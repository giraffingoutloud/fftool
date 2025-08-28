/**
 * Execute the zero-tolerance audit immediately and log results
 */

import { fullZeroToleranceAudit } from './fullZeroToleranceAudit';

export async function executeAudit() {
  const report = await fullZeroToleranceAudit();
  
  // Log the complete JSON report
  console.log('AUDIT REPORT:');
  console.log(JSON.stringify(report, null, 2));
  
  // Also save to window for access
  if (typeof window !== 'undefined') {
    (window as any).lastAuditReport = report;
  }
  
  return report;
}

// Auto-execute on load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    executeAudit().then(report => {
      console.log(`Audit complete: ${report.summary.files_checked} files checked, ${report.summary.total_errors} errors found`);
    });
  }, 1000);
}