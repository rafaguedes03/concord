// Motor de Mídia WebRTC de Alta Performance com LiveKit SFU (Padrão Discord)
// Áudio Opus nativo em tempo real sobre UDP, FEC, jitter buffer e aceleração por hardware (GPU H.264)
import {
  Room,
  RoomEvent,
  Track
} from 'livekit-client';

export class LivekitEngine {
  constructor() {
    this.room = null;
    this.currentChannelId = null;
    this.isMuted = false;
    this.isDeafened = false;

    // Elementos de áudio remotos: userId -> HTMLAudioElement
    this.remoteAudioElements = new Map();
    // Volumes personalizados: userId -> number (0 a 200)
    this.userVolumes = new Map();
    // Mute local por usuário: userId -> boolean
    this.locallyMutedUsers = new Set();

    // Map de tracks de vídeo de compartilhamento de tela: userId -> RemoteTrack
    this.remoteVideoTracks = new Map();
    this.remoteAudioTracks = new Map();

    // Tracks locais de tela
    this.localScreenVideoTrack = null;
    this.localScreenAudioTrack = null;
    this.localScreenStream = null;

    // Callbacks para o React
    this.onActiveSpeakersChanged = null; // (speakerIds: string[]) => void
    this.onRemoteTrackSubscribed = null; // (userId: string, track: Track, kind: 'video' | 'audio') => void
    this.onRemoteTrackUnsubscribed = null; // (userId: string, kind: 'video' | 'audio') => void
    this.onConnectionStateChange = null;
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

    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true
      },
      publishDefaults: {
        simulcast: false,
        videoCodec: 'h264',
        dtx: true,
        red: true
      }
    });

    this.setupRoomEvents();

    try {
      console.log(`[LiveKit] Conectando a ${livekitUrl} na sala ${channelId}...`);
      // Timeout seguro de 4 segundos: se portas 7880/7882 estiverem fechadas no roteador, não trava o app
      await Promise.race([
        this.room.connect(livekitUrl, token),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout ao conectar no LiveKit (portas 7880/7882 inacessíveis)')), 4000)
        )
      ]);
      console.log('[LiveKit] Conectado com sucesso à sala!', this.room.name);
      return this.room;
    } catch (err) {
      console.warn('[LiveKit] Falha na conexão:', err.message);
      this.cleanup();
      if (this.room) {
        try { await this.room.disconnect(); } catch (e) {}
        this.room = null;
      }
      throw err;
    }
  }

  setupRoomEvents() {
    if (!this.room) return;

    // Inscrição em tracks de outros participantes (Voz ou Tela)
    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      const userId = participant.identity;
      console.log(`[LiveKit] Track inscrita de ${participant.name || userId} (${track.kind}, source: ${track.source})`);

      if (track.kind === Track.Kind.Audio) {
        // Se for áudio da tela ou microfone
        const audioEl = track.attach();
        audioEl.id = `lk-audio-${userId}-${track.source}`;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);

        // Aplica configurações de volume salvas
        const vol = this.userVolumes.get(userId) ?? 100;
        const isMuted = this.locallyMutedUsers.has(userId) || this.isDeafened;
        audioEl.volume = isMuted ? 0 : Math.min(1, vol / 100);

        this.remoteAudioElements.set(`${userId}-${track.source}`, audioEl);

        if (track.source === Track.Source.ScreenShareAudio) {
          this.remoteAudioTracks.set(userId, track);
          if (this.onRemoteTrackSubscribed) {
            this.onRemoteTrackSubscribed(userId, track, 'audio');
          }
        }
      } else if (track.kind === Track.Kind.Video) {
        // Vídeo de transmissão de tela
        this.remoteVideoTracks.set(userId, track);
        if (this.onRemoteTrackSubscribed) {
          this.onRemoteTrackSubscribed(userId, track, 'video');
        }
      }
    });

    // Desinscrição de tracks
    this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      const userId = participant.identity;
      console.log(`[LiveKit] Track desinscrita de ${participant.name || userId} (${track.kind})`);

      if (track.kind === Track.Kind.Audio) {
        track.detach().forEach((el) => el.remove());
        this.remoteAudioElements.delete(`${userId}-${track.source}`);
        if (track.source === Track.Source.ScreenShareAudio) {
          this.remoteAudioTracks.delete(userId);
          if (this.onRemoteTrackUnsubscribed) {
            this.onRemoteTrackUnsubscribed(userId, 'audio');
          }
        }
      } else if (track.kind === Track.Kind.Video) {
        this.remoteVideoTracks.delete(userId);
        if (this.onRemoteTrackUnsubscribed) {
          this.onRemoteTrackUnsubscribed(userId, 'video');
        }
      }
    });

    // Detecção de quem está falando em tempo real (Anel Verde)
    this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const activeIds = speakers.map((s) => s.identity);
      if (this.onActiveSpeakersChanged) {
        this.onActiveSpeakersChanged(activeIds);
      }
    });

    this.room.on(RoomEvent.Disconnected, () => {
      console.log('[LiveKit] Desconectado da sala');
      this.cleanup();
    });
  }

  // Ativa o microfone com supressor de ruído (Modo IA Krisp / Google WebRTC ou Manual)
  async startMicrophone(noiseMode = 'auto') {
    if (!this.room) return;

    const isAuto = noiseMode === 'auto';
    try {
      await this.room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: isAuto,
        autoGainControl: isAuto
      });

      this.isMuted = false;
      console.log(`[LiveKit] Microfone ativado (Modo: ${noiseMode})`);
    } catch (err) {
      console.error('[LiveKit] Erro ao ativar microfone:', err);
      throw err;
    }
  }

  // Mudo do microfone próprio
  async setMuted(muted) {
    this.isMuted = !!muted;
    if (this.room && this.room.localParticipant) {
      await this.room.localParticipant.setMicrophoneEnabled(!this.isMuted);
    }
  }

  // Ensurdecer (desativa saída de som dos outros participantes)
  setDeafened(deafened) {
    this.isDeafened = !!deafened;
    for (const [key, el] of this.remoteAudioElements.entries()) {
      if (this.isDeafened) {
        el.volume = 0;
      } else {
        const userId = key.split('-')[0];
        const isLocallyMuted = this.locallyMutedUsers.has(userId);
        const vol = this.userVolumes.get(userId) ?? 100;
        el.volume = isLocallyMuted ? 0 : Math.min(1, vol / 100);
      }
    }
  }

  // Ajuste de volume de outro participante (0% a 200%)
  setUserVolume(userId, volume) {
    this.userVolumes.set(userId, volume);
    for (const [key, el] of this.remoteAudioElements.entries()) {
      if (key.startsWith(userId)) {
        if (!this.isDeafened && !this.locallyMutedUsers.has(userId)) {
          el.volume = Math.min(1, Math.max(0, volume / 100));
        }
      }
    }
  }

  // Mudo local de outro participante
  setUserLocalMuted(userId, isMuted) {
    if (isMuted) {
      this.locallyMutedUsers.add(userId);
    } else {
      this.locallyMutedUsers.delete(userId);
    }

    for (const [key, el] of this.remoteAudioElements.entries()) {
      if (key.startsWith(userId)) {
        if (isMuted || this.isDeafened) {
          el.volume = 0;
        } else {
          const vol = this.userVolumes.get(userId) ?? 100;
          el.volume = Math.min(1, vol / 100);
        }
      }
    }
  }

  // Compartilhamento de tela com aceleração por hardware (GPU H.264 / VP8) e áudio do sistema
  async startScreenShare(sourceId, withAudio = false, presetKey = '720p60') {
    if (!this.room) throw new Error('Não está em uma sala LiveKit');

    let width = 1280;
    let height = 720;
    let fps = 60;

    if (presetKey === '720p30') {
      fps = 30;
    } else if (presetKey === '1080p60') {
      width = 1920;
      height = 1080;
      fps = 60;
    }

    console.log(`[LiveKit] Iniciando captura de tela (${width}x${height} @ ${fps}fps)...`);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: withAudio ? {
        mandatory: {
          chromeMediaSource: 'desktop'
        }
      } : false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          minWidth: width,
          maxWidth: width,
          minHeight: height,
          maxHeight: height,
          minFrameRate: fps,
          maxFrameRate: fps
        }
      }
    });

    this.localScreenStream = stream;

    // Publica o vídeo com codec H.264 acelerado por GPU (NVENC/AMD)
    const videoTrack = stream.getVideoTracks()[0];
    this.localScreenVideoTrack = videoTrack;

    await this.room.localParticipant.publishTrack(videoTrack, {
      name: 'screen_share',
      source: Track.Source.ScreenShare,
      simulcast: false,
      videoCodec: 'h264'
    });

    // Publica áudio da tela se houver
    if (withAudio && stream.getAudioTracks().length > 0) {
      const audioTrack = stream.getAudioTracks()[0];
      this.localScreenAudioTrack = audioTrack;

      await this.room.localParticipant.publishTrack(audioTrack, {
        name: 'screen_audio',
        source: Track.Source.ScreenShareAudio
      });
    }

    console.log('[LiveKit] Transmissão de tela publicada com sucesso via WebRTC H.264!');
    return stream;
  }

  // Parar transmissão de tela
  async stopScreenShare() {
    if (this.room && this.room.localParticipant) {
      if (this.localScreenVideoTrack) {
        try {
          await this.room.localParticipant.unpublishTrack(this.localScreenVideoTrack);
          this.localScreenVideoTrack.stop();
        } catch (e) {}
        this.localScreenVideoTrack = null;
      }

      if (this.localScreenAudioTrack) {
        try {
          await this.room.localParticipant.unpublishTrack(this.localScreenAudioTrack);
          this.localScreenAudioTrack.stop();
        } catch (e) {}
        this.localScreenAudioTrack = null;
      }
    }

    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((t) => t.stop());
      this.localScreenStream = null;
    }
  }

  cleanup() {
    for (const el of this.remoteAudioElements.values()) {
      try { el.remove(); } catch (e) {}
    }
    this.remoteAudioElements.clear();
    this.remoteVideoTracks.clear();
    this.remoteAudioTracks.clear();

    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((t) => t.stop());
      this.localScreenStream = null;
    }
  }

  // Desconectar da sala
  async disconnect() {
    await this.stopScreenShare();
    if (this.room) {
      try {
        await this.room.disconnect();
      } catch (e) {}
      this.room = null;
    }
    this.cleanup();
    this.currentChannelId = null;
  }
}
