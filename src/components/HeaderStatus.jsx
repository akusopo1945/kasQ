import React, { useState, useEffect } from 'react';

export default function HeaderStatus({
  theme,
  onToggleTheme,
  currentUser,
  onLogout,
  onOpenSettings
}) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Profile & Controls */}
      {currentUser && (
        <div className="flex items-center justify-between sm:justify-end gap-4 border-t border-neutral-900 pt-3 sm:pt-0 sm:border-0">
          {/* User Profile */}
          <div 
            onClick={onOpenSettings}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition group"
            title="Buka Pengaturan & Profil"
          >
            <div className="w-8 h-8 rounded-xl bg-violet-600/10 border border-violet-500/25 flex items-center justify-center text-xs font-bold text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition shadow-sm">
              {currentUser.name ? currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'US'}
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-neutral-200 group-hover:text-white transition leading-snug">{currentUser.name}</div>
              <div className="text-[10px] text-neutral-500 font-semibold leading-tight">{currentUser.business}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex items-center justify-center p-2 rounded-xl text-neutral-400 hover:text-neutral-200 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800/80 transition-all cursor-pointer shadow-sm"
              title={theme === 'dark' ? 'Mode Terang (Daylight)' : 'Mode Gelap'}
            >
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-amber-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-indigo-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              )}
            </button>

            {/* Logout Button */}
            <button 
              type="button"
              onClick={onLogout}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/25 transition cursor-pointer shadow-sm"
              title="Keluar Akun"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
