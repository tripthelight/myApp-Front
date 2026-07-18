import lv4Style from "../../../assets/scss/game/lv4/common.scss?inline";
import lv4Template from "./lv4.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playFailSound,
  playOkSound,
  playOverlapAppearSound,
  playStartSound,
  readySound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv4Sound.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const CONFIG = Object.freeze({
  minOverlapCount: 4,
  maxOverlapCount: 6,
  answerCount: 4,
  minCoverage: 0.75,
  generationAttempts: 900,
  circleAppearGapMs: 350,
  circleDrawMs: 920,
  overlapAppearGapMs: 430,
  overlapDrawMs: 520,
  memoryHoldMs: 950,
  disappearGapMs: 180,
  replayGapMs: 280,
  touchCueMs: 420,
  touchStageMs: 1050,
  feedbackMs: 360,
});

const PASTELS = Object.freeze([
  [255, 180, 190], [255, 215, 170], [255, 241, 170],
  [183, 235, 201], [170, 219, 255], [194, 198, 255],
  [231, 190, 255], [255, 192, 224], [177, 238, 235],
  [211, 222, 246], [244, 205, 178], [202, 231, 190],
]);

const FEEDBACK = Object.freeze({
  success: "rgba(34, 166, 105, 0.9)",
  fail: "rgba(220, 76, 76, 0.9)",
});

let activeGameId = 0;

export function renderPage() {
  activeGameId += 1;
  const pageGameId = activeGameId;

  renderView(lv4Template, lv4Style);
  bindPage(pageGameId);
}

function bindPage(pageGameId) {
  const ready = document.getElementById("lv4Ready");
  const startButton = document.getElementById("lv4StartButton");
  const retryButton = document.getElementById("lv4RetryButton");
  const nextButton = document.getElementById("lv4NextButton");
  const homeButton = document.getElementById("lv4HomeButton");

  if (!ready || !startButton || !retryButton || !nextButton || !homeButton) return;

  unlockSoundOnNextGesture();

  startButton.addEventListener("click", async () => {
    const gameId = beginGame();
    await readySound();
    if (!isActive(gameId)) return;

    playStartSound();
    ready.hidden = true;
    runGame(gameId);
  });

  nextButton.addEventListener("click", () => {
    activeGameId += 1;
    navigate("lv5", { replace: true });
  });

  retryButton.addEventListener("click", async () => {
    const gameId = beginGame();

    await readySound();
    if (!isActive(gameId)) return;

    playStartSound();
    ready.hidden = true;
    runGame(gameId);
  });

  homeButton.addEventListener("click", () => {
    activeGameId += 1;
    navigate("home", { replace: true });
  });

  activeGameId = pageGameId;
}

function beginGame() {
  activeGameId += 1;
  resetBoard();
  hideResult();
  return activeGameId;
}

async function runGame(gameId) {
  const round = createRound();

  setStatus("원의 흐름과 네 개 겹침 면의 순서를 기억하세요.");
  await playMemoryPhase(gameId, round);
  if (!isActive(gameId)) return;

  setStatus("원이 다시 나타납니다. 기억한 겹침 면을 순서대로 터치하세요.");
  await replayCircles(gameId, round.circles);
  if (!isActive(gameId)) return;

  createTouchTargets(round.overlaps);
  setStatus("깜빡이는 겹침 면을 즉시 터치하세요. 0 / 4");

  const results = await playTouchPhase(gameId, round.answers);
  if (!isActive(gameId)) return;

  showResult(results.length === CONFIG.answerCount && results.every(Boolean));
}

function createRound() {
  const width = Math.max(window.innerWidth, 320);
  const height = Math.max(window.innerHeight, 480);
  let bestCandidate = null;

  for (let attempt = 0; attempt < CONFIG.generationAttempts; attempt += 1) {
    const circles = createCircleCandidate(width, height);
    const overlaps = findOverlaps(circles);
    const coverage = estimateCoverage(circles, width, height);
    const validCount = overlaps.length >= CONFIG.minOverlapCount && overlaps.length <= CONFIG.maxOverlapCount;

    if (!bestCandidate || coverage > bestCandidate.coverage) {
      bestCandidate = { circles, overlaps, coverage };
    }

    if (validCount && coverage >= CONFIG.minCoverage) {
      return finalizeRound(circles, overlaps, width, height);
    }
  }

  return createFallbackRound(width, height, bestCandidate);
}

function createCircleCandidate(width, height) {
  const minSide = Math.min(width, height);
  const maxSide = Math.max(width, height);
  const circleCount = randomInteger(5, 7);
  const centerX = width / 2;
  const centerY = height / 2;
  const orbitX = width * randomBetween(0.23, 0.34);
  const orbitY = height * randomBetween(0.2, 0.31);
  const phase = Math.random() * Math.PI * 2;

  return Array.from({ length: circleCount }, (_, index) => {
    const angle = phase + (Math.PI * 2 * index) / circleCount + randomBetween(-0.16, 0.16);
    const radius = Math.min(
      maxSide * 0.56,
      minSide * randomBetween(0.39, 0.57),
    );

    return {
      id: `lv4-circle-${index}`,
      order: index,
      cx: centerX + Math.cos(angle) * orbitX,
      cy: centerY + Math.sin(angle) * orbitY,
      radius,
      color: pastelColor(index, 0.48),
      startAngle: randomInteger(0, 359),
    };
  });
}

function finalizeRound(circles, overlaps, width, height) {
  const orderedOverlaps = shuffle(overlaps)
    .map((overlap, index) => ({
      ...overlap,
      id: `lv4-overlap-${index}`,
      order: index,
      color: pastelColor(index + circles.length, 0.66),
    }));

  return {
    width,
    height,
    circles,
    overlaps: orderedOverlaps,
    answers: orderedOverlaps.slice(0, CONFIG.answerCount),
  };
}

function createFallbackRound(width, height) {
  const minSide = Math.min(width, height);
  const radius = minSide * 0.48;
  const positions = [
    [0.18, 0.2], [0.82, 0.2], [0.18, 0.8], [0.82, 0.8], [0.5, 0.5],
  ];
  const circles = positions.map(([x, y], index) => ({
    id: `lv4-circle-${index}`,
    order: index,
    cx: width * x,
    cy: height * y,
    radius,
    color: pastelColor(index, 0.48),
    startAngle: randomInteger(0, 359),
  }));
  const overlaps = findOverlaps(circles)
    .sort((a, b) => b.area - a.area)
    .slice(0, CONFIG.maxOverlapCount);

  return finalizeRound(circles, overlaps, width, height);
}

function findOverlaps(circles) {
  const overlaps = [];

  for (let first = 0; first < circles.length; first += 1) {
    for (let second = first + 1; second < circles.length; second += 1) {
      const overlap = createLens(circles[first], circles[second]);
      if (overlap) overlaps.push(overlap);
    }
  }

  return overlaps;
}

function createLens(a, b) {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const distance = Math.hypot(dx, dy);
  const minRadius = Math.min(a.radius, b.radius);

  if (distance >= a.radius + b.radius || distance <= Math.abs(a.radius - b.radius)) return null;

  const x = (a.radius ** 2 - b.radius ** 2 + distance ** 2) / (2 * distance);
  const hSquared = a.radius ** 2 - x ** 2;
  if (hSquared <= 0) return null;

  const h = Math.sqrt(hSquared);
  const baseX = a.cx + (x * dx) / distance;
  const baseY = a.cy + (x * dy) / distance;
  const offsetX = (-dy * h) / distance;
  const offsetY = (dx * h) / distance;
  const p1 = { x: baseX + offsetX, y: baseY + offsetY };
  const p2 = { x: baseX - offsetX, y: baseY - offsetY };
  // 두 교차점을 잇는 원호 중 상대 원의 내부를 지나는 원호만 선택한다.
  // 이렇게 해야 바깥쪽 큰 원호(합집합처럼 보이는 영역)가 아니라
  // 두 원의 실제 교집합인 렌즈 영역만 만들어진다.
  const arcA = createInnerArc(a, p1, p2, b);
  const arcB = createInnerArc(b, p2, p1, a);
  const path = [
    `M ${format(p1.x)} ${format(p1.y)}`,
    `A ${format(a.radius)} ${format(a.radius)} 0 ${arcA.largeArcFlag} ${arcA.sweepFlag} ${format(p2.x)} ${format(p2.y)}`,
    `A ${format(b.radius)} ${format(b.radius)} 0 ${arcB.largeArcFlag} ${arcB.sweepFlag} ${format(p1.x)} ${format(p1.y)}`,
    "Z",
  ].join(" ");
  const area = lensArea(a.radius, b.radius, distance);

  if (area < Math.PI * minRadius ** 2 * 0.035) return null;

  return {
    pair: [a.id, b.id],
    path,
    area,
    center: { x: (p1.x + p2.x + a.cx + b.cx) / 4, y: (p1.y + p2.y + a.cy + b.cy) / 4 },
  };
}

function createInnerArc(circle, start, end, otherCircle) {
  const startAngle = Math.atan2(start.y - circle.cy, start.x - circle.cx);
  const endAngle = Math.atan2(end.y - circle.cy, end.x - circle.cx);
  const clockwiseDelta = normalizeAngle(endAngle - startAngle);
  const clockwiseMidAngle = startAngle + clockwiseDelta / 2;
  const clockwiseMidPoint = {
    x: circle.cx + Math.cos(clockwiseMidAngle) * circle.radius,
    y: circle.cy + Math.sin(clockwiseMidAngle) * circle.radius,
  };

  if (pointInCircle(clockwiseMidPoint, otherCircle)) {
    return {
      largeArcFlag: clockwiseDelta > Math.PI ? 1 : 0,
      sweepFlag: 1,
    };
  }

  const counterClockwiseDelta = normalizeAngle(startAngle - endAngle);
  return {
    largeArcFlag: counterClockwiseDelta > Math.PI ? 1 : 0,
    sweepFlag: 0,
  };
}

function normalizeAngle(angle) {
  let result = angle;
  while (result < 0) result += Math.PI * 2;
  while (result >= Math.PI * 2) result -= Math.PI * 2;
  return result;
}

function lensArea(r1, r2, distance) {
  const alpha = Math.acos(clamp((distance ** 2 + r1 ** 2 - r2 ** 2) / (2 * distance * r1), -1, 1));
  const beta = Math.acos(clamp((distance ** 2 + r2 ** 2 - r1 ** 2) / (2 * distance * r2), -1, 1));
  return r1 ** 2 * alpha + r2 ** 2 * beta - distance * r1 * Math.sin(alpha);
}

function estimateCoverage(circles, width, height) {
  const columns = 18;
  const rows = 24;
  let covered = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const point = {
        x: ((column + 0.5) / columns) * width,
        y: ((row + 0.5) / rows) * height,
      };
      if (circles.some((circle) => pointInCircle(point, circle))) covered += 1;
    }
  }

  return covered / (columns * rows);
}

async function playMemoryPhase(gameId, round) {
  for (const circle of round.circles) {
    showCircle(circle, round);
    await delay(CONFIG.circleAppearGapMs);
    if (!isActive(gameId)) return;
  }

  await delay(CONFIG.circleDrawMs);
  if (!isActive(gameId)) return;

  // 전체 교집합 중 실제로 플레이어가 터치해야 할 네 면만
  // 정답 순서대로 보여 줍니다.
  for (const overlap of round.answers) {
    showOverlap(overlap, round, true);
    playOverlapAppearSound(overlap.order);
    await delay(CONFIG.overlapAppearGapMs);
    if (!isActive(gameId)) return;
  }

  await delay(CONFIG.memoryHoldMs);
  if (!isActive(gameId)) return;

  for (const circle of [...round.circles].reverse()) {
    hideElement(circle.id);
    await delay(CONFIG.disappearGapMs);
    if (!isActive(gameId)) return;
  }

  for (const overlap of [...round.answers].reverse()) {
    hideElement(overlap.id);
    await delay(CONFIG.disappearGapMs);
    if (!isActive(gameId)) return;
  }

  await delay(260);
  resetBoard();
}

async function replayCircles(gameId, circles) {
  const round = { width: window.innerWidth, height: window.innerHeight };

  for (const circle of circles) {
    showCircle(circle, round);
    await delay(CONFIG.replayGapMs);
    if (!isActive(gameId)) return;
  }

  await delay(CONFIG.circleDrawMs);
}

async function playTouchPhase(gameId, answers) {
  const results = [];

  // 각 단계는 사용자의 터치 여부와 관계없이 고정된 박자로 진행됩니다.
  // 따라서 터치를 하지 않아도 다음 정답 영역의 깜빡임은 계속 시작됩니다.
  for (let index = 0; index < CONFIG.answerCount; index += 1) {
    const expected = answers[index];
    setStatus(`깜빡이는 겹침 면을 즉시 터치하세요. ${index} / 4`);

    const result = await runTouchStage(expected, gameId, index);
    results.push(result.success);

    if (!isActive(gameId)) return results;

    setStatus(index === CONFIG.answerCount - 1
      ? "네 번의 터치 판정을 완료했습니다."
      : `다음 겹침 면이 이어서 나타납니다. ${index + 1} / 4`);
  }

  return results;
}

function runTouchStage(expected, gameId, sequenceIndex) {
  return new Promise((resolve) => {
    let touchResult = { success: false, touchedId: null };
    let hasTouched = false;
    const expectedPath = document.querySelector(
      `[data-overlap-id="${expected.id}"]`,
    );

    const expectedSvg = expectedPath?.closest(".lv4-overlap-svg");

    // 교집합 터치 영역끼리 겹쳐도 현재 정답 영역이 포인터 이벤트를
    // 가장 먼저 받도록 이 단계에서만 최상단으로 올립니다.
    expectedSvg?.classList.add("is-active-touch-target");
    expectedPath?.classList.add("is-cue");
    playOverlapAppearSound(sequenceIndex);

    const cueTimerId = window.setTimeout(() => {
      expectedPath?.classList.remove("is-cue");
    }, CONFIG.touchCueMs);

    const onPointerDown = (event) => {
      if (hasTouched || !isActive(gameId)) return;

      hasTouched = true;
      window.clearTimeout(cueTimerId);
      expectedPath?.classList.remove("is-cue");

      const target = event.target.closest(".lv4-touch-path");
      touchResult = {
        success: target?.dataset.overlapId === expected.id,
        touchedId: target?.dataset.overlapId ?? null,
      };

      // 피드백 애니메이션은 재생하되 다음 단계의 고정 박자를 막지 않습니다.
      void showFeedback(touchResult.touchedId ?? expected.id, touchResult.success);
    };

    document.addEventListener("pointerdown", onPointerDown, true);

    window.setTimeout(() => {
      window.clearTimeout(cueTimerId);
      expectedPath?.classList.remove("is-cue");
      expectedSvg?.classList.remove("is-active-touch-target");
      document.removeEventListener("pointerdown", onPointerDown, true);

      if (!hasTouched) {
        void showFeedback(expected.id, false);
      }

      resolve(touchResult);
    }, CONFIG.touchStageMs);
  });
}

async function showFeedback(overlapId, success) {
  success ? playOkSound() : playFailSound();
  const path = document.querySelector(`[data-overlap-id="${overlapId}"]`);

  if (!path) {
    flashPage(success);
    await delay(CONFIG.feedbackMs);
    return;
  }

  path.style.setProperty("--feedback-color", success ? FEEDBACK.success : FEEDBACK.fail);
  path.classList.add(success ? "is-success" : "is-fail");
  await delay(CONFIG.feedbackMs);
  path.classList.remove("is-success", "is-fail");
}

function flashPage(success) {
  const page = document.querySelector(".lv4-page");
  if (!page) return;
  page.classList.add(success ? "is-success-flash" : "is-fail-flash");
  window.setTimeout(() => page.classList.remove("is-success-flash", "is-fail-flash"), CONFIG.feedbackMs);
}

function showCircle(circle, round) {
  const layer = document.getElementById("lv4CircleLayer");
  if (!layer) return;

  const svg = createSvg(round.width, round.height, "lv4-circle-svg");
  svg.id = circle.id;
  svg.style.setProperty("--draw-ms", `${CONFIG.circleDrawMs}ms`);
  svg.style.setProperty("--circle-circumference", `${2 * Math.PI * circle.radius}`);

  const maskId = `${circle.id}-mask-${activeGameId}`;
  const defs = document.createElementNS(SVG_NS, "defs");
  const mask = document.createElementNS(SVG_NS, "mask");
  mask.id = maskId;
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  const reveal = document.createElementNS(SVG_NS, "circle");
  const circumference = 2 * Math.PI * circle.radius;

  setAttributes(reveal, {
    cx: circle.cx,
    cy: circle.cy,
    r: circle.radius,
    fill: "none",
    stroke: "white",
    "stroke-width": circle.radius * 2,
    "stroke-dasharray": circumference,
    "stroke-dashoffset": circumference,
    transform: `rotate(${circle.startAngle} ${circle.cx} ${circle.cy})`,
    class: "lv4-circle-reveal",
  });

  const fill = document.createElementNS(SVG_NS, "circle");
  setAttributes(fill, {
    cx: circle.cx,
    cy: circle.cy,
    r: circle.radius,
    fill: circle.color,
    mask: `url(#${maskId})`,
    class: "lv4-circle-fill",
  });

  mask.appendChild(reveal);
  defs.appendChild(mask);
  svg.append(defs, fill);
  layer.appendChild(svg);
  requestAnimationFrame(() => svg.classList.add("is-visible"));
}

function showOverlap(overlap, round, memoryMode) {
  const layer = document.getElementById("lv4OverlapLayer");
  if (!layer) return;

  const svg = createSvg(round.width, round.height, "lv4-overlap-svg");
  svg.id = overlap.id;
  svg.classList.toggle("is-memory", memoryMode);
  svg.style.setProperty("--overlap-draw-ms", `${CONFIG.overlapDrawMs}ms`);
  const path = document.createElementNS(SVG_NS, "path");
  setAttributes(path, {
    d: overlap.path,
    fill: overlap.color,
    class: "lv4-overlap-path",
  });
  svg.appendChild(path);
  layer.appendChild(svg);
  requestAnimationFrame(() => svg.classList.add("is-visible"));
}

function createTouchTargets(overlaps) {
  const layer = document.getElementById("lv4OverlapLayer");
  if (!layer) return;
  layer.replaceChildren();

  overlaps.forEach((overlap) => {
    const svg = createSvg(window.innerWidth, window.innerHeight, "lv4-overlap-svg is-touch-target is-visible");
    svg.id = `${overlap.id}-touch`;
    const path = document.createElementNS(SVG_NS, "path");
    setAttributes(path, {
      d: overlap.path,
      fill: "rgba(255, 255, 255, 0.001)",
      class: "lv4-touch-path",
      "data-overlap-id": overlap.id,
    });
    path.style.setProperty("--cue-color", overlap.color);
    path.style.setProperty("--touch-cue-ms", `${CONFIG.touchCueMs}ms`);
    svg.appendChild(path);
    layer.appendChild(svg);
  });
}

function createSvg(width, height, className) {
  const svg = document.createElementNS(SVG_NS, "svg");
  setAttributes(svg, {
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: "100%",
    class: className,
    preserveAspectRatio: "none",
  });
  return svg;
}

function hideElement(id) {
  document.getElementById(id)?.classList.add("is-hiding");
}

function resetBoard() {
  document.getElementById("lv4CircleLayer")?.replaceChildren();
  document.getElementById("lv4OverlapLayer")?.replaceChildren();
}

function hideResult() {
  const result = document.getElementById("lv4Result");
  const next = document.getElementById("lv4NextButton");
  const retry = document.getElementById("lv4RetryButton");
  if (result) result.hidden = true;
  if (next) next.hidden = true;
  if (retry) retry.hidden = true;
}

function showResult(success) {
  const result = document.getElementById("lv4Result");
  const title = document.getElementById("lv4ResultTitle");
  const message = document.getElementById("lv4ResultMessage");
  const next = document.getElementById("lv4NextButton");
  const retry = document.getElementById("lv4RetryButton");
  if (!result || !title || !message || !next || !retry) return;

  title.textContent = success ? "CLEAR" : "TRY AGAIN";
  message.textContent = success
    ? "네 개의 겹침 면을 정확한 위치와 순서로 모두 터치했습니다."
    : "네 번의 터치는 끝났지만 한 번 이상 순서나 위치가 달랐습니다.";
  next.hidden = !success;
  retry.hidden = success;
  result.hidden = false;
  setStatus(success ? "완벽합니다. 네 번 모두 성공했습니다." : "한 번 이상 실패했습니다.");
}

function setStatus(message) {
  const status = document.getElementById("lv4Status");
  if (status) status.textContent = message;
}

function setAttributes(element, attributes) {
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
}

function pointInCircle(point, circle) {
  return Math.hypot(point.x - circle.cx, point.y - circle.cy) <= circle.radius;
}

function pastelColor(index, alpha) {
  const [r, g, b] = PASTELS[index % PASTELS.length];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function format(value) {
  return Number(value.toFixed(2));
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isActive(gameId) {
  return activeGameId === gameId && window.location.pathname === "/lv4";
}
