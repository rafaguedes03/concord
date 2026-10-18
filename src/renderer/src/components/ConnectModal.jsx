import React, { useState, useEffect } from 'react';
import { User, Server, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';

export default function ConnectModal({ isOpen, initialNick = '', initialServer = '', onConnect }) {
  const [nickname, setNickname] = useState(initialNick || '');
  const [serverUrl, setServerUrl] = useState(initialServer || '45.184.120.69:3002');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialNick) setNickname(initialNick);
    if (initialServer) setServerUrl(initialServer);
  }, [initialNick, initialServer]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('Por favor, informe seu apelido.');
      return;
    }
    if (!serverUrl.trim()) {
      setError('Por favor, informe o endereço do servidor.');
      return;
    }

    setError('');
    onConnect(nickname.trim(), serverUrl.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#313338] w-full max-w-md rounded-xl shadow-2xl border border-[#3f4147] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Banner Superior Estilo Discord */}
        <div className="h-24 bg-gradient-to-r from-[#5865F2] to-[#4752c4] flex items-center justify-center relative">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg absolute -bottom-8 border-4 border-[#313338]">
            <span className="text-[#5865F2] font-black text-3xl tracking-tighter">C</span>
          </div>
        </div>

        <div className="p-6 pt-10 text-center">
          <h2 className="text-xl font-black text-white">Bem-vindo ao Concord!</h2>
          <p className="text-discord-muted text-xs mt-1">
            Zero burocracia: sem conta, sem e-mail e sem senha. Escolha seu apelido e entre direto na chamada.
          </p>

          {error && (
            <div className="bg-discord-red/20 border border-discord-red text-discord-red text-xs p-2 rounded mt-3 text-left">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-left">
            {/* Campo Apelido */}
            <div>
              <label className="block text-xs font-bold text-discord-text uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <User size={13} className="text-[#5865F2]" />
                <span>Seu Apelido</span>
                <span className="text-discord-red">*</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: Rafael, DevGamer, etc."
                maxLength={32}
                autoFocus
                className="w-full bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865F2] rounded-md px-3.5 py-2.5 text-white text-sm focus:outline-none transition select-text"
              />
            </div>

            {/* Campo Endereço do Servidor */}
            <div>
              <label className="block text-xs font-bold text-discord-text uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <Server size={13} className="text-discord-green" />
                <span>Endereço do Servidor (IP:Porta)</span>
                <span className="text-discord-red">*</span>
              </label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="Ex: 45.184.120.69:3002 ou localhost:3002"
                className="w-full bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865F2] rounded-md px-3.5 py-2.5 text-white text-sm focus:outline-none transition select-text"
              />
              <p className="text-[11px] text-discord-muted mt-1">
                Servidor configurado para <span className="text-white font-mono">45.184.120.69:3002</span> (ou <span className="text-white font-mono">localhost:3002</span> se estiver neste PC).
              </p>
            </div>

            {/* Botão Conectar */}
            <button
              type="submit"
              className="w-full mt-4 bg-[#5865F2] hover:bg-[#4752c4] text-white py-2.5 rounded-md font-bold text-sm flex items-center justify-center space-x-2 transition shadow-lg"
            >
              <span>Entrar no Discord</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

        <div className="bg-[#2b2d31] px-6 py-3 border-t border-[#1e1f22] flex items-center justify-between text-[11px] text-discord-muted">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck size={14} className="text-discord-green" />
            <span>Transmissão 720p 60FPS ativada</span>
          </div>
          <span>Sem cadastro necessário</span>
        </div>
      </div>
    </div>
  );
}
