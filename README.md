# 🎮 Discord Clone - Voz & Compartilhamento de Tela 720p 60FPS

Um aplicativo desktop completo e moderno estilo Discord com foco em comunicação por voz de alta fidelidade e transmissão de tela a 60 FPS e 720p.

---

## ✨ Principais Funcionalidades

1. **Zero Burocracia / Sem Login:**
   - Não requer cadastro, nem e-mail, nem senha.
   - Basta escolher um apelido (Nickname) e entrar instantaneamente.
   - Salva suas preferências localmente para abrir direto da próxima vez.

2. **Compartilhamento de Tela Otimizado (720p @ 60 FPS):**
   - Resolução travada em **1280x720** e taxa de quadros a **60 FPS**.
   - Bitrate elevado (~4.5 Mbps) com flag `contentHint: "motion"` para jogos rápidos e vídeos fluidos sem pixelização ou travamentos.
   - Seletor nativo estilo Discord para escolher entre telas inteiras ou janelas específicas com miniaturas ao vivo.
   - Badge "AO VIVO 720p 60FPS", botão de tela cheia e visualização em destaque.

3. **Chamadas de Voz Completas (WebRTC Mesh):**
   - **Indicador de fala ao vivo:** O avatar pulsa com uma borda verde vibrante quando a pessoa fala.
   - **Controles próprios:**
     - Botão de **Mutar Microfone** (com ícone vermelho de corte).
     - Botão de **Ensurdecer / Deafen** (desativa o fone e o microfone ao mesmo tempo).
   - **Controles para outros participantes:**
     - Controle deslizante de **Volume Individual** (de 0% a 200%) para cada amigo na call.
     - Botão de **Mutar Usuário Localmente** (para você não ouvir alguém específico sem afetar os outros).
   - Cancelamento de eco, supressão de ruído e controle automático de ganho integrados.

4. **Canais de Voz e Criação Dinâmica de Novas Calls:**
   - Canais de voz padrão: **🔊 Geral**, **🔊 Jogos**, **🔊 Bate-papo**.
   - Botão **➕ Criar Canal** para criar novas salas de voz ou canais de texto em tempo real para todo o servidor.
   - Lista visual de participantes conectados embaixo de cada canal na barra lateral.

5. **Servidor Leve para Hospedar em Casa:**
   - Backend Node.js + Socket.IO super rápido.
   - Seus amigos conectam pelo seu IP local ou público (ou por ferramentas como Radmin VPN / ZeroTier / Hamachi / Port Forwarding).

6. **Aplicativo Executável Windows (.exe):**
   - Aplicativo empacotado como `.exe` portátil para você e seus amigos abrirem direto no Windows com 2 cliques.

---

## 🚀 Como Usar

### 1. Iniciar o Servidor (No PC do Host):
Dê dois cliques no arquivo:
```
INICIAR-SERVIDOR.bat
```
O terminal mostrará o seu IP para você passar aos seus amigos (ex: `http://192.168.1.100:3000`).

### 2. Abrir o Aplicativo:
Dê dois cliques no executável:
```
dist-electron\Discord Clone.exe
```
*(Ou dê dois cliques no atalho `INICIAR-APP.bat`)*

### 3. Conectar e Conversar:
1. Digite seu apelido.
2. No campo do servidor:
   - Se você estiver no mesmo PC do servidor: digite `localhost:3000`.
   - Se seus amigos estiverem em outros PCs: eles digitam o seu IP (ex: `192.168.1.100:3000`).
3. Clique em **Entrar no Discord** e clique no canal **🔊 Geral** para entrar na call!

---

## 🛠️ Scripts Disponíveis (Desenvolvedor)

- `npm run start:server` - Inicia o servidor de sinalização WebRTC.
- `npm run dev` - Roda o frontend no navegador com Vite.
- `npm run dev:electron` - Abre o app diretamente no Electron em modo dev.
- `npm run build:exe` - Compila o executável `.exe` Windows portátil em `dist-electron/`.
