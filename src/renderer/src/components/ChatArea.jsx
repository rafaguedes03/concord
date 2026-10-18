import React, { useState, useRef, useEffect } from 'react';
import { Hash, Send, Volume2, PlusCircle, X, Maximize2, Download } from 'lucide-react';

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

  return (
    <div
      onPaste={handlePaste}
      className="flex-1 bg-discord-dark flex flex-col h-full overflow-hidden select-none relative"
    >
      {/* Cabeçalho do Canal de Texto */}
      <div className="h-12 border-b border-[#1f2023] px-4 flex items-center justify-between shadow-sm flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Hash size={22} className="text-discord-muted" />
          <span className="text-white font-bold text-base">
            {currentTextChannel?.name || 'chat-geral'}
          </span>
          <span className="text-discord-muted text-xs border-l border-[#35373c] pl-3 ml-2 hidden sm:inline">
            Canal de texto oficial do Concord
          </span>
        </div>

        {!isVoiceConnected && (
          <button
            onClick={onJoinVoiceFromChat}
            className="bg-discord-green hover:bg-discord-green-hover text-white text-xs font-bold px-3 py-1.5 rounded flex items-center space-x-1.5 transition shadow"
          >
            <Volume2 size={16} />
            <span>Entrar na Call Geral</span>
          </button>
        )}
      </div>

      {/* Lista de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Mensagem de Boas-vindas do Canal */}
        <div className="mb-6 pt-4 border-b border-[#2b2d31] pb-4">
          <div className="w-16 h-16 rounded-full bg-[#2b2d31] flex items-center justify-center text-white mb-2">
            <Hash size={36} />
          </div>
          <h2 className="text-2xl font-black text-white">
            Bem-vindo ao #{currentTextChannel?.name || 'chat-geral'}!
          </h2>
          <p className="text-discord-muted text-sm mt-1">
            Este é o início do canal #{currentTextChannel?.name || 'chat-geral'} no Concord. Converse por texto, envie imagens e entre na chamada de voz!
          </p>
        </div>

        {/* Mensagens Enviadas */}
        {messages.map((msg) => (
          <div key={msg.id} className="flex space-x-3 group hover:bg-[#2e3035]/40 -mx-4 px-4 py-1.5 rounded transition">
            {/* Foto de Perfil ou Inicial */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow overflow-hidden"
              style={{ backgroundColor: msg.sender?.avatarColor || '#5865F2' }}
            >
              {msg.sender?.avatarUrl ? (
                <img src={msg.sender.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                msg.sender?.nickname?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div className="flex flex-col flex-1 overflow-hidden leading-snug">
              <div className="flex items-baseline space-x-2">
                <span className="text-white font-semibold text-sm hover:underline cursor-pointer">
                  {msg.sender?.nickname}
                </span>
                <span className="text-[11px] text-discord-muted">
                  {msg.timestamp}
                </span>
              </div>

              {msg.text && (
                <p className="text-discord-text text-sm select-text break-words mt-0.5">
                  {msg.text}
                </p>
              )}

              {/* Exibição de Imagem Anexada */}
              {msg.image && (
                <div className="mt-2 max-w-sm sm:max-w-md rounded-lg overflow-hidden border border-[#2b2d31] bg-black/30 group/img relative inline-block">
                  <img
                    src={msg.image}
                    alt="Imagem enviada"
                    onClick={() => setViewingImage(msg.image)}
                    className="max-h-72 w-auto object-contain cursor-pointer hover:opacity-95 transition rounded"
                  />
                  <div
                    onClick={() => setViewingImage(msg.image)}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded opacity-0 group-hover/img:opacity-100 transition cursor-pointer"
                    title="Ampliar Imagem"
                  >
                    <Maximize2 size={14} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Caixa de Entrada de Mensagem com Pré-visualização de Imagem */}
      <div className="px-4 pb-4">
        {/* Preview da imagem selecionada antes de enviar */}
        {attachedImage && (
          <div className="mb-2.5 relative inline-flex items-center bg-[#2b2d31] p-2 rounded-lg border border-[#3f4147] shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <img src={attachedImage} alt="Anexo" className="h-20 w-auto rounded object-contain bg-black/50" />
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="absolute -top-2 -right-2 bg-[#ed4245] hover:bg-[#c03537] text-white rounded-full p-1 shadow transition cursor-pointer"
              title="Remover Imagem"
            >
              <X size={12} />
            </button>
            <span className="ml-2.5 text-xs text-white font-medium pr-1">Imagem pronta para envio</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-[#383a40] rounded-lg px-3 py-2.5 flex items-center space-x-2 shadow-inner"
        >
          {/* Botão + para Enviar Imagem */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-discord-muted hover:text-white p-1 hover:bg-[#4e5058]/40 rounded-full transition cursor-pointer flex-shrink-0"
            title="Enviar Imagem (+)"
          >
            <PlusCircle size={22} className="text-[#b5bac1] hover:text-white" />
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
            placeholder={`Conversar em #${currentTextChannel?.name || 'chat-geral'} (Cole uma imagem com Ctrl+V ou clique no +)`}
            className="bg-transparent flex-1 text-white text-sm focus:outline-none placeholder:text-discord-muted select-text"
          />

          <button
            type="submit"
            disabled={!inputText.trim() && !attachedImage}
            className={`p-1.5 rounded transition flex-shrink-0 ${
              inputText.trim() || attachedImage
                ? 'text-[#5865F2] hover:text-[#7983f5] cursor-pointer'
                : 'text-discord-muted opacity-40 cursor-default'
            }`}
            title="Enviar"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Modal Visualizador de Imagem em Tamanho Real */}
      {viewingImage && (
        <div
          onClick={() => setViewingImage(null)}
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-150"
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <img
              src={viewingImage}
              alt="Visualização"
              className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl border border-[#2b2d31]"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-3 flex items-center space-x-3">
              <a
                href={viewingImage}
                download={`concord_image_${Date.now()}.jpg`}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#2b2d31] hover:bg-[#35373c] text-white text-xs font-bold px-3 py-1.5 rounded flex items-center space-x-1.5 border border-[#3f4147] transition shadow"
              >
                <Download size={14} />
                <span>Baixar Original</span>
              </a>
              <button
                onClick={() => setViewingImage(null)}
                className="bg-[#ed4245] hover:bg-[#c03537] text-white text-xs font-bold px-3 py-1.5 rounded flex items-center space-x-1.5 transition shadow"
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
