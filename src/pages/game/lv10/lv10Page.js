import lv10Style from "../../../assets/scss/game/lv10/common.scss?inline";
import lv10Template from "./lv10.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv10CollisionSound,
  playLv10SwipeSound,
  playLv10WaveSound,
  playStartSound,
  readySound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv10Sound.js";

const CONFIG = Object.freeze({
  waves: [7, 5, 6],
  approachDurationMin: 3.15,
  approachDurationMax: 5.2,
  spawnDelayMinMs: 260,
  spawnDelayMaxMs: 860,
  spawnPairDelayMinMs: 150,
  spawnPairDelayMaxMs: 280,
  waveGapMs: 1050,
  dragScale: 1,
  swipeVelocityScale: 0.92,
  minReleaseSpeed: 150,
  maxReleaseSpeed: 1550,
  frictionPerFrame: 0.986,
  outPadding: 72,
  collisionPadding: 3,
  resultDelayMs: 1050,
});

const SIDES = ["top", "right", "bottom", "left"];
const TOTAL_THIEVES = CONFIG.waves.reduce((sum, count) => sum + count, 0);

let gameId = 0;
let frameId = 0;
let timeoutIds = new Set();
let viewportController = null;
let thieves = new Map();
let resolvedCount = 0;
let failedCount = 0;
let currentWaveIndex = -1;
let waveRemaining = 0;
let running = false;
let lastFrameTime = 0;

export function renderPage() {
  cancelGame();
  renderView(lv10Template, lv10Style);
  bindViewportHeight();
  bindPage();
}

function bindViewportHeight() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;

  const sync = () => {
    const page = document.getElementById("lv10Page");
    if (!page) return;
    const height = window.visualViewport?.height ?? window.innerHeight;
    page.style.setProperty("--lv10-viewport-height", `${Math.round(height)}px`);
  };

  sync();
  window.addEventListener("resize", sync, { passive: true, signal });
  window.addEventListener("orientationchange", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true, signal });
}

function bindPage() {
  const start = document.getElementById("lv10StartButton");
  const retry = document.getElementById("lv10RetryButton");
  const next = document.getElementById("lv10NextButton");
  const home = document.getElementById("lv10HomeButton");
  const layer = document.getElementById("lv10ThiefLayer");
  if (!start || !retry || !next || !home || !layer) return;

  unlockSoundOnNextGesture();
  layer.addEventListener("pointerdown", handlePointerDown);
  layer.addEventListener("pointermove", handlePointerMove);
  layer.addEventListener("pointerup", handlePointerUp);
  layer.addEventListener("pointercancel", handlePointerUp);

  start.addEventListener("click", async () => {
    const id = beginGame();
    await readySound();
    if (!isActive(id)) return;
    document.getElementById("lv10Ready")?.setAttribute("hidden", "");
    playStartSound();
    schedule(() => startWave(id, 0), 650);
  });

  retry.addEventListener("click", async () => {
    const id = beginGame();
    await readySound();
    if (!isActive(id)) return;
    document.getElementById("lv10Result")?.setAttribute("hidden", "");
    playStartSound();
    schedule(() => startWave(id, 0), 520);
  });

  next.addEventListener("click", () => {
    cancelGame();
    navigate("lv11", { replace: true });
  });

  home.addEventListener("click", () => {
    cancelGame();
    navigate("home", { replace: true });
  });
}

function beginGame() {
  cancelGame();
  gameId += 1;
  running = true;
  resolvedCount = 0;
  failedCount = 0;
  currentWaveIndex = -1;
  waveRemaining = 0;
  thieves = new Map();
  lastFrameTime = performance.now();

  document.getElementById("lv10ThiefLayer")?.replaceChildren();
  document.getElementById("lv10Effects")?.replaceChildren();
  document.getElementById("lv10DamageMarks")?.replaceChildren();
  document.getElementById("lv10Jewel")?.classList.remove("is-hit", "is-critical");
  document.getElementById("lv10Arena")?.classList.add("is-playing");
  updateHud();
  frameId = requestAnimationFrame(tick);
  return gameId;
}

function startWave(id, waveIndex) {
  if (!isActive(id)) return;
  currentWaveIndex = waveIndex;
  const count = CONFIG.waves[waveIndex];
  waveRemaining = count;
  showWaveBanner(waveIndex, count);
  updateHud();

  const sidePool = shuffle([...SIDES]);
  const spawnDelays = createSpawnDelays(count);
  for (let index = 0; index < count; index += 1) {
    schedule(() => {
      if (!isActive(id)) return;
      playLv10WaveSound(index, waveIndex);
      spawnThief(id, sidePool[index % sidePool.length], index);
    }, spawnDelays[index]);
  }
}


function createSpawnDelays(count) {
  const delays = [];
  let elapsed = 360;

  for (let index = 0; index < count; index += 1) {
    delays.push(Math.round(elapsed));
    if (index >= count - 1) continue;

    const makeQuickPair = Math.random() < 0.42 && index < count - 2;
    elapsed += makeQuickPair
      ? random(CONFIG.spawnPairDelayMinMs, CONFIG.spawnPairDelayMaxMs)
      : random(CONFIG.spawnDelayMinMs, CONFIG.spawnDelayMaxMs);
  }

  return delays;
}

function spawnThief(id, side, order) {
  const arena = document.getElementById("lv10Arena");
  const layer = document.getElementById("lv10ThiefLayer");
  if (!arena || !layer || !isActive(id)) return;

  const rect = arena.getBoundingClientRect();
  const shortSide = Math.min(rect.width, rect.height);
  const longSide = Math.max(rect.width, rect.height);
  const desktopBoost = window.matchMedia("(min-width: 721px)").matches ? longSide * 0.018 : 0;
  const size = clamp(shortSide * 0.112 + desktopBoost, 58, 164);
  const position = spawnPosition(side, rect.width, rect.height, size, order);
  const jewel = { x: rect.width / 2, y: rect.height / 2 };
  const angle = Math.atan2(jewel.y - position.y, jewel.x - position.x);
  const distance = Math.hypot(jewel.x - position.x, jewel.y - position.y);
  const waveBoost = 1 + currentWaveIndex * 0.08;
  const duration = random(CONFIG.approachDurationMin, CONFIG.approachDurationMax) / waveBoost;
  const speed = distance / duration;
  const thiefId = `${id}-${currentWaveIndex}-${order}-${Math.random().toString(36).slice(2, 7)}`;

  const element = document.createElement("button");
  element.type = "button";
  element.className = `lv10-thief is-${side}`;
  element.dataset.thiefId = thiefId;
  element.setAttribute("aria-label", "다가오는 도둑. 화면 밖으로 스와이프하세요.");
  element.innerHTML = `<span class="thief-head"><i></i><b></b></span><span class="thief-body"><i></i></span><em>!</em>`;
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  layer.appendChild(element);

  const thief = {
    id: thiefId,
    element,
    x: position.x,
    y: position.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size,
    dragging: false,
    pointerId: null,
    samples: [],
    resolved: false,
  };
  thieves.set(thiefId, thief);
  renderThief(thief);
  requestAnimationFrame(() => element.classList.add("is-visible"));
}

function spawnPosition(side, width, height, size, order) {
  const margin = size * 0.72;
  const spreadSeed = (order + 1) / 5;
  if (side === "top") return { x: random(width * 0.14, width * 0.86) + spreadSeed, y: -margin };
  if (side === "right") return { x: width + margin, y: random(height * 0.16, height * 0.84) + spreadSeed };
  if (side === "bottom") return { x: random(width * 0.14, width * 0.86) - spreadSeed, y: height + margin };
  return { x: -margin, y: random(height * 0.16, height * 0.84) - spreadSeed };
}

function tick(now) {
  if (!running) return;
  const dt = Math.min((now - lastFrameTime) / 1000, 0.034);
  lastFrameTime = now;
  const arena = document.getElementById("lv10Arena");
  if (!arena) return;
  const rect = arena.getBoundingClientRect();
  const jewelRect = document.getElementById("lv10JewelWrap")?.getBoundingClientRect();
  const jewelRadius = jewelRect ? jewelRect.width * 0.39 : clamp(Math.min(rect.width, rect.height) * 0.09, 44, 105);

  thieves.forEach((thief) => {
    if (thief.resolved || thief.dragging) return;
    thief.x += thief.vx * dt;
    thief.y += thief.vy * dt;

    if (thief.wasSwiped) {
      const friction = Math.pow(CONFIG.frictionPerFrame, dt * 60);
      thief.vx *= friction;
      thief.vy *= friction;
    }

    renderThief(thief);

    const dx = thief.x - rect.width / 2;
    const dy = thief.y - rect.height / 2;
    if (Math.hypot(dx, dy) <= jewelRadius + thief.size * 0.29 + CONFIG.collisionPadding) {
      resolveCollision(thief);
      return;
    }

    const pad = CONFIG.outPadding + thief.size;
    if (thief.wasSwiped && (thief.x < -pad || thief.x > rect.width + pad || thief.y < -pad || thief.y > rect.height + pad)) {
      resolveSuccess(thief);
    }
  });

  frameId = requestAnimationFrame(tick);
}

function handlePointerDown(event) {
  const element = event.target.closest(".lv10-thief");
  if (!element || !running) return;
  const thief = thieves.get(element.dataset.thiefId);
  if (!thief || thief.resolved) return;

  event.preventDefault();
  element.setPointerCapture?.(event.pointerId);
  thief.dragging = true;
  thief.pointerId = event.pointerId;
  thief.vx = 0;
  thief.vy = 0;
  const arena = document.getElementById("lv10Arena");
  if (!arena) return;
  const rect = arena.getBoundingClientRect();
  thief.samples = [{ x: event.clientX, y: event.clientY, t: performance.now() }];
  thief.dragOffsetX = event.clientX - rect.left - thief.x;
  thief.dragOffsetY = event.clientY - rect.top - thief.y;
  element.classList.add("is-grabbed");
}

function handlePointerMove(event) {
  const thief = findDraggedThief(event.pointerId);
  if (!thief) return;
  event.preventDefault();
  const arena = document.getElementById("lv10Arena");
  if (!arena) return;
  const rect = arena.getBoundingClientRect();
  thief.x = (event.clientX - rect.left - thief.dragOffsetX) * CONFIG.dragScale;
  thief.y = (event.clientY - rect.top - thief.dragOffsetY) * CONFIG.dragScale;
  thief.samples.push({ x: event.clientX, y: event.clientY, t: performance.now() });
  thief.samples = thief.samples.filter((sample) => performance.now() - sample.t < 110).slice(-6);
  renderThief(thief);
  renderSwipeTrail(thief, event.clientX - rect.left, event.clientY - rect.top);
}

function handlePointerUp(event) {
  const thief = findDraggedThief(event.pointerId);
  if (!thief) return;
  event.preventDefault();
  thief.dragging = false;
  thief.pointerId = null;
  thief.element.classList.remove("is-grabbed");

  const first = thief.samples[0];
  const last = thief.samples.at(-1);
  const elapsed = Math.max((last.t - first.t) / 1000, 0.025);
  let vx = ((last.x - first.x) / elapsed) * CONFIG.swipeVelocityScale;
  let vy = ((last.y - first.y) / elapsed) * CONFIG.swipeVelocityScale;
  const speed = Math.hypot(vx, vy);

  if (speed < CONFIG.minReleaseSpeed) {
    const fallback = CONFIG.minReleaseSpeed / Math.max(speed, 1);
    vx *= fallback;
    vy *= fallback;
  }
  const limitedSpeed = Math.min(Math.max(Math.hypot(vx, vy), CONFIG.minReleaseSpeed), CONFIG.maxReleaseSpeed);
  const normalized = normalize(vx, vy);
  thief.vx = normalized.x * limitedSpeed;
  thief.vy = normalized.y * limitedSpeed;
  thief.wasSwiped = true;
  thief.element.classList.add("is-released");
  playLv10SwipeSound(limitedSpeed / CONFIG.maxReleaseSpeed);
  showFeedback(limitedSpeed > 820 ? "GREAT SWIPE" : "KEEP PUSHING", limitedSpeed > 820 ? "FAST" : "STEADY", "success");
}

function findDraggedThief(pointerId) {
  return [...thieves.values()].find((thief) => thief.dragging && thief.pointerId === pointerId && !thief.resolved);
}

function resolveSuccess(thief) {
  if (thief.resolved) return;
  thief.resolved = true;
  resolvedCount += 1;
  waveRemaining -= 1;
  thief.element.classList.add("is-banished");
  createSuccessBurst(thief.x, thief.y, thief.vx, thief.vy);
  showFeedback("BANISHED", "PERFECT GUARD", "success");
  schedule(() => removeThief(thief), 680);
  updateHud();
  checkWaveComplete();
}

function resolveCollision(thief) {
  if (thief.resolved) return;
  thief.resolved = true;
  resolvedCount += 1;
  failedCount += 1;
  waveRemaining -= 1;
  thief.element.classList.add("is-caught");
  damageJewel(thief);
  createFailureBurst(thief.x, thief.y);
  playLv10CollisionSound(failedCount);
  showFeedback("IMPACT", "JEWEL DAMAGED", "fail");
  schedule(() => removeThief(thief), 620);
  updateHud();
  checkWaveComplete();
}

function damageJewel(thief) {
  const jewel = document.getElementById("lv10Jewel");
  const marks = document.getElementById("lv10DamageMarks");
  if (!jewel || !marks) return;
  jewel.classList.remove("is-hit");
  void jewel.offsetWidth;
  jewel.classList.add("is-hit");
  jewel.style.setProperty("--damage", `${failedCount / TOTAL_THIEVES}`);
  if (failedCount >= Math.ceil(TOTAL_THIEVES * 0.55)) jewel.classList.add("is-critical");

  const mark = document.createElement("i");
  const angle = Math.atan2(thief.y - innerHeight / 2, thief.x - innerWidth / 2);
  mark.style.setProperty("--mark-angle", `${angle}rad`);
  mark.style.setProperty("--mark-index", failedCount);
  marks.appendChild(mark);
  document.getElementById("lv10Arena")?.classList.add("is-impact");
  schedule(() => document.getElementById("lv10Arena")?.classList.remove("is-impact"), 420);
}

function checkWaveComplete() {
  if (waveRemaining > 0) return;
  if (resolvedCount >= TOTAL_THIEVES) {
    schedule(showResult, CONFIG.resultDelayMs);
    return;
  }
  const nextWave = currentWaveIndex + 1;
  schedule(() => startWave(gameId, nextWave), CONFIG.waveGapMs);
}

function showResult() {
  if (!running) return;
  running = false;
  cancelAnimationFrame(frameId);
  document.getElementById("lv10Arena")?.classList.remove("is-playing");
  const result = document.getElementById("lv10Result");
  const title = document.getElementById("lv10ResultTitle");
  const message = document.getElementById("lv10ResultMessage");
  const next = document.getElementById("lv10NextButton");
  const retry = document.getElementById("lv10RetryButton");
  if (!result || !title || !message || !next || !retry) return;

  if (failedCount === 0) {
    title.textContent = "JEWEL SAFE";
    message.textContent = `${TOTAL_THIEVES}명의 도둑을 모두 완벽하게 쫓아냈습니다.`;
    next.hidden = false;
    retry.hidden = true;
  } else {
    title.textContent = "JEWEL DAMAGED";
    message.textContent = `${failedCount}번 충돌했습니다. 모든 스와이프가 끝났으니 다시 도전하세요.`;
    next.hidden = true;
    retry.hidden = false;
  }
  result.hidden = false;
}

function updateHud() {
  const batch = document.getElementById("lv10BatchText");
  const score = document.getElementById("lv10ScoreText");
  if (batch) batch.textContent = currentWaveIndex < 0 ? "READY" : `WAVE ${currentWaveIndex + 1} / ${CONFIG.waves.length}`;
  if (score) score.textContent = `${resolvedCount} / ${TOTAL_THIEVES}`;
}

function showWaveBanner(index, count) {
  const banner = document.getElementById("lv10WaveBanner");
  if (!banner) return;
  banner.querySelector("span").textContent = `WAVE ${index + 1}`;
  banner.querySelector("strong").textContent = `${count} INCOMING`;
  banner.classList.remove("is-showing");
  void banner.offsetWidth;
  banner.classList.add("is-showing");
}

function showFeedback(title, subtitle, type) {
  const feedback = document.getElementById("lv10Feedback");
  if (!feedback) return;
  feedback.querySelector("strong").textContent = title;
  feedback.querySelector("span").textContent = subtitle;
  feedback.className = `lv10-feedback is-${type}`;
  void feedback.offsetWidth;
  feedback.classList.add("is-visible");
}

function createSuccessBurst(x, y, vx, vy) {
  const effects = document.getElementById("lv10Effects");
  if (!effects) return;
  const burst = document.createElement("div");
  burst.className = "lv10-burst is-success";
  burst.style.left = `${x}px`;
  burst.style.top = `${y}px`;
  const angle = Math.atan2(vy, vx);
  burst.style.setProperty("--burst-angle", `${angle}rad`);
  burst.innerHTML = Array.from({ length: 10 }, (_, index) => `<i style="--i:${index}"></i>`).join("");
  effects.appendChild(burst);
  schedule(() => burst.remove(), 850);
}

function createFailureBurst(x, y) {
  const effects = document.getElementById("lv10Effects");
  if (!effects) return;
  const burst = document.createElement("div");
  burst.className = "lv10-burst is-fail";
  burst.style.left = `${x}px`;
  burst.style.top = `${y}px`;
  burst.innerHTML = Array.from({ length: 8 }, (_, index) => `<i style="--i:${index}"></i>`).join("");
  effects.appendChild(burst);
  schedule(() => burst.remove(), 760);
}

function renderSwipeTrail(thief, x, y) {
  const effects = document.getElementById("lv10Effects");
  if (!effects || Math.random() > 0.55) return;
  const dot = document.createElement("i");
  dot.className = "lv10-swipe-dot";
  dot.style.left = `${x}px`;
  dot.style.top = `${y}px`;
  dot.style.setProperty("--dot-size", `${random(5, 13)}px`);
  effects.appendChild(dot);
  schedule(() => dot.remove(), 420);
}

function renderThief(thief) {
  thief.element.style.transform = `translate3d(${thief.x - thief.size / 2}px, ${thief.y - thief.size / 2}px, 0) rotate(${clamp(thief.vx * 0.012, -14, 14)}deg)`;
}

function removeThief(thief) {
  thief.element.remove();
  thieves.delete(thief.id);
}

function cancelGame() {
  running = false;
  cancelAnimationFrame(frameId);
  timeoutIds.forEach((id) => clearTimeout(id));
  timeoutIds.clear();
  thieves.forEach((thief) => thief.element.remove());
  thieves.clear();
}

function schedule(callback, delay) {
  const id = window.setTimeout(() => {
    timeoutIds.delete(id);
    callback();
  }, delay);
  timeoutIds.add(id);
  return id;
}

function isActive(id) {
  return running && id === gameId && document.getElementById("lv10Page");
}

function normalize(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}
