import {
  Volume2,
  Plus,
  Mic,
  MicOff,
  Headphones,
  Settings,
  PhoneOff,
  Trash2,
  Video
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
    <div className="w-64 bg-surface-container-low flex flex-col h-full select-none border-r border-outline-variant/40">
      {/* Banner do Servidor */}
      <div className="relative p-3.5 bg-surface-container-high/60 backdrop-blur-md shadow-md">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            <span className="text-[10px] font-label font-bold tracking-widest text-primary uppercase">Concord</span>
          </div>
          <h1 className="text-sm font-headline font-bold text-on-surface truncate tracking-wider mt-0.5 uppercase">
            Meu Servidor
          </h1>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[10px] font-label text-on-surface-variant bg-surface-container-lowest/80 px-2.5 py-1 rounded">
          <span className="flex items-center gap-1 text-secondary uppercase">
            <span className="w-1 h-1 rounded-full bg-secondary"></span> {users.length} Online
          </span>
          <span className="text-on-surface-variant/70 uppercase">{channels.length} Canais</span>
        </div>
      </div>

      {/* Lista de Canais */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* SEÇÃO CANAIS DE VOZ */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1 text-[10px] font-label font-bold text-on-surface-variant/80 uppercase tracking-widest">
            <span>Canais de Voz</span>
            <button
              onClick={() => onOpenCreateChannel('voice')}
              className="hover:text-secondary transition p-0.5"
              title="Criar Canal de Voz"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-1">
            {voiceChannels.map((ch) => {
              const isCurrent = currentVoiceChannel?.id === ch.id;
              // Usuários conectados nesta call específica
              const usersInThisChannel = users.filter((u) => u.currentVoiceChannel === ch.id);

              return (
                <div
                  key={ch.id}
                  className={`rounded-lg transition-colors ${
                    isCurrent ? 'bg-surface-container-high/40 p-2' : 'hover:bg-surface-container p-2'
                  }`}
                >
                  <div
                    onClick={() => onSelectVoiceChannel(ch)}
                    className={`group flex items-center gap-2 cursor-pointer text-xs font-headline ${
                      isCurrent ? 'text-secondary font-semibold' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <Volume2 size={16} className={isCurrent ? '' : 'text-on-surface-variant/70'} />
                    <span className="truncate flex-1">{ch.name}</span>
                    {usersInThisChannel.length > 0 && (
                      <span
                        className={`text-[10px] font-label px-1.5 py-0.5 rounded ${
                          isCurrent
                            ? 'text-secondary-fixed-dim bg-secondary-container/60'
                            : 'text-on-surface-variant/70'
                        }`}
                      >
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
                        className="opacity-0 group-hover:opacity-100 hover:text-error p-0.5 rounded transition text-on-surface-variant"
                        title="Excluir canal de voz"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Usuários listados abaixo do canal de voz */}
                  {usersInThisChannel.length > 0 && (
                    <div className="pl-6 mt-1.5 space-y-0.5">
                      {usersInThisChannel.map((u) => {
                        const isSpeaking = !!speakingUsers[u.id];
                        const isSelf = u.id === currentUser?.id;
                        return (
                          <div
                            key={u.id}
                            className="flex items-center justify-between pr-1 py-1 rounded hover:bg-surface-container-high/60 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-on-surface text-[9px] font-bold overflow-hidden ring-1 transition-shadow ${
                                  isSpeaking ? 'ring-secondary shadow-[0_0_8px_rgba(0,255,204,0.6)]' : 'ring-transparent'
                                }`}
                                style={{ backgroundColor: u.avatarColor || '#b3004e' }}
                              >
                                {u.avatarUrl ? (
                                  <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  u.nickname?.charAt(0).toUpperCase()
                                )}
                              </div>
                              <span
                                className={`truncate ${
                                  isSpeaking ? 'text-secondary font-semibold' : 'text-on-surface-variant'
                                }`}
                              >
                                {u.nickname}
                                {isSelf && ' (você)'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {u.isScreenSharing && (
                                <span className="bg-primary text-[9px] font-label text-on-primary px-1 rounded font-bold flex items-center">
                                  AO VIVO
                                </span>
                              )}
                              {u.isCameraOn && <Video size={12} className="text-secondary" />}
                              {u.isMuted && <MicOff size={12} className="text-error" />}
                              {u.isDeafened && <Headphones size={12} className="text-error" />}
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
          <div className="flex items-center justify-between px-2 mb-1 text-[10px] font-label font-bold text-on-surface-variant/80 uppercase tracking-widest">
            <span>Canais de Texto</span>
            <button
              onClick={() => onOpenCreateChannel('text')}
              className="hover:text-secondary transition p-0.5"
              title="Criar Canal de Texto"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-0.5">
            {textChannels.map((ch) => {
              const isCurrent = currentTextChannel?.id === ch.id;
              return (
                <div
                  key={ch.id}
                  onClick={() => onSelectTextChannel(ch)}
                  className={`relative group flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all text-xs font-headline ${
                    isCurrent
                      ? 'bg-surface-container-highest text-on-surface font-semibold shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <span
                    className={`text-sm ${
                      isCurrent ? 'text-primary font-bold' : 'text-on-surface-variant/60 group-hover:text-secondary'
                    }`}
                  >
                    #
                  </span>
                  <span className="truncate flex-1">{ch.name}</span>
                  {!(ch.id === 'chat-geral' || ch.name?.toLowerCase() === 'chat-geral') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Tem certeza que deseja excluir o canal de texto "${ch.name}"?`)) {
                          onDeleteChannel && onDeleteChannel(ch.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-error p-0.5 rounded transition text-on-surface-variant"
                      title="Excluir canal de texto"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  {isCurrent && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-r"></span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Widget de Conexão de Voz Ativa (quando conectado em uma call) */}
      {currentVoiceChannel && (
        <div className="px-3 py-2.5 bg-surface-container-lowest border-t border-outline-variant/40 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_#00ffcc]"></span>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-label font-bold text-secondary uppercase tracking-widest leading-none truncate">
                Voz Conectada
              </span>
              <span className="text-[11px] font-headline text-on-surface truncate mt-0.5">
                {currentVoiceChannel.name} / RTC
              </span>
            </div>
          </div>
          <button
            onClick={onLeaveVoice}
            className="w-7 h-7 rounded-lg bg-error-container/60 hover:bg-error-container text-error flex items-center justify-center transition"
            title="Desconectar da chamada"
          >
            <PhoneOff size={14} />
          </button>
        </div>
      )}

      {/* Barra do Usuário no Rodapé */}
      <div className="h-14 bg-surface-container-lowest px-2 flex items-center justify-between border-t border-outline-variant/40">
        {/* Avatar e Nome */}
        <div
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 px-1 py-1 rounded-lg hover:bg-surface-container cursor-pointer flex-1 truncate transition"
          title="Abrir Configurações"
        >
          <div className="relative flex-shrink-0">
            <div className="p-[2px] rounded-full ring-2 ring-secondary/80 shadow-[0_0_10px_rgba(0,255,204,0.4)]">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface text-xs font-bold overflow-hidden"
                style={{ backgroundColor: currentUser?.avatarColor || '#b3004e' }}
              >
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  currentUser?.nickname?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-secondary ring-2 ring-surface-container-lowest shadow-[0_0_6px_#00ffcc]" />
          </div>
          <div className="flex flex-col truncate leading-tight">
            <span className="text-xs font-headline font-bold text-on-surface truncate tracking-wide">
              {currentUser?.nickname || 'Você'}
            </span>
            <span className="text-[10px] font-label text-secondary uppercase flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-secondary inline-block animate-pulse"></span>
              Online
            </span>
          </div>
        </div>

        {/* Botões de Mute Microfone, Deafen Fone e Configurações */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMic}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
              currentUser?.isMuted
                ? 'bg-error-container/60 text-error'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
            }`}
            title={currentUser?.isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
          >
            {currentUser?.isMuted ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          <button
            onClick={onToggleDeafen}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
              currentUser?.isDeafened
                ? 'bg-error-container/60 text-error'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
            }`}
            title={currentUser?.isDeafened ? 'Ativar Som' : 'Desativar Som'}
          >
            <Headphones size={15} />
          </button>

          <button
            onClick={onOpenSettings}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-secondary transition"
            title="Configurações do Usuário"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
