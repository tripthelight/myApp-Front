import lv2Style from "../../../assets/scss/game/lv2/common.scss?inline";
import lv2Template from "./lv2.html?raw";
import { renderView } from "../../../shared/dom.js";
import { navigate } from "../../../app/router.js";
import {
  playCircleAppearSound,
  playFailSound,
  playOkSound,
  playStartSound,
  readySound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/sound.js";

const LEVEL_CONFIG = Object.freeze({
  // 이 배열의 길이가 circle 개수입니다.
  // [1000, 1000, 1000, 1000] => 4개가 1초 간격으로 등장
  // [200, 1000, 400] => 3개가 0.2초, 1초, 0.4초 간격으로 등장
  appearIntervalsMs: [1000, 1000, 1000, 1000],
  appearAnimationMs: 720,
  hitWindowMs: 820,
  feedbackMs: 220,
  randomRangeRatio: [0.25, 0.75],
});

const TOUCH_POS = new Map();

let activeGameId = 0;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function renderPage() {
  activeGameId += 1;
  renderView(lv2Template, lv2Style);
  lv2Main(activeGameId);
}

function lv2Main(gameId) {
  const page = document.querySelector(".lv2-page");
  const readyLayer = document.getElementById("lv2Ready");
  const startButton = document.getElementById("lv2StartButton");
  const resultLayer = document.getElementById("lv2Result");
  const nextButton = document.getElementById("lv2NextButton");
  const retryButton = document.getElementById("lv2RetryButton");
  const homeButton = document.getElementById("lv2HomeButton");

  if (!page || !readyLayer || !startButton || !resultLayer || !nextButton || !retryButton || !homeButton) {
    return;
  }

  unlockSoundOnNextGesture();

  startButton.addEventListener("click", async () => {
    await readySound();
    playStartSound();
    readyLayer.hidden = true;
    resultLayer.hidden = true;
    nextButton.hidden = true;
    retryButton.hidden = true;
    homeButton.hidden = true;
    runGame(gameId);
  });

  retryButton.addEventListener("click", async () => {
    activeGameId += 1;
    const nextGameId = activeGameId;
    await readySound();
    playStartSound();
    resultLayer.hidden = true;
    nextButton.hidden = true;
    retryButton.hidden = true;
    homeButton.hidden = true;
    runGame(nextGameId);
  });

  nextButton.addEventListener("click", () => {
    activeGameId += 1;
    navigate("lv3", { replace: true });
  });

  homeButton.addEventListener("click", () => {
    activeGameId += 1;
    navigate("home", { replace: true });
  });
}

async function runGame(gameId) {
  resetGameView();
  setStatus("위치를 기억하세요.");

  const circles = createCircles(LEVEL_CONFIG.appearIntervalsMs.length);

  await playMemoryPhase(gameId, circles);
  if (!isActive(gameId)) return;

  await delay(380);
  if (!isActive(gameId)) return;

  setStatus("순서대로 안쪽 원을 터치하세요.");

  const success = await playTouchPhase(gameId, circles);
  if (!isActive(gameId)) return;

  showResult(success);
}

async function playMemoryPhase(gameId, circles) {
  TOUCH_POS.clear();

  for (let i = 0; i < circles.length; i += 1) {
    await delay(LEVEL_CONFIG.appearIntervalsMs[i]);
    if (!isActive(gameId)) return;

    const circle = circles[i];
    const center = randomCenterPosition();

    appendCircle(circle);
    moveCircle(circle, center);
    saveTouchPosition(circle, i, center);

    playCircleAppearSound(i);

    await showCircleOnce(circle);
  }

  removeAllCircles();
}

async function playTouchPhase(gameId, circles) {
  const touchResults = [];

  for (let i = 0; i < circles.length; i += 1) {
    await delay(LEVEL_CONFIG.appearIntervalsMs[i]);
    if (!isActive(gameId)) return false;

    const circle = circles[i];
    const savedPosition = TOUCH_POS.get(circleKey(i));

    if (!savedPosition) {
      touchResults.push(false);
      continue;
    }

    appendCircle(circle);
    moveCircle(circle, savedPosition.centerPos);
    playCircleAppearSound(i);

    const success = await waitForTouchResult(circle, gameId);

    touchResults.push(success);

    await showTouchFeedback(circle, success);

    circle.remove();
  }

  removeAllCircles();

  return touchResults.every(Boolean);
}

function createCircles(count) {
  const circles = [];

  for (let i = 0; i < count; i += 1) {
    const circle = document.createElement("li");
    const outerSpan = document.createElement("span");
    const innerSpan = document.createElement("span");

    circle.className = `lv2-circle circle-${i + 1}`;
    circle.dataset.circleIndex = String(i);

    outerSpan.appendChild(innerSpan);
    circle.appendChild(outerSpan);

    circles.push(circle);
  }

  return circles;
}

function appendCircle(circle) {
  const circlesWrap = document.getElementById("circlesWrap");

  if (!circlesWrap || circle.isConnected) return;

  circlesWrap.appendChild(circle);
}

async function showCircleOnce(circle) {
  appendCircle(circle);
  restartCircleAnimation(circle);

  await delay(LEVEL_CONFIG.appearAnimationMs);

  circle.remove();
}

function restartCircleAnimation(circle) {
  circle.classList.remove("is-showing", "is-touchable", "is-success", "is-fail");

  void circle.offsetWidth;

  circle.classList.add("is-showing");
}

function waitForTouchResult(circle, gameId) {
  return new Promise((resolve) => {
    let resolved = false;
    const innerTouchArea = circle.querySelector("span span");

    const finish = (success) => {
      if (resolved) return;

      resolved = true;

      window.clearTimeout(timeoutId);
      document.removeEventListener("pointerdown", onPointerDown, true);

      circle.classList.remove("is-touchable", "is-showing");

      resolve(success);
    };

    const onPointerDown = (event) => {
      if (!isActive(gameId)) {
        finish(false);
        return;
      }

      const success = Boolean(innerTouchArea?.contains(event.target));

      finish(success);
    };

    restartCircleAnimation(circle);
    circle.classList.add("is-touchable");

    document.addEventListener("pointerdown", onPointerDown, true);

    const timeoutId = window.setTimeout(() => {
      finish(false);
    }, LEVEL_CONFIG.hitWindowMs);
  });
}

async function showTouchFeedback(circle, success) {
  circle.classList.add(success ? "is-success" : "is-fail");

  if (success) {
    playOkSound();
  } else {
    playFailSound();
  }

  await delay(LEVEL_CONFIG.feedbackMs);

  circle.classList.remove("is-success", "is-fail");
}

function saveTouchPosition(circle, index, center) {
  const innerTouchArea = circle.querySelector("span span");

  if (!innerTouchArea) return;

  const rect = innerTouchArea.getBoundingClientRect();

  TOUCH_POS.set(circleKey(index), {
    centerPos: { x: center.x, y: center.y },
    lt: { x: rect.left, y: rect.top },
    lb: { x: rect.left, y: rect.bottom },
    rt: { x: rect.right, y: rect.top },
    rb: { x: rect.right, y: rect.bottom },
  });
}

function randomCenterPosition() {
  const [startRatio, endRatio] = LEVEL_CONFIG.randomRangeRatio;

  const x = randomNumber(window.innerWidth * startRatio, window.innerWidth * endRatio);
  const y = randomNumber(window.innerHeight * startRatio, window.innerHeight * endRatio);

  return { x, y };
}

function randomNumber(start, end) {
  return Math.round(Math.random() * (end - start) + start);
}

function moveCircle(circle, center) {
  circle.style.left = `${center.x}px`;
  circle.style.top = `${center.y}px`;
}

function circleKey(index) {
  return `circle${index + 1}`;
}

function resetGameView() {
  TOUCH_POS.clear();
  removeAllCircles();
}

function removeAllCircles() {
  const circlesWrap = document.getElementById("circlesWrap");

  if (!circlesWrap) return;

  circlesWrap.replaceChildren();
}

function setStatus(message) {
  const status = document.getElementById("lv2Status");

  if (!status) return;

  status.textContent = message;
}

function showResult(success) {
  const resultLayer = document.getElementById("lv2Result");
  const nextButton = document.getElementById("lv2NextButton");
  const retryButton = document.getElementById("lv2RetryButton");
  const homeButton = document.getElementById("lv2HomeButton");

  if (!resultLayer || !nextButton || !retryButton || !homeButton) return;

  setStatus(success ? "성공입니다. 다음 레벨로 이동하세요." : "실패입니다. 다시 도전하세요.");
  resultLayer.hidden = false;
  nextButton.hidden = !success;
  retryButton.hidden = success;
  homeButton.hidden = false;
}

function isActive(gameId) {
  return activeGameId === gameId && window.location.pathname === "/lv2";
}