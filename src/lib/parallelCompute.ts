import type { PlayerProjection } from '@/types';

interface ComputeTask {
  id: string;
  type: 'monte_carlo' | 'vorp' | 'optimization' | 'bayesian';
  data: any;
  priority: number;
}

interface ComputeResult {
  taskId: string;
  result: any;
  computeTime: number;
  workerId: number;
}

export class ParallelCompute {
  private workers: Worker[] = [];
  private taskQueue: ComputeTask[] = [];
  private activeWorkers: Map<number, ComputeTask> = new Map();
  private results: Map<string, ComputeResult> = new Map();
  private workerPool: number;
  
  constructor(workerPool?: number) {
    this.workerPool = workerPool || navigator.hardwareConcurrency || 4;
    this.initializeWorkers();
  }
  
  private initializeWorkers(): void {
    for (let i = 0; i < this.workerPool; i++) {
      const worker = new Worker(
        new URL('./workers/compute.worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      worker.onmessage = (e) => this.handleWorkerMessage(i, e);
      worker.onerror = (e) => this.handleWorkerError(i, e);
      
      this.workers.push(worker);
    }
  }
  
  async execute<T>(
    type: ComputeTask['type'],
    data: any,
    priority: number = 0
  ): Promise<T> {
    const taskId = this.generateTaskId();
    const task: ComputeTask = { id: taskId, type, data, priority };
    
    return new Promise((resolve, reject) => {
      // Add callback for when result is ready
      const checkResult = setInterval(() => {
        const result = this.results.get(taskId);
        if (result) {
          clearInterval(checkResult);
          this.results.delete(taskId);
          resolve(result.result as T);
        }
      }, 100);
      
      // Add task to queue
      this.enqueueTask(task);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkResult);
        reject(new Error(`Task ${taskId} timed out`));
      }, 30000);
    });
  }
  
  private enqueueTask(task: ComputeTask): void {
    // Insert task based on priority
    const insertIndex = this.taskQueue.findIndex(t => t.priority < task.priority);
    if (insertIndex === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(insertIndex, 0, task);
    }
    
    this.processQueue();
  }
  
  private processQueue(): void {
    // Find available workers
    for (let i = 0; i < this.workers.length; i++) {
      if (!this.activeWorkers.has(i) && this.taskQueue.length > 0) {
        const task = this.taskQueue.shift()!;
        this.assignTaskToWorker(i, task);
      }
    }
  }
  
  private assignTaskToWorker(workerId: number, task: ComputeTask): void {
    this.activeWorkers.set(workerId, task);
    const startTime = performance.now();
    
    this.workers[workerId].postMessage({
      taskId: task.id,
      type: task.type,
      data: task.data,
      startTime
    });
  }
  
  private handleWorkerMessage(workerId: number, e: MessageEvent): void {
    const { taskId, result, error, computeTime } = e.data;
    
    if (error) {
      console.error(`Worker ${workerId} error:`, error);
      // Retry task
      const task = this.activeWorkers.get(workerId);
      if (task) {
        this.enqueueTask(task);
      }
    } else {
      this.results.set(taskId, {
        taskId,
        result,
        computeTime,
        workerId
      });
    }
    
    // Mark worker as available
    this.activeWorkers.delete(workerId);
    
    // Process next task
    this.processQueue();
  }
  
  private handleWorkerError(workerId: number, e: ErrorEvent): void {
    console.error(`Worker ${workerId} crashed:`, e);
    
    // Restart worker
    this.workers[workerId].terminate();
    const newWorker = new Worker(
      new URL('./workers/compute.worker.ts', import.meta.url),
      { type: 'module' }
    );
    newWorker.onmessage = (e) => this.handleWorkerMessage(workerId, e);
    newWorker.onerror = (e) => this.handleWorkerError(workerId, e);
    this.workers[workerId] = newWorker;
    
    // Retry task if any
    const task = this.activeWorkers.get(workerId);
    if (task) {
      this.activeWorkers.delete(workerId);
      this.enqueueTask(task);
    }
  }
  
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Batch processing methods
  async batchProcess<T>(
    type: ComputeTask['type'],
    items: any[],
    batchSize?: number
  ): Promise<T[]> {
    const actualBatchSize = batchSize || Math.ceil(items.length / this.workerPool);
    const batches: any[][] = [];
    
    for (let i = 0; i < items.length; i += actualBatchSize) {
      batches.push(items.slice(i, i + actualBatchSize));
    }
    
    const promises = batches.map((batch, index) =>
      this.execute<T[]>(type, batch, index)
    );
    
    const results = await Promise.all(promises);
    return results.flat() as T[];
  }
  
  // Specific compute methods
  async parallelMonteCarlo(
    players: PlayerProjection[],
    iterations: number
  ): Promise<Map<string, any>> {
    const batches = this.createPlayerBatches(players);
    const results = await this.batchProcess<[string, any][]>(
      'monte_carlo',
      batches.map(batch => ({ players: batch, iterations }))
    );
    
    return new Map(results.flat());
  }
  
  async parallelVORP(
    players: PlayerProjection[],
    replacementLevels: Map<string, number>
  ): Promise<Map<string, number>> {
    const batches = this.createPlayerBatches(players);
    const results = await this.batchProcess<[string, number][]>(
      'vorp',
      batches.map(batch => ({ 
        players: batch, 
        replacementLevels: Array.from(replacementLevels.entries())
      }))
    );
    
    return new Map(results.flat());
  }
  
  private createPlayerBatches(
    players: PlayerProjection[],
    batchSize?: number
  ): PlayerProjection[][] {
    const size = batchSize || Math.ceil(players.length / this.workerPool);
    const batches: PlayerProjection[][] = [];
    
    for (let i = 0; i < players.length; i += size) {
      batches.push(players.slice(i, i + size));
    }
    
    return batches;
  }
  
  // Performance monitoring
  getPerformanceStats(): {
    activeWorkers: number;
    queueLength: number;
    totalProcessed: number;
    averageComputeTime: number;
  } {
    const processedResults = Array.from(this.results.values());
    const avgTime = processedResults.length > 0
      ? processedResults.reduce((sum, r) => sum + r.computeTime, 0) / processedResults.length
      : 0;
    
    return {
      activeWorkers: this.activeWorkers.size,
      queueLength: this.taskQueue.length,
      totalProcessed: processedResults.length,
      averageComputeTime: avgTime
    };
  }
  
  terminate(): void {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers.clear();
    this.results.clear();
  }
}