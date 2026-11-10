# Imagem do servidor Concord (socket.io + LiveKit SFU) para rodar em Docker (ex.: ZimaOS)
# O binário do LiveKit vem da imagem oficial; o server.js o encontra no PATH
FROM livekit/livekit-server:v1.13.10 AS livekit

FROM node:20-alpine
WORKDIR /app

# Só as dependências do servidor (o package.json raiz traz Electron/Vite, que não são necessários aqui)
RUN npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund \
      express@^4.21.2 socket.io@^4.8.1 cors@^2.8.5 dotenv@^16.6.1 livekit-server-sdk@^2.19.1

COPY --from=livekit /livekit-server /usr/local/bin/livekit-server
COPY server/ ./server/

ENV NODE_ENV=production
EXPOSE 3456 7880 7881 7882/udp
CMD ["node", "server/server.js"]
