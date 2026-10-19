import React from 'react';
import { Mic, MicOff, Headphones, PhoneOff, Maximize2 } from 'lucide-react';

// Dock flutuante de voz exibido no chat enquanto há uma chamada conectada
export default function VoiceDock({ channel, usersCount, currentUser, onToggleMic, onToggleDeafen, onOpenCall, onLeave }) {
  if (!channel) return null;

  return (
    <div className="fixed bottom-24 right-6 z-40 bg-surface-container/90 backdrop-blur-xl border border-secondary/30 rounded-xl px-4 py-2.5 flex items-center gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_14px_rgba(0,255,204,0.15)]">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_#00ffcc] flex-shrink-0"></div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-label uppercase tracking-widest text-secondary font-bold">Voz Conectada</span>
          <span className="text-xs font-headline font-semibold text-on-surface truncate max-w-[180px]">
            {channel.name} <span className="text-on-surface-variant font-normal">({usersCount} na call)</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 border-l border-outline-variant/40 pl-3">
        <button
          onClick={onToggleMic}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
            currentUser?.isMuted
              ? 'bg-error-container/60 text-error'
              : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
          }`}
          title={currentUser?.isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
        >
          {currentUser?.isMuted ? <MicOff size={15} /> : <Mic size={15} />}
        </button>
        <button
          onClick={onToggleDeafen}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
            currentUser?.isDeafened
              ? 'bg-error-container/60 text-error'
              : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
          }`}
          title={currentUser?.isDeafened ? 'Ativar Som' : 'Desativar Som'}
        >
          <Headphones size={15} />
        </button>
        <button
          onClick={onOpenCall}
          className="h-7 px-2.5 rounded-lg bg-secondary-container/40 hover:bg-secondary-container text-secondary flex items-center gap-1.5 text-[11px] font-headline font-semibold transition-all hover-glow-cyan"
          title="Ver Chamada e Transmissões"
        >
          <Maximize2 size={13} />
          <span>Ver Chamada</span>
        </button>
        <button
          onClick={onLeave}
          className="w-7 h-7 rounded-lg bg-error-container/60 hover:bg-error-container text-error flex items-center justify-center transition-all ml-1"
          title="Desconectar"
        >
          <PhoneOff size={15} />
        </button>
      </div>
    </div>
  );
}
