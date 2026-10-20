import React, { useState, useEffect } from 'react';
import { User, Server, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import logoMark from '../assets/logo-mark.png';

export default function ConnectModal({ isOpen, initialNick = '', initialServer = '', onConnect }) {
  const [nickname, setNickname] = useState(initialNick || '');
  const [serverUrl, setServerUrl] = useState(initialServer || __SERVER_ADDRESS__);
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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container w-full max-w-md rounded-xl border border-primary/30 shadow-[inset_0_0_12px_rgba(255,45,120,0.1)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Banner Superior */}
        <div className="h-24 bg-surface-container-lowest bg-grid border-b border-primary/30 flex items-center justify-center relative">
          <div className="w-16 h-16 rounded-xl bg-surface-container-high flex items-center justify-center absolute -bottom-8 ring-4 ring-surface-container glow-pink">
            <img src={logoMark} alt="Concord" className="w-11 h-11 object-contain" draggable={false} />
          </div>
        </div>

        <div className="p-6 pt-10 text-center">
          <h2 className="text-xl font-headline font-extrabold text-on-surface">Bem-vindo ao Concord!</h2>
          <p className="text-on-surface-variant text-xs mt-1">
            Zero burocracia: sem conta, sem e-mail e sem senha. Escolha seu apelido e entre direto na chamada.
          </p>

          {error && (
            <div className="bg-error-container border border-error/50 text-on-error-container text-xs p-2 rounded mt-3 text-left">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-left">
            {/* Campo Apelido */}
            <div>
              <label className="block text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest mb-1.5 flex items-center space-x-1">
                <User size={13} className="text-primary" />
                <span>Seu Apelido</span>
                <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: Rafael, DevGamer, etc."
                maxLength={32}
                autoFocus
                className="w-full bg-surface-container-lowest border-0 border-b-2 border-outline-variant focus:border-primary focus:shadow-[0_6px_12px_-6px_rgba(255,45,120,0.5)] rounded-t-md px-3.5 py-2.5 text-on-surface text-sm focus:outline-none transition select-text placeholder:text-on-surface-variant/50"
              />
            </div>

            {/* Campo Endereço do Servidor */}
            <div>
              <label className="block text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest mb-1.5 flex items-center space-x-1">
                <Server size={13} className="text-secondary" />
                <span>Endereço do Servidor (IP:Porta)</span>
                <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder={`Ex: ${__SERVER_ADDRESS__} ou localhost:3002`}
                className="w-full bg-surface-container-lowest border-0 border-b-2 border-outline-variant focus:border-primary focus:shadow-[0_6px_12px_-6px_rgba(255,45,120,0.5)] rounded-t-md px-3.5 py-2.5 text-on-surface text-sm focus:outline-none transition select-text placeholder:text-on-surface-variant/50"
              />
              <p className="text-[11px] text-on-surface-variant mt-1">
                Servidor configurado para <span className="text-on-surface font-mono">{__SERVER_ADDRESS__}</span> (ou <span className="text-on-surface font-mono">localhost:3002</span> se estiver neste PC).
              </p>
            </div>

            {/* Botão Conectar */}
            <button
              type="submit"
              className="w-full mt-4 bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container hover-glow-pink py-2.5 rounded-lg font-headline font-bold text-sm flex items-center justify-center space-x-2 transition"
            >
              <span>Entrar no Discord</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

        <div className="bg-surface-container-lowest px-6 py-3 border-t border-outline-variant/40 flex items-center justify-between text-[11px] font-label text-on-surface-variant">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck size={14} className="text-secondary" />
            <span>Transmissão 720p 60FPS ativada</span>
          </div>
          <span>Sem cadastro necessário</span>
        </div>
      </div>
    </div>
  );
}
