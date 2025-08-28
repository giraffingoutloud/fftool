/**
 * Canonical Data Integrity Checker
 * 
 * HARD CONSTRAINTS:
 * 1. Treat canonical_data as immutable and read-only
 * 2. Never modify, write, move, rename, or delete any file under canonical_data
 * 3. All data cleaning must be done via parsing and transformation logic
 * 4. Verify integrity before and after pipeline execution
 * 5. Fail pipeline if any hash changes
 */

import { createHash } from 'crypto';
import { readFileSync, statSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

interface FileIntegrityRecord {
  path: string;
  relativePath: string;
  sha256: string;
  sizeBytes: number;
  lastModifiedMs: number;
  category: string;
}

interface IntegrityReport {
  version: string;
  generatedAt: string;
  canonicalDataPath: string;
  totalFiles: number;
  totalSizeBytes: number;
  files: FileIntegrityRecord[];
  summary: {
    byCategory: Record<string, number>;
    byExtension: Record<string, number>;
  };
}

interface IntegrityCheckResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  changedFiles: string[];
  missingFiles: string[];
  newFiles: string[];
}

export class CanonicalDataIntegrityChecker {
  private readonly CANONICAL_DATA_PATH = '/mnt/c/Users/giraf/Documents/projects/fftool/canonical_data';
  private readonly REPORTS_PATH = '/mnt/c/Users/giraf/Documents/projects/fftool/reports';
  private readonly BASELINE_REPORT_PATH = join(this.REPORTS_PATH, 'canonical_data_integrity.json');
  private readonly INTEGRITY_LOG_PATH = join(this.REPORTS_PATH, 'integrity_check_log.json');

  /**
   * Compute SHA256 hash of a file
   */
  private computeFileHash(filePath: string): string {
    const fileBuffer = readFileSync(filePath);
    const hashSum = createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Recursively scan directory for all CSV and TXT files
   */
  private scanDirectory(dirPath: string, baseDir: string = this.CANONICAL_DATA_PATH): FileIntegrityRecord[] {
    const records: FileIntegrityRecord[] = [];
    
    const items = readdirSync(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = join(dirPath, item.name);
      
      if (item.isDirectory()) {
        // Recursively scan subdirectories
        records.push(...this.scanDirectory(fullPath, baseDir));
      } else if (item.isFile() && (item.name.endsWith('.csv') || item.name.endsWith('.txt'))) {
        const stat = statSync(fullPath);
        const relativePath = relative(baseDir, fullPath);
        const category = this.categorizeFile(relativePath);
        
        records.push({
          path: fullPath,
          relativePath,
          sha256: this.computeFileHash(fullPath),
          sizeBytes: stat.size,
          lastModifiedMs: stat.mtimeMs,
          category
        });
      }
    }
    
    return records;
  }

  /**
   * Categorize file based on its path
   */
  private categorizeFile(relativePath: string): string {
    const parts = relativePath.split('/');
    if (parts.length > 0) {
      return parts[0];
    }
    return 'uncategorized';
  }

  /**
   * Generate integrity report for canonical_data
   */
  public generateIntegrityReport(): IntegrityReport {
    console.log('Generating integrity report for canonical_data...');
    
    const files = this.scanDirectory(this.CANONICAL_DATA_PATH);
    
    // Sort files by path for consistent ordering
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    
    // Calculate summary statistics
    const byCategory: Record<string, number> = {};
    const byExtension: Record<string, number> = {};
    let totalSizeBytes = 0;
    
    for (const file of files) {
      // Category summary
      byCategory[file.category] = (byCategory[file.category] || 0) + 1;
      
      // Extension summary
      const ext = file.relativePath.split('.').pop() || 'unknown';
      byExtension[ext] = (byExtension[ext] || 0) + 1;
      
      // Total size
      totalSizeBytes += file.sizeBytes;
    }
    
    const report: IntegrityReport = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      canonicalDataPath: this.CANONICAL_DATA_PATH,
      totalFiles: files.length,
      totalSizeBytes,
      files,
      summary: {
        byCategory,
        byExtension
      }
    };
    
    return report;
  }

  /**
   * Save integrity report to JSON file
   */
  public saveIntegrityReport(report: IntegrityReport, filePath?: string): void {
    const targetPath = filePath || this.BASELINE_REPORT_PATH;
    const jsonContent = JSON.stringify(report, null, 2);
    writeFileSync(targetPath, jsonContent);
    console.log(`Integrity report saved to: ${targetPath}`);
  }

  /**
   * Load existing integrity report
   */
  public loadIntegrityReport(filePath?: string): IntegrityReport | null {
    const targetPath = filePath || this.BASELINE_REPORT_PATH;
    
    if (!existsSync(targetPath)) {
      console.warn(`No existing integrity report found at: ${targetPath}`);
      return null;
    }
    
    const content = readFileSync(targetPath, 'utf-8');
    return JSON.parse(content) as IntegrityReport;
  }

  /**
   * Verify current state against baseline integrity report
   */
  public verifyIntegrity(baselineReport?: IntegrityReport): IntegrityCheckResult {
    // Load baseline if not provided
    const baseline = baselineReport || this.loadIntegrityReport();
    
    if (!baseline) {
      return {
        isValid: false,
        errors: ['No baseline integrity report found. Run generateBaseline() first.'],
        warnings: [],
        changedFiles: [],
        missingFiles: [],
        newFiles: []
      };
    }
    
    // Generate current state
    const currentReport = this.generateIntegrityReport();
    
    // Create maps for efficient lookup
    const baselineMap = new Map(baseline.files.map(f => [f.relativePath, f]));
    const currentMap = new Map(currentReport.files.map(f => [f.relativePath, f]));
    
    const errors: string[] = [];
    const warnings: string[] = [];
    const changedFiles: string[] = [];
    const missingFiles: string[] = [];
    const newFiles: string[] = [];
    
    // Check for missing or changed files
    for (const [path, baselineFile] of baselineMap) {
      const currentFile = currentMap.get(path);
      
      if (!currentFile) {
        missingFiles.push(path);
        errors.push(`MISSING FILE: ${path}`);
      } else if (currentFile.sha256 !== baselineFile.sha256) {
        changedFiles.push(path);
        errors.push(`MODIFIED FILE: ${path} (hash mismatch)`);
      } else if (currentFile.sizeBytes !== baselineFile.sizeBytes) {
        warnings.push(`SIZE CHANGED: ${path} (${baselineFile.sizeBytes} -> ${currentFile.sizeBytes} bytes)`);
      }
    }
    
    // Check for new files
    for (const [path, currentFile] of currentMap) {
      if (!baselineMap.has(path)) {
        newFiles.push(path);
        warnings.push(`NEW FILE: ${path}`);
      }
    }
    
    const isValid = errors.length === 0;
    
    // Log results
    this.logIntegrityCheck({
      timestamp: new Date().toISOString(),
      isValid,
      errors,
      warnings,
      changedFiles,
      missingFiles,
      newFiles,
      baselineGeneratedAt: baseline.generatedAt,
      currentGeneratedAt: currentReport.generatedAt
    });
    
    return {
      isValid,
      errors,
      warnings,
      changedFiles,
      missingFiles,
      newFiles
    };
  }

  /**
   * Log integrity check results
   */
  private logIntegrityCheck(result: any): void {
    let log = [];
    
    if (existsSync(this.INTEGRITY_LOG_PATH)) {
      const existing = readFileSync(this.INTEGRITY_LOG_PATH, 'utf-8');
      log = JSON.parse(existing);
    }
    
    log.push(result);
    
    // Keep only last 100 checks
    if (log.length > 100) {
      log = log.slice(-100);
    }
    
    writeFileSync(this.INTEGRITY_LOG_PATH, JSON.stringify(log, null, 2));
  }

  /**
   * Generate baseline integrity report (run this once initially)
   */
  public generateBaseline(): IntegrityReport {
    console.log('Generating baseline integrity report...');
    const report = this.generateIntegrityReport();
    this.saveIntegrityReport(report);
    console.log(`Baseline created with ${report.totalFiles} files, ${report.totalSizeBytes} bytes`);
    return report;
  }

  /**
   * Verify integrity and fail if compromised (for pipeline use)
   */
  public verifyOrFail(): void {
    const result = this.verifyIntegrity();
    
    if (!result.isValid) {
      console.error('❌ INTEGRITY CHECK FAILED');
      console.error('Errors:', result.errors);
      console.error('Changed files:', result.changedFiles);
      console.error('Missing files:', result.missingFiles);
      throw new Error('Canonical data integrity compromised. Pipeline halted.');
    }
    
    if (result.warnings.length > 0) {
      console.warn('⚠️ Integrity warnings:', result.warnings);
    }
    
    console.log('✅ Integrity check passed');
  }

  /**
   * Get integrity status summary
   */
  public getIntegrityStatus(): {
    hasBaseline: boolean;
    baselineDate: string | null;
    isValid: boolean;
    lastCheckDate: string | null;
  } {
    const baseline = this.loadIntegrityReport();
    const hasBaseline = baseline !== null;
    const baselineDate = baseline?.generatedAt || null;
    
    let lastCheck = null;
    let isValid = false;
    
    if (existsSync(this.INTEGRITY_LOG_PATH)) {
      const log = JSON.parse(readFileSync(this.INTEGRITY_LOG_PATH, 'utf-8'));
      if (log.length > 0) {
        const last = log[log.length - 1];
        lastCheck = last.timestamp;
        isValid = last.isValid;
      }
    }
    
    return {
      hasBaseline,
      baselineDate,
      isValid,
      lastCheckDate: lastCheck
    };
  }
}

// Export singleton instance
export const integrityChecker = new CanonicalDataIntegrityChecker();