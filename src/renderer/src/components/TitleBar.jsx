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
      className="h-7 bg-discord-darkest flex items-center justify-between px-3 select-none border-b border-[#111214] text-discord-muted text-xs font-semibold z-50 cursor-default"
    >
      <div className="flex items-center space-x-2" style={{ WebkitAppRegion: 'drag' }}>
        <span className="text-[#5865F2] font-black text-sm tracking-wider">CONCORD</span>
        <span className="text-[#4e5058] font-normal">| Voz IA & Transmissão</span>
      </div>

      {isElectron && (
        <div className="flex items-center space-x-1 -mr-2" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={handleMinimize}
            style={{ WebkitAppRegion: 'no-drag' }}
            title="Minimizar"
            className="w-7 h-7 flex items-center justify-center hover:bg-[#35373c] hover:text-white transition cursor-pointer"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={handleMaximize}
            style={{ WebkitAppRegion: 'no-drag' }}
            title="Maximizar"
            className="w-7 h-7 flex items-center justify-center hover:bg-[#35373c] hover:text-white transition cursor-pointer"
          >
            <Square size={11} />
          </button>
          <button
            onClick={handleClose}
            style={{ WebkitAppRegion: 'no-drag' }}
            title="Fechar"
            className="w-7 h-7 flex items-center justify-center hover:bg-[#ed4245] hover:text-white transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
