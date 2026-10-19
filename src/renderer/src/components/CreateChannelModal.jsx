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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container w-full max-w-md rounded-xl border border-primary/30 shadow-[inset_0_0_12px_rgba(255,45,120,0.1),0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-outline-variant/40 flex items-center justify-between">
          <h2 className="text-on-surface font-headline font-bold text-lg">Criar Canal</h2>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition p-1"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-error-container text-on-error-container text-xs p-2 rounded">
              {error}
            </div>
          )}

          {/* Seleção do Tipo de Canal */}
          <div>
            <label className="block text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest mb-2">
              Tipo de Canal
            </label>
            <div className="space-y-2">
              <div
                onClick={() => setType('voice')}
                className={`p-3 rounded-lg border-2 flex items-center space-x-3 cursor-pointer transition ${
                  type === 'voice'
                    ? 'border-secondary bg-secondary-container/20 shadow-[0_0_12px_rgba(0,255,204,0.2)]'
                    : 'border-outline-variant/40 bg-surface-container-low/50 hover:bg-surface-container-low'
                }`}
              >
                <Volume2 size={24} className={type === 'voice' ? 'text-secondary' : 'text-on-surface-variant'} />
                <div className="flex-1">
                  <div className="text-sm font-headline font-bold text-on-surface">Voz (Call)</div>
                  <div className="text-xs text-on-surface-variant">
                    Converse por voz, compartilhe tela a 720p 60FPS.
                  </div>
                </div>
              </div>

              <div
                onClick={() => setType('text')}
                className={`p-3 rounded-lg border-2 flex items-center space-x-3 cursor-pointer transition ${
                  type === 'text'
                    ? 'border-secondary bg-secondary-container/20 shadow-[0_0_12px_rgba(0,255,204,0.2)]'
                    : 'border-outline-variant/40 bg-surface-container-low/50 hover:bg-surface-container-low'
                }`}
              >
                <Hash size={24} className={type === 'text' ? 'text-secondary' : 'text-on-surface-variant'} />
                <div className="flex-1">
                  <div className="text-sm font-headline font-bold text-on-surface">Texto</div>
                  <div className="text-xs text-on-surface-variant">
                    Envie mensagens, links e avisos no chat.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Nome do Canal */}
          <div>
            <label className="block text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
              Nome do Canal
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'voice' ? 'Ex: Jogos, Call 2, Squad' : 'Ex: bate-papo, memes'}
              autoFocus
              maxLength={40}
              className="w-full bg-surface-container-lowest border-0 border-b-2 border-outline-variant focus:border-primary focus:shadow-[0_6px_12px_-6px_rgba(255,45,120,0.5)] rounded-t-md placeholder:text-on-surface-variant/50 px-3.5 py-2 text-on-surface text-sm focus:outline-none transition select-text"
            />
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-headline font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container hover-glow-pink rounded-lg font-headline text-sm font-semibold transition shadow"
            >
              Criar Canal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
