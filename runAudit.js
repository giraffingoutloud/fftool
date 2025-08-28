// Script to run the zero-tolerance audit
// Run this in the browser console after the app loads

async function runAudit() {
  console.log('Starting zero-tolerance CSV audit...');
  console.log('This will check all CSV files for:');
  console.log('- Header mismatches');
  console.log('- Inconsistent columns per row');
  console.log('- Invalid data types (no coercion)');
  console.log('- Missing required fields');
  console.log('- Duplicate primary keys');
  console.log('- Broken foreign keys');
  console.log('');
  
  if (typeof window.auditCSV !== 'function') {
    console.error('Audit function not loaded. Make sure the app is running.');
    return;
  }
  
  const report = await window.auditCSV();
  
  // The audit function already logs the full JSON
  // Just return the report for further processing
  return report;
}

// Instructions
console.log('Zero-tolerance CSV audit ready.');
console.log('Run: await runAudit()');
console.log('Or directly: await window.auditCSV()');