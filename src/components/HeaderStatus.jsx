import React, { useState, useEffect } from 'react';

export default function HeaderStatus({ apiKey, onApiKeyChange }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="w-full bg-neutral-950 border-b border-neutral-800/80 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      {/* Brand & Status */}
      <div className="flex items-center justify-between sm:justify-start gap-4">
        <div className="flex items-center gap-2.5">
          <span className="bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1 rounded-lg text-sm font-bold tracking-wider uppercase text-white shadow-lg shadow-violet-900/30">
            KasQ
          </span>
          <span className="text-neutral-700 font-light text-base hidden xs:inline">|</span>
          <span className="text-sm font-semibold text-neutral-300 hidden xs:inline tracking-wide">UMKM POS AI</span>
        </div>

        {/* Network Status Badge */}
        <div className="flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 px-3 py-1.5 rounded-full">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`} />
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isOnline ? 'Online - AI' : 'Offline - Lokal'}
          </span>
        </div>
      </div>

      {/* API Key Controller */}
      <div className="flex items-center gap-3">
        {showKeyInput ? (
          <div className="flex items-center gap-2 bg-neutral-900/50 border border-neutral-800 rounded-lg px-2.5 py-1.5 shadow-inner w-full sm:w-auto">
            <input
              type="password"
              placeholder="Masukkan Gemini API Key..."
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              className="bg-transparent text-xs text-neutral-200 outline-none w-44 xs:w-56 placeholder-neutral-600"
            />
            <button
              onClick={() => setShowKeyInput(false)}
              className="text-[10px] bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white font-bold px-2 py-1 rounded transition-all cursor-pointer"
            >
              Simpan
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowKeyInput(true)}
            className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-neutral-200 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800/80 px-3.5 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
          >
            <span>{apiKey ? '🔑 API Key Aktif' : '🔑 Setup API Key'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
