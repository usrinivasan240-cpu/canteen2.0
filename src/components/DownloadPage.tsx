import React, { useEffect, useState } from 'react';
import {
  Download, Smartphone, Shield, Zap, Clock, QrCode,
  Star, ChevronLeft, ExternalLink, CheckCircle, Wifi, WifiOff
} from 'lucide-react';

interface DownloadPageProps {
  onBack?: () => void;
}

export default function DownloadPage({ onBack }: DownloadPageProps) {
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/EscQ-v2.3.1-arm64.apk';
    link.download = 'EscQ-v2.3.1-arm64.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadStarted(true);
  };

  const features = [
    { icon: <QrCode className="h-5 w-5" />, title: 'QR Ticket Pickup', desc: 'Show your unique QR at the counter' },
    { icon: <Zap className="h-5 w-5" />, title: 'Lightning Fast Orders', desc: 'Skip the queue, order in seconds' },
    { icon: <Clock className="h-5 w-5" />, title: 'Smart Time Slots', desc: 'Pick a pickup slot that suits you' },
    { icon: <Shield className="h-5 w-5" />, title: 'Secure UPI Payment', desc: 'Razorpay & UPI Dynamic QR' },
    { icon: <Star className="h-5 w-5" />, title: 'Live Reviews', desc: 'Rate food and see live sentiment' },
    { icon: <CheckCircle className="h-5 w-5" />, title: 'Real-Time Tracking', desc: 'Track order: Preparing → Ready' },
  ];

  const steps = [
    { num: '01', title: 'Download the APK', desc: 'Tap the download button below' },
    { num: '02', title: 'Install the App', desc: 'Allow installation from unknown sources' },
    { num: '03', title: 'Sign Up & Order', desc: 'Create account and start ordering' },
  ];

  return (
    <div className={`min-h-screen bg-gray-950 transition-all duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 via-gray-950 to-red-900/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[120px]" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-8">
          {/* Top nav */}
          <div className="flex items-center justify-between mb-10">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-medium transition-colors cursor-pointer group"
            >
              <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to Login
            </button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-600 flex items-center justify-center">
                <span className="text-white font-display font-bold text-xs">Esc(Q)</span>
              </div>
              <span className="text-xs font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">v2.3.1</span>
            </div>
          </div>

          {/* Hero content */}
          <div className="text-center max-w-2xl mx-auto">
            {/* Phone mockup placeholder */}
            <div className="relative inline-block mb-8">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-3xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-2xl shadow-amber-500/20 mx-auto">
                <span className="text-white font-display font-bold text-3xl sm:text-4xl tracking-tight">Esc(Q)</span>
              </div>
              <div className="absolute -top-2 -right-2 h-6 w-6 bg-green-500 rounded-full flex items-center justify-center">
                <div className="h-3 w-3 bg-white rounded-full" />
              </div>
              <div className="absolute -bottom-1 -left-1 h-6 w-6 bg-amber-500 rounded-full flex items-center justify-center animate-pulse">
                <Download className="h-3 w-3 text-white" />
              </div>
            </div>

            <h1 className="font-display font-black text-3xl sm:text-5xl text-white tracking-tight leading-tight mb-4">
              Download <span className="text-amber-400">Esc(Q)</span> App
            </h1>
            <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed mb-8">
              Your campus canteen, just a tap away. Order meals, skip the queue, and pay seamlessly with UPI.
            </p>

            {/* Download button */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleDownload}
                className="group relative overflow-hidden bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-2xl px-8 py-4 font-display font-bold text-sm sm:text-base transition-all shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                  <Download className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-normal opacity-80">Download APK</div>
                  <div className="text-sm font-bold">EscQ v2.3.1 (29 MB)</div>
                </div>
                <ExternalLink className="h-4 w-4 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>

              {downloadStarted && (
                <div className="flex items-center gap-2 text-green-400 text-xs font-medium animate-pulse">
                  <CheckCircle className="h-4 w-4" />
                  Download started! Check your notifications.
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-gray-500 mt-1">
                <a href="/EscQ-v2.3.1-arm32.apk" download className="underline hover:text-amber-400 transition-colors">Older phone (32-bit, 26 MB)</a>
                <span>•</span>
                <a href="/EscQ-v2.3.1.apk" download className="underline hover:text-amber-400 transition-colors">All devices (70 MB)</a>
              </div>

              <div className="flex items-center gap-4 text-[10px] text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  Android 5.0+
                </span>
                <span>•</span>
                  <span>~29 MB</span>
                <span>•</span>
                <span>Free</span>
              </div>
              <div className="text-[10px] text-gray-600 mt-2">
                Last updated: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features grid */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em]">Why Esc(Q)?</span>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-white mt-2">Everything You Need</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="group bg-gray-900/60 border border-gray-800/60 rounded-2xl p-5 hover:border-amber-500/30 hover:bg-gray-900/80 transition-all duration-300"
            >
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 group-hover:bg-amber-500/20 transition-colors">
                {f.icon}
              </div>
              <h3 className="font-display font-bold text-sm text-white mb-1">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Steps section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-12">
        <div className="text-center mb-10">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em]">Get Started</span>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-white mt-2">How to Install</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-display font-black text-amber-500/20 mb-3">{s.num}</div>
              <h3 className="font-display font-bold text-sm text-white mb-1">{s.title}</h3>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Offline note */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-gray-900/40 border border-gray-800/40 rounded-2xl p-6 flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
            <WifiOff className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-white mb-1">Works Offline Too</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Once installed, the app works in low-network areas. Menu data syncs automatically when connected.
              Perfect for campus environments with spotty connectivity.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-amber-600 flex items-center justify-center">
              <span className="text-white font-display font-bold text-[8px]">Esc(Q)</span>
            </div>
            <span className="text-xs text-gray-500">&copy; 2026 Esc(Q). All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-gray-600">
            <span className="flex items-center gap-1 font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
              Secure
            </span>
            <span>v2.3.1 • Android</span>
          </div>
        </div>
      </div>
    </div>
  );
}
