import React from 'react';
import { Compass, Plus, Server, Wifi, WifiOff } from 'lucide-react';

export default function ServerSidebar({ connected, serverAddress, onOpenConnectModal }) {
  return (
    <div className="w-[72px] bg-discord-darkest flex flex-col items-center py-3 space-y-2 select-none border-r border-[#1a1b1e]">
      {/* Ícone Discord / Home */}
      <div
        className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[#5865F2] hover:bg-[#5865F2] flex items-center justify-center text-white cursor-pointer transition-all duration-200 shadow-md group relative"
        title="Concord - Início"
      >
        <span className="font-black text-2xl tracking-tighter">C</span>
        {/* Marcador lateral branco estilo Discord */}
        <div className="absolute -left-3 w-2 h-10 bg-white rounded-r-full hidden group-hover:block transition-all"></div>
      </div>

      <div className="w-8 h-[2px] bg-[#35373c] rounded-full my-1" />

      {/* Ícone do Servidor Conectado */}
      <div
        onClick={onOpenConnectModal}
        className={`w-12 h-12 rounded-[16px] flex flex-col items-center justify-center cursor-pointer transition-all duration-200 relative group ${
          connected ? 'bg-[#313338] text-white' : 'bg-[#2b2d31] text-[#949ba4]'
        } hover:bg-[#5865F2] hover:text-white`}
        title={`Servidor: ${serverAddress || 'Desconectado'} (Clique para alterar)`}
      >
        <Server size={22} />
        {/* Indicador de status online/offline */}
        <div
          className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-discord-darkest ${
            connected ? 'bg-discord-green' : 'bg-discord-red'
          }`}
        />
        {/* Pill lateral ativo */}
        {connected && (
          <div className="absolute -left-3 w-2 h-8 bg-white rounded-r-full"></div>
        )}
      </div>

      {/* Botão Adicionar/Configurar Servidor */}
      <button
        onClick={onOpenConnectModal}
        className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[#313338] hover:bg-discord-green text-discord-green hover:text-white flex items-center justify-center cursor-pointer transition-all duration-200 group"
        title="Mudar Servidor ou Apelido"
      >
        <Plus size={22} />
      </button>

      <div className="flex-1" />

      {/* Indicador de Conexão no rodapé */}
      <div
        className="text-[10px] text-discord-muted flex flex-col items-center cursor-pointer hover:text-white transition"
        onClick={onOpenConnectModal}
        title={connected ? `Conectado a ${serverAddress}` : 'Desconectado'}
      >
        {connected ? <Wifi size={16} className="text-discord-green" /> : <WifiOff size={16} className="text-discord-red" />}
        <span className="mt-1 text-[9px]">{connected ? 'ONLINE' : 'OFFLINE'}</span>
      </div>
    </div>
  );
}
