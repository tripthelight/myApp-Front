const STORE_SLOT = "__m4f8p2_v3";
const LEGACY_SLOT = "myapp.rhythm.level-progress.v1";
const MAX_LEVEL = 30;

const FIELD_SEED = "_7qN4";
const FIELD_BODY = "_p2X9";
const FIELD_PROOF = "_k8R1";
const FORMAT_TAG = "r3";
const MIXING_KEY = "c9V!4mQ#7xL@2sD$8nH%5zK";

let clearStateObserver = null;

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeLevels(levels) {
  return [...new Set((Array.isArray(levels) ? levels : [])
    .map(Number)
    .filter((level) => Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL))]
    .sort((a, b) => a - b);
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function bytesToToken(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function tokenToBytes(token) {
  const normalized = String(token || "").replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function makeStream(seedToken, length) {
  const stream = new Uint8Array(length);
  let state = hashText(`${MIXING_KEY}|${seedToken}|${FORMAT_TAG}`) || 0x9e3779b9;

  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    stream[index] = (state >>> ((index % 4) * 8)) & 0xff;
  }
  return stream;
}

function levelsToBytes(levels) {
  const bytes = new Uint8Array(4);
  normalizeLevels(levels).forEach((level) => {
    const bitIndex = level - 1;
    bytes[Math.floor(bitIndex / 8)] |= 1 << (bitIndex % 8);
  });
  return bytes;
}

function bytesToLevels(bytes) {
  const levels = [];
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    const bitIndex = level - 1;
    if ((bytes[Math.floor(bitIndex / 8)] & (1 << (bitIndex % 8))) !== 0) {
      levels.push(level);
    }
  }
  return levels;
}

function createProof(seedToken, bodyToken) {
  const first = hashText(`${MIXING_KEY}:${seedToken}:${bodyToken}:A`).toString(36);
  const second = hashText(`${bodyToken}:${FORMAT_TAG}:${seedToken}:${MIXING_KEY}:B`).toString(36);
  return `${first}${second}`;
}

function encodeRecord(levels) {
  const seedToken = bytesToToken(randomBytes(12));
  const plainBytes = levelsToBytes(levels);
  const stream = makeStream(seedToken, plainBytes.length);
  const encryptedBytes = plainBytes.map((byte, index) => byte ^ stream[index]);
  const bodyToken = bytesToToken(encryptedBytes);

  return {
    [FIELD_SEED]: seedToken,
    [FIELD_BODY]: bodyToken,
    [FIELD_PROOF]: createProof(seedToken, bodyToken),
  };
}

function decodeRecord(record) {
  if (!record || typeof record !== "object") return null;

  const seedToken = record[FIELD_SEED];
  const bodyToken = record[FIELD_BODY];
  const proofToken = record[FIELD_PROOF];

  if (typeof seedToken !== "string" || typeof bodyToken !== "string" || typeof proofToken !== "string") {
    return null;
  }
  if (createProof(seedToken, bodyToken) !== proofToken) return null;

  try {
    const encryptedBytes = tokenToBytes(bodyToken);
    if (encryptedBytes.length !== 4) return null;

    const stream = makeStream(seedToken, encryptedBytes.length);
    const plainBytes = encryptedBytes.map((byte, index) => byte ^ stream[index]);
    return normalizeLevels(bytesToLevels(plainBytes));
  } catch {
    return null;
  }
}

function readLegacyLevels() {
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_SLOT) || "null");
    const listKey = String.fromCharCode(99, 108, 101, 97, 114, 101, 100);
    const proofKey = String.fromCharCode(99, 104, 101, 99, 115, 117, 109);
    if (!legacy || !Array.isArray(legacy[listKey]) || typeof legacy[proofKey] !== "string") return null;

    const levels = normalizeLevels(legacy[listKey]);
    const payload = levels.join(",");
    const expected = hashText(`rhythm-score:${payload}:30`).toString(36);
    return expected === legacy[proofKey] ? levels : null;
  } catch {
    return null;
  }
}

function writeLevels(levels) {
  try {
    localStorage.setItem(STORE_SLOT, JSON.stringify(encodeRecord(levels)));
  } catch {
    // 저장 공간이 차단된 환경에서도 게임 자체는 계속 실행합니다.
  }
}

function readLevels() {
  try {
    const decoded = decodeRecord(JSON.parse(localStorage.getItem(STORE_SLOT) || "null"));
    if (decoded) return decoded;

    const legacyLevels = readLegacyLevels();
    if (legacyLevels) {
      writeLevels(legacyLevels);
      localStorage.removeItem(LEGACY_SLOT);
      return legacyLevels;
    }
  } catch {
    // 손상되거나 수정된 값은 사용하지 않습니다.
  }

  return [];
}

function routeToLevel(route) {
  const matched = /^lv(\d+)$/.exec(route || "");
  if (!matched) return null;

  const level = Number(matched[1]);
  return Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL ? level : null;
}

function isActuallyVisible(element) {
  if (!(element instanceof HTMLElement) || element.hidden) return false;

  let current = element;
  while (current) {
    if (current.hidden) return false;

    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      return false;
    }
    current = current.parentElement;
  }

  return true;
}

function findVisibleNextButton(root) {
  return [...root.querySelectorAll("button, a, [role='button']")].find((element) => {
    const label = (element.textContent || "").trim().toUpperCase();
    return label === "NEXT" && isActuallyVisible(element) && !element.disabled;
  });
}

export function getClearedLevels() {
  return new Set(readLevels());
}

export function isLevelUnlocked(level) {
  const target = Number(level);
  if (target === 1) return true;
  return getClearedLevels().has(target - 1);
}

export function markLevelCleared(level) {
  const target = Number(level);
  if (!Number.isInteger(target) || target < 1 || target > MAX_LEVEL) return;

  const levels = readLevels();
  if (levels.includes(target)) return;
  writeLevels([...levels, target]);
}

export function stopLevelClearWatcher() {
  clearStateObserver?.disconnect();
  clearStateObserver = null;
}

export function watchLevelClearState(route) {
  stopLevelClearWatcher();

  const level = routeToLevel(route);
  if (!level || level === MAX_LEVEL || !isLevelUnlocked(level)) return;

  const appView = document.getElementById("appView");
  if (!appView) return;

  const recordClearWhenSuccessIsVisible = () => {
    if (!findVisibleNextButton(appView)) return false;

    markLevelCleared(level);
    stopLevelClearWatcher();
    return true;
  };

  if (recordClearWhenSuccessIsVisible()) return;

  clearStateObserver = new MutationObserver(() => {
    recordClearWhenSuccessIsVisible();
  });

  clearStateObserver.observe(appView, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["hidden", "class", "style", "disabled"],
  });
}
