import { defineConfig } from 'vite';
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true,

    https: {
      key: fs.readFileSync(
        path.resolve(__dirname, "certs/localhost-key.pem"),
      ),
      cert: fs.readFileSync(
        path.resolve(__dirname, "certs/localhost-cert.pem"),
      ),
    },
    
    proxy: {
      '/member': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/board': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/payments': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
});
