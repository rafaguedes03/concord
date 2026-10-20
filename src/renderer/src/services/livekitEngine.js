// Motor de Mídia WebRTC com LiveKit SFU (Padrão Discord)
// Áudio Opus em tempo real sobre UDP (com fallback TCP), FEC/RED, jitter buffer adaptativo e tela em H.264 por GPU
import {
  Room,
  RoomEvent,
  Track,
  AudioPresets
} from 'livekit-client';
import { ConcordVoiceProcessor } from './voiceProcessor';

// Presets de transmissão de tela: resolução máxima, FPS e bitrate do encoder H.264
export const STREAM_PRESETS = {
  '720p30': { name: '720p 30 FPS', width: 1280, height: 720, fps: 30, maxBitrate: 3_000_000 },
  '720p60': { name: '720p 60 FPS', width: 1280, height: 720, fps: 60, maxBitrate: 5_000_000 },
  '1080p60': { name: '1080p 60 FPS', width: 1920, height: 1080, fps: 60, maxBitrate: 8_000_000 }
};

// Curva de ganho exponencial estilo Discord: 100% = 1.0x, 200% = 5.0x (+14 dB)
export function calcGain(volume) {
  if (volume <= 0) return 0;
  if (volume <= 100) return volume / 100;
  const extra = (volume - 100) / 100;
  return 1.0 + Math.pow(extra, 1.25) * 4.0;
}

export class LivekitEngine {
  constructor() {
    this.room = null;
    this.currentChannelId = null;
    this.isMuted = false;
    this.isDeafened = false;
    this.isLeaving = false;

    // Tracks de áudio remotas: userId -> Map(source -> RemoteAudioTrack)
    this.remoteAudioTracks = new Map();
    // Volumes personalizados de voz: userId -> number (0 a 200)
    this.userVolumes = new Map();
    // Mute local de voz por usuário
    this.locallyMutedUsers = new Set();
    // Volume e mute do som das transmissões: userId -> number / Set
    this.streamVolumes = new Map();
    this.mutedStreams = new Set();

    // Tracks de vídeo de compartilhamento de tela: userId -> RemoteVideoTrack
    this.remoteVideoTracks = new Map();

    // Microfone e processador de voz
    this.voiceProcessor = null;
    this.noiseSettings = { mode: 'auto', gateEnabled: true, thresholdPercent: 15 };

    // Tracks locais de tela
    this.localScreenVideoTrack = null;
    this.localScreenAudioTrack = null;
    this.localScreenStream = null;
    this.currentPresetKey = null;

    // Callbacks para o React
    this.onActiveSpeakersChanged = null; // (speakerIds: string[]) => void
    this.onRemoteTrackSubscribed = null; // (userId: string, track: Track, kind: 'video' | 'audio') => void
    this.onRemoteTrackUnsubscribed = null; // (userId: string, kind: 'video' | 'audio') => void
    this.onConnectionStateChange = null; // ('connected' | 'reconnecting' | 'disconnected', reason?) => void
    this.onLocalScreenShareEnded = null; // () => void
  }

  // Verifica se o LiveKit está de fato conectado e pronto
  isConnected() {
    return !!(this.room && this.room.state === 'connected');
  }

  // Conectar na sala LiveKit do canal de voz
  async connect(livekitUrl, token, channelId) {
    if (this.room) {
      await this.disconnect();
    }

    this.currentChannelId = channelId;
    this.isLeaving = false;

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      // Mixa o áudio remoto via Web Audio: permite volume individual acima de 100%
      webAudioMix: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      },
      publishDefaults: {
        audioPreset: AudioPresets.music,
        dtx: true,
        red: true,
        videoCodec: 'h264',
        simulcast: false
      }
    });
    this.room = room;
    this.setupRoomEvents(room);

    try {
      console.log(`[LiveKit] Conectando a ${livekitUrl} na sala ${channelId}...`);
      await room.connect(livekitUrl, token);
      await room.startAudio().catch(() => {});
      console.log('[LiveKit] Conectado com sucesso à sala!', room.name);
      return room;
    } catch (err) {
      console.warn('[LiveKit] Falha na conexão:', err.message);
      this.isLeaving = true;
      try { await room.disconnect(); } catch (e) {}
      if (this.room === room) this.room = null;
      this.cleanup();
      throw err;
    }
  }

  setupRoomEvents(room) {
    // Inscrição em tracks de outros participantes (Voz ou Tela)
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      const userId = participant.identity;
      console.log(`[LiveKit] Track inscrita de ${participant.name || userId} (${track.kind}, source: ${track.source})`);

      if (track.kind === Track.Kind.Audio) {
        // Com webAudioMix o elemento fica mudo e o som passa pelo AudioContext da sala
        const audioEl = track.attach();
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);

        if (!this.remoteAudioTracks.has(userId)) {
          this.remoteAudioTracks.set(userId, new Map());
        }
        this.remoteAudioTracks.get(userId).set(track.source, track);
        this.applyUserVolume(userId);

        if (track.source === Track.Source.ScreenShareAudio && this.onRemoteTrackSubscribed) {
          this.onRemoteTrackSubscribed(userId, track, 'audio');
        }
      } else if (track.kind === Track.Kind.Video) {
        this.remoteVideoTracks.set(userId, track);
        if (this.onRemoteTrackSubscribed) {
          this.onRemoteTrackSubscribed(userId, track, 'video');
        }
      }
    });

    // Desinscrição de tracks
    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      const userId = participant.identity;
      console.log(`[LiveKit] Track desinscrita de ${participant.name || userId} (${track.kind})`);

      if (track.kind === Track.Kind.Audio) {
        track.detach().forEach((el) => el.remove());
        const sources = this.remoteAudioTracks.get(userId);
        if (sources) {
          sources.delete(track.source);
          if (sources.size === 0) this.remoteAudioTracks.delete(userId);
        }
        if (track.source === Track.Source.ScreenShareAudio && this.onRemoteTrackUnsubscribed) {
          this.onRemoteTrackUnsubscribed(userId, 'audio');
        }
      } else if (track.kind === Track.Kind.Video) {
        track.detach();
        this.remoteVideoTracks.delete(userId);
        if (this.onRemoteTrackUnsubscribed) {
          this.onRemoteTrackUnsubscribed(userId, 'video');
        }
      }
    });

    // Detecção de quem está falando em tempo real (Anel Verde)
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const activeIds = speakers.map((s) => s.identity);
      if (this.onActiveSpeakersChanged) {
        this.onActiveSpeakersChanged(activeIds);
      }
    });

    // Quedas curtas de rede: o SDK reconecta sozinho e mantém as tracks publicadas
    room.on(RoomEvent.Reconnecting, () => {
      console.warn('[LiveKit] Conexão instável, reconectando...');
      if (this.room === room && this.onConnectionStateChange) this.onConnectionStateChange('reconnecting');
    });

    room.on(RoomEvent.Reconnected, () => {
      console.log('[LiveKit] Reconectado!');
      if (this.room === room && this.onConnectionStateChange) this.onConnectionStateChange('connected');
    });

    room.on(RoomEvent.Disconnected, (reason) => {
      console.log('[LiveKit] Desconectado da sala, motivo:', reason);
      if (this.room !== room) return;
      const intentional = this.isLeaving;
      this.room = null;
      this.cleanup();
      if (!intentional && this.onConnectionStateChange) {
        this.onConnectionStateChange('disconnected', reason);
      }
    });
  }

  // Ativa o microfone com o processador de voz (DeepFilterNet3 IA no modo auto ou Noise Gate no manual)
  async startMicrophone(noiseSettings = {}) {
    if (!this.room) return;
    this.noiseSettings = { ...this.noiseSettings, ...noiseSettings };
    const { mode, gateEnabled, thresholdPercent } = this.noiseSettings;
    const isAuto = mode !== 'manual';

    try {
      const publication = await this.room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: isAuto,
        autoGainControl: isAuto,
        channelCount: 1
      });

      const micTrack = publication?.track;
      if (micTrack) {
        this.voiceProcessor = new ConcordVoiceProcessor({ mode, gateEnabled, thresholdPercent });
        try {
          await micTrack.setProcessor(this.voiceProcessor);
        } catch (procErr) {
          console.warn('[LiveKit] Processador de voz indisponível, enviando áudio direto:', procErr);
          this.voiceProcessor = null;
        }
      }

      if (this.isMuted && publication) {
        await publication.mute();
      }
      console.log(`[LiveKit] Microfone ativado (Modo: ${mode})`);
    } catch (err) {
      console.error('[LiveKit] Erro ao ativar microfone:', err);
      throw err;
    }
  }

  // Ajusta o modo de áudio e a sensibilidade do Noise Gate durante a chamada
  setNoiseSettings(mode, gateEnabled, thresholdPercent) {
    this.noiseSettings = { mode, gateEnabled, thresholdPercent };
    if (this.voiceProcessor) {
      this.voiceProcessor.setSettings(mode, gateEnabled, thresholdPercent);
    }
  }

  // Mudo do microfone próprio (silencia a track publicada sem recriá-la)
  async setMuted(muted) {
    this.isMuted = !!muted;
    const publication = this.room?.localParticipant?.getTrackPublication(Track.Source.Microphone);
    if (!publication) return;
    try {
      if (this.isMuted) {
        await publication.mute();
      } else {
        await publication.unmute();
      }
    } catch (err) {
      console.warn('[LiveKit] Erro ao alternar mudo:', err);
    }
  }

  // Aplica volume/mute de voz e de transmissão de um participante
  applyUserVolume(userId) {
    const sources = this.remoteAudioTracks.get(userId);
    if (!sources) return;

    for (const [source, track] of sources.entries()) {
      let gain;
      if (source === Track.Source.ScreenShareAudio) {
        gain = this.isDeafened || this.mutedStreams.has(userId)
          ? 0
          : calcGain(this.streamVolumes.get(userId) ?? 100);
      } else {
        gain = this.isDeafened || this.locallyMutedUsers.has(userId)
          ? 0
          : calcGain(this.userVolumes.get(userId) ?? 100);
      }
      track.setVolume(gain);
    }
  }

  // Ensurdecer (desativa saída de som dos outros participantes)
  setDeafened(deafened) {
    this.isDeafened = !!deafened;
    for (const userId of this.remoteAudioTracks.keys()) {
      this.applyUserVolume(userId);
    }
  }

  // Ajuste de volume de outro participante (0% a 200%)
  setUserVolume(userId, volume) {
    this.userVolumes.set(userId, volume);
    this.applyUserVolume(userId);
  }

  // Mudo local de outro participante
  setUserLocalMuted(userId, isMuted) {
    if (isMuted) {
      this.locallyMutedUsers.add(userId);
    } else {
      this.locallyMutedUsers.delete(userId);
    }
    this.applyUserVolume(userId);
  }

  // Volume do som da transmissão de tela de um participante (0% a 200%)
  setStreamVolume(userId, volume) {
    this.streamVolumes.set(userId, volume);
    this.applyUserVolume(userId);
  }

  setStreamMuted(userId, isMuted) {
    if (isMuted) {
      this.mutedStreams.add(userId);
    } else {
      this.mutedStreams.delete(userId);
    }
    this.applyUserVolume(userId);
  }

  // Captura a tela/janela escolhida no seletor do Electron (ou no seletor do navegador)
  async captureScreen(sourceId, withAudio, preset) {
    if (sourceId && window.electronAPI?.isElectron) {
      if (window.electronAPI.setSelectedSource) {
        try { await window.electronAPI.setSelectedSource(sourceId); } catch (e) {}
      }

      // Áudio do sistema só existe na captura de tela inteira
      const audioConfig = withAudio && sourceId.startsWith('screen:')
        ? { mandatory: { chromeMediaSource: 'desktop' } }
        : false;

      try {
        // Só limites máximos: o Chromium reduz mantendo a proporção de qualquer monitor
        return await navigator.mediaDevices.getUserMedia({
          audio: audioConfig,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              maxWidth: preset.width,
              maxHeight: preset.height,
              maxFrameRate: preset.fps
            }
          }
        });
      } catch (gumErr) {
        console.warn('[LiveKit] getUserMedia falhou para a fonte selecionada, usando getDisplayMedia:', gumErr);
      }
    }

    return navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: preset.width, max: preset.width },
        height: { ideal: preset.height, max: preset.height },
        frameRate: { ideal: preset.fps, max: preset.fps }
      },
      audio: withAudio
    });
  }

  // Compartilhamento de tela com H.264 acelerado por GPU e áudio do sistema
  async startScreenShare(sourceId, withAudio = false, presetKey = '720p60') {
    if (!this.room) throw new Error('Não está em uma sala LiveKit');
    if (this.localScreenStream) await this.stopScreenShare();

    this.currentPresetKey = presetKey in STREAM_PRESETS ? presetKey : '720p60';
    const preset = STREAM_PRESETS[this.currentPresetKey];
    console.log(`[LiveKit] Iniciando captura de tela (${preset.name}, ${preset.maxBitrate / 1e6} Mbps)...`);

    const stream = await this.captureScreen(sourceId, withAudio, preset);
    this.localScreenStream = stream;

    try {
      const videoTrack = stream.getVideoTracks()[0];
      // Prioriza fluidez (jogos e vídeos) em vez de nitidez de texto parado
      videoTrack.contentHint = 'motion';
      videoTrack.onended = () => {
        this.stopScreenShare();
        if (this.onLocalScreenShareEnded) this.onLocalScreenShareEnded();
      };

      const encoding = { maxBitrate: preset.maxBitrate, maxFramerate: preset.fps, priority: 'high' };
      const videoPub = await this.room.localParticipant.publishTrack(videoTrack, {
        name: 'screen_share',
        source: Track.Source.ScreenShare,
        videoCodec: 'h264',
        simulcast: false,
        videoEncoding: encoding,
        screenShareEncoding: encoding,
        degradationPreference: 'maintain-framerate'
      });
      this.localScreenVideoTrack = videoPub.track;

      // Publica áudio da tela se houver
      const audioTrack = stream.getAudioTracks()[0];
      if (withAudio && audioTrack) {
        const audioPub = await this.room.localParticipant.publishTrack(audioTrack, {
          name: 'screen_audio',
          source: Track.Source.ScreenShareAudio,
          audioPreset: AudioPresets.musicHighQualityStereo,
          dtx: false,
          red: false
        });
        this.localScreenAudioTrack = audioPub.track;
      }
    } catch (err) {
      await this.stopScreenShare();
      throw err;
    }

    console.log('[LiveKit] Transmissão de tela publicada via WebRTC H.264!');
    return stream;
  }

  // Parar transmissão de tela
  async stopScreenShare() {
    const localParticipant = this.room?.localParticipant;

    for (const key of ['localScreenVideoTrack', 'localScreenAudioTrack']) {
      const track = this[key];
      this[key] = null;
      if (!track) continue;
      try {
        if (localParticipant) await localParticipant.unpublishTrack(track);
      } catch (e) {}
      try { track.stop(); } catch (e) {}
    }

    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      this.localScreenStream = null;
    }
    this.currentPresetKey = null;
  }

  cleanup() {
    for (const sources of this.remoteAudioTracks.values()) {
      for (const track of sources.values()) {
        try { track.detach().forEach((el) => el.remove()); } catch (e) {}
      }
    }
    this.remoteAudioTracks.clear();
    this.remoteVideoTracks.clear();
    this.voiceProcessor = null;

    this.localScreenVideoTrack = null;
    this.localScreenAudioTrack = null;
    this.currentPresetKey = null;
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      this.localScreenStream = null;
    }
  }

  // Desconectar da sala
  async disconnect() {
    this.isLeaving = true;
    await this.stopScreenShare();
    const room = this.room;
    this.room = null;
    if (room) {
      try {
        await room.disconnect();
      } catch (e) {}
    }
    this.cleanup();
    this.currentChannelId = null;
  }
}
