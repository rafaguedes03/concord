import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Endereço padrão do servidor embutido no app, lido de server/.env (SERVER_URL + PORT)
const envPath = path.resolve(__dirname, 'server/.env');
const serverEnv = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
const serverAddress = `${serverEnv.SERVER_URL || 'localhost'}:${serverEnv.PORT || 3002}`;

export default defineConfig({
  plugins: [react()],
  define: {
    __SERVER_ADDRESS__: JSON.stringify(serverAddress)
  },
  base: './',
  root: path.resolve(__dirname, 'src/renderer'),
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true
  },
  server: {
    port: 5173
  }
});
