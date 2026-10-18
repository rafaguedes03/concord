import React, { useState } from 'react';
import { Volume2, Hash, X } from 'lucide-react';

export default function CreateChannelModal({ isOpen, defaultType = 'voice', onClose, onCreateChannel }) {
  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe um nome para o canal.');
      return;
    }

    onCreateChannel(name.trim(), type);
    setName('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#313338] w-full max-w-md rounded-lg shadow-2xl border border-[#2b2d31] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-[#2b2d31] flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Criar Canal</h2>
          <button
            onClick={onClose}
            className="text-discord-muted hover:text-white transition p-1"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-discord-red/20 text-discord-red text-xs p-2 rounded">
              {error}
            </div>
          )}

          {/* Seleção do Tipo de Canal */}
          <div>
            <label className="block text-xs font-bold text-discord-text uppercase tracking-wider mb-2">
              Tipo de Canal
            </label>
            <div className="space-y-2">
              <div
                onClick={() => setType('voice')}
                className={`p-3 rounded-lg border-2 flex items-center space-x-3 cursor-pointer transition ${
                  type === 'voice'
                    ? 'border-[#5865F2] bg-[#2b2d31]'
                    : 'border-[#1e1f22] bg-[#2b2d31]/50 hover:bg-[#2b2d31]'
                }`}
              >
                <Volume2 size={24} className={type === 'voice' ? 'text-[#5865F2]' : 'text-discord-muted'} />
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Voz (Call)</div>
                  <div className="text-xs text-discord-muted">
                    Converse por voz, compartilhe tela a 720p 60FPS.
                  </div>
                </div>
              </div>

              <div
                onClick={() => setType('text')}
                className={`p-3 rounded-lg border-2 flex items-center space-x-3 cursor-pointer transition ${
                  type === 'text'
                    ? 'border-[#5865F2] bg-[#2b2d31]'
                    : 'border-[#1e1f22] bg-[#2b2d31]/50 hover:bg-[#2b2d31]'
                }`}
              >
                <Hash size={24} className={type === 'text' ? 'text-[#5865F2]' : 'text-discord-muted'} />
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Texto</div>
                  <div className="text-xs text-discord-muted">
                    Envie mensagens, links e avisos no chat.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Nome do Canal */}
          <div>
            <label className="block text-xs font-bold text-discord-text uppercase tracking-wider mb-1.5">
              Nome do Canal
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'voice' ? 'Ex: Jogos, Call 2, Squad' : 'Ex: bate-papo, memes'}
              autoFocus
              maxLength={40}
              className="w-full bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865F2] rounded-md px-3.5 py-2 text-white text-sm focus:outline-none transition select-text"
            />
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-white hover:underline transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white rounded text-sm font-semibold transition shadow"
            >
              Criar Canal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
