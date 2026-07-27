/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { QrCode, Scan, Camera, Sparkles, Check, HelpCircle } from 'lucide-react';

interface QRScannerSimProps {
  onScanSuccess: (canteenId: string, tableName: string) => void;
}

export default function QRScannerSim({ onScanSuccess }: QRScannerSimProps) {
  const [useCamera, setUseCamera] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [scannedTable, setScannedTable] = useState('');

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  React.useEffect(() => {
    let activeStream: MediaStream | null = null;
    if (useCamera) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          activeStream = stream;
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Camera access failed", err);
          alert("Could not access camera stream. Please guarantee permissions or close any other apps utilizing the webcam.");
          setUseCamera(false);
        });
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [useCamera]);

  const handleSimulateScan = (tableId: string, tableName: string) => {
    if (scanning) return;
    setScanning(true);
    setScannedTable(tableName);

    // Audio beep simulation
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // high pitched beep
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      osc.start();
      setTimeout(() => {
        osc.stop();
        audioCtx.close();
      }, 100);
    } catch (e) {
      // Audio context may be blocked initially, ignore
    }

    setTimeout(() => {
      setScanning(false);
      setSuccess(true);
      setTimeout(() => {
        onScanSuccess('canteen_001', tableName);
        setSuccess(false);
      }, 900);
    }, 1200);
  };

  return (
    <div className="bg-white border border-lavender-150 rounded-2xl p-6 shadow-md shadow-lavender-100/50">
      <div className="flex items-center justify-between mb-4 border-b border-lavender-50 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-lavender-100/75 text-lavender-800">
            <QrCode className="h-5 w-5" />
          </div>
          <h3 className="font-display font-bold text-base text-gray-900">Virtual Canteen QR Scanner</h3>
        </div>
        <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setUseCamera(false)}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${
              !useCamera ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Virtual Tags
          </button>
          <button
            onClick={() => setUseCamera(true)}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${
              useCamera ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Live Camera
          </button>
        </div>
      </div>

      {!useCamera ? (
        <div>
          <p className="text-xs text-gray-500 mb-4 font-sans leading-relaxed">
            In modern canteens, each table is stickered with a custom QR code. Simulate scanning a table QR code below to inspect the live menu!
          </p>

          {/* Table Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { id: 'T3', name: 'Table 03 (Window Pane)', desc: 'Near garden windows' },
              { id: 'T5', name: 'Table 05 (Center Hall)', desc: 'Main premium booth' },
              { id: 'T8', name: 'Table 08 (Outdoor Patio)', desc: 'Open air canopy' },
              { id: 'Q1', name: 'Express Wall Counter', desc: 'Pre-lecture express bar' },
            ].map((table) => (
              <button
                key={table.id}
                onClick={() => handleSimulateScan(table.id, table.name)}
                disabled={scanning || success}
                className={`relative group text-left border p-3 rounded-xl transition-all ${
                  scanning && scannedTable === table.name
                    ? 'border-lavender-500 bg-lavender-50/50 ring-2 ring-lavender-100'
                    : 'border-lavender-100 hover:border-lavender-300 hover:bg-lavender-50/20 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block px-1.5 py-0.5 text-[9px] font-mono bg-lavender-100 text-lavender-750 font-bold rounded mb-1">
                      {table.id}
                    </span>
                    <h4 className="font-display font-semibold text-xs text-gray-900 group-hover:text-lavender-700 transition-colors">
                      {table.name}
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-sans">{table.desc}</p>
                  </div>
                  <div className="h-7 w-7 rounded-lg bg-gray-50 text-gray-400 group-hover:text-lavender-650 flex items-center justify-center border border-dashed border-gray-200 group-hover:border-lavender-300 transition-all">
                    {scanning && scannedTable === table.name ? (
                      <div className="w-3.5 h-3.5 border-2 border-lavender-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Scan className="h-3.5 w-3.5 animate-pulse" />
                    )}
                  </div>
                </div>

                {success && scannedTable === table.name && (
                  <div className="absolute inset-0 bg-lavender-400/95 text-white rounded-xl flex items-center justify-center space-x-1.5 animate-fade-in">
                    <Check className="h-4 w-4 stroke-[3]" />
                    <span className="text-xs font-bold font-display">Linked to Menu!</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-lavender-200 bg-gray-950 aspect-video flex flex-col items-center justify-center p-4">
          {/* Real video webcam stream tag */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Guide boxes */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-12 z-10">
            <div className="relative w-36 h-36 border-2 border-lavender-400/85 rounded-2xl flex items-center justify-center shadow-lg shadow-lavender-500/10">
              {/* Laser line simulator */}
              <div className="absolute left-0 right-0 h-0.5 bg-lavender-400/90 top-1/2 -translate-y-1/2 animate-bounce" />
              <p className="absolute -bottom-8 text-[9px] font-mono text-center text-lavender-200 tracking-wide">
                PLACE TABLE QR IN GRID
              </p>
            </div>
          </div>

          <div className="text-center z-12 px-6 bg-slate-950/70 p-3 rounded-xl backdrop-blur-3xs max-w-[85%]">
            <Camera className="h-6 w-6 text-lavender-300 mx-auto opacity-75 mb-1 animate-pulse" />
            <h4 className="font-display font-medium text-xs text-white">Live Video Feed Active</h4>
            <p className="text-[9px] text-gray-300 max-w-xs mx-auto">
              Webcam preview is stream-synchronized. Align any QR, or click below to manually authenticate.
            </p>

            <button
              id="camera-scan-trigger"
              onClick={() => handleSimulateScan('T3', 'Table 03 Live QR')}
              disabled={scanning || success}
              className="mt-3.5 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold shadow-xs transition-all font-display cursor-pointer"
            >
              <Scan className="h-3 w-3" />
              <span>Force Table Sync</span>
            </button>
          </div>

          {success && (
            <div className="absolute inset-0 bg-lavender-650/95 text-white flex flex-col items-center justify-center space-y-1.5 z-20">
              <Check className="h-8 w-8 stroke-[3]" />
              <p className="font-display font-bold text-sm">Table Link Authenticated</p>
              <span className="text-[10px] font-mono text-lavender-200">Table 03 Linked successfully</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
