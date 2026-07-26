import { spawn } from "node:child_process";

const viteCommand = process.platform === "win32" ? "vite.cmd" : "vite";
const child = spawn(viteCommand, ["--host", "0.0.0.0", "--port", "5173"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    VITE_USE_HTTPS: "true",
  },
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("error", (error) => {
  console.error("[Vite HTTPS] 개발 서버를 실행하지 못했습니다.", error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
