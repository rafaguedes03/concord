import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Volume2, Server, Tv, Check, Shield, Sliders, Sparkles, Camera, Copy, CheckCheck } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  currentUser,
  serverAddress,
  onUpdateNickname,
  onUpdateAvatar,
  persistentUserId,
  onReconnectWithNewServer,
  noiseMode = 'auto',
  noiseGateEnabled = true,
  noiseGateThreshold = 15,
  onUpdateNoiseGate
}) {
  const [nickname, setNickname] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [mode, setMode] = useState(noiseMode);
  const [noiseEnabled, setNoiseEnabled] = useState(noiseGateEnabled);
  const [noiseThreshold, setNoiseThreshold] = useState(noiseGateThreshold);
  const [micLevel, setMicLevel] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatarUrl || null);

  const audioContextRef = useRef(null);
  const micStreamRef = useRef(null);
  const animFrameRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (currentUser?.nickname) setNickname(currentUser.nickname);
    if (currentUser?.avatarUrl) setAvatarPreview(currentUser.avatarUrl);
    if (serverAddress) setServerUrl(serverAddress);
    setMode(noiseMode);
    setNoiseEnabled(noiseGateEnabled);
    setNoiseThreshold(noiseGateThreshold);
  }, [currentUser, serverAddress, noiseMode, noiseGateEnabled, noiseGateThreshold, isOpen]);

  // Medidor de Microfone em tempo real
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((stream) => {
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkVolume = () => {
          if (isCancelled) return;
          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const level = Math.min(100, Math.round((avg / 128) * 100));
          setMicLevel(level);

          animFrameRef.current = requestAnimationFrame(checkVolume);
        };

        checkVolume();
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      setMicLevel(0);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Redimensiona para foto de perfil quadrada de 256x256
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Centraliza e recorta quadrado perfeito
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

        setAvatarPreview(dataUrl);
        if (onUpdateAvatar) {
          onUpdateAvatar(dataUrl);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const copyUserId = () => {
    if (persistentUserId) {
      navigator.clipboard.writeText(persistentUserId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (onUpdateNoiseGate) {
      onUpdateNoiseGate(newMode, noiseEnabled, noiseThreshold);
    }
  };

  const handleNoiseToggle = (checked) => {
    setNoiseEnabled(checked);
    if (onUpdateNoiseGate) {
      onUpdateNoiseGate(mode, checked, noiseThreshold);
    }
  };

  const handleThresholdChange = (val) => {
    setNoiseThreshold(val);
    if (onUpdateNoiseGate) {
      onUpdateNoiseGate(mode, noiseEnabled, val);
    }
  };

  const handleSave = () => {
    if (nickname.trim() && nickname !== currentUser?.nickname) {
      onUpdateNickname(nickname.trim());
    }
    if (serverUrl.trim() && serverUrl !== serverAddress) {
      onReconnectWithNewServer(serverUrl.trim());
    }
    if (onUpdateNoiseGate) {
      onUpdateNoiseGate(mode, noiseEnabled, noiseThreshold);
    }
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#313338] w-full max-w-lg rounded-xl shadow-2xl border border-[#2b2d31] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-[#2b2d31] flex items-center justify-between bg-[#2b2d31]/50">
          <div className="flex items-center space-x-2">
            <h2 className="text-white font-bold text-lg">Configurações do Concord</h2>
          </div>
          <button
            onClick={onClose}
            className="text-discord-muted hover:text-white transition p-1 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo com rolagem */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Seção 1: Perfil do Usuário com Foto e ID Permanente */}
          <div>
            <h3 className="text-xs font-bold text-discord-muted uppercase tracking-wider mb-2.5">
              Seu Perfil Permanente
            </h3>
            <div className="bg-[#2b2d31] p-4 rounded-lg border border-[#35373c] space-y-3.5">
              <div className="flex items-center space-x-4">
                {/* Avatar com botão de alterar */}
                <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg overflow-hidden border-2 border-[#5865F2]"
                    style={{ backgroundColor: currentUser?.avatarColor || '#5865F2' }}
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      nickname.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition">
                    <Camera size={18} />
                    <span className="text-[9px] font-bold mt-0.5">Mudar</span>
                  </div>
                </div>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white">Apelido no Servidor</label>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="text-xs font-semibold text-[#5865F2] hover:underline cursor-pointer"
                    >
                      Alterar Foto
                    </button>
                  </div>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={32}
                    className="w-full bg-[#1e1f22] border border-[#35373c] focus:border-[#5865F2] rounded px-3 py-1.5 text-white text-sm focus:outline-none select-text"
                  />
                </div>
              </div>

              {/* ID de Usuário Permanente */}
              <div className="pt-2 border-t border-[#35373c]/70 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5 text-discord-muted truncate">
                  <span>ID do Usuário:</span>
                  <span className="font-mono text-white bg-[#1e1f22] px-2 py-0.5 rounded border border-[#35373c] truncate max-w-[200px]">
                    {persistentUserId || 'user_local'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyUserId}
                  className="text-xs text-[#5865F2] hover:text-[#7983f5] font-semibold flex items-center space-x-1 cursor-pointer"
                  title="Copiar ID"
                >
                  {copiedId ? <CheckCheck size={14} className="text-discord-green" /> : <Copy size={14} />}
                  <span>{copiedId ? 'Copiado!' : 'Copiar ID'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Seção 2: Supressão de Ruído e Microfone */}
          <div>
            <h3 className="text-xs font-bold text-discord-muted uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
              <Mic size={14} className="text-[#5865F2]" />
              <span>Microfone & Supressão de Ruído</span>
            </h3>

            {/* Opções de Redução de Ruído */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {/* Opção 1: IA DeepFilterNet3 (WorkAdventure) */}
              <div
                onClick={() => handleModeChange('auto')}
                className={`p-3.5 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                  mode === 'auto'
                    ? 'border-[#5865F2] bg-[#5865F2]/10 shadow'
                    : 'border-[#35373c] bg-[#2b2d31] hover:border-[#4f545c]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-1.5 font-bold text-sm text-white">
                      <Sparkles size={16} className="text-[#5865F2]" />
                      <span>IA DeepFilterNet3</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-discord-green/20 text-discord-green px-1.5 py-0.5 rounded">
                      Deep Learning
                    </span>
                  </div>
                  <p className="text-xs text-discord-muted leading-relaxed">
                    Motor neural de alta definição a 48 kHz. Silencia totalmente teclados mecânicos, ventiladores e ruídos externos, mantendo a voz encorpada e cristalina.
                  </p>
                </div>
                <div className="mt-3 flex items-center space-x-1.5 text-[11px] font-semibold text-[#5865F2]">
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    mode === 'auto' ? 'border-[#5865F2] bg-[#5865F2]' : 'border-discord-muted'
                  }`}>
                    {mode === 'auto' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span>{mode === 'auto' ? 'Selecionado (Recomendado)' : 'Ativar IA DeepFilterNet'}</span>
                </div>
              </div>

              {/* Opção 2: Noise Gate Manual */}
              <div
                onClick={() => handleModeChange('manual')}
                className={`p-3.5 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                  mode === 'manual'
                    ? 'border-[#5865F2] bg-[#5865F2]/10 shadow'
                    : 'border-[#35373c] bg-[#2b2d31] hover:border-[#4f545c]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-1.5 font-bold text-sm text-white">
                      <Sliders size={16} className="text-[#5865F2]" />
                      <span>Noise Gate Manual</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#5865F2]/20 text-[#5865F2] px-1.5 py-0.5 rounded">
                      Estúdio
                    </span>
                  </div>
                  <p className="text-xs text-discord-muted leading-relaxed">
                    Controle manual com barra de sensibilidade ajustável. Mantém o tom puro e encorpado para microfones de estúdio/mesa.
                  </p>
                </div>
                <div className="mt-3 flex items-center space-x-1.5 text-[11px] font-semibold text-[#5865F2]">
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    mode === 'manual' ? 'border-[#5865F2] bg-[#5865F2]' : 'border-discord-muted'
                  }`}>
                    {mode === 'manual' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span>{mode === 'manual' ? 'Selecionado' : 'Ativar Modo Manual'}</span>
                </div>
              </div>
            </div>

            {/* Painel de Ajustes e Feedback ao Vivo */}
            <div className="bg-[#2b2d31] p-4 rounded-lg border border-[#35373c] space-y-3">
              {mode === 'manual' && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">Ativar Noise Gate</div>
                      <div className="text-xs text-discord-muted">
                        Corta o sinal de áudio quando o volume estiver abaixo do limiar.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={noiseEnabled}
                      onChange={(e) => handleNoiseToggle(e.target.checked)}
                      className="w-5 h-5 accent-[#5865F2] cursor-pointer"
                    />
                  </div>

                  {noiseEnabled && (
                    <div className="pt-2 border-t border-[#35373c] space-y-2">
                      <div className="flex items-center justify-between text-xs text-white">
                        <span>Sensibilidade do Gate:</span>
                        <span className="font-bold text-[#5865F2] bg-[#5865F2]/20 px-2 py-0.5 rounded">
                          {noiseThreshold}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="60"
                        step="1"
                        value={noiseThreshold}
                        onChange={(e) => handleThresholdChange(Number(e.target.value))}
                        className="w-full accent-[#5865F2] cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-discord-muted">
                        <span>Mais sensível (capta sussurros)</span>
                        <span>Corte forte (bloqueia ruídos)</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Barra de Teste de Microfone ao Vivo */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] text-discord-muted">
                  <span>Teste de Microfone (Fale agora):</span>
                  {mode === 'auto' ? (
                    <span className={micLevel >= 6 ? 'text-discord-green font-bold' : 'text-discord-muted'}>
                      {micLevel >= 6 ? 'Transmitindo com IA ✓' : 'Silêncio / Ruído filtrado'}
                    </span>
                  ) : (
                    <span className={(!noiseEnabled || micLevel >= noiseThreshold) ? 'text-discord-green font-bold' : 'text-discord-muted'}>
                      {(!noiseEnabled || micLevel >= noiseThreshold) ? 'Transmitindo voz ✓' : 'Silêncio / Cortado'}
                    </span>
                  )}
                </div>
                <div className="h-3 w-full bg-[#1e1f22] rounded-full overflow-hidden relative border border-[#35373c]">
                  {mode === 'manual' && noiseEnabled && (
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-white z-10 shadow"
                      style={{ left: `${noiseThreshold}%` }}
                      title={`Corte em ${noiseThreshold}%`}
                    />
                  )}
                  <div
                    className={`h-full transition-all duration-75 ${
                      (mode === 'auto' ? micLevel >= 6 : (!noiseEnabled || micLevel >= noiseThreshold))
                        ? 'bg-discord-green'
                        : 'bg-slate-500'
                    }`}
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 3: Servidor */}
          <div>
            <h3 className="text-xs font-bold text-discord-muted uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Server size={14} className="text-discord-green" />
              <span>Servidor Conectado</span>
            </h3>
            <div className="bg-[#2b2d31] p-3.5 rounded-lg border border-[#35373c] space-y-2">
              <label className="text-[11px] text-discord-muted block">Endereço IP e Porta</label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="Ex: 45.184.120.69:3002 ou localhost:3002"
                className="w-full bg-[#1e1f22] border border-[#35373c] focus:border-[#5865F2] rounded px-3 py-1.5 text-white text-sm focus:outline-none select-text font-mono"
              />
              <p className="text-[11px] text-discord-muted">
                Altere aqui se quiser conectar a outro PC na sua rede local ou via IP público.
              </p>
            </div>
          </div>

          {/* Seção 4: Transmissão de Vídeo */}
          <div>
            <h3 className="text-xs font-bold text-discord-muted uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Tv size={14} className="text-[#5865F2]" />
              <span>Transmissão Multi-Telas</span>
            </h3>
            <div className="bg-[#2b2d31] p-3.5 rounded-lg border border-[#35373c] space-y-2 text-xs">
              <div className="flex items-center justify-between text-white">
                <span>Multi-Stream Simultâneo:</span>
                <span className="font-bold text-discord-green bg-discord-green/20 px-2 py-0.5 rounded">
                  Todos veem todos
                </span>
              </div>
              <div className="flex items-center justify-between text-white">
                <span>Qualidade e FPS:</span>
                <span className="font-bold text-[#5865F2] bg-[#5865F2]/20 px-2 py-0.5 rounded">
                  720p / 1080p a 60 FPS
                </span>
              </div>
              <p className="text-[11px] text-discord-muted pt-1">
                Motor em tempo real ultra-otimizado com sincronização direta no Concord.
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="bg-[#2b2d31] px-6 py-3 border-t border-[#1e1f22] flex items-center justify-between">
          <span className="text-xs text-discord-muted font-semibold">Concord v1.5.0</span>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-white hover:underline transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white rounded text-sm font-semibold flex items-center space-x-1.5 transition shadow cursor-pointer"
            >
              {isSaved ? (
                <>
                  <Check size={16} />
                  <span>Salvo!</span>
                </>
              ) : (
                <span>Salvar Alterações</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
