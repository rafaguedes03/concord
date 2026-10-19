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
  Sparkles
} from 'lucide-react';
import UserTile from './UserTile';

// Componente para renderizar individualmente a transmissão de cada participante
function StreamCard({
  sharer,
  isSelf,
  localScreenStream,
  livekitEngine,
  screenEngine,
  streamMeta,
  streamVolume = 100,
  isStreamMuted = false,
  onStreamVolumeChange,
  onToggleStreamMute
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVolSlider, setShowVolSlider] = useState(false);
  const [usingLiveKit, setUsingLiveKit] = useState(false);

  useEffect(() => {
    // 1. Preview local da minha tela
    if (isSelf && localScreenStream && videoRef.current) {
      videoRef.current.srcObject = localScreenStream;
      videoRef.current.play().catch(() => {});
      return () => {
        if (videoRef.current) videoRef.current.srcObject = null;
      };
    }

    // 2. Transmissão do Amigo via LiveKit (Hardware GPU Video Track se disponível)
    let liveKitTrack = null;
    if (!isSelf && livekitEngine) {
      const track = livekitEngine.remoteVideoTracks?.get(sharer.id);
      if (track && videoRef.current) {
        liveKitTrack = track;
        setUsingLiveKit(true);
        track.attach(videoRef.current);
        videoRef.current.play().catch(() => {});
      } else {
        setUsingLiveKit(false);
      }
    }

    // 3. Transmissão do Amigo via Motor Socket (Sempre ativo para garantir que todos vejam)
    let removeListener = null;
    if (!isSelf && screenEngine && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { alpha: false });
      removeListener = screenEngine.addFrameListener((userId, bitmap) => {
        if (userId === sharer.id && ctx) {
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        }
      });
    }

    return () => {
      if (liveKitTrack && videoRef.current) {
        try { liveKitTrack.detach(videoRef.current); } catch (e) {}
      }
      if (removeListener) {
        removeListener();
      }
    };
  }, [isSelf, localScreenStream, sharer.id, livekitEngine, screenEngine]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const meta = streamMeta[sharer.id] || { width: 1280, height: 720, label: '720p 60 FPS', preset: '720p60' };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-surface-container-lowest rounded-2xl overflow-hidden flex items-center justify-center border border-primary/30 shadow-[inset_0_0_12px_rgba(255,45,120,0.1)] group min-h-0 min-w-0"
    >
      {/* Canvas para recepção instantânea via Socket (100% garantido na porta 3002) */}
      <canvas
        ref={canvasRef}
        width={meta.width}
        height={meta.height}
        style={{ display: (!isSelf && !usingLiveKit) ? 'block' : 'none' }}
        className="absolute inset-0 w-full h-full object-contain"
      />

      {/* Video para Preview Local próprio ou LiveKit WebRTC */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: (isSelf || usingLiveKit) ? 'block' : 'none' }}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />

      {/* Badge de Transmissão */}
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

      {/* Controles da Transmissão */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        {!isSelf && (
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

        <button
          onClick={toggleFullscreen}
          className="bg-surface-container-lowest/70 hover:bg-surface-container-high text-on-surface p-2 rounded-lg transition backdrop-blur"
          title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>
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
  screenEngine,
  onToggleMic,
  onToggleDeafen,
  onToggleScreenShare,
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
  const [streamMeta, setStreamMeta] = useState({});
  const [, setTrackUpdateTick] = useState(0);
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

  // Obter TODOS os usuários compartilhando tela
  const screenSharers = usersInCall.filter((u) => u.isScreenSharing);

  // Escuta metadados de resolução/FPS para cada transmissor
  useEffect(() => {
    if (screenEngine) {
      screenEngine.onShareStarted = (userId, meta) => {
        let label = '720p 60 FPS';
        if (meta.preset === '720p30') label = '720p 30 FPS';
        if (meta.preset === '1080p60') label = '1080p 60 FPS';

        setStreamMeta((prev) => ({
          ...prev,
          [userId]: {
            preset: meta.preset || '720p60',
            width: meta.width || 1280,
            height: meta.height || 720,
            label
          }
        }));
      };
    }
  }, [screenEngine]);

  // Sincroniza stream próprio
  useEffect(() => {
    if (currentUser?.isScreenSharing && screenEngine?.currentPresetKey) {
      const p = screenEngine.currentPresetKey;
      let label = '720p 60 FPS';
      let w = 1280, h = 720;
      if (p === '720p30') { label = '720p 30 FPS'; }
      if (p === '1080p60') { label = '1080p 60 FPS'; w = 1920; h = 1080; }
      setStreamMeta((prev) => ({
        ...prev,
        [currentUser.id]: { preset: p, width: w, height: h, label }
      }));
    }
  }, [currentUser?.isScreenSharing, currentUser?.id, screenEngine?.currentPresetKey]);

  const isAiNoise = noiseMode && noiseMode !== 'manual';

  // Escolhe o número de colunas que gera o maior tile 16:9 cabendo na largura E na altura
  const GRID_GAP = 12;
  const MAX_TILE_WIDTH = 960;
  let tileWidth = 0;
  const count = usersInCall.length;
  if (count > 0 && gridSize.width > 0 && gridSize.height > 0) {
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      const byWidth = (gridSize.width - GRID_GAP * (cols - 1)) / cols;
      const byHeight = ((gridSize.height - GRID_GAP * (rows - 1)) / rows) * (16 / 9);
      tileWidth = Math.max(tileWidth, Math.min(byWidth, byHeight));
    }
    tileWidth = Math.floor(Math.min(tileWidth, MAX_TILE_WIDTH));
  }

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
            <span className="font-label font-bold text-[11px] tracking-widest text-secondary glow-text-secondary uppercase flex-shrink-0">
              LiveKit WebRTC
            </span>
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
      </div>

      {/* Área Central: Grade de Transmissões OU Grade de Participantes */}
      <div className={`flex-1 min-h-0 px-6 pb-4 flex flex-col ${screenSharers.length > 0 ? 'overflow-hidden' : 'overflow-visible'}`}>
        {screenSharers.length > 0 ? (
          // MODO MULTI-TRANSMISSÃO: Enquadra 1, 2, 3 ou mais telas perfeitamente
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            <div className={`flex-1 min-h-0 grid gap-4 auto-rows-fr ${
              screenSharers.length === 1
                ? 'grid-cols-1'
                : screenSharers.length === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 auto-rows-fr'
            }`}>
              {screenSharers.map((sharer) => (
                <StreamCard
                  key={sharer.id}
                  sharer={sharer}
                  isSelf={sharer.id === currentUser?.id}
                  localScreenStream={localScreenStream}
                  livekitEngine={livekitEngine}
                  screenEngine={screenEngine}
                  streamMeta={streamMeta}
                  streamVolume={streamVolumes[sharer.id] ?? 100}
                  isStreamMuted={!!streamMuted[sharer.id]}
                  onStreamVolumeChange={onStreamVolumeChange}
                  onToggleStreamMute={onToggleStreamMute}
                />
              ))}
            </div>

            {/* Faixa inferior de miniaturas dos participantes */}
            <div className="flex items-end justify-center gap-3 flex-shrink-0">
              {usersInCall.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <div key={u.id} className="flex-1 min-w-0 max-w-44">
                    <UserTile
                      user={u}
                      isSelf={isSelf}
                      compact
                      isSpeaking={!!speakingUsers[u.id]}
                      selfDeafened={currentUser?.isDeafened}
                      userVolume={userVolumes[u.id] ?? 100}
                      isLocallyMuted={!!locallyMutedUsers[u.id]}
                      onVolumeChange={onVolumeChange}
                      onToggleLocalMute={onToggleLocalMute}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // MODO GRADE DE PARTICIPANTES (Nenhum compartilhamento ativo): tiles 16:9 que sempre cabem na tela
          <div ref={setGridEl} className="flex-1 min-h-0 flex flex-wrap items-center justify-center content-center" style={{ gap: GRID_GAP }}>
            {tileWidth > 0 &&
              usersInCall.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <div key={u.id} style={{ width: tileWidth }}>
                    <UserTile
                      user={u}
                      isSelf={isSelf}
                      compact={tileWidth < 260}
                      isSpeaking={!!speakingUsers[u.id]}
                      selfDeafened={currentUser?.isDeafened}
                      userVolume={userVolumes[u.id] ?? 100}
                      isLocallyMuted={!!locallyMutedUsers[u.id]}
                      onVolumeChange={onVolumeChange}
                      onToggleLocalMute={onToggleLocalMute}
                    />
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Barra de Controles Inferior */}
      <div className="px-6 py-4 bg-surface-container-low/90 backdrop-blur-xl border-t border-outline-variant/40 flex items-center justify-between gap-4 z-30">
        {/* Mute / Desativar Som */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMic}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-headline font-semibold text-xs transition ${
              currentUser?.isMuted
                ? 'bg-error-container text-error'
                : 'bg-secondary-container/40 text-secondary hover:bg-secondary-container'
            }`}
            title={currentUser?.isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
          >
            {currentUser?.isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            <span>{currentUser?.isMuted ? 'Mutado' : 'Microfone'}</span>
          </button>

          <button
            onClick={onToggleDeafen}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-headline font-semibold text-xs transition ${
              currentUser?.isDeafened
                ? 'bg-error-container text-error'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
            }`}
            title={currentUser?.isDeafened ? 'Ativar Som' : 'Desativar Som'}
          >
            <Headphones size={16} />
            <span>{currentUser?.isDeafened ? 'Som Desativado' : 'Desativar Som'}</span>
          </button>
        </div>

        {/* Botão de Compartilhar Tela */}
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
