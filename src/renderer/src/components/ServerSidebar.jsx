import React from 'react';
import { Plus, Server, Wifi, WifiOff } from 'lucide-react';
import logoMark from '../assets/logo-mark.png';

export default function ServerSidebar({ connected, serverAddress, onOpenConnectModal }) {
  return (
    <div className="w-20 bg-surface-container-lowest flex flex-col items-center py-4 gap-3 select-none border-r border-outline-variant/40">
      {/* Logo Concord / Início */}
      <div
        className="relative w-12 h-12 rounded-xl bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center cursor-pointer transition-all duration-300 glow-pink"
        title="Concord - Início"
      >
        <img src={logoMark} alt="Concord" className="w-9 h-9 object-contain pointer-events-none" draggable={false} />
        {/* Marcador lateral neon */}
        <span className="absolute -left-4 w-1.5 h-6 bg-primary rounded-r-full shadow-[0_0_8px_#ff2d78]"></span>
      </div>

      <div className="w-8 h-px bg-outline-variant/50 my-1" />

      {/* Ícone do Servidor Conectado */}
      <div
        onClick={onOpenConnectModal}
        className={`relative group w-12 h-12 flex items-center justify-center cursor-pointer transition-all duration-200 ${
          connected
            ? 'bg-secondary-container text-on-secondary-container rounded-xl shadow-[0_0_12px_rgba(0,255,204,0.4)]'
            : 'bg-surface-container text-on-surface-variant rounded-full hover:bg-surface-container-highest hover:text-on-surface'
        }`}
        title={`Servidor: ${serverAddress || 'Desconectado'} (Clique para alterar)`}
      >
        <Server size={20} />
        {/* Indicador de status online/offline */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-surface-container-lowest ${
            connected ? 'bg-secondary shadow-[0_0_6px_#00ffcc]' : 'bg-error'
          }`}
        />
        {/* Pill lateral ativo */}
        {connected && (
          <span className="absolute -left-4 w-1 h-5 bg-primary rounded-r-full"></span>
        )}
      </div>

      <div className="w-8 h-px bg-outline-variant/50 my-1" />

      {/* Botão Adicionar/Configurar Servidor */}
      <button
        onClick={onOpenConnectModal}
        className="w-12 h-12 rounded-full bg-surface-container text-primary hover:bg-primary-container hover:text-on-primary-container flex items-center justify-center cursor-pointer transition-all"
        title="Mudar Servidor ou Apelido"
      >
        <Plus size={22} />
      </button>

      <div className="flex-1" />

      {/* Indicador de Conexão no rodapé */}
      <div
        className="w-12 py-2 rounded-xl bg-surface-container flex flex-col items-center cursor-pointer hover:bg-surface-container-high transition"
        onClick={onOpenConnectModal}
        title={connected ? `Conectado a ${serverAddress}` : 'Desconectado'}
      >
        {connected ? <Wifi size={16} className="text-secondary" /> : <WifiOff size={16} className="text-error" />}
        <span className={`mt-1 font-label font-bold text-[9px] tracking-widest ${connected ? 'text-secondary' : 'text-error'}`}>
          {connected ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>
    </div>
  );
}
