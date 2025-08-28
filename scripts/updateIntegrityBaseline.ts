#!/usr/bin/env tsx

/**
 * Update Integrity Baseline to Include All Files
 * This updates the baseline to track all 123 files (CSV + TXT)
 */

import { integrityChecker } from '../validation/integrityChecker';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';

const CANONICAL_DATA_PATH = '/mnt/c/Users/giraf/Documents/projects/fftool/canonical_data';
const REPORTS_PATH = '/mnt/c/Users/giraf/Documents/projects/fftool/reports';

function computeFileHash(filepath: string): string {
  const fileBuffer = readFileSync(filepath);
  const hashSum = createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function scanAllFiles(dirPath: string, baseDir: string = CANONICAL_DATA_PATH): any[] {
  const files: any[] = [];
  
  const items = readdirSync(dirPath, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = join(dirPath, item.name);
    
    if (item.isDirectory()) {
      // Recursively scan subdirectories
      files.push(...scanAllFiles(fullPath, baseDir));
    } else if (item.isFile() && (item.name.endsWith('.csv') || item.name.endsWith('.txt'))) {
      const stat = statSync(fullPath);
      const relativePath = relative(baseDir, fullPath).replace(/\\/g, '/');
      const category = relativePath.split('/')[0] || 'root';
      
      files.push({
        path: fullPath,
        relativePath,
        sha256: computeFileHash(fullPath),
        sizeBytes: stat.size,
        lastModifiedMs: stat.mtimeMs,
        category,
        fileType: item.name.endsWith('.csv') ? 'csv' : 'txt'
      });
    }
  }
  
  return files;
}

async function main() {
  console.log('='*60);
  console.log('UPDATING INTEGRITY BASELINE TO INCLUDE ALL FILES');
  console.log('='*60);
  
  // Scan all files (CSV and TXT)
  console.log('Scanning canonical_data for all files...');
  const allFiles = scanAllFiles(CANONICAL_DATA_PATH);
  
  // Sort files by path for consistent ordering
  allFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  
  // Count by type
  const csvCount = allFiles.filter(f => f.fileType === 'csv').length;
  const txtCount = allFiles.filter(f => f.fileType === 'txt').length;
  
  console.log(`Found ${allFiles.length} total files:`);
  console.log(`  - CSV files: ${csvCount}`);
  console.log(`  - TXT files: ${txtCount}`);
  
  // Calculate summary statistics
  const byCategory: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let totalSizeBytes = 0;
  
  for (const file of allFiles) {
    byCategory[file.category] = (byCategory[file.category] || 0) + 1;
    byType[file.fileType] = (byType[file.fileType] || 0) + 1;
    totalSizeBytes += file.sizeBytes;
  }
  
  // Create new integrity report
  const newReport = {
    version: '2.0.0', // Version 2 includes TXT files
    generatedAt: new Date().toISOString(),
    canonicalDataPath: CANONICAL_DATA_PATH,
    totalFiles: allFiles.length,
    csvFiles: csvCount,
    txtFiles: txtCount,
    totalSizeBytes,
    files: allFiles,
    summary: {
      byCategory,
      byType
    }
  };
  
  // Save the updated baseline
  const baselinePath = join(REPORTS_PATH, 'canonical_data_integrity.json');
  writeFileSync(baselinePath, JSON.stringify(newReport, null, 2));
  
  console.log('\n✅ Integrity baseline updated successfully!');
  console.log(`📁 Baseline saved to: ${baselinePath}`);
  console.log('\nSummary by category:');
  for (const [category, count] of Object.entries(byCategory)) {
    console.log(`  ${category}: ${count} files`);
  }
  console.log(`\nTotal size: ${(totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log('\nThe integrity baseline now tracks all 123 files.');
}

main().catch(console.error);