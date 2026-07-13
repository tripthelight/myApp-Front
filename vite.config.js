import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const certificateKeyPath = path.resolve(
  __dirname,
  "certs/localhost-key.pem",
);

const certificatePath = path.resolve(
  __dirname,
  "certs/localhost-cert.pem",
);

export default defineConfig(({ command }) => {
  const isDevServer = command === "serve";

  const hasLocalCertificates =
    fs.existsSync(certificateKeyPath) &&
    fs.existsSync(certificatePath);

  const httpsConfig =
    isDevServer && hasLocalCertificates
      ? {
          key: fs.readFileSync(certificateKeyPath),
          cert: fs.readFileSync(certificatePath),
        }
      : undefined;

  if (isDevServer && !hasLocalCertificates) {
    console.warn(
      [
        "",
        "[Vite HTTPS]",
        "로컬 HTTPS 인증서가 없어 HTTP로 실행합니다.",
        `key: ${certificateKeyPath}`,
        `cert: ${certificatePath}`,
        "",
      ].join("\n"),
    );
  }

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