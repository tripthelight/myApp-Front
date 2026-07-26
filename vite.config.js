import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const certificateKeyPath = path.resolve(__dirname, "certs/dev-key.pem");
const certificatePath = path.resolve(__dirname, "certs/dev-cert.pem");

export default defineConfig(({ command }) => {
  const isDevServer = command === "serve";
  const useHttps = isDevServer && process.env.VITE_USE_HTTPS === "true";
  const hasLocalCertificates =
    fs.existsSync(certificateKeyPath) && fs.existsSync(certificatePath);

  if (useHttps && !hasLocalCertificates) {
    throw new Error(
      [
        "",
        "[Vite HTTPS] LAN/iPhone 테스트용 인증서가 없습니다.",
        "먼저 npm run setup:https 를 실행한 뒤 npm run dev:https 를 실행하세요.",
        `key: ${certificateKeyPath}`,
        `cert: ${certificatePath}`,
        "",
      ].join("\n"),
    );
  }

  const httpsConfig = useHttps
    ? {
        key: fs.readFileSync(certificateKeyPath),
        cert: fs.readFileSync(certificatePath),
      }
    : undefined;

  return {
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      https: httpsConfig,
      proxy: {
        "/member": {
          target: "http://127.0.0.1:8080",
          changeOrigin: true,
        },
        "/board": {
          target: "http://127.0.0.1:8080",
          changeOrigin: true,
        },
        "/payments": {
          target: "http://127.0.0.1:8080",
          changeOrigin: true,
        },
      },
    },
  };
});
