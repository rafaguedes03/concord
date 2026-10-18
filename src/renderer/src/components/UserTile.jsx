import React, { useState } from 'react';
import { Mic, MicOff, Headphones, Volume2, VolumeX, Tv } from 'lucide-react';

export default function UserTile({
  user,
  isSelf,
  isSpeaking,
  selfDeafened,
  onVolumeChange,
  onToggleLocalMute,
  userVolume = 100,
  isLocallyMuted = false
}) {
  const [showVolumePopup, setShowVolumePopup] = useState(false);

  const initialLetter = (user.nickname || '?').charAt(0).toUpperCase();

  const handleSliderChange = (e) => {
    const val = Number(e.target.value);
    if (!isNaN(val) && onVolumeChange) {
      onVolumeChange(user.id, val);
    }
  };

  return (
    <div
      className={`relative bg-[#111214] rounded-lg overflow-hidden flex flex-col items-center justify-center p-4 min-h-[170px] transition-all border-2 ${
        isSpeaking ? 'border-discord-green shadow-[0_0_15px_rgba(35,165,90,0.4)]' : 'border-[#1e1f22]'
      }`}
    >
      {/* Badges superiores */}
      <div className="absolute top-2 left-2 flex items-center space-x-1.5 z-10">
        {user.isScreenSharing && (
          <span className="bg-[#ed4245] text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center space-x-1 shadow">
            <Tv size={11} />
            <span>AO VIVO</span>
          </span>
        )}
      </div>

      <div className="absolute top-2 right-2 flex items-center space-x-1.5 z-10">
        {user.isMuted && (
          <span className="bg-[#da373c] text-white p-1 rounded-full shadow" title="Microfone Desativado">
            <MicOff size={13} />
          </span>
        )}
        {user.isDeafened && (
          <span className="bg-[#da373c] text-white p-1 rounded-full shadow" title="Áudio Desativado (Ensurdecido)">
            <Headphones size={13} />
          </span>
        )}
        {isLocallyMuted && !isSelf && (
          <span className="bg-amber-600 text-white p-1 rounded-full shadow" title="Mutado localmente por você">
            <VolumeX size={13} />
          </span>
        )}
      </div>

      {/* Avatar Central */}
      <div className="relative my-auto">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg transition-transform duration-200 overflow-hidden ${
            isSpeaking ? 'scale-105 ring-4 ring-discord-green' : ''
          }`}
          style={{ backgroundColor: user.avatarColor || '#5865F2' }}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.nickname} className="w-full h-full object-cover" />
          ) : (
            initialLetter
          )}
        </div>
      </div>

      {/* Barra Inferior com Apelido e Controles */}
      <div className="w-full flex items-center justify-between mt-2 pt-2 border-t border-[#1e1f22] z-10">
        <div className="flex items-center space-x-1.5 truncate max-w-[140px]">
          <span className="text-sm font-semibold text-white truncate">
            {user.nickname}
          </span>
          {isSelf && (
            <span className="text-[10px] text-discord-muted bg-[#2b2d31] px-1 py-0.5 rounded">
              Você
            </span>
          )}
        </div>

        {/* Botão de Controle de Volume para outros participantes */}
        {!isSelf && (
          <div className="relative">
            <button
              onClick={() => setShowVolumePopup(!showVolumePopup)}
              className={`p-1.5 rounded hover:bg-[#35373c] transition ${
                isLocallyMuted ? 'text-discord-red' : 'text-discord-muted hover:text-white'
              }`}
              title="Ajustar Volume / Mutar Usuário"
            >
              {isLocallyMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {/* Menu Popup de Volume Individual */}
            {showVolumePopup && (
              <div
                className="absolute bottom-8 right-0 bg-[#2b2d31] p-3 rounded-md shadow-2xl border border-[#1e1f22] w-52 z-50 flex flex-col space-y-3"
                onMouseLeave={() => setShowVolumePopup(false)}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-discord-text">Volume de {user.nickname}</span>
                  <span className={`${userVolume > 100 ? 'text-discord-green font-black flex items-center space-x-1' : 'text-[#5865F2]'}`}>
                    <span>{userVolume}%</span>
                    {userVolume > 100 && <span className="text-[10px] bg-discord-green/20 px-1 rounded">🚀 Boost</span>}
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="250"
                  step="5"
                  value={userVolume}
                  onChange={handleSliderChange}
                  className="w-full accent-[#5865F2] cursor-pointer"
                />

                <button
                  type="button"
                  onClick={() => onToggleLocalMute && onToggleLocalMute(user.id)}
                  className={`w-full py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                    isLocallyMuted
                      ? 'bg-discord-green hover:bg-discord-green-hover text-white'
                      : 'bg-discord-red hover:bg-discord-red-hover text-white'
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
    </div>
  );
}
