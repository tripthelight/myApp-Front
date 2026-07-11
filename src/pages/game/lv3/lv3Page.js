import lv3Style from "../../../assets/scss/game/lv3/common.scss?inline";
import lv3Template from "./lv3.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playFailSound,
  playOkSound,
  playStartSound,
  playTouchDotAppearSound,
  readySound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/sound.js";

const LEVEL_CONFIG = Object.freeze({
  // 각 숫자는 해당 rectangle이 나타나기 전까지 기다릴 시간입니다.
  // [1000, 1000, 1000, 1000] => 네 rectangle이 각각 1초 간격으로 등장
  // [200, 1000, 400, 600] => 0.2초, 1초, 0.4초, 0.6초 간격으로 등장
  appearIntervalsMs: [1000, 1000, 1000, 1000],
  rectangleTransitionMs: 620,
  sameStageCueGapMs: 110,
  memoryHoldMs: 1000,
  disappearGapMs: 260,
  hitWindowMs: 1150,
  feedbackMs: 260,
  randomRangeRatio: [0.25, 0.75],
  positions: ["t", "l", "b", "r"],
});

const PASTEL_COLORS = Object.freeze([
  [255, 179, 186],
  [255, 223, 186],
  [255, 255, 186],
  [186, 255, 201],
  [186, 225, 255],
  [204, 204, 255],
  [255, 204, 229],
  [221, 204, 255],
  [204, 255, 255],
  [230, 230, 250],
  [255, 218, 185],
  [216, 191, 216],
]);

let activeGameId = 0;

export function renderPage() {
  activeGameId += 1;
  renderView(lv3Template, lv3Style);
  bindLv3Page(activeGameId);
}

function bindLv3Page(pageGameId) {
  const readyLayer = document.getElementById("lv3Ready");
  const startButton = document.getElementById("lv3StartButton");
  const resultLayer = document.getElementById("lv3Result");
  const retryButton = document.getElementById("lv3RetryButton");
  const nextButton = document.getElementById("lv3NextButton");
  const homeButton = document.getElementById("lv3HomeButton");

  if (
    !readyLayer ||
    !startButton ||
    !resultLayer ||
    !retryButton ||
    !nextButton ||
    !homeButton
  ) {
    return;
  }

  unlockSoundOnNextGesture();

  startButton.addEventListener("click", async () => {
    const gameId = beginNewGame();

    await readySound();
    if (!isActive(gameId)) return;

    playStartSound();
    readyLayer.hidden = true;
    resultLayer.hidden = true;
    runGame(gameId);
  });

  retryButton.addEventListener("click", async () => {
    const gameId = beginNewGame();

    await readySound();
    if (!isActive(gameId)) return;

    playStartSound();
    resultLayer.hidden = true;
    runGame(gameId);
  });

  nextButton.addEventListener("click", () => {
    activeGameId += 1;
    navigate("lv4", { replace: true });
  });

  homeButton.addEventListener("click", () => {
    activeGameId += 1;
    navigate("home", { replace: true });
  });

  // renderPage가 다시 호출되기 전의 이벤트가 실행되지 않도록 페이지 ID를 유지합니다.
  activeGameId = pageGameId;
}

function beginNewGame() {
  activeGameId += 1;
  resetBoard();
  hideResult();
  return activeGameId;
}

async function runGame(gameId) {
  const round = createRound();

  setStatus("위치와 순서를 기억하세요.");
  await playMemoryPhase(gameId, round);
  if (!isActive(gameId)) return;

  await delay(360);
  if (!isActive(gameId)) return;

  resetBoard();
  setStatus("나타났던 순서대로 꼭짓점을 터치하세요.");

  const results = await playTouchPhase(gameId, round);
  if (!isActive(gameId)) return;

  showResult(results.every(Boolean));
}

function createRound() {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  const positionOrder = shuffle(LEVEL_CONFIG.positions);
  const orderIndex = Object.fromEntries(
    positionOrder.map((position, index) => [position, index]),
  );
  const dimensions = createDimensions(viewport);
  const rectangles = positionOrder.map((position, index) => ({
    id: `rectangle-${index + 1}`,
    position,
    order: index,
    size: dimensions[position],
    color: createRectangleColor(index),
  }));
  const touchDots = createTouchDots(viewport, dimensions, orderIndex);

  return {
    viewport,
    rectangles,
    touchDots,
  };
}

function createDimensions(viewport) {
  const [minRatio, maxRatio] = LEVEL_CONFIG.randomRangeRatio;

  return {
    t: randomInteger(viewport.height * minRatio, viewport.height * maxRatio),
    l: randomInteger(viewport.width * minRatio, viewport.width * maxRatio),
    b: randomInteger(viewport.height * minRatio, viewport.height * maxRatio),
    r: randomInteger(viewport.width * minRatio, viewport.width * maxRatio),
  };
}

/**
 * 네 rectangle 경계선의 실제 좌표로 네 꼭짓점을 계산합니다.
 *
 * x축 경계: left rectangle의 오른쪽 끝, right rectangle의 왼쪽 끝
 * y축 경계: top rectangle의 아래쪽 끝, bottom rectangle의 위쪽 끝
 *
 * left/right 또는 top/bottom이 서로 겹쳐 경계 순서가 뒤집혀도 같은 공식이
 * 그대로 적용되므로 별도의 경우의 수 분기가 필요하지 않습니다.
 */
function createTouchDots(viewport, dimensions, orderIndex) {
  const boundaries = {
    l: dimensions.l,
    r: viewport.width - dimensions.r,
    t: dimensions.t,
    b: viewport.height - dimensions.b,
  };
  const definitions = [
    { key: "lt", horizontal: "l", vertical: "t" },
    { key: "lb", horizontal: "l", vertical: "b" },
    { key: "rt", horizontal: "r", vertical: "t" },
    { key: "rb", horizontal: "r", vertical: "b" },
  ];

  const dots = definitions.map((definition) => ({
    id: `touch-dot-${definition.key}`,
    key: definition.key,
    x: boundaries[definition.horizontal],
    y: boundaries[definition.vertical],
    revealStage: Math.max(
      orderIndex[definition.horizontal],
      orderIndex[definition.vertical],
    ),
  }));

  // 같은 rectangle이 등장하면서 완성되는 꼭짓점들은 동시 생성 대상입니다.
  // 그 내부의 선/후 순서는 매 라운드 무작위로 정하고 기억/터치 단계에서 재사용합니다.
  return dots
    .map((dot) => ({ ...dot, tieBreaker: Math.random() }))
    .sort(
      (a, b) =>
        a.revealStage - b.revealStage ||
        a.tieBreaker - b.tieBreaker,
    )
    .map((dot, sequenceIndex) => ({
      ...dot,
      sequenceIndex,
    }));
}

async function playMemoryPhase(gameId, round) {
  const dotsByStage = groupDotsByStage(round.touchDots);

  for (const rectangle of round.rectangles) {
    await delay(LEVEL_CONFIG.appearIntervalsMs[rectangle.order] ?? 0);
    if (!isActive(gameId)) return;

    showRectangle(rectangle);
    await showMemoryDotBatch(gameId, dotsByStage.get(rectangle.order) ?? []);
  }

  await delay(LEVEL_CONFIG.memoryHoldMs);
  if (!isActive(gameId)) return;

  for (let stage = round.rectangles.length - 1; stage >= 0; stage -= 1) {
    const stageDots = [...(dotsByStage.get(stage) ?? [])].reverse();

    for (const dot of stageDots) {
      hideDot(dot.id);
      await delay(LEVEL_CONFIG.disappearGapMs);
      if (!isActive(gameId)) return;
    }

    hideRectangle(round.rectangles[stage].id);
    await delay(LEVEL_CONFIG.disappearGapMs);
    if (!isActive(gameId)) return;
  }
}

async function showMemoryDotBatch(gameId, dots) {
  if (dots.length === 0) return;

  for (const dot of dots) {
    showDot(dot, { touchable: false, cue: true });
    playTouchDotAppearSound(dot.sequenceIndex);

    await delay(LEVEL_CONFIG.sameStageCueGapMs);
    if (!isActive(gameId)) return;
  }
}

async function playTouchPhase(gameId, round) {
  const dotsByStage = groupDotsByStage(round.touchDots);
  const results = [];

  for (const rectangle of round.rectangles) {
    await delay(LEVEL_CONFIG.appearIntervalsMs[rectangle.order] ?? 0);
    if (!isActive(gameId)) return results;

    showRectangle(rectangle);

    const stageDots = dotsByStage.get(rectangle.order) ?? [];
    if (stageDots.length === 0) continue;

    // 같은 단계의 점은 함께 나타나지만, 판정 순서는 기억 단계에서 들려준 순서를 따릅니다.
    stageDots.forEach((dot) => showDot(dot, { touchable: true, cue: false }));
    stageDots.forEach((dot) => playTouchDotAppearSound(dot.sequenceIndex));

    for (const expectedDot of stageDots) {
      const touchResult = await waitForTouch(expectedDot, gameId);
      results.push(touchResult.success);

      await showTouchFeedback(
        touchResult.touchedDotId ?? expectedDot.id,
        touchResult.success,
      );

      if (!isActive(gameId)) return results;
    }
  }

  // 방어적으로 네 번 모두 판정되지 않은 경우도 실패로 채웁니다.
  while (results.length < round.touchDots.length) {
    results.push(false);
  }

  return results;
}

function waitForTouch(expectedDot, gameId) {
  return new Promise((resolve) => {
    let finished = false;
    const expectedElement = document.getElementById(expectedDot.id);

    expectedElement?.classList.add("is-cue");

    const finish = (result) => {
      if (finished) return;
      finished = true;

      window.clearTimeout(timeoutId);
      document.removeEventListener("pointerdown", onPointerDown, true);
      expectedElement?.classList.remove("is-cue");

      resolve(result);
    };

    const onPointerDown = (event) => {
      if (!isActive(gameId)) {
        finish({ success: false, touchedDotId: null });
        return;
      }

      const touchedDot = event.target.closest(".lv3-touch-dot");
      const touchedDotId = touchedDot?.id ?? null;

      finish({
        success: touchedDotId === expectedDot.id,
        touchedDotId,
      });
    };

    document.addEventListener("pointerdown", onPointerDown, true);

    const timeoutId = window.setTimeout(() => {
      finish({ success: false, touchedDotId: null });
    }, LEVEL_CONFIG.hitWindowMs);
  });
}

async function showTouchFeedback(dotId, success) {
  const dot = document.getElementById(dotId);

  if (success) {
    playOkSound();
  } else {
    playFailSound();
  }

  if (!dot) {
    await delay(LEVEL_CONFIG.feedbackMs);
    return;
  }

  dot.classList.add(success ? "is-success" : "is-fail");
  await delay(LEVEL_CONFIG.feedbackMs);
  dot.classList.remove("is-success", "is-fail");
}

function showRectangle(rectangle) {
  const wrap = document.getElementById("rectanglesWrap");
  if (!wrap) return;

  let element = document.getElementById(rectangle.id);

  if (!element) {
    element = document.createElement("li");
    element.id = rectangle.id;
    element.className = `lv3-rectangle ${rectangle.position}`;
    element.style.setProperty(
      "--rectangle-transition-ms",
      `${LEVEL_CONFIG.rectangleTransitionMs}ms`,
    );
    element.style.backgroundColor = rectangle.color;
    wrap.appendChild(element);
  }

  // 초기 0 크기를 브라우저가 먼저 그리게 한 다음 목표 크기로 전환합니다.
  void element.offsetWidth;

  if (rectangle.position === "t" || rectangle.position === "b") {
    element.style.height = `${rectangle.size}px`;
  } else {
    element.style.width = `${rectangle.size}px`;
  }

  element.classList.add("is-visible");
}

function hideRectangle(rectangleId) {
  const rectangle = document.getElementById(rectangleId);
  if (!rectangle) return;

  rectangle.classList.remove("is-visible");

  if (rectangle.classList.contains("t") || rectangle.classList.contains("b")) {
    rectangle.style.height = "0px";
  } else {
    rectangle.style.width = "0px";
  }
}

function showDot(dot, options = {}) {
  const wrap = document.getElementById("touchDotsWrap");
  if (!wrap) return;

  let element = document.getElementById(dot.id);

  if (!element) {
    element = document.createElement("button");
    element.type = "button";
    element.id = dot.id;
    element.className = "lv3-touch-dot";
    element.dataset.sequenceIndex = String(dot.sequenceIndex);
    element.setAttribute("aria-label", `${dot.sequenceIndex + 1}번째 터치 지점`);
    element.style.left = `${dot.x}px`;
    element.style.top = `${dot.y}px`;
    wrap.appendChild(element);
  }

  element.classList.toggle("is-touchable", Boolean(options.touchable));
  element.classList.toggle("is-cue", Boolean(options.cue));

  void element.offsetWidth;
  element.classList.add("is-visible");
}

function hideDot(dotId) {
  const dot = document.getElementById(dotId);
  if (!dot) return;

  dot.classList.remove("is-visible", "is-touchable", "is-cue");
}

function groupDotsByStage(touchDots) {
  const groups = new Map();

  touchDots.forEach((dot) => {
    const stageDots = groups.get(dot.revealStage) ?? [];
    stageDots.push(dot);
    stageDots.sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    groups.set(dot.revealStage, stageDots);
  });

  return groups;
}

function resetBoard() {
  document.getElementById("rectanglesWrap")?.replaceChildren();
  document.getElementById("touchDotsWrap")?.replaceChildren();
}

function hideResult() {
  const resultLayer = document.getElementById("lv3Result");
  const nextButton = document.getElementById("lv3NextButton");
  const retryButton = document.getElementById("lv3RetryButton");

  if (resultLayer) resultLayer.hidden = true;
  if (nextButton) nextButton.hidden = true;
  if (retryButton) retryButton.hidden = true;
}

function showResult(success) {
  const resultLayer = document.getElementById("lv3Result");
  const title = document.getElementById("lv3ResultTitle");
  const message = document.getElementById("lv3ResultMessage");
  const nextButton = document.getElementById("lv3NextButton");
  const retryButton = document.getElementById("lv3RetryButton");

  if (!resultLayer || !title || !message || !nextButton || !retryButton) return;

  title.textContent = success ? "CLEAR" : "TRY AGAIN";
  message.textContent = success
    ? "네 개의 꼭짓점을 모두 정확한 순서로 터치했습니다."
    : "네 번의 터치가 끝났습니다. 순서와 위치를 다시 기억해 보세요.";
  nextButton.hidden = !success;
  retryButton.hidden = success;
  resultLayer.hidden = false;

  setStatus(success ? "성공입니다." : "한 번 이상 실패했습니다.");
}

function setStatus(message) {
  const status = document.getElementById("lv3Status");
  if (status) status.textContent = message;
}

function createRectangleColor(index) {
  const rgb = PASTEL_COLORS[randomInteger(0, PASTEL_COLORS.length - 1)];
  const alpha = Math.min(0.28 + index * 0.08, 0.58);

  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function shuffle(values) {
  const result = [...values];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [result[i], result[randomIndex]] = [result[randomIndex], result[i]];
  }

  return result;
}

function randomInteger(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isActive(gameId) {
  return activeGameId === gameId && window.location.pathname === "/lv3";
}
