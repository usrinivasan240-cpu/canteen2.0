import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, X } from 'lucide-react';
import { API_BASE } from '../config';

const BUNDLED_VERSION = '1.1.0';

export default function UpdatePopup() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/app-version`);
        const data = await resp.json();
        if (data.version && data.version !== BUNDLED_VERSION) {
          setLatestVersion(data.version);
          setShowUpdate(true);
        }
      } catch (e) {
        // Silently fail - don't block the app
      } finally {
        setIsChecking(false);
      }
    };
    checkVersion();
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-900 to-blue-800 p-6 text-center text-white">
          <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <RefreshCw className="h-8 w-8 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <h2 className="font-display font-bold text-xl">Update Available</h2>
          <p className="text-white/80 text-xs mt-1">Version {latestVersion} is ready</p>
        </div>

        {/* Body */}
        <div className="p-6 text-center space-y-4">
          <p className="text-sm text-gray-600">
            A new version of <span className="font-bold text-orange-600">Violet Bites</span> is available with improvements and bug fixes.
          </p>
          <p className="text-xs text-gray-400">
            Please update to continue using the app.
          </p>

          <div className="flex flex-col gap-3 pt-2">
            <a
              href={`${API_BASE}/app-debug.apk`}
              download
              className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-3 text-sm font-semibold transition-all flex items-center justify-center space-x-2 shadow-md"
            >
              <Download className="h-4 w-4" />
              <span>Download Update</span>
            </a>
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl py-3 text-sm font-semibold transition-all"
            >
              Refresh App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
