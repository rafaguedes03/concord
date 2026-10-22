import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Headphones, Volume2, VolumeX, Tv, AudioLines } from 'lucide-react';

export default function UserTile({
  user,
  isSelf,
  isSpeaking,
  selfDeafened,
  onVolumeChange,
  onToggleLocalMute,
  userVolume = 100,
  isLocallyMuted = false,
  compact = false,
  videoTrack = null,
  trackUpdateTick = 0
}) {
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const videoRef = useRef(null);
  const hasVideo = !!videoTrack;

  // Câmera do participante no lugar do avatar (o adaptiveStream escolhe a camada pelo tamanho do tile)
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoTrack || !videoEl) return undefined;
    videoTrack.attach(videoEl);
    videoEl.play().catch(() => {});
    return () => {
      try { videoTrack.detach(videoEl); } catch (e) {}
    };
  }, [videoTrack, trackUpdateTick]);

  const initialLetter = (user.nickname || '?').charAt(0).toUpperCase();

  const handleSliderChange = (e) => {
    const val = Number(e.target.value);
    if (!isNaN(val) && onVolumeChange) {
      onVolumeChange(user.id, val);
    }
  };

  // Badge de estado no topo (prioridade: transmitindo > som desativado > mutado > falando)
  let badge = null;
  if (user.isScreenSharing) badge = { label: 'Ao Vivo', cls: 'bg-primary text-on-primary', icon: <Tv size={11} /> };
  else if (user.isDeafened) badge = { label: 'Som Desativado', cls: 'bg-error-container text-error', icon: <Headphones size={11} /> };
  else if (user.isMuted) badge = { label: 'Mutado', cls: 'bg-error-container text-error', icon: <MicOff size={11} /> };
  else if (isSpeaking) badge = { label: 'Falando', cls: 'bg-secondary-container/50 text-secondary', icon: <AudioLines size={11} className="animate-pulse" /> };

  return (
    <div
      className={`group relative w-full aspect-video rounded-xl bg-surface-container shadow-md flex flex-col items-center justify-between transition-transform hover:-translate-y-0.5 ${
        compact ? 'p-2' : 'p-3'
      } ${hasVideo && isSpeaking ? 'ring-2 ring-secondary glow-cyan' : ''}`}
    >
      {/* Vídeo da câmera cobrindo o tile (preview próprio espelhado) */}
      {hasVideo && (
        <div className="absolute inset-0 rounded-xl overflow-hidden bg-surface-container-lowest">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover pointer-events-none ${isSelf ? '-scale-x-100' : ''}`}
          />
        </div>
      )}

      {/* Topo: badge de estado e indicador de mute local */}
      {!compact && (
        <div className="relative w-full h-5 flex items-center justify-between">
          {badge ? (
            <span className={`flex items-center gap-1 text-[10px] font-label font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badge.cls}`}>
              {badge.icon}
              <span>{badge.label}</span>
            </span>
          ) : (
            <span />
          )}
          {isLocallyMuted && !isSelf && (
            <VolumeX size={14} className="text-tertiary" title="Mutado localmente por você" />
          )}
        </div>
      )}

      {/* Avatar com halo pulsante quando fala (some quando a câmera está ligada) */}
      {hasVideo ? (
        <div className="flex-1" />
      ) : (
        <div className={`relative ${compact ? 'w-[26%] max-w-12' : 'w-[22%] max-w-28'} aspect-square my-1`}>
          {isSpeaking && (
            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-secondary to-primary blur halo-shimmer" />
          )}
          <div
            className={`relative w-full h-full rounded-2xl flex items-center justify-center text-on-surface font-bold overflow-hidden ${
              compact ? 'text-base' : 'text-2xl'
            } ${isSpeaking ? 'ring-2 ring-secondary glow-cyan' : 'ring-2 ring-outline-variant'}`}
            style={{ backgroundColor: user.avatarColor || '#b3004e' }}
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.nickname} className="w-full h-full object-cover" />
            ) : (
              initialLetter
            )}
          </div>
          {/* Selo do microfone no canto do avatar */}
          {(isSpeaking || user.isMuted || user.isDeafened) && (
            <span
              className={`absolute -bottom-1 -right-1 rounded-full flex items-center justify-center ${
                compact ? 'w-4 h-4' : 'w-6 h-6'
              } ${
                user.isDeafened || user.isMuted
                  ? 'bg-surface-container-lowest text-error'
                  : 'bg-secondary text-on-secondary'
              }`}
            >
              {user.isDeafened ? (
                <Headphones size={compact ? 9 : 13} />
              ) : user.isMuted ? (
                <MicOff size={compact ? 9 : 13} />
              ) : (
                <Mic size={compact ? 9 : 13} />
              )}
            </span>
          )}
        </div>
      )}

      {/* Apelido e barras de áudio (com fundo translúcido sobre o vídeo) */}
      <div
        className={`relative min-w-0 ${
          hasVideo
            ? 'self-start max-w-[80%] flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-container-lowest/70 backdrop-blur'
            : 'w-full text-center'
        }`}
      >
        {hasVideo && (user.isDeafened || user.isMuted) && (
          <span className="text-error flex-shrink-0">
            {user.isDeafened ? <Headphones size={compact ? 10 : 12} /> : <MicOff size={compact ? 10 : 12} />}
          </span>
        )}
        <p className={`font-headline font-bold text-on-surface truncate flex items-center justify-center gap-1.5 ${compact ? 'text-[11px]' : 'text-sm'}`}>
          <span className="truncate">{user.nickname}</span>
          {isSelf && <span className="text-[9px] font-label font-bold uppercase text-secondary flex-shrink-0">Você</span>}
        </p>
        {!compact && !hasVideo && (
          <div className="flex items-center justify-center gap-1 h-3 mt-1">
            {isSpeaking && (
              <>
                <span className="w-1 bg-secondary rounded h-1.5 animate-pulse" />
                <span className="w-1 bg-secondary rounded h-3 animate-pulse" style={{ animationDelay: '0.1s' }} />
                <span className="w-1 bg-secondary rounded h-2.5 animate-pulse" style={{ animationDelay: '0.2s' }} />
                <span className="w-1 bg-secondary rounded h-1 animate-pulse" style={{ animationDelay: '0.3s' }} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Botão de Controle de Volume para outros participantes (aparece no hover) */}
      {!isSelf && (
        <div className="absolute bottom-2 right-2 z-20">
          <button
            onClick={() => setShowVolumePopup(!showVolumePopup)}
            className={`p-1.5 rounded-md bg-surface-container-lowest/80 backdrop-blur transition ${
              showVolumePopup || isLocallyMuted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            } ${isLocallyMuted ? 'text-error' : 'text-on-surface-variant hover:text-secondary'}`}
            title="Ajustar Volume / Mutar Usuário"
          >
            {isLocallyMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          {/* Menu Popup de Volume Individual */}
          {showVolumePopup && (
            <div
              className="absolute bottom-9 right-0 bg-surface-container p-3 rounded-xl shadow-2xl border border-secondary/30 w-52 z-50 flex flex-col gap-3"
              onMouseLeave={() => setShowVolumePopup(false)}
            >
              <div className="flex items-center justify-between text-xs font-label font-bold">
                <span className="text-on-surface truncate">Volume de {user.nickname}</span>
                <span className={`flex items-center gap-1 ${userVolume > 100 ? 'text-tertiary' : 'text-secondary'}`}>
                  <span>{userVolume}%</span>
                  {userVolume > 100 && <span className="text-[10px] bg-tertiary/15 px-1 rounded">🚀 Boost</span>}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="250"
                step="5"
                value={userVolume}
                onChange={handleSliderChange}
                className="w-full accent-secondary cursor-pointer"
              />

              <button
                type="button"
                onClick={() => onToggleLocalMute && onToggleLocalMute(user.id)}
                className={`w-full py-1.5 px-2 rounded-lg text-xs font-headline font-semibold flex items-center justify-center gap-1.5 transition ${
                  isLocallyMuted
                    ? 'bg-secondary-container/60 hover:bg-secondary-container text-secondary'
                    : 'bg-error-container/60 hover:bg-error-container text-error'
                }`}
              >
                {isLocallyMuted ? (
                  <>
                    <Volume2 size={14} />
                    <span>Desmutar Usuário</span>
                  </>
                ) : (
                  <>
                    <VolumeX size={14} />
                    <span>Mutar para Mim</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
