import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export default function TitleBar() {
  const isElectron = window.electronAPI?.isElectron;

  const handleMinimize = () => window.electronAPI?.minimizeWindow();
  const handleMaximize = () => window.electronAPI?.maximizeWindow();
  const handleClose = () => window.electronAPI?.closeWindow();

  return (
    <div
      style={{ WebkitAppRegion: 'drag' }}
      className="h-7 bg-surface-container-lowest flex items-center justify-between px-3 select-none border-b border-outline-variant/40 text-on-surface-variant text-xs font-semibold z-50 cursor-default"
    >
      <div className="flex items-center space-x-2" style={{ WebkitAppRegion: 'drag' }}>
        <span className="font-headline text-primary glow-text-primary font-extrabold text-sm tracking-widest">CONCORD</span>
        <span className="font-label text-on-surface-variant/60 font-medium text-[10px] uppercase tracking-widest">// Voz IA & Transmissão</span>
      </div>

      {isElectron && (
        <div className="flex items-center space-x-1 -mr-2" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={handleMinimize}
            style={{ WebkitAppRegion: 'no-drag' }}
            title="Minimizar"
            className="w-7 h-7 flex items-center justify-center hover:bg-surface-container-high hover:text-on-surface transition cursor-pointer"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={handleMaximize}
            style={{ WebkitAppRegion: 'no-drag' }}
            title="Maximizar"
            className="w-7 h-7 flex items-center justify-center hover:bg-surface-container-high hover:text-on-surface transition cursor-pointer"
          >
            <Square size={11} />
          </button>
          <button
            onClick={handleClose}
            style={{ WebkitAppRegion: 'no-drag' }}
            title="Fechar"
            className="w-7 h-7 flex items-center justify-center hover:bg-error hover:text-on-error transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
