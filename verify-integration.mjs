/**
 * Verify data integration by checking the loaded data
 */

console.log('🧪 Verifying Data Integration...\n');

// Check if artifacts exist
import fs from 'fs';
import path from 'path';

const artifactsPath = './artifacts/clean_data';
const manifestPath = './artifacts/data_manifest.json';

// Check manifest
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log('✅ Manifest found:');
  console.log(`  - Generated: ${manifest.generated_at}`);
  console.log(`  - Files: ${Object.keys(manifest.files || {}).length}`);
  console.log(`  - Integrity: ${manifest.integrity_verified}`);
} else {
  console.log('❌ Manifest not found');
}

// Check clean data files
if (fs.existsSync(artifactsPath)) {
  const files = fs.readdirSync(artifactsPath);
  console.log(`\n✅ Clean data directory contains ${files.length} files`);
  
  // Check specific integration files
  const checkFiles = [
    'adp0_2025.csv',
    'adp2_2025.csv', // Has age and injury status
    'projections_2025.csv'
  ];
  
  checkFiles.forEach(file => {
    const filePath = path.join(artifactsPath, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      console.log(`  ✓ ${file}: ${lines.length} lines`);
      
      // Check for specific fields
      if (file === 'adp2_2025.csv' && lines.length > 0) {
        const headers = lines[0].split(',');
        console.log(`    Headers: ${headers.slice(0, 5).join(', ')}...`);
        const hasAge = headers.some(h => h.includes('Age'));
        const hasStatus = headers.some(h => h.includes('Status'));
        console.log(`    Age field: ${hasAge ? '✓' : '✗'}`);
        console.log(`    Status field: ${hasStatus ? '✓' : '✗'}`);
      }
    } else {
      console.log(`  ✗ ${file}: Not found`);
    }
  });
} else {
  console.log('❌ Clean data directory not found');
}

// Check team roster files
const rosterPath = './canonical_data/advanced_data/2025-2026';
if (fs.existsSync(rosterPath)) {
  const rosterFiles = fs.readdirSync(rosterPath).filter(f => f.endsWith('.csv'));
  console.log(`\n✅ Found ${rosterFiles.length} team roster files`);
  
  // Check sample roster file for fields
  if (rosterFiles.length > 0) {
    const sampleFile = path.join(rosterPath, rosterFiles[0]);
    const content = fs.readFileSync(sampleFile, 'utf-8');
    const lines = content.split('\n');
    if (lines.length > 0) {
      const headers = lines[0].split(',');
      console.log(`  Sample file (${rosterFiles[0]}) headers:`);
      const relevantHeaders = ['NAME', 'HEIGHT', 'WEIGHT', 'COLLEGE', 'YEAR', 'R#', 'D#', 'OFF_GRADE'];
      relevantHeaders.forEach(h => {
        const hasHeader = headers.some(header => header.includes(h));
        console.log(`    ${h}: ${hasHeader ? '✓' : '✗'}`);
      });
    }
  }
} else {
  console.log('❌ Roster data directory not found');
}

// Check SOS file
const sosFile = './canonical_data/strength_of_schedule/sos_2025.csv';
if (fs.existsSync(sosFile)) {
  const content = fs.readFileSync(sosFile, 'utf-8');
  const lines = content.split('\n');
  console.log(`\n✅ SOS file found: ${lines.length} lines`);
  if (lines.length > 0) {
    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
    console.log(`  Headers include: Season SOS: ${headers.includes('Season SOS') ? '✓' : '✗'}, Playoffs SOS: ${headers.includes('Playoffs SOS') ? '✓' : '✗'}`);
  }
} else {
  console.log('❌ SOS file not found');
}

console.log('\n📊 Integration Verification Complete!');