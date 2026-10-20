const path = require("path");
// Carrega server/.env pelo caminho do arquivo (o servidor é iniciado da raiz do projeto)
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { AccessToken } = require("livekit-server-sdk");

// Credenciais e portas do LiveKit SFU, definidas em server/.env
// Sem secret no .env, gera um aleatório a cada início (o LiveKit exige no mínimo 32 caracteres)
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "concord";
const LIVEKIT_API_SECRET =
  process.env.LIVEKIT_API_SECRET || crypto.randomBytes(32).toString("hex");
const LIVEKIT_PORT = parseInt(process.env.LIVEKIT_PORT || "7880", 10);
const LIVEKIT_TCP_PORT = parseInt(process.env.LIVEKIT_TCP_PORT || "7881", 10);
const LIVEKIT_UDP_PORT = parseInt(process.env.LIVEKIT_UDP_PORT || "7882", 10);
// URL opcional que os apps usam para chegar no LiveKit (ex.: host sem proxy do Cloudflare)
const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
let livekitProcess = null;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e7, // 10MB: suficiente para imagens do chat (mídia vai pelo LiveKit)
});

const PORT = process.env.PORT || 3002;
// IP público ou domínio do servidor (sem porta), definido em server/.env
const SERVER_ADDRESS = `${process.env.SERVER_URL || "localhost:" + PORT}`;

// Paleta de cores vibrantes estilo Discord para os avatares padrão
const AVATAR_COLORS = [
  "#5865F2", // Blurple
  "#57F287", // Green
  "#FEE75C", // Yellow
  "#EB459E", // Fuchsia
  "#ED4245", // Red
  "#9B59B6", // Purple
  "#1ABC9C", // Turquoise
  "#E67E22", // Orange
];

function getRandomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// Canais padrão
let channels = [
  { id: "geral", name: "Geral", type: "voice" },
  { id: "jogos", name: "Jogos", type: "voice" },
  { id: "conversa", name: "Bate-papo", type: "voice" },
  { id: "chat-geral", name: "chat-geral", type: "text" },
];

// Estado dos usuários conectados
// socket.id -> { id, nickname, currentVoiceChannel, currentTextChannel, isMuted, isDeafened, isScreenSharing, avatarColor }
const users = new Map();

// Histórico de mensagens por canal de texto
const messages = new Map();

// Servir arquivos de download (concord.exe/.deb, app.asar e app.zip)
app.use("/download", express.static(path.join(__dirname, "public")));

// Endpoint de verificação de atualização automática
app.get("/download/version.json", (req, res) => {
  res.json({
    version: "1.5.1",
    releaseNotes:
      "Concord v1.5.1: Otimização total de CPU/FPS na transmissão, eliminação de travamentos de áudio com AudioWorklet e ganho ampliado em até 250% (+14dB)!",
    asarUrl: "/download/app.asar",
    zipUrl: "/download/app.zip",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    usersCount: users.size,
    channels: channels.length,
    timestamp: new Date().toISOString(),
  });
});

// Página Web estilizada estilo Discord para amigos baixarem o instalador direto pelo navegador
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Concord - Servidor de Chamadas</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background-color: #1e1f22;
      color: #dbdee1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background-color: #313338;
      border: 1px solid #3f4147;
      border-radius: 12px;
      padding: 40px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .logo {
      width: 72px;
      height: 72px;
      background-color: #5865F2;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 800;
      color: white;
      margin-bottom: 20px;
      box-shadow: 0 4px 15px rgba(88, 101, 242, 0.4);
    }
    h1 { color: white; font-size: 26px; font-weight: 800; margin-bottom: 8px; }
    p { color: #949ba4; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(35, 165, 90, 0.15);
      color: #23a55a;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 24px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background-color: #23a55a;
      border-radius: 50%;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { opacity: 0.6; }
      50% { opacity: 1; transform: scale(1.2); }
      100% { opacity: 0.6; }
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      background-color: #5865F2;
      color: white;
      text-decoration: none;
      padding: 14px 24px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      transition: background 0.2s, transform 0.1s;
      margin-bottom: 12px;
    }
    .btn:hover { background-color: #4752c4; transform: translateY(-1px); }
    .btn-secondary {
      background-color: #2b2d31;
      color: #dbdee1;
      border: 1px solid #3f4147;
      font-size: 13px;
      padding: 10px;
    }
    .btn-secondary:hover { background-color: #35373c; color: white; }
    .features {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #3f4147;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      text-align: left;
    }
    .feature-item {
      font-size: 12px;
      color: #949ba4;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .feature-item strong { color: white; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">C</div>
    <h1>Concord</h1>
    <div class="status-badge">
      <span class="status-dot"></span>
      SERVIDOR ONLINE (${SERVER_ADDRESS})
    </div>
    <p>Converse com seus amigos com IA DeepFilterNet3, transmissão 60FPS fluida, envio de imagens no chat e zero burocracia.</p>
    
    <a href="/download/concord.exe" class="btn" download>
      <span>⬇️ Baixar Instalador Windows (.exe)</span>
      <span style="font-size: 11px; opacity: 0.8; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">16 KB</span>
    </a>

    <a href="/download/concord.deb" class="btn" download>
      <span>🐧 Baixar Instalador Linux (.deb)</span>
      <span style="font-size: 11px; opacity: 0.8; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">Debian / Ubuntu</span>
    </a>

    <a href="/download/app.zip" class="btn btn-secondary" download>
      <span>📦 Baixar Versão Portátil Direta (.zip)</span>
    </a>

    <div class="features">
      <div class="feature-item">🧠 <strong>IA DeepFilterNet3</strong></div>
      <div class="feature-item">🖥️ <strong>Multi-Telas 60FPS</strong></div>
      <div class="feature-item">📷 <strong>Fotos e Imagens</strong></div>
      <div class="feature-item">⚡ <strong>Zero Cadastro</strong></div>
    </div>
  </div>
</body>
</html>`);
});

io.on("connection", (socket) => {
  console.log(`[+] Nova conexão: ${socket.id}`);

  // Registro inicial do usuário (com suporte a User ID persistente e Foto de Perfil)
  socket.on("join-server", ({ nickname, userId, avatarUrl }, callback) => {
    const cleanNick = (nickname || "Anonimo").trim().substring(0, 32);
    const user = {
      id: socket.id,
      userId: userId || `user_${socket.id}`,
      nickname: cleanNick,
      currentVoiceChannel: null,
      currentTextChannel: "chat-geral",
      isMuted: false,
      isDeafened: false,
      isScreenSharing: false,
      avatarColor: getRandomColor(),
      avatarUrl: avatarUrl || null,
    };

    users.set(socket.id, user);
    console.log(`[User] ${cleanNick} (#${user.userId}) entrou no servidor.`);

    // Enviar dados para o novo usuário
    const usersList = Array.from(users.values());
    if (callback) {
      callback({
        self: user,
        channels,
        users: usersList,
      });
    }

    // Notificar os outros usuários
    socket.broadcast.emit("user-joined-server", user);

    // Notificar imediatamente o cliente se houver atualização de versão
    socket.emit("update-available", {
      version: "1.5.1",
      releaseNotes:
        "Concord v1.5.1: Otimização total de CPU/FPS na transmissão, eliminação de travamentos de áudio com AudioWorklet e ganho ampliado em até 250% (+14dB)!",
    });
  });

  // Atualizar Foto de Perfil
  socket.on("update-user-avatar", ({ avatarUrl }) => {
    const user = users.get(socket.id);
    if (!user) return;
    user.avatarUrl = avatarUrl;
    io.emit("user-updated", user);
  });

  // Criar novo canal
  socket.on("create-channel", ({ name, type }, callback) => {
    const cleanName = (name || "novo-canal")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const channelId = `ch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newChannel = {
      id: channelId,
      name: cleanName,
      type: type === "text" ? "text" : "voice",
    };

    channels.push(newChannel);
    console.log(
      `[Canal Criado] ${newChannel.name} (${newChannel.type}) por ${socket.id}`,
    );

    io.emit("channel-created", newChannel);
    if (callback) callback({ success: true, channel: newChannel });
  });

  // Excluir canal (seja voz ou texto)
  socket.on("delete-channel", ({ channelId }, callback) => {
    if (channelId === "geral" || channelId === "chat-geral") {
      if (callback)
        callback({
          success: false,
          message: "Os canais padrão não podem ser excluídos.",
        });
      return;
    }

    const channelIndex = channels.findIndex((c) => c.id === channelId);
    if (channelIndex === -1) {
      if (callback)
        callback({ success: false, message: "Canal não encontrado" });
      return;
    }

    const removedChannel = channels[channelIndex];
    channels.splice(channelIndex, 1);
    console.log(
      `[Canal Excluído] ${removedChannel.name} (${removedChannel.id})`,
    );

    // Se for canal de voz, desconecta qualquer usuário que esteja nele
    if (removedChannel.type === "voice") {
      for (const [userId, u] of users.entries()) {
        if (u.currentVoiceChannel === channelId) {
          u.currentVoiceChannel = null;
          u.isScreenSharing = false;
          io.to(channelId).emit("user-left-voice-channel", {
            userId: u.id,
            channelId,
          });
          io.emit("user-updated", u);
        }
      }
    }

    // Se tiver mensagens de texto, remove
    messages.delete(channelId);

    // Notifica todos os clientes
    io.emit("channel-deleted", { channelId });
    if (callback) callback({ success: true });
  });

  // Entrar em canal de voz
  socket.on("join-voice-channel", ({ channelId }, callback) => {
    const user = users.get(socket.id);
    if (!user) return;

    const oldChannelId = user.currentVoiceChannel;
    if (oldChannelId === channelId) {
      if (callback) callback({ success: true, usersInRoom: [] });
      return;
    }

    // Se já estava em outro canal, sai dele primeiro
    if (oldChannelId) {
      socket.leave(oldChannelId);
      user.currentVoiceChannel = null;
      user.isScreenSharing = false;
      io.to(oldChannelId).emit("user-left-voice-channel", {
        userId: socket.id,
        channelId: oldChannelId,
      });
    }

    // Entra no novo canal de voz
    socket.join(channelId);
    user.currentVoiceChannel = channelId;

    // Obter lista completa de usuários já presentes neste canal com seus estados atualizados
    const usersInRoom = Array.from(users.values()).filter(
      (u) => u.currentVoiceChannel === channelId,
    );

    console.log(
      `[Voz] ${user.nickname} entrou em ${channelId}. Usuários na sala: ${usersInRoom.length}`,
    );

    // Notifica os usuários que já estavam na sala que um novo usuário entrou
    socket.to(channelId).emit("user-joined-voice-channel", {
      user,
      channelId,
    });

    // Envia a lista para quem acabou de entrar começar o handshake WebRTC
    if (callback) {
      callback({
        success: true,
        usersInRoom,
      });
    }

    // Notifica todo o servidor para atualizar a sidebar
    io.emit("user-updated", user);
  });

  // Gerar token de acesso para o LiveKit SFU (WebRTC)
  socket.on("get-livekit-token", async ({ channelId }, callback) => {
    try {
      const user = users.get(socket.id);
      const nickname = user ? user.nickname : "Anonimo";
      const identity = socket.id;

      const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity,
        name: nickname,
        ttl: "24h",
      });

      at.addGrant({
        roomJoin: true,
        room: channelId || "geral",
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      const token = await at.toJwt();

      console.log(
        `[LiveKit] Token gerado para ${nickname} (${identity}) na sala ${channelId}`,
      );
      // O cliente monta a URL com o mesmo host que usou para chegar neste servidor
      if (typeof callback === "function") {
        callback({
          success: true,
          token,
          livekitUrl: LIVEKIT_URL || null,
          livekitPort: LIVEKIT_PORT,
        });
      }
    } catch (err) {
      console.error("[LiveKit] Erro ao gerar token:", err);
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      }
    }
  });

  // Sair do canal de voz
  socket.on("leave-voice-channel", (callback) => {
    const user = users.get(socket.id);
    if (!user || !user.currentVoiceChannel) {
      if (callback) callback({ success: true });
      return;
    }

    const channelId = user.currentVoiceChannel;
    socket.leave(channelId);
    user.currentVoiceChannel = null;
    user.isScreenSharing = false;

    console.log(`[Voz] ${user.nickname} saiu da sala ${channelId}`);

    io.to(channelId).emit("user-left-voice-channel", {
      userId: socket.id,
      channelId,
    });

    io.emit("user-updated", user);
    if (callback) callback({ success: true });
  });

  // Atualizar status (Mute microfone, Deafen fone, Screen share)
  socket.on("update-user-state", ({ isMuted, isDeafened, isScreenSharing }) => {
    const user = users.get(socket.id);
    if (!user) return;

    if (typeof isMuted === "boolean") user.isMuted = isMuted;
    if (typeof isDeafened === "boolean") user.isDeafened = isDeafened;
    if (typeof isScreenSharing === "boolean")
      user.isScreenSharing = isScreenSharing;

    // Se estiver no canal de voz, notifica a sala e todos
    if (user.currentVoiceChannel) {
      io.to(user.currentVoiceChannel).emit("user-state-changed", {
        userId: socket.id,
        isMuted: user.isMuted,
        isDeafened: user.isDeafened,
        isScreenSharing: user.isScreenSharing,
      });
    }
    io.emit("user-updated", user);
  });

  // Notificação de início de compartilhamento com resolução e FPS
  socket.on(
    "start-screen-share",
    ({ channelId, preset, width, height, fps }) => {
      const user = users.get(socket.id);
      if (user) {
        user.isScreenSharing = true;
        user.screenPreset = preset || null;
        io.emit("user-updated", user);
      }
      const targetChannel = channelId || user?.currentVoiceChannel;
      if (!targetChannel) return;
      socket.to(targetChannel).emit("screen-share-started", {
        userId: socket.id,
        preset,
        width,
        height,
        fps,
      });
    },
  );

  // Parar Transmissão de Tela
  socket.on("stop-screen-share", ({ channelId }) => {
    const user = users.get(socket.id);
    if (user) {
      user.isScreenSharing = false;
      io.emit("user-updated", user);
    }
    const targetChannel = channelId || user?.currentVoiceChannel;
    if (targetChannel) {
      socket
        .to(targetChannel)
        .emit("screen-share-stopped", { userId: socket.id });
    }
  });

  // ==================== CHAT DE TEXTO ====================
  socket.on(
    "send-message",
    ({ channelId, text, image, senderName, avatarUrl }) => {
      if ((!text || !text.trim()) && !image) return;

      let user = users.get(socket.id);
      if (!user) {
        user = {
          id: socket.id,
          nickname: (senderName || "Amigo").trim().substring(0, 32),
          avatarColor: getRandomColor(),
          avatarUrl: avatarUrl || null,
        };
        users.set(socket.id, user);
      } else if (avatarUrl && !user.avatarUrl) {
        user.avatarUrl = avatarUrl;
      }

      const targetChannelId = channelId || "chat-geral";
      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        channelId: targetChannelId,
        sender: {
          id: user.id,
          nickname: user.nickname,
          avatarColor: user.avatarColor,
          avatarUrl: user.avatarUrl,
        },
        text: (text || "").trim().substring(0, 2000),
        image: image || null,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      if (!messages.has(targetChannelId)) {
        messages.set(targetChannelId, []);
      }
      const channelMsgs = messages.get(targetChannelId);
      channelMsgs.push(message);
      if (channelMsgs.length > 100) channelMsgs.shift();

      io.emit("new-message", message);
    },
  );

  socket.on("get-messages", ({ channelId }, callback) => {
    const msgs = messages.get(channelId) || [];
    if (callback) callback(msgs);
  });

  // Desconexão
  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`[-] Usuário desconectou: ${user.nickname} (${socket.id})`);
      if (user.currentVoiceChannel) {
        socket.to(user.currentVoiceChannel).emit("user-left-voice-channel", {
          userId: socket.id,
          channelId: user.currentVoiceChannel,
        });
      }
      users.delete(socket.id);
      io.emit("user-left-server", socket.id);
    }
  });
});

// Gera o arquivo de configuração do LiveKit a partir do server/.env
function writeLiveKitConfig() {
  const lines = [
    "# Gerado automaticamente pelo server.js a partir do server/.env - não edite",
    `port: ${LIVEKIT_PORT}`,
    "bind_addresses:",
    '  - "0.0.0.0"',
    "rtc:",
    `  tcp_port: ${LIVEKIT_TCP_PORT}`,
    `  udp_port: ${LIVEKIT_UDP_PORT}`,
    `  use_external_ip: ${process.env.LIVEKIT_USE_EXTERNAL_IP === "true"}`,
  ];
  if (process.env.LIVEKIT_NODE_IP) {
    lines.push(`  node_ip: ${process.env.LIVEKIT_NODE_IP}`);
  }
  lines.push(
    "keys:",
    `  ${JSON.stringify(LIVEKIT_API_KEY)}: ${JSON.stringify(LIVEKIT_API_SECRET)}`,
    "logging:",
    "  level: info",
    "",
  );

  const configPath = path.join(__dirname, "livekit.yaml");
  fs.writeFileSync(configPath, lines.join("\n"));
  return configPath;
}

function startLiveKitServer() {
  // Binário em server/bin (livekit-server.exe no Windows, livekit-server no Linux) ou no PATH
  const binName =
    process.platform === "win32" ? "livekit-server.exe" : "livekit-server";
  const localBin = path.join(__dirname, "bin", binName);
  const livekitPath = fs.existsSync(localBin) ? localBin : binName;

  const configPath = writeLiveKitConfig();
  console.log(
    `[LiveKit] Iniciando LiveKit SFU (${livekitPath}) - TCP ${LIVEKIT_PORT}/${LIVEKIT_TCP_PORT}, UDP ${LIVEKIT_UDP_PORT}...`,
  );

  try {
    livekitProcess = spawn(livekitPath, ["--config", configPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    console.error("[LiveKit] Erro ao iniciar processo livekit-server:", err);
    return;
  }

  let announcedReady = false;
  const onOutput = (data) => {
    for (const line of data.toString().split("\n")) {
      if (
        !announcedReady &&
        (line.includes("starting LiveKit server") ||
          line.includes("using single-node"))
      ) {
        announcedReady = true;
        console.log("[LiveKit] SFU WebRTC ativo e pronto para chamadas!");
      }
      // Só o nível do log importa (WARN com campo "error" não é erro)
      if (/\s(ERROR|FATAL|PANIC)\s/.test(line)) {
        console.error(`[LiveKit] ${line.trim()}`);
      }
    }
  };
  livekitProcess.stdout.on("data", onOutput);
  livekitProcess.stderr.on("data", onOutput);

  livekitProcess.on("error", (err) => {
    livekitProcess = null;
    if (err.code === "ENOENT") {
      console.error(
        `[LiveKit] Executável não encontrado. Baixe o livekit-server para ${process.platform} em https://github.com/livekit/livekit/releases e coloque em server/bin/${binName}`,
      );
    } else {
      console.error("[LiveKit] Erro no processo livekit-server:", err);
    }
    console.error(
      "[LiveKit] Sem o LiveKit não há voz nem transmissão de tela (o chat continua funcionando).",
    );
  });

  livekitProcess.on("exit", (code) => {
    console.log(`[LiveKit] Processo encerrou com código ${code}`);
    livekitProcess = null;
  });

  const cleanup = () => {
    if (livekitProcess) {
      try {
        livekitProcess.kill();
      } catch (e) {}
      livekitProcess = null;
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit();
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit();
  });
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`===============================================`);
  console.log(`  DISCORD CLONE - SERVIDOR INICIADO`);
  console.log(`  Porta: ${PORT}`);
  console.log(`  Local: http://localhost:${PORT}`);
  console.log(`  Público: ${/^https?:\/\//.test(SERVER_ADDRESS) ? SERVER_ADDRESS : `http://${SERVER_ADDRESS}`}`);
  console.log(`  Rede Local: http://0.0.0.0:${PORT}`);
  console.log(`  Hospedagem em casa pronta para conexões!`);
  console.log(`===============================================`);

  startLiveKitServer();
});
