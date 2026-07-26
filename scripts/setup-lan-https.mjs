import { cpSync, existsSync, mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(import.meta.dirname, "..");
const certDir = resolve(projectRoot, "certs");
const keyPath = resolve(certDir, "dev-key.pem");
const certPath = resolve(certDir, "dev-cert.pem");
const rootPemPath = resolve(certDir, "mkcert-rootCA.pem");
const rootCerPath = resolve(certDir, "mkcert-rootCA.cer");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.error || result.status !== 0) {
    throw new Error(`${command} 실행에 실패했습니다.`);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.error || result.status !== 0) {
    throw new Error(`${command} 실행 결과를 읽지 못했습니다.`);
  }

  return result.stdout.trim();
}

function getLanIpv4Addresses() {
  return [...new Set(
    Object.values(networkInterfaces())
      .flat()
      .filter(Boolean)
      .filter((item) => item.family === "IPv4" && !item.internal)
      .map((item) => item.address),
  )];
}

function commandExists(command) {
  const checker = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(checker, [command], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

if (!commandExists("mkcert")) {
  console.error(`
[실패] mkcert가 설치되어 있지 않습니다.

Windows 설치 예시:
  winget install FiloSottile.mkcert

설치 후 새 터미널에서 다시 실행하세요:
  npm run setup:https
`);
  process.exit(1);
}

mkdirSync(certDir, { recursive: true });
const lanAddresses = getLanIpv4Addresses();
const certificateHosts = ["localhost", "127.0.0.1", "::1", ...lanAddresses];

console.log("\n[1/3] 로컬 인증 기관을 PC에 등록합니다.");
run("mkcert", ["-install"]);

console.log("\n[2/3] localhost와 현재 LAN IP를 모두 포함한 인증서를 생성합니다.");
run("mkcert", [
  "-key-file",
  keyPath,
  "-cert-file",
  certPath,
  ...certificateHosts,
]);

console.log("\n[3/3] iPhone에 설치할 루트 인증서를 준비합니다.");
const caroot = capture("mkcert", ["-CAROOT"]);
const sourceRootPem = resolve(caroot, "rootCA.pem");

if (!existsSync(sourceRootPem)) {
  throw new Error(`mkcert 루트 인증서를 찾지 못했습니다: ${sourceRootPem}`);
}

cpSync(sourceRootPem, rootPemPath);

if (commandExists("openssl")) {
  run("openssl", ["x509", "-in", rootPemPath, "-outform", "der", "-out", rootCerPath]);
} else {
  cpSync(rootPemPath, rootCerPath);
}

console.log(`
완료되었습니다.

개발 서버 실행:
  npm run dev

같은 Wi-Fi의 iPhone Safari 접속 주소:
${lanAddresses.length ? lanAddresses.map((ip) => `  https://${ip}:5173`).join("\n") : "  LAN IPv4 주소를 찾지 못했습니다."}

iPhone에 전달할 인증서:
  ${rootCerPath}

중요:
  1. iPhone에서 mkcert-rootCA.cer를 열어 프로파일을 설치합니다.
  2. 설정 > 일반 > 정보 > 인증서 신뢰 설정에서 해당 인증서를 완전히 신뢰합니다.
  3. Safari를 완전히 종료한 뒤 위 HTTPS 주소로 다시 접속합니다.
  4. Safari 공유 버튼 > 홈 화면에 추가를 눌러 설치합니다.
`);
