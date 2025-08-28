#!/usr/bin/env tsx

/**
 * Detect New Files Not in Integrity Baseline
 * Automatically identifies new data files added to canonical_data
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';

const CANONICAL_DATA_PATH = '/mnt/c/Users/giraf/Documents/projects/fftool/canonical_data';
const BASELINE_PATH = '/mnt/c/Users/giraf/Documents/projects/fftool/reports/canonical_data_integrity.json';

interface BaselineFile {
  relativePath: string;
  sha256: string;
}

interface NewFileInfo {
  path: string;
  relativePath: string;
  size: number;
  modified: Date;
  extension: string;
  category: string;
  sha256: string;
}

function scanForDataFiles(dirPath: string, baseDir: string = CANONICAL_DATA_PATH): string[] {
  const files: string[] = [];
  
  const items = readdirSync(dirPath, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = join(dirPath, item.name);
    
    if (item.isDirectory()) {
      files.push(...scanForDataFiles(fullPath, baseDir));
    } else if (item.isFile() && (item.name.endsWith('.csv') || item.name.endsWith('.txt'))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function computeFileHash(filepath: string): string {
  const fileBuffer = readFileSync(filepath);
  const hashSum = createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function categorizeFile(relativePath: string): string {
  const parts = relativePath.split('/');
  if (parts.length > 0) {
    return parts[0];
  }
  return 'uncategorized';
}

async function detectNewFiles(): Promise<NewFileInfo[]> {
  console.log('='.repeat(60));
  console.log('NEW FILE DETECTION');
  console.log('='.repeat(60));
  console.log('');
  
  // Load baseline
  if (!existsSync(BASELINE_PATH)) {
    console.error('❌ No baseline found! Run: npm run integrity:baseline');
    process.exit(1);
  }
  
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
  const baselineFiles = new Set(baseline.files.map((f: BaselineFile) => f.relativePath));
  
  console.log(`📊 Baseline contains ${baselineFiles.size} files`);
  console.log(`📊 Baseline date: ${baseline.generatedAt}`);
  console.log('');
  
  // Scan current files
  console.log('Scanning canonical_data for files...');
  const currentFiles = scanForDataFiles(CANONICAL_DATA_PATH);
  console.log(`Found ${currentFiles.length} data files`);
  console.log('');
  
  // Find new files
  const newFiles: NewFileInfo[] = [];
  
  for (const filePath of currentFiles) {
    const relativePath = relative(CANONICAL_DATA_PATH, filePath).replace(/\\/g, '/');
    
    if (!baselineFiles.has(relativePath)) {
      const stat = statSync(filePath);
      const extension = filePath.split('.').pop() || '';
      
      newFiles.push({
        path: filePath,
        relativePath,
        size: stat.size,
        modified: stat.mtime,
        extension,
        category: categorizeFile(relativePath),
        sha256: computeFileHash(filePath)
      });
    }
  }
  
  // Report findings
  if (newFiles.length === 0) {
    console.log('✅ No new files detected');
    console.log('All files are tracked in the baseline');
  } else {
    console.log(`🆕 Found ${newFiles.length} new file(s):`);
    console.log('');
    
    // Group by category
    const byCategory: Record<string, NewFileInfo[]> = {};
    for (const file of newFiles) {
      if (!byCategory[file.category]) {
        byCategory[file.category] = [];
      }
      byCategory[file.category].push(file);
    }
    
    // Display by category
    for (const [category, files] of Object.entries(byCategory)) {
      console.log(`📁 ${category}/`);
      for (const file of files) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        console.log(`   - ${file.relativePath}`);
        console.log(`     Size: ${sizeMB} MB | Modified: ${file.modified.toISOString()}`);
        console.log(`     SHA256: ${file.sha256}`);
      }
      console.log('');
    }
    
    console.log('🔄 Next Steps:');
    console.log('1. Review the new files above');
    console.log('2. If they should be tracked, run: npm run integrity:update');
    console.log('3. If they are temporary, consider moving them out of canonical_data');
    console.log('');
    
    // Write detection report
    const reportPath = '/mnt/c/Users/giraf/Documents/projects/fftool/reports/new_files_detected.json';
    const report = {
      detectedAt: new Date().toISOString(),
      baselineDate: baseline.generatedAt,
      newFilesCount: newFiles.length,
      files: newFiles,
      byCategory: Object.fromEntries(
        Object.entries(byCategory).map(([cat, files]) => [cat, files.length])
      )
    };
    
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detection report saved to: ${reportPath}`);
  }
  
  // Also check for deleted files
  const currentSet = new Set(currentFiles.map(f => relative(CANONICAL_DATA_PATH, f).replace(/\\/g, '/')));
  const deletedFiles = Array.from(baselineFiles).filter(f => !currentSet.has(f));
  
  if (deletedFiles.length > 0) {
    console.log('');
    console.log(`⚠️  Warning: ${deletedFiles.length} file(s) in baseline are missing:`);
    for (const file of deletedFiles) {
      console.log(`   - ${file}`);
    }
    console.log('');
    console.log('This violates the immutability constraint!');
  }
  
  return newFiles;
}

// Export for use in other scripts
export { detectNewFiles, NewFileInfo };

// Run if called directly
detectNewFiles().catch(console.error);