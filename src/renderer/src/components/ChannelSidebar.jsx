import {
  Volume2,
  Hash,
  Plus,
  Mic,
  MicOff,
  Headphones,
  Settings,
  PhoneOff,
  Radio,
  Tv,
  Trash2
} from 'lucide-react';

export default function ChannelSidebar({
  channels = [],
  currentVoiceChannel,
  currentTextChannel,
  users = [],
  currentUser,
  speakingUsers = {},
  onSelectVoiceChannel,
  onSelectTextChannel,
  onOpenCreateChannel,
  onDeleteChannel,
  onOpenSettings,
  onToggleMic,
  onToggleDeafen,
  onLeaveVoice
}) {
  const voiceChannels = channels.filter((c) => c.type === 'voice');
  const textChannels = channels.filter((c) => c.type === 'text');

  return (
    <div className="w-60 bg-discord-darker flex flex-col h-full select-none border-r border-[#1e1f22]">
      {/* Topo do Servidor */}
      <div className="h-12 border-b border-[#1f2023] px-4 flex items-center justify-between font-bold text-white shadow-sm hover:bg-[#35373c] transition cursor-pointer">
        <span className="truncate">Meu Servidor</span>
        <span className="text-discord-muted text-xs">▼</span>
      </div>

      {/* Lista de Canais */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* SEÇÃO CANAIS DE VOZ */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1 text-xs font-bold text-discord-muted uppercase tracking-wider group">
            <span className="hover:text-white transition">Canais de Voz</span>
            <button
              onClick={() => onOpenCreateChannel('voice')}
              className="hover:text-white transition p-0.5"
              title="Criar Canal de Voz"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-0.5">
            {voiceChannels.map((ch) => {
              const isCurrent = currentVoiceChannel?.id === ch.id;
              // Usuários conectados nesta call específica
              const usersInThisChannel = users.filter((u) => u.currentVoiceChannel === ch.id);

              return (
                <div key={ch.id} className="space-y-1">
                  <div
                    onClick={() => onSelectVoiceChannel(ch)}
                    className={`group flex items-center space-x-2 px-2 py-1.5 rounded-md cursor-pointer transition text-sm font-medium ${
                      isCurrent
                        ? 'bg-[#3f4147] text-white'
                        : 'text-discord-muted hover:bg-[#35373c] hover:text-white'
                    }`}
                  >
                    <Volume2 size={18} className={isCurrent ? 'text-discord-green' : ''} />
                    <span className="truncate flex-1">{ch.name}</span>
                    {usersInThisChannel.length > 0 && (
                      <span className="text-xs bg-[#1e1f22] px-1.5 py-0.2 rounded text-discord-muted">
                        {usersInThisChannel.length}
                      </span>
                    )}
                    {!(ch.id === 'geral' || ch.name?.toLowerCase() === 'geral') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Tem certeza que deseja excluir o canal de voz "${ch.name}"?`)) {
                            onDeleteChannel && onDeleteChannel(ch.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-discord-red p-1 rounded transition text-discord-muted"
                        title="Excluir canal de voz"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Usuários listados abaixo do canal de voz estilo Discord */}
                  {usersInThisChannel.length > 0 && (
                    <div className="pl-6 space-y-1">
                      {usersInThisChannel.map((u) => {
                        const isSpeaking = !!speakingUsers[u.id];
                        const isSelf = u.id === currentUser?.id;
                        return (
                          <div
                            key={u.id}
                            className="flex items-center justify-between pr-2 py-1 rounded hover:bg-[#35373c]/60 text-xs"
                          >
                            <div className="flex items-center space-x-2 truncate">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold border overflow-hidden ${
                                  isSpeaking ? 'border-discord-green ring-1 ring-discord-green' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: u.avatarColor || '#5865F2' }}
                              >
                                {u.avatarUrl ? (
                                  <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  u.nickname?.charAt(0).toUpperCase()
                                )}
                              </div>
                              <span
                                className={`truncate font-medium ${
                                  isSpeaking ? 'text-discord-green font-bold' : 'text-[#dbdee1]'
                                }`}
                              >
                                {u.nickname}
                                {isSelf && ' (você)'}
                              </span>
                            </div>

                            <div className="flex items-center space-x-1">
                              {u.isScreenSharing && (
                                <span className="bg-[#ed4245] text-[9px] text-white px-1 rounded font-bold flex items-center">
                                  AO VIVO
                                </span>
                              )}
                              {u.isMuted && <MicOff size={12} className="text-discord-red" />}
                              {u.isDeafened && <Headphones size={12} className="text-discord-red" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SEÇÃO CANAIS DE TEXTO */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1 text-xs font-bold text-discord-muted uppercase tracking-wider group">
            <span className="hover:text-white transition">Canais de Texto</span>
            <button
              onClick={() => onOpenCreateChannel('text')}
              className="hover:text-white transition p-0.5"
              title="Criar Canal de Texto"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-0.5">
            {textChannels.map((ch) => {
              const isCurrent = currentTextChannel?.id === ch.id;
              return (
                <div
                  key={ch.id}
                  onClick={() => onSelectTextChannel(ch)}
                  className={`group flex items-center space-x-2 px-2 py-1.5 rounded-md cursor-pointer transition text-sm font-medium ${
                    isCurrent
                      ? 'bg-[#3f4147] text-white'
                      : 'text-discord-muted hover:bg-[#35373c] hover:text-white'
                  }`}
                >
                  <Hash size={18} />
                  <span className="truncate flex-1">{ch.name}</span>
                  {!(ch.id === 'chat-geral' || ch.name?.toLowerCase() === 'chat-geral') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Tem certeza que deseja excluir o canal de texto "${ch.name}"?`)) {
                          onDeleteChannel && onDeleteChannel(ch.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-discord-red p-1 rounded transition text-discord-muted"
                      title="Excluir canal de texto"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Widget de Conexão de Voz Ativa (quando conectado em uma call) */}
      {currentVoiceChannel && (
        <div className="bg-[#232428] border-b border-[#1f2023] px-3 py-2 flex items-center justify-between">
          <div className="flex flex-col truncate">
            <div className="flex items-center space-x-1.5 text-discord-green text-xs font-bold">
              <Radio size={14} className="animate-pulse" />
              <span>Voz Conectada</span>
            </div>
            <span className="text-[11px] text-discord-muted truncate">
              {currentVoiceChannel.name} / RTC
            </span>
          </div>
          <button
            onClick={onLeaveVoice}
            className="p-1.5 text-discord-muted hover:text-discord-red hover:bg-[#35373c] rounded transition"
            title="Desconectar da chamada"
          >
            <PhoneOff size={18} />
          </button>
        </div>
      )}

      {/* Barra do Usuário no Rodapé (Estilo Discord Fiel) */}
      <div className="h-[52px] bg-discord-userpanel px-2 flex items-center justify-between border-t border-[#1e1f22]">
        {/* Avatar e Nome */}
        <div
          onClick={onOpenSettings}
          className="flex items-center space-x-2 px-1 py-1 rounded hover:bg-[#35373c] cursor-pointer flex-1 truncate transition"
          title="Abrir Configurações"
        >
          <div className="relative">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow overflow-hidden"
              style={{ backgroundColor: currentUser?.avatarColor || '#5865F2' }}
            >
              {currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                currentUser?.nickname?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-discord-green border-2 border-discord-userpanel" />
          </div>
          <div className="flex flex-col truncate leading-tight">
            <span className="text-xs font-bold text-white truncate">
              {currentUser?.nickname || 'Você'}
            </span>
            <span className="text-[10px] text-discord-muted">Online</span>
          </div>
        </div>

        {/* Botões de Mute Microfone, Deafen Fone e Configurações */}
        <div className="flex items-center space-x-0.5">
          <button
            onClick={onToggleMic}
            className={`p-1.5 rounded hover:bg-[#35373c] transition ${
              currentUser?.isMuted ? 'text-discord-red' : 'text-discord-text hover:text-white'
            }`}
            title={currentUser?.isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
          >
            {currentUser?.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <button
            onClick={onToggleDeafen}
            className={`p-1.5 rounded hover:bg-[#35373c] transition ${
              currentUser?.isDeafened ? 'text-discord-red' : 'text-discord-text hover:text-white'
            }`}
            title={currentUser?.isDeafened ? 'Ativar Áudio' : 'Desativar Áudio (Ensurdecer)'}
          >
            <Headphones size={18} />
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded hover:bg-[#35373c] text-discord-text hover:text-white transition"
            title="Configurações do Usuário"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
