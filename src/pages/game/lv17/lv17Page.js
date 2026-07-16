import lv17Style from "../../../assets/scss/game/lv17/common.scss?inline";
import lv17Template from "./lv17.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv17AppearSound, playLv17WallSound, playLv17FloorSound,
  playLv17SuccessSound, playLv17FailSound, playLv17FinishSound,
  stopLv17Sounds, playStartSound, readySound, unlockSoundOnNextGesture,
} from "../../../module/sound/sound.js";

const GAME_MS = 60000;
const BALL_TOTAL = 5;
const HIT_EARLY_MS = 190;
const HIT_LATE_MS = 230;
const POSITION_TOLERANCE = 1.45;
const COLORS = ["#f1b9cf", "#aec9f4", "#a9dfcf", "#d0bff0", "#f3d0a7"];

let runId = 0;
let rafId = 0;
let timerFrame = 0;
let spawnTimers = new Set();
let balls = [];
let pendingHits = [];
let startedAt = 0;
let previousFrame = 0;
let running = false;
let mistakes = 0;
let successes = 0;
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let mountedPathname = "";
let routeWatchTimer = 0;
let arenaWidth = 0;
let arenaHeight = 0;
let floorBoundaryY = 0;

export function renderPage() {
  destroyPage();
  renderView(lv17Template, lv17Style);
  mountedPathname = window.location.pathname;
  bindLifecycle();
  bindViewport();
  bindControls();
  unlockSoundOnNextGesture();
}

function bindLifecycle() {
  lifecycleController?.abort();
  lifecycleController = new AbortController();
  const { signal } = lifecycleController;
  const leave = () => destroyPage();
  window.addEventListener("popstate", leave, { signal });
  window.addEventListener("pagehide", leave, { signal });
  window.addEventListener("beforeunload", leave, { signal });
  window.clearInterval(routeWatchTimer);
  routeWatchTimer = window.setInterval(() => {
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv17Page")) destroyPage();
  }, 90);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv17Page");
    const arena = document.getElementById("lv17Arena");
    if (!page || !arena) return;
    const height = window.visualViewport?.height ?? window.innerHeight;
    page.style.setProperty("--lv17-vh", `${Math.round(height)}px`);
    const oldW = arenaWidth || arena.clientWidth;
    const oldH = arenaHeight || arena.clientHeight;
    arenaWidth = arena.clientWidth;
    arenaHeight = arena.clientHeight;
    floorBoundaryY = getFloorBoundaryY();
    if (running && oldW && oldH) {
      balls.forEach((ball) => {
        ball.x = clamp((ball.x / oldW) * arenaWidth, ball.radius, arenaWidth - ball.radius);
        const oldFloor = Math.max(ball.radius, oldH - getHitZoneHeight());
        const newFloor = Math.max(ball.radius, floorBoundaryY);
        ball.y = clamp((ball.y / oldFloor) * newFloor, ball.radius, newFloor - ball.radius);
      });
    }
  };
  sync();
  window.addEventListener("resize", sync, { passive: true, signal });
  window.addEventListener("orientationchange", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true, signal });
}

function bindControls() {
  inputController?.abort();
  inputController = new AbortController();
  const { signal } = inputController;
  document.getElementById("lv17Start")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv17Retry")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv17Next")?.addEventListener("click", () => { cancelRun(); navigate("lv18", { replace: true }); }, { signal });
  document.getElementById("lv17Home")?.addEventListener("click", () => { cancelRun(); navigate("home", { replace: true }); }, { signal });
  document.getElementById("lv17TouchRail")?.addEventListener("pointerdown", onTouch, { signal });
  document.getElementById("lv17HitZone")?.addEventListener("pointerdown", onTouch, { signal });
}

async function startGame() {
  cancelRun();
  const id = ++runId;
  running = true;
  mistakes = 0;
  successes = 0;
  balls = [];
  pendingHits = [];
  document.getElementById("lv17Balls").innerHTML = "";
  document.getElementById("lv17Ready")?.setAttribute("hidden", "");
  document.getElementById("lv17Result")?.setAttribute("hidden", "");
  setText("lv17Time", "60");
  await readySound();
  if (!isActive(id)) return;
  playStartSound();
  window.setTimeout(() => beginRun(id), 520);
}

function beginRun(id) {
  if (!isActive(id)) return;
  const arena = document.getElementById("lv17Arena");
  arenaWidth = arena.clientWidth;
  arenaHeight = arena.clientHeight;
  floorBoundaryY = getFloorBoundaryY();
  startedAt = performance.now();
  previousFrame = startedAt;
  spawnBall(id, 0);
  [4300, 9800, 15700, 23100].forEach((base, index) => {
    const delay = base + Math.random() * 2600;
    const timer = window.setTimeout(() => { spawnTimers.delete(timer); spawnBall(id, index + 1); }, delay);
    spawnTimers.add(timer);
  });
  rafId = requestAnimationFrame((now) => animate(id, now));
  timerFrame = requestAnimationFrame(() => updateTimer(id));
}

function spawnBall(id, index) {
  if (!isActive(id)) return;
  const baseRadius = clamp(Math.min(arenaWidth, floorBoundaryY) * 0.033, 16, 34);
  const radius = randomBetween(baseRadius, baseRadius * 1.48);
  const speedBase = clamp(Math.min(arenaWidth, floorBoundaryY) * 0.34, 230, 460);
  const speed = randomBetween(speedBase, speedBase * 1.72);
  let angle = randomBetween(0.38, Math.PI - 0.38);
  if (Math.abs(Math.cos(angle)) < 0.22) angle += 0.28;
  const ball = {
    id: `ball-${id}-${index}`,
    index,
    x: randomBetween(radius * 2, arenaWidth - radius * 2),
    y: randomBetween(radius * 2, Math.max(radius * 3, floorBoundaryY * 0.62)),
    vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
    vy: Math.sin(angle) * speed,
    radius,
    color: COLORS[index % COLORS.length],
    element: null,
  };
  const element = document.createElement("i");
  element.className = "lv17-ball";
  element.style.setProperty("--ball", ball.color);
  element.style.setProperty("--size", `${radius * 2}px`);
  element.style.transform = `translate3d(${ball.x - radius}px, ${ball.y - radius}px, 0)`;
  element.innerHTML = `<span class="lv17-ball-surface is-born"></span>`;
  document.getElementById("lv17Balls")?.append(element);
  ball.element = element;
  balls.push(ball);
  playLv17AppearSound(index);
  window.setTimeout(() => element.querySelector(".lv17-ball-surface")?.classList.remove("is-born"), 600);
}

function animate(id, now) {
  if (!isActive(id)) return;
  const elapsed = now - startedAt;
  if (elapsed >= GAME_MS) { finishGame(id); return; }
  const dt = Math.min((now - previousFrame) / 1000, 0.032);
  previousFrame = now;
  expireHits(now);
  balls.forEach((ball) => moveBall(ball, dt, now));
  rafId = requestAnimationFrame((time) => animate(id, time));
}

function moveBall(ball, dt, now) {
  let remaining = dt;
  let iterations = 0;

  while (remaining > 0.00001 && iterations < 6) {
    iterations += 1;

    const minX = ball.radius;
    const maxX = Math.max(minX, arenaWidth - ball.radius);
    const minY = ball.radius;
    const maxY = Math.max(minY, floorBoundaryY - ball.radius);

    const timeToX = ball.vx > 0
      ? (maxX - ball.x) / ball.vx
      : ball.vx < 0
        ? (minX - ball.x) / ball.vx
        : Number.POSITIVE_INFINITY;
    const timeToY = ball.vy > 0
      ? (maxY - ball.y) / ball.vy
      : ball.vy < 0
        ? (minY - ball.y) / ball.vy
        : Number.POSITIVE_INFINITY;

    const safeTimeToX = timeToX >= -0.000001 ? Math.max(0, timeToX) : Number.POSITIVE_INFINITY;
    const safeTimeToY = timeToY >= -0.000001 ? Math.max(0, timeToY) : Number.POSITIVE_INFINITY;
    const travelTime = Math.min(remaining, safeTimeToX, safeTimeToY);

    ball.x += ball.vx * travelTime;
    ball.y += ball.vy * travelTime;
    remaining -= travelTime;

    const hitX = safeTimeToX <= travelTime + 0.000001;
    const hitY = safeTimeToY <= travelTime + 0.000001;

    if (!hitX && !hitY) break;

    if (hitX) {
      const wall = ball.vx < 0 ? "left" : "right";
      ball.x = wall === "left" ? minX : maxX;
      ball.vx = -ball.vx;
      playLv17WallSound(ball.index, wall);
      pulseBall(ball, "is-wall-hit");
    }

    if (hitY) {
      const isFloor = ball.vy > 0;
      ball.y = isFloor ? maxY : minY;
      ball.vy = -ball.vy;

      if (isFloor) {
        createFloorHit(ball, now - remaining * 1000);
        pulseBall(ball, "is-floor-hit");
      } else {
        playLv17WallSound(ball.index, "top");
        pulseBall(ball, "is-wall-hit");
      }
    }

    // 부동소수점 오차 때문에 같은 벽을 다음 반복에서 다시 판정하지 않도록
    // 반사된 진행 방향으로 아주 미세하게 경계 안쪽에 배치합니다.
    ball.x = clamp(ball.x + Math.sign(ball.vx) * 0.001, minX, maxX);
    ball.y = clamp(ball.y + Math.sign(ball.vy) * 0.001, minY, maxY);
  }

  ball.element.style.transform = `translate3d(${ball.x - ball.radius}px, ${ball.y - ball.radius}px, 0)`;
}

function createFloorHit(ball, now) {
  pendingHits.push({ ballId: ball.id, x: ball.x, radius: ball.radius, time: now, resolved: false });
  playLv17FloorSound(ball.index);
  pulseBall(ball, "is-floor-hit");
  const zone = document.getElementById("lv17HitZone");
  zone?.style.setProperty("--impact-x", `${ball.x}px`);
  zone?.classList.remove("is-impact");
  void zone?.offsetWidth;
  zone?.classList.add("is-impact");

  const rail = document.getElementById("lv17TouchRail");
  rail?.style.setProperty("--target-x", `${ball.x}px`);
  rail?.style.setProperty("--target-width", `${Math.max(54, ball.radius * POSITION_TOLERANCE * 2)}px`);
  rail?.style.setProperty("--target-color", ball.color);
  rail?.classList.remove("is-targeted");
  void rail?.offsetWidth;
  rail?.classList.add("is-targeted");
}

function onTouch(event) {
  if (!running) return;
  const arenaRect = document.getElementById("lv17Arena")?.getBoundingClientRect();
  if (!arenaRect) return;
  const x = event.clientX - arenaRect.left;
  const now = performance.now();
  const candidates = pendingHits.filter((hit) => !hit.resolved && now - hit.time >= -HIT_EARLY_MS && now - hit.time <= HIT_LATE_MS);
  if (!candidates.length) { registerFailure(x, "타이밍이 어긋났습니다"); return; }
  const closest = candidates.reduce((best, hit) => Math.abs(hit.x - x) < Math.abs(best.x - x) ? hit : best);
  closest.resolved = true;
  if (Math.abs(closest.x - x) <= closest.radius * POSITION_TOLERANCE) registerSuccess(closest.x);
  else registerFailure(x, "위치가 빗나갔습니다");
}

function expireHits(now) {
  pendingHits.forEach((hit) => {
    if (!hit.resolved && now - hit.time > HIT_LATE_MS) {
      hit.resolved = true;
      registerFailure(hit.x, "바닥 충돌을 놓쳤습니다");
    }
  });
  pendingHits = pendingHits.filter((hit) => now - hit.time < 1200);
}

function registerSuccess(x) {
  successes += 1;
  playLv17SuccessSound(successes);
  showFeedback(true, x, "PERFECT", "정확한 리듬입니다");
}

function registerFailure(x, message) {
  mistakes += 1;
  playLv17FailSound(mistakes);
  showFeedback(false, x, "MISS", message);
}

function showFeedback(success, x, title, message) {
  const el = document.getElementById("lv17Feedback");
  if (!el) return;
  el.style.setProperty("--feedback-x", `${clamp(x, 30, arenaWidth - 30)}px`);
  el.className = `lv17-feedback ${success ? "good" : "bad"}`;
  el.querySelector("span").textContent = success ? "+" : "×";
  el.querySelector("strong").textContent = title;
  el.querySelector("small").textContent = message;
  el.querySelector("div").innerHTML = Array.from({ length: 10 }, () => "<i></i>").join("");
  void el.offsetWidth;
  el.classList.add("show");
  window.setTimeout(() => el.classList.remove("show"), 720);
}

function updateTimer(id) {
  if (!isActive(id)) return;
  const remain = Math.max(0, GAME_MS - (performance.now() - startedAt));
  setText("lv17Time", String(Math.ceil(remain / 1000)));
  timerFrame = requestAnimationFrame(() => updateTimer(id));
}

function finishGame(id) {
  if (!isActive(id)) return;
  running = false;
  cancelAnimationFrame(rafId);
  cancelAnimationFrame(timerFrame);
  pendingHits.forEach((hit) => { if (!hit.resolved) mistakes += 1; });
  pendingHits = [];
  setText("lv17Time", "0");
  playLv17FinishSound(mistakes === 0);
  const ballElements = [...document.querySelectorAll("#lv17Page .lv17-ball")];
  ballElements.forEach((el, index) => window.setTimeout(() => el.classList.add("is-goodbye"), index * 120));
  window.setTimeout(showResult, 1500);
}

function showResult() {
  const success = mistakes === 0;
  const result = document.getElementById("lv17Result");
  document.getElementById("lv17Next")?.toggleAttribute("hidden", !success);
  document.getElementById("lv17Retry")?.toggleAttribute("hidden", success);
  setText("lv17ResultKicker", success ? "BOUNCE COMPLETE" : "RHYTHM REVIEW");
  setText("lv17ResultTitle", success ? "모든 바운스를 완벽히 읽었습니다" : "한 번 더 리듬을 맞춰보세요");
  setText("lv17ResultText", success
    ? `60초 동안 ${successes}번의 하단 충돌을 모두 정확히 터치했습니다.`
    : `${successes}번 성공했고 ${mistakes}번 실수했습니다. RETRY를 누르면 설명 없이 즉시 다시 시작합니다.`);
  result?.removeAttribute("hidden");
}

function pulseBall(ball, className) {
  const surface = ball.element?.querySelector(".lv17-ball-surface");
  if (!surface) return;
  surface.classList.remove(className);
  void surface.offsetWidth;
  surface.classList.add(className);
  window.setTimeout(() => surface.classList.remove(className), 300);
}

function cancelRun() {
  running = false;
  runId += 1;
  cancelAnimationFrame(rafId);
  cancelAnimationFrame(timerFrame);
  spawnTimers.forEach((timer) => window.clearTimeout(timer));
  spawnTimers.clear();
  stopLv17Sounds();
  document.querySelectorAll("#lv17Page *").forEach((el) => el.getAnimations?.().forEach((animation) => animation.cancel()));
}

function destroyPage() {
  cancelRun();
  lifecycleController?.abort();
  inputController?.abort();
  viewportController?.abort();
  lifecycleController = inputController = viewportController = null;
  window.clearInterval(routeWatchTimer);
  routeWatchTimer = 0;
}

function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
function isActive(id) { return running && id === runId && Boolean(document.getElementById("lv17Page")); }
function randomBetween(min, max) { return min + Math.random() * (max - min); }
function getHitZoneHeight() {
  return document.getElementById("lv17HitZone")?.offsetHeight ?? 0;
}
function getFloorBoundaryY() {
  return Math.max(0, arenaHeight - getHitZoneHeight());
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
