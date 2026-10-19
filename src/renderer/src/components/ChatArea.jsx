import React, { useState, useRef, useEffect } from 'react';
import { Hash, Send, Volume2, Plus, X, Maximize2, Download } from 'lucide-react';

export default function ChatArea({
  currentTextChannel,
  messages = [],
  onSendMessage,
  currentUser,
  onJoinVoiceFromChat,
  isVoiceConnected
}) {
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const processImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Redimensiona inteligentemente para no máximo 1600px de largura/altura
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Converte para JPEG otimizado 82% qualidade
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setAttachedImage(compressedDataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // Reseta input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  // Suporte a colar print/screenshot direto com Ctrl+V
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedImage) return;
    onSendMessage(inputText.trim(), attachedImage);
    setInputText('');
    setAttachedImage(null);
  };

  const channelName = currentTextChannel?.name || 'chat-geral';

  return (
    <div
      onPaste={handlePaste}
      className="flex-1 bg-surface-container-lowest flex flex-col h-full overflow-hidden select-none relative"
    >
      {/* Cabeçalho do Canal de Texto */}
      <div className="h-14 bg-surface-container-low/80 backdrop-blur-md px-4 flex items-center justify-between shadow-sm flex-shrink-0 z-10 border-b border-outline-variant/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-primary text-xl font-bold">#</span>
            <span className="font-headline font-bold text-sm text-on-surface tracking-wide">{channelName}</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-outline-variant/60"></div>
          <span className="hidden sm:inline text-xs text-on-surface-variant truncate">
            Canal de texto oficial do Concord
          </span>
        </div>

        {!isVoiceConnected && (
          <button
            onClick={onJoinVoiceFromChat}
            className="bg-secondary-container/40 hover:bg-secondary-container text-secondary border border-secondary/40 text-xs font-headline font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition hover-glow-cyan"
          >
            <Volume2 size={15} />
            <span>Entrar na Call Geral</span>
          </button>
        )}
      </div>

      {/* Lista de Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 space-y-5">
        {/* Mensagem de Boas-vindas do Canal */}
        <div className="p-6 rounded-xl bg-surface-container-low shadow-md relative overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <div className="w-10 h-10 rounded-lg bg-primary-container/80 flex items-center justify-center text-on-primary-container mb-3 shadow-lg">
              <Hash size={22} />
            </div>
            <h2 className="text-xl font-headline font-bold text-on-surface tracking-wide">
              Bem-vindo ao #{channelName}!
            </h2>
            <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
              Este é o início do canal #{channelName} no Concord. Converse por texto, envie imagens e entre na chamada de voz!
            </p>
          </div>
          {/* SVG decorativo */}
          <svg className="absolute right-0 bottom-0 top-0 h-full w-1/3 opacity-20 pointer-events-none" fill="none" viewBox="0 0 200 200">
            <circle className="text-secondary" cx="150" cy="100" r="80" stroke="currentColor" strokeDasharray="4 6" strokeWidth="1.5" />
            <circle className="text-primary" cx="150" cy="100" r="50" stroke="currentColor" strokeWidth="1" />
            <line className="text-secondary" stroke="currentColor" strokeWidth="1" x1="70" x2="190" y1="100" y2="100" />
          </svg>
        </div>

        {messages.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="h-px bg-surface-container-highest flex-1"></div>
            <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant/70 font-semibold px-2">Mensagens</span>
            <div className="h-px bg-surface-container-highest flex-1"></div>
          </div>
        )}

        {/* Mensagens Enviadas */}
        {messages.map((msg) => {
          const isOwn = msg.sender?.id && msg.sender.id === currentUser?.id;
          return (
            <div
              key={msg.id}
              className={`flex gap-3 group -mx-4 px-4 py-2 rounded-lg transition ${
                isOwn ? 'bg-surface-container-low/40' : 'hover:bg-surface-container-low/40'
              }`}
            >
              {/* Foto de Perfil ou Inicial */}
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-on-surface text-sm font-bold flex-shrink-0 overflow-hidden ${
                  isOwn ? 'ring-1 ring-secondary/50' : ''
                }`}
                style={{ backgroundColor: msg.sender?.avatarColor || '#b3004e' }}
              >
                {msg.sender?.avatarUrl ? (
                  <img src={msg.sender.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  msg.sender?.nickname?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={`text-xs font-headline font-bold cursor-pointer ${isOwn ? 'text-secondary' : 'text-on-surface'}`}>
                    {msg.sender?.nickname}
                  </span>
                  <span className="text-[10px] font-label text-on-surface-variant/70">
                    {msg.timestamp}
                  </span>
                </div>

                {msg.text && (
                  <p className="text-sm text-on-surface leading-relaxed select-text break-words">
                    {msg.text}
                  </p>
                )}

                {/* Exibição de Imagem Anexada */}
                {msg.image && (
                  <div className="mt-2.5 max-w-sm sm:max-w-md rounded-lg overflow-hidden bg-surface-container shadow-lg group/img relative inline-block">
                    <img
                      src={msg.image}
                      alt="Imagem enviada"
                      onClick={() => setViewingImage(msg.image)}
                      className="max-h-72 w-auto object-contain cursor-pointer group-hover/img:scale-[1.02] transition-transform duration-500"
                    />
                    <div
                      onClick={() => setViewingImage(msg.image)}
                      className="absolute top-2 right-2 bg-surface-container-lowest/80 hover:bg-surface-container-lowest text-secondary p-1.5 rounded opacity-0 group-hover/img:opacity-100 transition cursor-pointer"
                      title="Ampliar Imagem"
                    >
                      <Maximize2 size={14} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Caixa de Entrada de Mensagem com Pré-visualização de Imagem */}
      <div className="p-3 lg:p-4 bg-surface-container-low/90 backdrop-blur-md">
        {/* Preview da imagem selecionada antes de enviar */}
        {attachedImage && (
          <div className="mb-2.5 relative inline-flex items-center bg-surface-container p-2 rounded-lg border border-secondary/30 shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <img src={attachedImage} alt="Anexo" className="h-20 w-auto rounded object-contain bg-surface-container-lowest" />
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="absolute -top-2 -right-2 bg-error hover:bg-error/80 text-on-error rounded-full p-1 shadow transition cursor-pointer"
              title="Remover Imagem"
            >
              <X size={12} />
            </button>
            <span className="ml-2.5 text-xs font-label text-secondary pr-1">Imagem pronta para envio</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-surface-container px-2.5 py-2 flex items-center gap-2 shadow-lg border border-transparent focus-within:border-primary/40 focus-within:shadow-[inset_0_0_12px_rgba(255,45,120,0.1)] transition"
        >
          {/* Botão + para Enviar Imagem */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-7 h-7 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-secondary flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
            title="Enviar Imagem (+)"
          >
            <Plus size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onPaste={handlePaste}
            placeholder={`Conversar em #${channelName} (Cole uma imagem com Ctrl+V ou clique no +)`}
            className="bg-transparent flex-1 text-on-surface text-sm focus:outline-none placeholder:text-on-surface-variant/50 select-text"
          />

          <button
            type="submit"
            disabled={!inputText.trim() && !attachedImage}
            className={`px-3 py-1.5 rounded-lg font-headline font-bold text-xs flex items-center gap-1.5 transition-all flex-shrink-0 ${
              inputText.trim() || attachedImage
                ? 'bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container hover-glow-pink cursor-pointer'
                : 'bg-surface-container-high text-on-surface-variant/50 cursor-default'
            }`}
            title="Enviar"
          >
            <span>Enviar</span>
            <Send size={13} />
          </button>
        </form>
      </div>

      {/* Modal Visualizador de Imagem em Tamanho Real */}
      {viewingImage && (
        <div
          onClick={() => setViewingImage(null)}
          className="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-150"
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <img
              src={viewingImage}
              alt="Visualização"
              className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl border border-primary/30"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-3 flex items-center gap-3">
              <a
                href={viewingImage}
                download={`concord_image_${Date.now()}.jpg`}
                onClick={(e) => e.stopPropagation()}
                className="bg-surface-container hover:bg-surface-container-high text-secondary text-xs font-headline font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-secondary/40 transition hover-glow-cyan"
              >
                <Download size={14} />
                <span>Baixar Original</span>
              </a>
              <button
                onClick={() => setViewingImage(null)}
                className="bg-error-container/60 hover:bg-error-container text-error text-xs font-headline font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
              >
                <X size={14} />
                <span>Fechar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
