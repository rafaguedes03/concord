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
      className="relative flex-1 bg-black rounded-lg overflow-hidden flex items-center justify-center border border-[#2b2d31] shadow-2xl group min-h-[220px]"
    >
      {/* Canvas para recepção instantânea via Socket (100% garantido na porta 3002) */}
      <canvas
        ref={canvasRef}
        width={meta.width}
        height={meta.height}
        style={{ display: (!isSelf && !usingLiveKit) ? 'block' : 'none' }}
        className="w-full h-full object-contain"
      />

      {/* Video para Preview Local próprio ou LiveKit WebRTC */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: (isSelf || usingLiveKit) ? 'block' : 'none' }}
        className="w-full h-full object-contain pointer-events-none"
      />

      {/* Badge de Transmissão */}
      <div className="absolute top-3 left-3 flex items-center space-x-2 bg-[#111214]/85 backdrop-blur px-3 py-1.5 rounded-md border border-[#2b2d31] text-xs font-bold text-white z-10 shadow">
        <span className="bg-[#ed4245] text-[10px] uppercase px-1.5 py-0.5 rounded tracking-wide">
          AO VIVO
        </span>
        <span className="truncate max-w-[120px]">{sharer.nickname}</span>
        <span className="text-discord-muted">|</span>
        <span className={`px-1.5 py-0.5 rounded text-[11px] flex items-center space-x-1 ${
          meta.preset === '1080p60'
            ? 'text-[#FEE75C] bg-[#FEE75C]/20 font-extrabold'
            : 'text-[#5865F2] bg-[#5865F2]/20 font-bold'
        }`}>
          {meta.preset === '1080p60' && <Sparkles size={11} className="mr-0.5" />}
          <span>{meta.label}</span>
        </span>
      </div>

      {/* Controles da Transmissão */}
      <div className="absolute top-3 right-3 flex items-center space-x-2 z-10">
        {!isSelf && (
          <div className="relative">
            <button
              onClick={() => onToggleStreamMute && onToggleStreamMute(sharer.id)}
              onMouseEnter={() => setShowVolSlider(true)}
              className={`bg-[#111214]/80 hover:bg-[#35373c] p-2 rounded-md transition backdrop-blur flex items-center space-x-1 ${
                isStreamMuted ? 'text-discord-red' : 'text-white'
              }`}
              title={isStreamMuted ? 'Desmutar Transmissão' : 'Mutar Transmissão'}
            >
              {isStreamMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {showVolSlider && (
              <div
                onMouseLeave={() => setShowVolSlider(false)}
                className="absolute top-10 right-0 bg-[#2b2d31] p-3 rounded shadow-xl border border-[#3f4147] flex flex-col space-y-2 w-44 z-50"
              >
                <div className="flex justify-between text-xs text-white font-bold">
                  <span>Som de {sharer.nickname}</span>
                  <span className={`${streamVolume > 100 ? 'text-discord-green font-black' : 'text-[#5865F2]'}`}>
                    {isStreamMuted ? '0%' : `${streamVolume}% ${streamVolume > 100 ? '🚀' : ''}`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={isStreamMuted ? 0 : streamVolume}
                  onChange={(e) => onStreamVolumeChange && onStreamVolumeChange(sharer.id, Number(e.target.value))}
                  className="w-full accent-[#5865F2] cursor-pointer"
                />
              </div>
            )}
          </div>
        )}

        <button
          onClick={toggleFullscreen}
          className="bg-[#111214]/80 hover:bg-[#35373c] text-white p-2 rounded-md transition backdrop-blur"
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
  streamMuted = {}
}) {
  const [streamMeta, setStreamMeta] = useState({});
  const [, setTrackUpdateTick] = useState(0);

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

  return (
    <div className="flex-1 bg-discord-dark flex flex-col h-full relative overflow-hidden select-none">
      {/* Cabeçalho da Chamada */}
      <div className="h-12 border-b border-[#1f2023] px-4 flex items-center justify-between bg-discord-dark z-20">
        <div className="flex items-center space-x-2">
          <span className="text-discord-muted font-bold text-lg">🔊</span>
          <span className="text-white font-bold text-base">{channel?.name || 'Geral'}</span>
          <span className="bg-[#23a55a] text-[10px] text-white font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            <span>LIVEKIT WEBRTC</span>
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs text-discord-muted font-semibold">
          <div className="flex items-center space-x-1.5 bg-[#2b2d31] px-2.5 py-1 rounded">
            <Radio size={14} className="text-discord-green" />
            <span className="text-white">{usersInCall.length} na chamada</span>
          </div>
        </div>
      </div>

      {/* Área Central: Grade de Transmissões OU Grade de Participantes */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col">
        {screenSharers.length > 0 ? (
          // MODO MULTI-TRANSMISSÃO: Enquadra 1, 2, 3 ou mais telas perfeitamente
          <div className="flex-1 flex flex-col space-y-3">
            <div className={`flex-1 grid gap-3 ${
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
            <div className="h-28 flex items-center space-x-3 overflow-x-auto pb-1 flex-shrink-0">
              {usersInCall.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <div key={u.id} className="w-36 h-24 flex-shrink-0">
                    <UserTile
                      user={u}
                      isSelf={isSelf}
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
          // MODO GRADE DE PARTICIPANTES (Nenhum compartilhamento ativo)
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr items-stretch">
            {usersInCall.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <UserTile
                  key={u.id}
                  user={u}
                  isSelf={isSelf}
                  isSpeaking={!!speakingUsers[u.id]}
                  selfDeafened={currentUser?.isDeafened}
                  userVolume={userVolumes[u.id] ?? 100}
                  isLocallyMuted={!!locallyMutedUsers[u.id]}
                  onVolumeChange={onVolumeChange}
                  onToggleLocalMute={onToggleLocalMute}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Barra de Controles Inferior Estilo Discord (Pill Bar) */}
      <div className="h-20 bg-discord-darkest/95 backdrop-blur border-t border-[#1e1f22] flex items-center justify-center px-6 z-30">
        <div className="flex items-center space-x-4 bg-[#2b2d31] px-5 py-2.5 rounded-full shadow-xl border border-[#35373c]">
          {/* Botão de Compartilhar Tela */}
          <button
            onClick={onToggleScreenShare}
            className={`flex items-center space-x-2 px-3 py-2 rounded-full font-bold text-xs transition duration-150 ${
              currentUser?.isScreenSharing
                ? 'bg-discord-green text-white hover:bg-discord-green-hover'
                : 'bg-[#313338] text-white hover:bg-[#3f4147]'
            }`}
            title="Compartilhar Tela (720p 30/60 FPS ou 1080p 60 FPS)"
          >
            {currentUser?.isScreenSharing ? (
              <>
                <ScreenShareOff size={18} />
                <span>Parar Tela</span>
              </>
            ) : (
              <>
                <ScreenShare size={18} />
                <span>Transmitir Tela</span>
              </>
            )}
          </button>

          {/* Botão Mute Microfone */}
          <button
            onClick={onToggleMic}
            className={`p-2.5 rounded-full transition duration-150 ${
              currentUser?.isMuted
                ? 'bg-discord-red text-white hover:bg-discord-red-hover'
                : 'bg-[#313338] text-white hover:bg-[#3f4147]'
            }`}
            title={currentUser?.isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
          >
            {currentUser?.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Botão Deafen (Ensurdecer fone) */}
          <button
            onClick={onToggleDeafen}
            className={`p-2.5 rounded-full transition duration-150 ${
              currentUser?.isDeafened
                ? 'bg-discord-red text-white hover:bg-discord-red-hover'
                : 'bg-[#313338] text-white hover:bg-[#3f4147]'
            }`}
            title={currentUser?.isDeafened ? 'Ativar Áudio do Fone' : 'Ensurdecer (Desativar Fone)'}
          >
            <Headphones size={20} />
          </button>

          {/* Botão Desconectar da Chamada */}
          <button
            onClick={onLeaveCall}
            className="p-2.5 rounded-full bg-discord-red text-white hover:bg-discord-red-hover transition duration-150"
            title="Desconectar da Chamada"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
