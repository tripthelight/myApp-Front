import lv8Style from "../../../assets/scss/game/lv8/common.scss?inline";
import lv8Template from "./lv8.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv8AccentSound,
  playLv8FailSound,
  playLv8HitSound,
  playLv8SoftSound,
  playStartSound,
  readySound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv8Sound.js";

const CONFIG = Object.freeze({
  eventCount: 10,
  travelMs: 2300,
  firstEventMs: 2400,
  minGapMs: 1250,
  maxGapMs: 1850,
  hitWindowMs: 230,
  lingerMs: 180,
  resultDelayMs: 850,
});

const DIRECTIONS = ["top", "right", "bottom", "left"];
const SIZES = [26, 34, 44, 56];
const COLORS = ["#9fdac8", "#efb9c6", "#aabfe5", "#ead594"];

let activeGameId = 0;
let activeFrameId = 0;
let currentRound = null;

export function renderPage() {
  cancelActiveGame();
  renderView(lv8Template, lv8Style);
  bindPage();
}

function bindPage() {
  const ready = document.getElementById("lv8Ready");
  const result = document.getElementById("lv8Result");
  const start = document.getElementById("lv8StartButton");
  const retry = document.getElementById("lv8RetryButton");
  const next = document.getElementById("lv8NextButton");
  const home = document.getElementById("lv8HomeButton");
  const hitArea = document.getElementById("lv8HitArea");

  if (!ready || !result || !start || !retry || !next || !home || !hitArea) return;
  unlockSoundOnNextGesture();

  start.addEventListener("click", async () => {
    const gameId = beginGame();
    await readySound();
    if (!isActive(gameId)) return;
    ready.hidden = true;
    playStartSound();
    runGame(gameId);
  });

  retry.addEventListener("click", async () => {
    const gameId = beginGame();
    await readySound();
    if (!isActive(gameId)) return;
    result.hidden = true;
    playStartSound();
    runGame(gameId);
  });

  hitArea.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    judgeTouch();
  });

  next.addEventListener("click", () => {
    cancelActiveGame();
    navigate("lv9", { replace: true });
  });

  home.addEventListener("click", () => {
    cancelActiveGame();
    navigate("home", { replace: true });
  });
}

function beginGame() {
  cancelActiveGame();
  activeGameId += 1;
  resetView();
  return activeGameId;
}

function cancelActiveGame() {
  activeGameId += 1;
  cancelAnimationFrame(activeFrameId);
  activeFrameId = 0;
  currentRound = null;
}

function runGame(gameId) {
  const round = createRound();
  currentRound = round;
  renderNodes(round);
  setStatus("중심으로 다가오는 마름모의 크기를 비교하세요.");
  setJudge("GO");
  round.startedAt = performance.now();
  activeFrameId = requestAnimationFrame((now) => updateFrame(gameId, round, now));
}

function createRound() {
  let hitAtMs = CONFIG.firstEventMs;
  const events = Array.from({ length: CONFIG.eventCount }, (_, index) => {
    const mustTouch = index < 6 ? true : index < 8 ? false : Math.random() < 0.55;
    const directionCount = mustTouch ? randomInteger(2, 4) : randomInteger(1, 4);
    const directions = shuffle([...DIRECTIONS]).slice(0, directionCount);
    const sharedSize = pick(SIZES);
    const sizes = mustTouch
      ? directions.map(() => sharedSize)
      : createDifferentSizes(directionCount);

    const event = {
      index,
      hitAtMs,
      mustTouch,
      state: "pending",
      touched: false,
      soundPlayed: false,
      nodes: directions.map((direction, nodeIndex) => ({
        direction,
        size: sizes[nodeIndex],
        color: COLORS[(index + nodeIndex) % COLORS.length],
        element: null,
      })),
    };

    hitAtMs += randomInteger(CONFIG.minGapMs, CONFIG.maxGapMs);
    return event;
  });

  return {
    events,
    startedAt: 0,
    judgedCount: 0,
    failed: false,
    finished: false,
  };
}

function createDifferentSizes(count) {
  const values = shuffle([...SIZES]);
  const result = Array.from({ length: count }, (_, index) => values[index % values.length]);
  if (new Set(result).size === 1) result[result.length - 1] = SIZES.find((size) => size !== result[0]);
  return result;
}

function renderNodes(round) {
  const layer = document.getElementById("lv8NodeLayer");
  if (!layer) return;
  const fragment = document.createDocumentFragment();

  round.events.forEach((event) => {
    event.nodes.forEach((node, nodeIndex) => {
      const element = document.createElement("span");
      element.className = "lv8-node";
      element.dataset.eventIndex = String(event.index);
      element.dataset.nodeIndex = String(nodeIndex);
      element.style.setProperty("--size", `${node.size}px`);
      element.style.setProperty("--node-color", node.color);
      node.element = element;
      fragment.appendChild(element);
    });
  });

  layer.replaceChildren(fragment);
}

function updateFrame(gameId, round, now) {
  if (!isActive(gameId) || round.finished) return;
  const elapsed = now - round.startedAt;
  const geometry = readGeometry();
  if (!geometry) return;

  round.events.forEach((event) => updateEvent(event, elapsed, geometry, round));
  setProgress(`${round.judgedCount} / ${CONFIG.eventCount}`);

  if (round.judgedCount >= CONFIG.eventCount) {
    finishRound(gameId, round);
    return;
  }

  activeFrameId = requestAnimationFrame((time) => updateFrame(gameId, round, time));
}

function updateEvent(event, elapsed, geometry, round) {
  if (event.state === "judged") return;
  const relative = elapsed - event.hitAtMs;
  const progress = clamp((relative + CONFIG.travelMs) / CONFIG.travelMs, 0, 1);

  event.nodes.forEach((node) => positionNode(node, progress, relative, geometry));

  if (!event.soundPlayed && relative >= 0) {
    event.soundPlayed = true;
    if (event.nodes.length === 1 || !event.mustTouch) playLv8SoftSound(event.index);
    else playLv8AccentSound(event.index);
  }

  if (relative > CONFIG.hitWindowMs) {
    if (event.mustTouch && !event.touched) {
      round.failed = true;
      playLv8FailSound(event.index);
      feedback(false, "MISS", "같은 크기를 놓쳤습니다");
    }
    finalizeEvent(event, round, false);
  }
}

function positionNode(node, progress, relative, geometry) {
  if (!node.element) return;
  const vector = directionVector(node.direction);
  const distance = geometry.distance * (1 - easeOutCubic(progress));
  const x = vector.x * distance;
  const y = vector.y * distance;
  const isVisible = progress > 0 && relative <= CONFIG.hitWindowMs + CONFIG.lingerMs;
  node.element.style.opacity = isVisible ? String(Math.min(1, progress * 2.8)) : "0";
  node.element.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(45deg)`;
}

function judgeTouch() {
  const round = currentRound;
  if (!round || round.finished) return;
  const elapsed = performance.now() - round.startedAt;
  const candidates = round.events.filter((event) => event.state === "pending" && Math.abs(elapsed - event.hitAtMs) <= CONFIG.hitWindowMs);
  const target = candidates.sort((a, b) => Math.abs(elapsed - a.hitAtMs) - Math.abs(elapsed - b.hitAtMs))[0];

  if (!target) {
    round.failed = true;
    playLv8FailSound(round.judgedCount);
    feedback(false, "TOO EARLY", "중심에서 만나는 순간을 기다리세요");
    return;
  }

  target.touched = true;
  if (target.mustTouch) {
    playLv8HitSound(target.index);
    feedback(true, "PERFECT", "같은 크기를 정확히 찾았습니다");
    finalizeEvent(target, round, true);
  } else {
    round.failed = true;
    playLv8FailSound(target.index);
    feedback(false, "MISMATCH", "서로 다른 크기였습니다");
    finalizeEvent(target, round, false);
  }
}

function finalizeEvent(event, round, success) {
  if (event.state === "judged") return;
  event.state = "judged";
  round.judgedCount += 1;
  event.nodes.forEach((node) => {
    node.element?.classList.add(success ? "is-success" : event.touched ? "is-fail" : "is-finished");
    window.setTimeout(() => { if (node.element) node.element.style.opacity = "0"; }, 620);
  });
}

function feedback(success, title, message) {
  const stage = document.getElementById("lv8Stage");
  const box = document.getElementById("lv8Feedback");
  if (!stage || !box) return;
  stage.classList.remove("is-success", "is-fail");
  box.classList.remove("is-success", "is-fail");
  void box.offsetWidth;
  stage.classList.add(success ? "is-success" : "is-fail");
  box.classList.add(success ? "is-success" : "is-fail");
  box.querySelector("strong").textContent = title;
  box.querySelector("span").textContent = message;
  setJudge(success ? "PERFECT" : "MISS");
  window.setTimeout(() => stage.classList.remove("is-success", "is-fail"), 700);
}

function finishRound(gameId, round) {
  if (round.finished) return;
  round.finished = true;
  setStatus(round.failed ? "모든 리듬이 끝났습니다." : "모든 동기화 타이밍을 성공했습니다.");
  window.setTimeout(() => {
    if (isActive(gameId)) showResult(round);
  }, CONFIG.resultDelayMs);
}

function showResult(round) {
  const result = document.getElementById("lv8Result");
  const title = document.getElementById("lv8ResultTitle");
  const message = document.getElementById("lv8ResultMessage");
  const next = document.getElementById("lv8NextButton");
  const retry = document.getElementById("lv8RetryButton");
  if (!result || !title || !message || !next || !retry) return;

  title.textContent = round.failed ? "TRY AGAIN" : "SYNC COMPLETE";
  message.textContent = round.failed
    ? "한 번 이상의 잘못된 터치 또는 놓친 타이밍이 있었습니다. 흐름을 다시 느껴보세요."
    : "같은 크기의 마름모가 만나는 모든 순간을 정확히 터치했습니다.";
  next.hidden = round.failed;
  retry.hidden = !round.failed;
  result.hidden = false;
}

function resetView() {
  document.getElementById("lv8NodeLayer")?.replaceChildren();
  document.getElementById("lv8Result")?.setAttribute("hidden", "");
  document.getElementById("lv8NextButton")?.setAttribute("hidden", "");
  document.getElementById("lv8RetryButton")?.setAttribute("hidden", "");
  document.getElementById("lv8Stage")?.classList.remove("is-success", "is-fail");
  setProgress(`0 / ${CONFIG.eventCount}`);
  setJudge("READY");
}

function readGeometry() {
  const stage = document.getElementById("lv8Stage");
  if (!stage) return null;
  const rect = stage.getBoundingClientRect();
  return { distance: Math.max(rect.width, rect.height) * 0.62 };
}

function directionVector(direction) {
  return {
    top: { x: 0, y: -1 }, right: { x: 1, y: 0 },
    bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 },
  }[direction];
}

function setStatus(text) { const el = document.getElementById("lv8Status"); if (el) el.textContent = text; }
function setProgress(text) { const el = document.getElementById("lv8Progress"); if (el) el.textContent = text; }
function setJudge(text) { const el = document.getElementById("lv8Judge"); if (el) el.textContent = text; }
function isActive(gameId) { return gameId === activeGameId && document.getElementById("lv8Page"); }
function randomInteger(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(values) { return values[randomInteger(0, values.length - 1)]; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function easeOutCubic(value) { return 1 - ((1 - value) ** 3); }
function shuffle(values) { for (let i = values.length - 1; i > 0; i -= 1) { const j = randomInteger(0, i); [values[i], values[j]] = [values[j], values[i]]; } return values; }
