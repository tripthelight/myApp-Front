import lv24Style from "../../../assets/scss/game/lv24/common.scss?inline";
import lv24Template from "./lv24.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv24Fail,
  playLv24Finish,
  playLv24Lock,
  playStartSound,
  readySound,
  stopLv24Sounds,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv24Sound.js";

const MAIN_BEAT_BUNDLES = 34;
const OFFBEAT_BUNDLES = 12;
const TOTAL_BUNDLES = MAIN_BEAT_BUNDLES + OFFBEAT_BUNDLES;
const FIRST_SPAWN_GAP = 2100;
const LAST_SPAWN_GAP = 1100;
const SUCCESS_WINDOW_MS = 190;
const RAPID_PRESS_THRESHOLD_MS = 240;
const WAITING_ALIGN_MIN_MS = 280;
const WAITING_ALIGN_MAX_MS = 430;
const SHAPES = Object.freeze([
  { name: "circle", label: "CIRCLE", shape: "circle(50%)", travel: 1120, hold: 430, leave: 680 },
  { name: "square", label: "SQUARE", shape: "inset(0 round 14%)", travel: 980, hold: 390, leave: 620 },
  { name: "hexagon", label: "HEXAGON", shape: "polygon(25% 6.7%,75% 6.7%,100% 50%,75% 93.3%,25% 93.3%,0 50%)", travel: 860, hold: 350, leave: 570 },
  { name: "octagon", label: "OCTAGON", shape: "polygon(29.3% 0,70.7% 0,100% 29.3%,100% 70.7%,70.7% 100%,29.3% 100%,0 70.7%,0 29.3%)", travel: 760, hold: 315, leave: 530 },
  { name: "diamond", label: "DIAMOND", shape: "polygon(50% 0,100% 50%,50% 100%,0 50%)", travel: 650, hold: 280, leave: 485 },
]);
const COLORS = Object.freeze([
  ["#b9dcf5", "#8fc9e9", "#d7ebf8"],
  ["#cdbcf1", "#b39de4", "#e3d9f7"],
  ["#aee1d1", "#87cfba", "#d2f0e7"],
  ["#f1c1cd", "#e9a7ba", "#f8dce3"],
  ["#f2d49d", "#e8bd72", "#fae8c5"],
]);

let gameToken = 0;
let running = false;
let spawnedBundles = 0;
let completedBundles = 0;
let failures = 0;
let clusterSequence = 0;
let activeTargetId = 0;
let activeQueue = [];
let activeClusters = new Map();
let timers = new Set();
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let mountedPathname = "";
let routeWatchTimer = 0;
let resizeFrame = 0;
let lastGameplayPressAt = Number.NEGATIVE_INFINITY;

export function renderPage() {
  destroyPage();
  renderView(lv24Template, lv24Style);
  mountedPathname = window.location.pathname;
  bindLifecycle();
  bindViewport();
  bindControls();
  prepareReadyState();
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
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv24Page")) destroyPage();
  }, 100);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv24Page");
    if (!page) return;
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);
    page.style.setProperty("--lv24-vw", `${width}px`);
    page.style.setProperty("--lv24-vh", `${height}px`);
    page.classList.toggle("is-portrait", height > width);
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      page.style.setProperty("--lv24-scale", String(Math.min(1, Math.max(.7, Math.min(width / 980, height / 720)))));
    });
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
  unlockSoundOnNextGesture();
  document.getElementById("lv24StartButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv24RetryButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv24NextButton")?.addEventListener("click", () => { cancelGame(); navigate("lv25", { replace: true }); }, { signal });
  document.getElementById("lv24HomeButton")?.addEventListener("click", () => { cancelGame(); navigate("home", { replace: true }); }, { signal });
  document.getElementById("lv24Page")?.addEventListener("pointerdown", handleScreenPress, { signal });
  document.getElementById("lv24Page")?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
}

function prepareReadyState() {
  setText("lv24Phase", "READY");
  setText("lv24Count", `00 / ${TOTAL_BUNDLES}`);
  setText("lv24Hint", "ACTIVE 도형이 한 줄이 되는 순간 화면 아무 곳이나 터치하세요");
  setProgress(0);
  clearStage();
}

async function startGame() {
  cancelGame();
  const token = ++gameToken;
  running = true;
  document.getElementById("lv24Page")?.classList.add("is-playing");
  spawnedBundles = 0;
  completedBundles = 0;
  failures = 0;
  clusterSequence = 0;
  activeTargetId = 0;
  activeQueue = [];
  lastGameplayPressAt = Number.NEGATIVE_INFINITY;
  hide("lv24Ready");
  hide("lv24Result");
  setText("lv24Phase", "FOCUS");
  setText("lv24Count", `00 / ${TOTAL_BUNDLES}`);
  setText("lv24Hint", "안정적인 흐름 사이에 예상치 못한 엇박이 끼어듭니다");
  setProgress(0);
  await readySound();
  if (!isActive(token)) return;
  playStartSound();
  const sequence = createSpawnSequence();
  schedule(() => spawnNextCluster(token, sequence, 0), 650);
}

function spawnNextCluster(token, sequence, bundleIndex) {
  if (!isActive(token) || bundleIndex >= sequence.length) return;
  const item = sequence[bundleIndex];
  spawnedBundles += 1;
  setText("lv24Phase", getStreamPhase(bundleIndex));
  setText("lv24Hint", getStreamHint(bundleIndex));
  spawnCluster(token, bundleIndex, item.layout);

  if (bundleIndex < sequence.length - 1) {
    schedule(() => spawnNextCluster(token, sequence, bundleIndex + 1), item.gapAfter);
  }
}

function spawnCluster(token, bundleIndex, layout) {
  if (!isActive(token)) return;
  const wave = createClusterData(bundleIndex, layout);
  const element = renderCluster(wave);
  activeClusters.set(wave.id, wave);
  activeQueue.push(wave.id);
  promoteNextActive(token);

  // 생성 직후의 화면 밖 시작 위치를 브라우저가 반드시 먼저 그리게 합니다.
  // 초기 위치와 목표 위치가 같은 렌더링 프레임에 합쳐지면 transition이 생략되어
  // 도형 묶음이 정렬된 상태로 갑자기 나타날 수 있습니다.
  void element.offsetWidth;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!isActive(token) || wave.resolved) return;
      element.classList.add("is-gathering");
      wave.lockAt = performance.now() + wave.shape.travel;
      wave.lockTimer = schedule(() => lockCluster(token, wave.id), wave.shape.travel);
    });
  });
}

function lockCluster(token, clusterId) {
  const wave = activeClusters.get(clusterId);
  if (!isActive(token) || !wave || wave.resolved) return;
  wave.element.classList.remove("is-gathering");

  if (wave.id !== activeTargetId) {
    // ACTIVE 뒤에서 대기하는 묶음은 완성된 1열이 되지 않습니다.
    // 화면 밖에서 들어온 뒤 정렬선 주변의 랜덤한 미완성 배열로 멈춰,
    // 여러 묶음이 겹쳐도 밤하늘의 별처럼 보이게 합니다.
    wave.state = "waiting-scattered";
    wave.element.classList.add("is-waiting-scattered");
    return;
  }

  wave.element.classList.add("is-locked");
  beginActiveTiming(token, wave);
}

function promoteNextActive(token) {
  if (!isActive(token) || activeTargetId) return;

  while (activeQueue.length > 0) {
    const nextId = activeQueue[0];
    const wave = activeClusters.get(nextId);
    if (!wave || wave.resolved) {
      activeQueue.shift();
      continue;
    }

    activeTargetId = wave.id;
    wave.isActiveTarget = true;
    wave.element.classList.remove("is-passive-target");
    wave.element.classList.add("is-active-target");
    setText("lv24Hint", "ACTIVE 도형이 한 줄이 되는 순간 화면 아무 곳이나 터치하세요");

    if (wave.state === "waiting-scattered") {
      alignPromotedCluster(token, wave);
    }
    return;
  }
}

function alignPromotedCluster(token, wave) {
  if (!isActive(token) || wave.resolved || wave.id !== activeTargetId) return;
  clearWaveTimers(wave);
  wave.state = "aligning-active";
  wave.alignDuration = randomInt(WAITING_ALIGN_MIN_MS, WAITING_ALIGN_MAX_MS);
  wave.element.style.setProperty("--active-align", `${wave.alignDuration}ms`);

  // 현재의 흩어진 대기 위치를 먼저 확정한 다음 한 줄 정렬 클래스로 전환해야
  // 브라우저가 시작/끝 위치를 같은 프레임으로 합치지 않습니다.
  void wave.element.offsetWidth;
  wave.element.classList.remove("is-waiting-scattered");
  wave.element.classList.add("is-aligning-active");

  // 대기 중 흩어져 있던 도형이 ACTIVE 승계 순간에만 한 줄로 완성됩니다.
  // 이 정렬이 끝난 뒤에 알림음과 성공 판정 창을 엽니다.
  wave.lockTimer = schedule(() => {
    const current = activeClusters.get(wave.id);
    if (!isActive(token) || !current || current.resolved || current.id !== activeTargetId) return;
    current.element.classList.remove("is-aligning-active");
    current.element.classList.add("is-locked");
    beginActiveTiming(token, current);
  }, wave.alignDuration);
}

function beginActiveTiming(token, wave) {
  if (!isActive(token) || wave.resolved || wave.id !== activeTargetId) return;
  wave.state = "locked";
  wave.lockAt = performance.now();
  const timing = wave.element.querySelector(".lv24-cluster-timing");
  timing?.classList.remove("is-now");
  void timing?.offsetWidth;
  timing?.classList.add("is-now");
  playLv24Lock(wave.typeIndex);
  wave.missTimer = schedule(() => resolveFailure(token, wave.id), wave.shape.hold);
}

function handleScreenPress(event) {
  if (!running) return;
  if (event.target.closest("button, .lv24-overlay")) return;

  event.preventDefault();
  const now = performance.now();
  const intervalFromPreviousPress = now - lastGameplayPressAt;
  const isRapidPress = intervalFromPreviousPress < RAPID_PRESS_THRESHOLD_MS;

  // 현재 ACTIVE 묶음이 성공/실패 연출 중이거나 다음 묶음으로 넘어가는 동안의 입력도
  // 기록합니다. 그래야 화면을 계속 난타하다가 다음 ACTIVE의 판정 창에 우연히
  // 들어온 입력이 성공으로 인정되지 않습니다.
  lastGameplayPressAt = now;

  const wave = activeClusters.get(activeTargetId);
  if (!wave || wave.resolved || !wave.isActiveTarget) return;

  const elapsedFromCue = now - wave.lockAt;
  const isInsideTimingWindow =
    wave.state === "locked" &&
    elapsedFromCue >= 0 &&
    elapsedFromCue <= SUCCESS_WINDOW_MS;

  // 성공은 알림음 직후의 짧은 구간에 들어온, 충분히 분리된 최초 입력만 허용합니다.
  // 빠른 연속 입력은 타이밍 창 안에 우연히 들어와도 실패입니다.
  if (isInsideTimingWindow && !isRapidPress) resolveSuccess(gameToken, wave.id);
  else resolveFailure(gameToken, wave.id);
}

function resolveSuccess(token, clusterId) {
  const wave = activeClusters.get(clusterId);
  if (!isActive(token) || !wave || wave.resolved) return;
  wave.resolved = true;
  wave.state = "success";
  clearWaveTimers(wave);
  wave.element.classList.add("is-success");
  const pieces = [...wave.element.querySelectorAll(".lv24-piece")];
  const sliceStepDelay = 105;
  pieces.forEach((piece, index) => {
    schedule(() => {
      if (!isActive(token)) return;
      piece.classList.add("is-sliced");
    }, index * sliceStepDelay);
  });
  schedule(() => completeCluster(token, clusterId), (pieces.length - 1) * sliceStepDelay + 430);
}

function resolveFailure(token, clusterId) {
  const wave = activeClusters.get(clusterId);
  if (!isActive(token) || !wave || wave.resolved) return;
  wave.resolved = true;
  wave.state = "failed";
  failures += 1;
  clearWaveTimers(wave);
  wave.element.classList.remove("is-gathering", "is-locked", "is-waiting-scattered", "is-aligning-active");
  wave.element.classList.add("is-missed");
  playLv24Fail();
  schedule(() => completeCluster(token, clusterId), 560);
}



function completeCluster(token, clusterId) {
  const wave = activeClusters.get(clusterId);
  if (!isActive(token) || !wave) return;
  wave.element.remove();
  activeClusters.delete(clusterId);
  activeQueue = activeQueue.filter((id) => id !== clusterId);
  if (activeTargetId === clusterId) activeTargetId = 0;
  completedBundles += 1;
  setText("lv24Count", `${String(completedBundles).padStart(2, "0")} / ${TOTAL_BUNDLES}`);
  setProgress(completedBundles / TOTAL_BUNDLES);
  promoteNextActive(token);

  if (completedBundles >= TOTAL_BUNDLES && spawnedBundles >= TOTAL_BUNDLES && activeClusters.size === 0) {
    schedule(() => finishGame(token), 430);
  }
}

function finishGame(token) {
  if (!isActive(token)) return;
  running = false;
  document.getElementById("lv24Page")?.classList.remove("is-playing");
  setProgress(1);
  setText("lv24Count", `${TOTAL_BUNDLES} / ${TOTAL_BUNDLES}`);
  const success = failures === 0;
  setText("lv24Phase", success ? "COMPLETE" : "FINISHED");
  setText("lv24ResultTitle", success ? "PERFECT ALIGN" : "RHYTHM MISSED");
  setText("lv24ResultText", success ? "모든 도형 묶음을 정확한 타이밍에 깔끔하게 잘라냈습니다." : `${failures}개의 도형 묶음을 놓쳤습니다. 흐름을 기억하고 다시 도전하세요.`);
  toggle("lv24NextButton", success);
  toggle("lv24RetryButton", !success);
  playLv24Finish(success);
  show("lv24Result");
}

function createClusterData(bundleIndex, layout) {
  const maxType = Math.min(4, Math.floor(bundleIndex / 6));
  const introducedType = Math.min(4, Math.floor(bundleIndex / 6));
  const typeIndex = bundleIndex % 6 === 0 ? introducedType : randomInt(0, maxType);
  const shape = SHAPES[typeIndex];
  const angle = bundleIndex === 0 ? 0 : pickAngle();
  return {
    id: ++clusterSequence,
    bundleIndex,
    typeIndex,
    shape,
    angle,
    sizeScale: createBundleSizeScale(),
    count: randomInt(5, 7),
    colors: COLORS[typeIndex],
    centerX: layout.x,
    centerY: layout.y,
    isActiveTarget: false,
    resolved: false,
    state: "approaching",
    lockAt: 0,
    lockTimer: 0,
    missTimer: 0,
    alignDuration: 0,
    element: null,
  };
}

function createSpawnSequence() {
  const mainIntervals = createMainBeatIntervals(MAIN_BEAT_BUNDLES - 1);
  const mainTimes = [0];
  mainIntervals.forEach((gap) => mainTimes.push(mainTimes[mainTimes.length - 1] + gap));

  const events = mainTimes.map((time, mainIndex) => ({
    time,
    kind: "main",
    mainIndex,
  }));

  // 기본 박자 사이에 추가 묶음을 끼워 넣어 엇박을 만듭니다.
  // 초반부터 조금씩 나타나지만, 중후반에 더 자주 배치됩니다.
  const candidateSlots = Array.from({ length: mainIntervals.length }, (_, index) => index)
    .filter((index) => index >= 2 && index < mainIntervals.length - 1);
  const weightedSlots = candidateSlots
    .map((index) => ({ index, score: Math.random() + index / candidateSlots.length * .72 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, OFFBEAT_BUNDLES)
    .map(({ index }) => index)
    .sort((a, b) => a - b);

  weightedSlots.forEach((slotIndex, offbeatIndex) => {
    const startTime = mainTimes[slotIndex];
    const interval = mainIntervals[slotIndex];
    const progress = offbeatIndex / Math.max(1, OFFBEAT_BUNDLES - 1);
    const minRatio = .32 - progress * .05;
    const maxRatio = .72 - progress * .08;
    const ratio = minRatio + Math.random() * (maxRatio - minRatio);
    events.push({
      time: Math.round(startTime + interval * ratio),
      kind: "offbeat",
      mainIndex: slotIndex,
    });
  });

  events.sort((a, b) => a.time - b.time || (a.kind === "main" ? -1 : 1));
  const layouts = createStreamLayouts(events.length);

  return events.map((event, index) => ({
    layout: layouts[index],
    gapAfter: index < events.length - 1 ? Math.max(180, events[index + 1].time - event.time) : 0,
    kind: event.kind,
  }));
}

function createMainBeatIntervals(count) {
  if (count <= 0) return [];
  const intervals = [];
  let previous = FIRST_SPAWN_GAP;

  for (let index = 0; index < count; index += 1) {
    const progress = index / Math.max(1, count - 1);
    const curve = 1 - Math.pow(progress, 1.08);
    const target = LAST_SPAWN_GAP + (FIRST_SPAWN_GAP - LAST_SPAWN_GAP) * curve;
    const jitter = index === 0 || index === count - 1 ? 0 : randomInt(-85, 85);
    let gap = Math.round(target + jitter);

    // 기본 박자는 대체로 서서히 빨라지되 기계적인 등차수열처럼 들리지 않게 합니다.
    gap = Math.min(previous + 55, gap);
    gap = Math.max(LAST_SPAWN_GAP, gap);
    if (index === 0) gap = FIRST_SPAWN_GAP;
    if (index === count - 1) gap = LAST_SPAWN_GAP;
    intervals.push(gap);
    previous = gap;
  }
  return intervals;
}

function createStreamLayouts(count) {
  const zones = [
    [23, 28], [50, 27], [76, 29],
    [27, 50], [72, 49],
    [24, 72], [50, 70], [76, 71],
    [50, 49],
  ];
  let pool = [];
  return Array.from({ length: count }, (_, index) => {
    if (pool.length === 0) pool = shuffle([...zones]);
    const [x, y] = pool.pop();
    return {
      x: clamp(x + randomInt(-5, 5), 17, 83),
      y: clamp(y + randomInt(-5, 5), 19, 81),
      index,
    };
  });
}

function renderCluster(wave) {
  const layer = document.getElementById("lv24ClusterLayer");
  const cluster = document.createElement("div");
  cluster.className = "lv24-cluster";
  cluster.dataset.clusterId = String(wave.id);
  cluster.classList.add("is-passive-target");
  cluster.style.setProperty("--angle", `${wave.angle}deg`);
  cluster.style.setProperty("--center-x", `${wave.centerX}%`);
  cluster.style.setProperty("--center-y", `${wave.centerY}%`);

  const guide = document.createElement("div");
  guide.className = "lv24-cluster-guide";
  const timing = document.createElement("div");
  timing.className = "lv24-cluster-timing";
  const activeLabel = document.createElement("span");
  activeLabel.textContent = "ACTIVE";
  timing.append(activeLabel);

  const basePieceSize = getResponsivePieceSize();
  const pieceSize = basePieceSize * wave.sizeScale;
  cluster.style.setProperty("--piece-size", `${pieceSize}px`);
  cluster.style.setProperty("--bundle-scale", wave.sizeScale.toFixed(3));
  const spacingRatio = .985;
  const center = (wave.count - 1) / 2;
  const missDirection = Math.random() > .5 ? 1 : -1;

  for (let index = 0; index < wave.count; index += 1) {
    const piece = document.createElement("i");
    piece.className = `lv24-piece is-${wave.shape.name}`;
    const side = index % 2 === 0 ? -1 : 1;
    const offset = (index - center) * spacingRatio;
    const targetX = offset * pieceSize;
    const responsiveTargetX = `calc(${offset} * var(--piece-size))`;
    const startY = getPerpendicularOffscreenDistance(wave, targetX, side);
    const exitY = -side * getPerpendicularOffscreenDistance(wave, targetX, -side, 40);
    const sliceDistance = Math.max(14, Math.round(pieceSize * randomFloat(.30, .42)));
    const waitingAlong = randomFloat(-.62, .62) * pieceSize;
    const waitingDistance = randomFloat(.42, 1.38) * pieceSize;
    const waitingSide = Math.random() > .5 ? 1 : -1;
    const waitingScale = randomFloat(.72, .94);
    piece.style.setProperty("--shape", wave.shape.shape);
    piece.style.setProperty("--fill", wave.colors[index % wave.colors.length]);
    // X축은 최종 정렬선 방향, Y축은 그 정렬선에 정확히 수직인 방향입니다.
    // 따라서 시작 X를 목표 X와 동일하게 고정하고 시작 Y만 화면 밖까지 이동시키면
    // 모든 도형은 정렬선과 정확히 ±90°인 경로로 진입합니다.
    piece.style.setProperty("--start-x", responsiveTargetX);
    piece.style.setProperty("--start-y", `${startY}px`);
    piece.style.setProperty("--target-x", responsiveTargetX);
    piece.style.setProperty("--wait-x", `calc(${offset} * var(--piece-size) + ${waitingAlong.toFixed(2)}px)`);
    piece.style.setProperty("--wait-y", `${(waitingSide * waitingDistance).toFixed(2)}px`);
    piece.style.setProperty("--wait-r", `${randomFloat(-18, 18).toFixed(2)}deg`);
    piece.style.setProperty("--wait-scale", waitingScale.toFixed(3));
    piece.style.setProperty("--wait-opacity", randomFloat(.42, .72).toFixed(3));
    piece.style.setProperty("--exit-x", `${targetX + randomInt(-70, 70)}px`);
    piece.style.setProperty("--exit-y", `${exitY}px`);
    piece.style.setProperty("--exit-r", `${randomInt(-70, 70)}deg`);
    piece.style.setProperty("--travel", `${wave.shape.travel}ms`);
    piece.style.setProperty("--leave", `${wave.shape.leave}ms`);
    // 묶음의 로컬 X축이 실제 1열 정렬 방향입니다.
    // 절단선은 이 X축과 평행해야 하므로 도형을 상/하로 나누고,
    // 두 반쪽은 로컬 Y축(정렬선에 수직)으로 벌어지게 합니다.
    piece.style.setProperty("--slice-top-x", `${randomInt(-3, 3)}px`);
    piece.style.setProperty("--slice-top-y", `${-sliceDistance}px`);
    piece.style.setProperty("--slice-bottom-x", `${randomInt(-3, 3)}px`);
    piece.style.setProperty("--slice-bottom-y", `${sliceDistance}px`);
    piece.style.setProperty("--miss-x", `${missDirection * randomInt(150, 240)}px`);
    piece.style.setProperty("--miss-y", `${randomInt(-100, 100)}px`);
    piece.style.setProperty("--miss-r", `${missDirection * randomInt(30, 72)}deg`);
    const topHalf = document.createElement("b");
    const bottomHalf = document.createElement("b");
    topHalf.className = "lv24-piece-half is-top";
    bottomHalf.className = "lv24-piece-half is-bottom";
    piece.append(topHalf, bottomHalf);
    cluster.append(piece);
  }

  cluster.append(guide, timing);
  layer?.append(cluster);
  wave.element = cluster;
  return cluster;
}

function createBundleSizeScale() {
  // 현재 도형 크기를 최소값(1)으로 유지하면서 묶음마다 독립적인 크기를 부여합니다.
  // 모양과 크기는 서로 관계없이 결정되며, 큰 묶음은 가끔만 등장해 공간감을 만듭니다.
  const roll = Math.random();
  if (roll < .18) return 1;
  if (roll < .62) return 1.08 + Math.random() * .22;
  if (roll < .90) return 1.30 + Math.random() * .20;
  return 1.50 + Math.random() * .12;
}

function getResponsivePieceSize() {
  const viewport = window.visualViewport;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  const vmin = Math.min(width, height) / 100;

  // lv24.scss의 반응형 --size 규칙과 같은 계산을 사용합니다.
  // 중심 간격을 실제 도형 크기와 연결해 화면이 작아져도 틈이 벌어지지 않습니다.
  if (width <= 620) return clamp(5.4 * vmin, 22, 38);
  return clamp(4.7 * vmin, 25, 48);
}

function getPerpendicularOffscreenDistance(wave, targetOffset, side, extraMargin = 72) {
  const layer = document.getElementById("lv24ClusterLayer");
  const rect = layer?.getBoundingClientRect();
  const width = Math.max(1, rect?.width ?? window.innerWidth);
  const height = Math.max(1, rect?.height ?? window.innerHeight);

  const radians = wave.angle * Math.PI / 180;
  const lineX = Math.cos(radians);
  const lineY = Math.sin(radians);
  const perpendicularX = -lineY * side;
  const perpendicularY = lineX * side;

  const targetX = width * wave.centerX / 100 + lineX * targetOffset;
  const targetY = height * wave.centerY / 100 + lineY * targetOffset;
  const candidates = [];

  if (perpendicularX > .0001) candidates.push((width - targetX) / perpendicularX);
  else if (perpendicularX < -.0001) candidates.push((0 - targetX) / perpendicularX);

  if (perpendicularY > .0001) candidates.push((height - targetY) / perpendicularY);
  else if (perpendicularY < -.0001) candidates.push((0 - targetY) / perpendicularY);

  const edgeDistance = Math.min(...candidates.filter((distance) => Number.isFinite(distance) && distance >= 0));
  const safeDistance = Number.isFinite(edgeDistance) ? edgeDistance : Math.max(width, height);
  return side * (safeDistance + extraMargin);
}

function pickAngle() {
  const kind = randomInt(0, 3);
  if (kind === 0) return 0;
  if (kind === 1) return 90;
  if (kind === 2) return randomInt(18, 67);
  return randomInt(-67, -18);
}

function getStreamPhase(bundleIndex) {
  const progress = bundleIndex / Math.max(1, TOTAL_BUNDLES - 1);
  if (progress < .25) return "FLOW";
  if (progress < .55) return "BUILD";
  if (progress < .82) return "ACCEL";
  return "FINAL RUSH";
}

function getStreamHint(bundleIndex) {
  const progress = bundleIndex / Math.max(1, TOTAL_BUNDLES - 1);
  if (bundleIndex < 5) return "기본 박자 사이에 갑작스러운 엇박 묶음이 끼어듭니다";
  if (progress < .7) return "예상보다 이른 출현에 흔들리지 말고 ACTIVE 순서를 따라가세요";
  return "엇박이 더 촘촘해집니다 — ACTIVE에만 집중하세요";
}

function clearWaveTimers(wave) {
  if (wave.lockTimer) clearScheduled(wave.lockTimer);
  if (wave.missTimer) clearScheduled(wave.missTimer);
}

function clearStage() {
  activeClusters.forEach((wave) => clearWaveTimers(wave));
  activeClusters.clear();
  activeQueue = [];
  activeTargetId = 0;
  const layer = document.getElementById("lv24ClusterLayer");
  if (layer) layer.innerHTML = "";
}

function schedule(callback, delay) {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
  return timer;
}

function clearScheduled(timer) {
  window.clearTimeout(timer);
  timers.delete(timer);
}

function cancelGame() {
  running = false;
  document.getElementById("lv24Page")?.classList.remove("is-playing");
  activeClusters.forEach((wave) => clearWaveTimers(wave));
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  stopLv24Sounds();
  clearStage();
}

export function destroyPage() {
  cancelGame();
  gameToken += 1;
  lifecycleController?.abort();
  inputController?.abort();
  viewportController?.abort();
  lifecycleController = null;
  inputController = null;
  viewportController = null;
  window.clearInterval(routeWatchTimer);
  window.cancelAnimationFrame(resizeFrame);
  routeWatchTimer = 0;
  resizeFrame = 0;
}

function isActive(token) { return running && token === gameToken && Boolean(document.getElementById("lv24Page")); }
function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function setProgress(value) { const element = document.getElementById("lv24Progress"); if (element) element.style.transform = `scaleX(${clamp(value, 0, 1)})`; }
function show(id) { const element = document.getElementById(id); if (element) element.hidden = false; }
function hide(id) { const element = document.getElementById(id); if (element) element.hidden = true; }
function toggle(id, visible) { const element = document.getElementById(id); if (element) element.hidden = !visible; }
