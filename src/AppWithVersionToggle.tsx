import { useState } from 'react';
import { Beaker, Home } from 'lucide-react';
import AppCalibrated from './AppCalibrated';
import AppExperimental from './AppExperimental';

function AppWithVersionToggle() {
  const [isExperimental, setIsExperimental] = useState(true); // Default to experimental

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Version Toggle Button */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsExperimental(!isExperimental)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300
            ${isExperimental 
              ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-600/20' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }
          `}
        >
          {isExperimental ? (
            <>
              <Beaker className="w-4 h-4" />
              <span>Experimental</span>
            </>
          ) : (
            <>
              <Home className="w-4 h-4" />
              <span>Stable</span>
            </>
          )}
        </button>
      </div>

      {/* Version Indicator Badge */}
      {isExperimental && (
        <div className="fixed top-4 left-4 z-50">
          <div className="bg-purple-600/10 border border-purple-600/30 text-purple-400 px-3 py-1 rounded-full text-sm font-medium">
            🧪 Experimental Mode
          </div>
        </div>
      )}

      {/* App Content */}
      <div className="transition-opacity duration-300">
        {isExperimental ? <AppExperimental /> : <AppCalibrated />}
      </div>
    </div>
  );
}

export default AppWithVersionToggle;