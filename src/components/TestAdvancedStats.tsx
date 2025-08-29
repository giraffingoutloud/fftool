import { useEffect, useState } from 'react';

export function TestAdvancedStats() {
  const [testResults, setTestResults] = useState<any>({});
  
  useEffect(() => {
    const testFetch = async () => {
      const basePath = import.meta.env?.BASE_URL || '/';
      const testUrl = `${basePath}artifacts/clean_data/FantasyPros_Fantasy_Football_Advanced_Stats_Report_WR.csv`;
      
      console.log('[TestAdvancedStats] Testing fetch from:', testUrl);
      
      try {
        const response = await fetch(testUrl);
        const text = await response.text();
        
        setTestResults({
          url: testUrl,
          status: response.status,
          ok: response.ok,
          contentLength: text.length,
          firstLine: text.split('\n')[0],
          secondLine: text.split('\n')[1]
        });
        
        console.log('[TestAdvancedStats] Fetch result:', {
          status: response.status,
          contentLength: text.length,
          firstChars: text.substring(0, 100)
        });
      } catch (error) {
        console.error('[TestAdvancedStats] Fetch error:', error);
        setTestResults({
          error: String(error)
        });
      }
    };
    
    testFetch();
  }, []);
  
  return (
    <div className="fixed top-4 right-4 bg-blue-900 text-white p-4 rounded-lg shadow-lg max-w-md z-50">
      <h3 className="font-bold mb-2">Advanced Stats Fetch Test</h3>
      <pre className="text-xs">{JSON.stringify(testResults, null, 2)}</pre>
    </div>
  );
}