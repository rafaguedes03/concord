import React, { useRef, useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  ScreenShare,
  ScreenShareOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  Video,
  VideoOff,
  ChevronUp,
  Check,
  LayoutGrid,
  Eye,
  EyeOff,
  Tv
} from 'lucide-react';
import UserTile from './UserTile';
import { LivekitEngine, STREAM_PRESETS } from '../services/livekitEngine';

// Botão da barra da call com setinha que abre a lista de dispositivos (câmera, microfone ou alto-falante)
function DeviceSplitButton({
  kind,
  menuTitle,
  selectedId,
  onSelectDevice,
  onClick,
  title,
  className,
  align = 'center',
  children
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [devices, setDevices] = useState([]);
  const menuRef = useRef(null);

  // Fecha o menu ao clicar fora dele
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const toggleMenu = async () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    setMenuOpen(true);
    setDevices(await LivekitEngine.listDevices(kind));
  };

  const activeId = selectedId || '';

  return (
    <div ref={menuRef} className="relative flex items-stretch">
      <button
        onClick={onClick}
        className={`flex items-center gap-2 pl-3.5 pr-3 py-2 rounded-l-lg font-headline font-semibold text-xs transition ${className}`}
        title={title}
      >
        {children}
      </button>
      <button
        onClick={toggleMenu}
        className={`px-1.5 rounded-r-lg border-l border-outline-variant/40 transition ${className}`}
        title={`Escolher ${menuTitle}`}
      >
        <ChevronUp size={14} className={`transition-transform ${menuOpen ? '' : 'rotate-180'}`} />
      </button>

      {menuOpen && (
        <div
          className={`absolute bottom-12 bg-surface-container p-2 rounded-xl shadow-2xl border border-secondary/30 w-64 z-50 flex flex-col gap-1 ${
            align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2'
          }`}
        >
          <span className="px-2 pt-1 pb-1.5 text-[10px] font-label font-bold uppercase tracking-wider text-on-surface-variant">
            {menuTitle}
          </span>
          {[{ deviceId: '', label: 'Padrão do sistema' }, ...devices].map((device, i) => {
            const selected = device.deviceId === activeId;
            return (
              <button
                key={device.deviceId || 'default'}
                onClick={() => {
                  setMenuOpen(false);
                  if (!selected) onSelectDevice && onSelectDevice(device.deviceId);
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-headline font-semibold transition ${
                  selected ? 'bg-secondary-container/40 text-secondary' : 'text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="w-3.5 flex-shrink-0">{selected && <Check size={14} />}</span>
                <span className="truncate">{device.label || `${menuTitle} ${i}`}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Componente para renderizar individualmente a transmissão de cada participante
function StreamCard({
  sharer,
  isSelf,
  localScreenStream,
  livekitEngine,
  trackUpdateTick,
  streamVolume = 100,
  isStreamMuted = false,
  onStreamVolumeChange,
  onToggleStreamMute,
  onClick,
  compact = false,
  isWatching = true,
  onToggleWatch
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVolSlider, setShowVolSlider] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    // 1. Preview local da minha tela
    if (isSelf && localScreenStream && videoRef.current) {
      videoRef.current.srcObject = localScreenStream;
      videoRef.current.play().catch(() => {});
      return () => {
        if (videoRef.current) videoRef.current.srcObject = null;
      };
    }

    // 2. Transmissão do amigo via LiveKit (track H.264 decodificada por hardware)
    const track = !isSelf && livekitEngine ? livekitEngine.remoteVideoTracks?.get(sharer.id) : null;
    const videoEl = videoRef.current;
    if (!track || !videoEl) {
      setHasVideo(false);
      return undefined;
    }

    track.attach(videoEl);
    videoEl.play().catch(() => {});
    setHasVideo(true);
    return () => {
      try { track.detach(videoEl); } catch (e) {}
    };
  }, [isSelf, localScreenStream, sharer.id, livekitEngine, trackUpdateTick]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const presetKey = sharer.screenPreset in STREAM_PRESETS ? sharer.screenPreset : '720p60';
  const meta = { preset: presetKey, label: STREAM_PRESETS[presetKey].name };

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`relative bg-surface-container-lowest overflow-hidden flex items-center justify-center border border-primary/30 shadow-[inset_0_0_12px_rgba(255,45,120,0.1)] group min-h-0 min-w-0 ${
        compact ? 'w-full aspect-video rounded-xl transition-transform hover:-translate-y-0.5' : 'flex-1 rounded-2xl'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Vídeo do preview local ou da transmissão recebida pelo LiveKit */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />

      {!isSelf && isWatching && !hasVideo && (
        <span className={`absolute inset-0 flex items-center justify-center font-label text-on-surface-variant ${compact ? 'text-[10px]' : 'text-sm'}`}>
          Carregando transmissão...
        </span>
      )}

      {/* Transmissão ainda não assistida: nada é baixado até a pessoa escolher assistir */}
      {!isWatching && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center ${compact ? 'gap-1 pb-5' : 'gap-3'}`}>
          {!compact && (
            <>
              <Tv size={36} className="text-primary" />
              <span className="text-sm font-headline font-semibold text-on-surface">
                {sharer.nickname} está transmitindo
              </span>
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleWatch && onToggleWatch(sharer.id, true);
            }}
            className={`flex items-center gap-1.5 rounded-lg bg-primary text-on-primary font-headline font-bold transition hover:bg-primary/90 glow-pink ${
              compact ? 'px-2 py-1 text-[10px]' : 'px-4 py-2 text-xs'
            }`}
            title="Assistir Transmissão"
          >
            <Eye size={compact ? 12 : 16} />
            <span>{compact ? 'Assistir' : 'Assistir Transmissão'}</span>
          </button>
        </div>
      )}

      {/* Miniatura da faixa: só o selo de ao vivo e o apelido */}
      {compact && (
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1.5 z-10 min-w-0">
          <span className="bg-primary text-on-primary font-headline font-bold text-[9px] px-1.5 py-0.5 rounded flex-shrink-0">
            AO VIVO
          </span>
          <span className="bg-surface-container-lowest/80 backdrop-blur px-1.5 py-0.5 rounded text-[10px] font-headline font-semibold text-on-surface truncate">
            {sharer.nickname}
          </span>
        </div>
      )}

      {/* Badge de Transmissão */}
      {!compact && (
      <div className="absolute top-3 left-3 flex items-center gap-3 z-10">
        <span className="bg-primary text-on-primary font-headline font-bold text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 glow-pink">
          <span className="w-1.5 h-1.5 rounded-full bg-on-primary animate-pulse"></span>
          AO VIVO
        </span>
        <span className="bg-surface-container-lowest/80 backdrop-blur px-2.5 py-1 rounded-md text-xs font-headline font-semibold text-on-surface truncate max-w-[140px]">
          {sharer.nickname}
        </span>
        <span className={`bg-surface-container-lowest/80 backdrop-blur px-2 py-1 rounded-md text-[11px] font-label font-bold flex items-center gap-1 ${
          meta.preset === '1080p60' ? 'text-tertiary' : 'text-secondary'
        }`}>
          {meta.preset === '1080p60' && <Sparkles size={11} />}
          <span>{meta.label}</span>
        </span>
      </div>
      )}

      {/* Controles da Transmissão (cliques aqui não mudam o destaque) */}
      {!compact && (
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
        {!isSelf && isWatching && (
          <button
            onClick={() => onToggleWatch && onToggleWatch(sharer.id, false)}
            className="bg-surface-container-lowest/70 hover:bg-surface-container-high text-on-surface px-2.5 py-2 rounded-lg transition backdrop-blur flex items-center gap-1.5 text-xs font-headline font-semibold"
            title="Parar de Assistir"
          >
            <EyeOff size={16} />
            <span>Parar de assistir</span>
          </button>
        )}

        {!isSelf && isWatching && (
          <div className="relative">
            <button
              onClick={() => onToggleStreamMute && onToggleStreamMute(sharer.id)}
              onMouseEnter={() => setShowVolSlider(true)}
              className={`bg-surface-container-lowest/70 hover:bg-surface-container-high p-2 rounded-lg transition backdrop-blur flex items-center ${
                isStreamMuted ? 'text-error' : 'text-on-surface'
              }`}
              title={isStreamMuted ? 'Desmutar Transmissão' : 'Mutar Transmissão'}
            >
              {isStreamMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {showVolSlider && (
              <div
                onMouseLeave={() => setShowVolSlider(false)}
                className="absolute top-11 right-0 bg-surface-container p-3 rounded-xl shadow-xl border border-secondary/30 flex flex-col gap-2 w-48 z-50"
              >
                <div className="flex justify-between text-xs font-label font-bold text-on-surface">
                  <span className="truncate">Som de {sharer.nickname}</span>
                  <span className={streamVolume > 100 ? 'text-tertiary' : 'text-secondary'}>
                    {isStreamMuted ? '0%' : `${streamVolume}% ${streamVolume > 100 ? '🚀' : ''}`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={isStreamMuted ? 0 : streamVolume}
                  onChange={(e) => onStreamVolumeChange && onStreamVolumeChange(sharer.id, Number(e.target.value))}
                  className="w-full accent-secondary cursor-pointer"
                />
              </div>
            )}
          </div>
        )}

        {isWatching && (
          <button
            onClick={toggleFullscreen}
            className="bg-surface-container-lowest/70 hover:bg-surface-container-high text-on-surface p-2 rounded-lg transition backdrop-blur"
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        )}
      </div>
      )}
    </div>
  );
}

export default function VoiceCallView({
  channel,
  usersInCall = [],
  currentUser,
  speakingUsers = {},
  localScreenStream,
  livekitEngine,
  mediaState,
  onToggleMic,
  onToggleDeafen,
  onToggleScreenShare,
  localCameraTrack,
  cameraDeviceId,
  onToggleCamera,
  onSelectCamera,
  micDeviceId,
  speakerDeviceId,
  onSelectMic,
  onSelectSpeaker,
  onLeaveCall,
  userVolumes = {},
  locallyMutedUsers = {},
  onVolumeChange,
  onToggleLocalMute,
  onStreamVolumeChange,
  onToggleStreamMute,
  streamVolumes = {},
  streamMuted = {},
  noiseMode
}) {
  const [trackUpdateTick, setTrackUpdateTick] = useState(0);
  const [gridEl, setGridEl] = useState(null);
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });

  // Mede a área da grade para encaixar todos os tiles sem rolagem (como no Discord)
  useEffect(() => {
    if (!gridEl) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setGridSize({ width, height });
    });
    observer.observe(gridEl);
    return () => observer.disconnect();
  }, [gridEl]);

  // Escuta novas tracks de vídeo do LiveKit para re-renderizar cards instantaneamente
  useEffect(() => {
    if (livekitEngine) {
      livekitEngine.onRemoteTrackSubscribed = (userId, track, kind) => {
        setTrackUpdateTick((t) => t + 1);
      };
      livekitEngine.onRemoteTrackUnsubscribed = (userId, kind) => {
        setTrackUpdateTick((t) => t + 1);
      };
    }
  }, [livekitEngine]);

  // Vídeo da câmera de cada participante (preview local ou track recebida pelo LiveKit)
  const getCameraTrack = (u) =>
    u.id === currentUser?.id ? localCameraTrack : livekitEngine?.remoteCameraTracks?.get(u.id) || null;

  // Obter TODOS os usuários compartilhando tela
  const screenSharers = usersInCall.filter((u) => u.isScreenSharing);

  // A própria transmissão é sempre preview local; as dos outros só baixam depois de "Assistir"
  const isWatchingStream = (userId) => userId === currentUser?.id || !!livekitEngine?.isWatchingStream(userId);
  const handleToggleWatch = (userId, watching) => {
    livekitEngine?.setWatchingStream(userId, watching);
    setTrackUpdateTick((t) => t + 1);
  };

  // Ocultar participantes sem câmera (preferência lembrada entre as calls)
  const [hideNoVideo, setHideNoVideo] = useState(() => {
    try {
      return localStorage.getItem('dc_hide_no_video') === '1';
    } catch (e) {
      return false;
    }
  });
  const toggleHideNoVideo = () => {
    setHideNoVideo((prev) => {
      try {
        localStorage.setItem('dc_hide_no_video', prev ? '0' : '1');
      } catch (e) {}
      return !prev;
    });
  };
  const visibleUsers = hideNoVideo ? usersInCall.filter((u) => u.isCameraOn || !!getCameraTrack(u)) : usersInCall;

  // Participante ou transmissão em destaque (como no Discord); null = grade normal
  const [focused, setFocused] = useState(null);
  const focusedStream = focused?.type === 'stream' ? screenSharers.find((u) => u.id === focused.id) : null;
  const focusedUser = focused?.type === 'user' ? usersInCall.find((u) => u.id === focused.id) : null;
  const hasFocus = !!(focusedStream || focusedUser);

  // Volta para a grade se quem estava em destaque saiu da call ou parou de transmitir
  useEffect(() => {
    if (focused && !hasFocus) setFocused(null);
  }, [focused, hasFocus]);

  // Esc também volta para a grade (fora da tela cheia, onde o Esc só sai dela)
  useEffect(() => {
    if (!hasFocus) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) setFocused(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasFocus]);

  const isAiNoise = noiseMode && noiseMode !== 'manual';

  // Escolhe o número de colunas que gera o maior tile 16:9 cabendo na largura E na altura
  const GRID_GAP = 12;
  const MAX_TILE_WIDTH = 960;
  const fitTileWidth = (count, maxWidth) => {
    let best = 0;
    if (count > 0 && gridSize.width > 0 && gridSize.height > 0) {
      for (let cols = 1; cols <= count; cols++) {
        const rows = Math.ceil(count / cols);
        const byWidth = (gridSize.width - GRID_GAP * (cols - 1)) / cols;
        const byHeight = ((gridSize.height - GRID_GAP * (rows - 1)) / rows) * (16 / 9);
        best = Math.max(best, Math.min(byWidth, byHeight));
      }
    }
    return Math.floor(Math.min(best, maxWidth));
  };
  const tileWidth = fitTileWidth(visibleUsers.length, MAX_TILE_WIDTH);
  // No destaque o tile ocupa o palco inteiro
  const stageTileWidth = fitTileWidth(1, Infinity);

  const renderUserTile = (u, { compact = false, focusable = true } = {}) => (
    <UserTile
      user={u}
      isSelf={u.id === currentUser?.id}
      compact={compact}
      videoTrack={getCameraTrack(u)}
      trackUpdateTick={trackUpdateTick}
      isSpeaking={!!speakingUsers[u.id]}
      selfDeafened={currentUser?.isDeafened}
      userVolume={userVolumes[u.id] ?? 100}
      isLocallyMuted={!!locallyMutedUsers[u.id]}
      onVolumeChange={onVolumeChange}
      onToggleLocalMute={onToggleLocalMute}
      onClick={focusable ? () => setFocused({ type: 'user', id: u.id }) : undefined}
    />
  );

  const renderStreamCard = (sharer, { compact = false, focusable = true } = {}) => (
    <StreamCard
      key={sharer.id}
      sharer={sharer}
      isSelf={sharer.id === currentUser?.id}
      localScreenStream={localScreenStream}
      livekitEngine={livekitEngine}
      trackUpdateTick={trackUpdateTick}
      streamVolume={streamVolumes[sharer.id] ?? 100}
      isStreamMuted={!!streamMuted[sharer.id]}
      onStreamVolumeChange={onStreamVolumeChange}
      onToggleStreamMute={onToggleStreamMute}
      compact={compact}
      isWatching={isWatchingStream(sharer.id)}
      onToggleWatch={handleToggleWatch}
      onClick={focusable ? () => setFocused({ type: 'stream', id: sharer.id }) : undefined}
    />
  );

  return (
    <div className="flex-1 bg-background bg-grid flex flex-col h-full relative overflow-hidden select-none">
      {/* Cabeçalho da Chamada */}
      <div className="px-6 pt-4 pb-3 flex items-start justify-between gap-4 z-20">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-primary-container/60 text-primary flex items-center justify-center flex-shrink-0">
              <Volume2 size={18} />
            </span>
            <span className="font-headline font-bold text-2xl text-on-surface truncate">{channel?.name || 'Geral'}</span>
            {mediaState === 'connected' ? (
              <span className="font-label font-bold text-[11px] tracking-widest text-secondary glow-text-secondary uppercase flex-shrink-0">
                LiveKit WebRTC
              </span>
            ) : mediaState === 'reconnecting' ? (
              <span className="font-label font-bold text-[11px] tracking-widest text-error uppercase flex-shrink-0 animate-pulse">
                Reconectando...
              </span>
            ) : (
              <span className="font-label font-bold text-[11px] tracking-widest text-on-surface-variant uppercase flex-shrink-0 animate-pulse">
                Conectando...
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-label">
            {noiseMode && (
              <span className="flex items-center gap-1.5 bg-surface-container px-2 py-0.5 rounded text-on-surface">
                <Sparkles size={12} className="text-tertiary" />
                {isAiNoise ? 'Supressão de Ruído IA: ON' : 'Noise Gate Manual'}
              </span>
            )}
            {screenSharers.length > 0 && (
              <span className="flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                {screenSharers.length === 1 ? 'Transmissão Ativa' : `${screenSharers.length} Transmissões Ativas`}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-on-surface-variant">
              <Radio size={12} className="text-secondary" />
              <span className="text-on-surface font-bold">{usersInCall.length}</span> na chamada
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleHideNoVideo}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-headline font-semibold text-xs transition ${
              hideNoVideo
                ? 'bg-secondary-container/40 text-secondary hover:bg-secondary-container'
                : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest hover-glow-cyan'
            }`}
            title={hideNoVideo ? 'Mostrar todos os participantes' : 'Ocultar participantes sem vídeo'}
          >
            {hideNoVideo ? <Eye size={16} /> : <VideoOff size={16} />}
            <span>{hideNoVideo ? 'Mostrar todos' : 'Ocultar sem vídeo'}</span>
          </button>

          {hasFocus && (
            <button
              onClick={() => setFocused(null)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest hover-glow-cyan font-headline font-semibold text-xs transition"
              title="Voltar à grade (Esc)"
            >
              <LayoutGrid size={16} />
              <span>Voltar à grade</span>
            </button>
          )}
        </div>
      </div>

      {/* Área Central: Grade de Transmissões OU Grade de Participantes */}
      <div className={`flex-1 min-h-0 px-6 pb-4 flex flex-col ${screenSharers.length > 0 || hasFocus ? 'overflow-hidden' : 'overflow-visible'}`}>
        {hasFocus ? (
          // MODO DESTAQUE: participante ou transmissão escolhida em tamanho grande, o resto na faixa inferior
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            {focusedStream ? (
              <div className="flex-1 min-h-0 flex">{renderStreamCard(focusedStream, { focusable: false })}</div>
            ) : (
              <div ref={setGridEl} className="flex-1 min-h-0 flex items-center justify-center">
                {stageTileWidth > 0 && (
                  <div style={{ width: stageTileWidth }}>{renderUserTile(focusedUser, { focusable: false })}</div>
                )}
              </div>
            )}

            {/* Faixa inferior: clicar em uma miniatura troca o destaque */}
            <div className="flex items-end justify-center gap-3 flex-shrink-0">
              {screenSharers
                .filter((s) => s.id !== focusedStream?.id)
                .map((sharer) => (
                  <div key={`stream-${sharer.id}`} className="flex-1 min-w-0 max-w-44">
                    {renderStreamCard(sharer, { compact: true })}
                  </div>
                ))}
              {visibleUsers
                .filter((u) => u.id !== focusedUser?.id)
                .map((u) => (
                  <div key={u.id} className="flex-1 min-w-0 max-w-44">
                    {renderUserTile(u, { compact: true })}
                  </div>
                ))}
            </div>
          </div>
        ) : screenSharers.length > 0 ? (
          // MODO MULTI-TRANSMISSÃO: Enquadra 1, 2, 3 ou mais telas perfeitamente
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            <div className={`flex-1 min-h-0 grid gap-4 auto-rows-fr ${
              screenSharers.length === 1
                ? 'grid-cols-1'
                : screenSharers.length === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 auto-rows-fr'
            }`}>
              {screenSharers.map((sharer) => renderStreamCard(sharer))}
            </div>

            {/* Faixa inferior de miniaturas dos participantes */}
            <div className="flex items-end justify-center gap-3 flex-shrink-0">
              {visibleUsers.map((u) => (
                <div key={u.id} className="flex-1 min-w-0 max-w-44">
                  {renderUserTile(u, { compact: true })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          // MODO GRADE DE PARTICIPANTES (Nenhum compartilhamento ativo): tiles 16:9 que sempre cabem na tela
          <div ref={setGridEl} className="flex-1 min-h-0 flex flex-wrap items-center justify-center content-center" style={{ gap: GRID_GAP }}>
            {tileWidth > 0 &&
              visibleUsers.map((u) => (
                <div key={u.id} style={{ width: tileWidth }}>
                  {renderUserTile(u, { compact: tileWidth < 260 })}
                </div>
              ))}
            {visibleUsers.length === 0 && (
              <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                <VideoOff size={32} />
                <span className="text-sm font-label">Ninguém está com a câmera ligada</span>
                <button
                  onClick={toggleHideNoVideo}
                  className="px-3.5 py-2 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-headline font-semibold text-xs transition"
                >
                  Mostrar todos
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barra de Controles Inferior */}
      <div className="px-6 py-4 bg-surface-container-low/90 backdrop-blur-xl border-t border-outline-variant/40 flex items-center justify-between gap-4 z-30">
        {/* Mute / Desativar Som */}
        <div className="flex items-center gap-2">
          <DeviceSplitButton
            kind="audioinput"
            menuTitle="Microfone"
            selectedId={micDeviceId}
            onSelectDevice={onSelectMic}
            onClick={onToggleMic}
            align="left"
            className={
              currentUser?.isMuted
                ? 'bg-error-container text-error'
                : 'bg-secondary-container/40 text-secondary hover:bg-secondary-container'
            }
            title={currentUser?.isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
          >
            {currentUser?.isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            <span>{currentUser?.isMuted ? 'Mutado' : 'Microfone'}</span>
          </DeviceSplitButton>

          <DeviceSplitButton
            kind="audiooutput"
            menuTitle="Alto-falante"
            selectedId={speakerDeviceId}
            onSelectDevice={onSelectSpeaker}
            onClick={onToggleDeafen}
            align="left"
            className={
              currentUser?.isDeafened
                ? 'bg-error-container text-error'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
            }
            title={currentUser?.isDeafened ? 'Ativar Som' : 'Desativar Som'}
          >
            <Headphones size={16} />
            <span>{currentUser?.isDeafened ? 'Som Desativado' : 'Desativar Som'}</span>
          </DeviceSplitButton>
        </div>

        {/* Câmera e Compartilhar Tela */}
        <div className="flex items-center gap-2">
          <DeviceSplitButton
            kind="videoinput"
            menuTitle="Câmera"
            selectedId={cameraDeviceId}
            onSelectDevice={onSelectCamera}
            onClick={onToggleCamera}
            className={
              currentUser?.isCameraOn
                ? 'bg-secondary-container text-secondary shadow-[0_0_12px_rgba(0,255,204,0.3)]'
                : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
            }
            title={currentUser?.isCameraOn ? 'Desligar Câmera' : 'Ligar Câmera (720p 30 FPS)'}
          >
            {currentUser?.isCameraOn ? <VideoOff size={16} /> : <Video size={16} />}
            <span>{currentUser?.isCameraOn ? 'Desligar Câmera' : 'Câmera'}</span>
          </DeviceSplitButton>

          <button
            onClick={onToggleScreenShare}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-headline font-semibold text-xs transition ${
              currentUser?.isScreenSharing
                ? 'bg-secondary-container text-secondary shadow-[0_0_12px_rgba(0,255,204,0.3)]'
                : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest hover-glow-cyan'
            }`}
            title="Compartilhar Tela (720p 30/60 FPS ou 1080p 60 FPS)"
          >
            {currentUser?.isScreenSharing ? (
              <>
                <ScreenShareOff size={16} />
                <span>Parar Tela</span>
              </>
            ) : (
              <>
                <ScreenShare size={16} />
                <span>Transmitir Tela</span>
              </>
            )}
          </button>
        </div>

        {/* Botão Desconectar da Chamada */}
        <button
          onClick={onLeaveCall}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-error hover:bg-error/90 text-on-error font-headline font-bold text-xs transition shadow-[0_0_16px_rgba(255,68,68,0.35)]"
          title="Desconectar da Chamada"
        >
          <PhoneOff size={16} />
          <span>Desconectar</span>
        </button>
      </div>
    </div>
  );
}
