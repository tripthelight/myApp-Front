import lv21Style from "../../../assets/scss/game/lv21/common.scss?inline";
import lv21Template from "./lv21.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv21CastanetSound,
  playLv21DealSound,
  playLv21FailSound,
  playLv21FinishSound,
  playStartSound,
  readySound,
  stopLv21Sounds,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv21Sound.js";

const LANE_COUNT = 4;
const NUMBER_CARD_COUNT = 16;
const MIN_SKIP_CARDS = 1;
const MAX_SKIP_CARDS = 4;
const MIN_REVERSE_CARDS = 1;
const MAX_REVERSE_CARDS = 2;
const SKIP_HOLD_TIME = 90;
const ACTIVE_FLASH_TIME = 210;
const RESULT_FLASH_TIME = 280;
const LIMITS = Object.freeze({ 1: 2250, 2: 2500, 3: 2750, 4: 3000 });
const COLOR_SETS = Object.freeze([
  { base: "#f5a9bc", deep: "#be6680", glow: "#ffdce6" },
  { base: "#8fcfe1", deep: "#477e9c", glow: "#d7f3fa" },
  { base: "#a9d8a4", deep: "#5d9568", glow: "#e1f4df" },
  { base: "#eccb82", deep: "#a77935", glow: "#fff0c9" },
  { base: "#c5afe8", deep: "#7a61ae", glow: "#eee5ff" },
  { base: "#8fd8c3", deep: "#4d927e", glow: "#daf6ed" },
  { base: "#f0ad91", deep: "#aa664d", glow: "#ffe2d5" },
  { base: "#a8bce9", deep: "#6175ad", glow: "#e1e8ff" },
]);

let gameToken = 0;
let running = false;
let acceptingInput = false;
let activeLane = 0;
let currentCard = null;
let currentTapCount = 0;
let processedCards = 0;
let dealtCards = 0;
let totalCardCount = NUMBER_CARD_COUNT;
let skipCardCount = 0;
let reverseCardCount = 0;
let direction = 1;
let failures = 0;
let laneQueues = [];
let laneColors = [];
let timers = new Set();
let limitTimer = 0;
let pendingSuccessTimer = 0;
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let mountedPathname = "";
let routeWatchTimer = 0;
let resizeFrame = 0;

export function renderPage() {
  destroyPage();
  renderView(lv21Template, lv21Style);
  mountedPathname = window.location.pathname;
  bindLifecycle();
  bindViewport();
  bindControls();
  prepareBoard();
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
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv21Page")) destroyPage();
  }, 100);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv21Page");
    if (!page) return;
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);
    page.style.setProperty("--lv21-vw", `${width}px`);
    page.style.setProperty("--lv21-vh", `${height}px`);
    page.classList.toggle("is-portrait", height > width);
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      page.style.setProperty("--lv21-stage-scale", String(Math.min(1, Math.max(0.72, width / 920))));
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
  document.getElementById("lv21StartButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv21RetryButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv21NextButton")?.addEventListener("click", () => {
    cancelGame();
    navigate("lv22", { replace: true });
  }, { signal });
  document.getElementById("lv21HomeButton")?.addEventListener("click", () => {
    cancelGame();
    navigate("home", { replace: true });
  }, { signal });
  document.querySelector(".lv21-lanes")?.addEventListener("pointerdown", handleCastanetPress, { signal });
  document.querySelector(".lv21-lanes")?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
}

function prepareBoard() {
  laneColors = shuffle([...COLOR_SETS]).slice(0, LANE_COUNT);
  laneQueues = Array.from({ length: LANE_COUNT }, (_, lane) => shuffle([1, 2, 3, 4]).map((number, index) => ({
    id: `number-${lane}-${index}-${number}`,
    type: "number",
    lane,
    number,
    color: laneColors[lane],
  })));

  skipCardCount = randomInteger(MIN_SKIP_CARDS, MAX_SKIP_CARDS);
  for (let index = 0; index < skipCardCount; index += 1) {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const minimumIndex = 1;
    const insertIndex = randomInteger(minimumIndex, laneQueues[lane].length);
    laneQueues[lane].splice(insertIndex, 0, {
      id: `skip-${index}-${lane}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
      type: "skip",
      lane,
      number: 0,
      color: laneColors[lane],
    });
  }

  reverseCardCount = randomInteger(MIN_REVERSE_CARDS, MAX_REVERSE_CARDS);
  insertReverseCards(reverseCardCount);

  totalCardCount = NUMBER_CARD_COUNT + skipCardCount + reverseCardCount;
  direction = 1;
  activeLane = 0;
  currentCard = null;
  currentTapCount = 0;
  processedCards = 0;
  dealtCards = 0;
  failures = 0;
  acceptingInput = false;
  clearStacks();
  updateDeckCount(totalCardCount);
  updateProgress();
  setText("lv21PhaseText", "READY");
}

async function startGame() {
  cancelGame();
  prepareBoard();
  const token = ++gameToken;
  running = true;
  hide("lv21Ready");
  hide("lv21Result");
  await readySound();
  if (!isActive(token)) return;
  playStartSound();
  setText("lv21PhaseText", "DEALING");
  schedule(() => dealInitialCards(token, 0), 420);
}

function dealInitialCards(token, laneIndex) {
  if (!isActive(token)) return;
  if (laneIndex >= LANE_COUNT) {
    schedule(() => beginTurn(token, 0), 720);
    return;
  }
  const card = laneQueues[laneIndex][0];
  dealCard(card, true);
  playLv21DealSound(laneIndex);
  schedule(() => dealInitialCards(token, laneIndex + 1), 330);
}

function beginTurn(token, laneIndex) {
  if (!isActive(token)) return;
  activeLane = laneIndex;
  currentCard = laneQueues[laneIndex][0] ?? null;
  currentTapCount = 0;
  acceptingInput = false;
  if (!currentCard) {
    advanceTurn(token);
    return;
  }

  document.querySelectorAll(".lv21-lane").forEach((lane, index) => {
    lane.classList.toggle("is-active", index === laneIndex);
  });
  const activeLaneElement = document.querySelector(`.lv21-lane[data-lane="${laneIndex}"]`);
  schedule(() => activeLaneElement?.classList.remove("is-active"), ACTIVE_FLASH_TIME);
  document.querySelectorAll(".lv21-castanet").forEach((button) => {
    button.disabled = true;
  });

  const stack = document.getElementById(`lv21Stack${laneIndex}`);
  const visibleCard = stack?.querySelector(".lv21-card:last-child");
  if (visibleCard?.dataset.cardId !== currentCard.id) {
    if (stack?.querySelector(".lv21-card.is-reverse")) {
      collapseReversePairThenDeal(token, currentCard);
      return;
    }
    dealCard(currentCard, false);
    playLv21DealSound(laneIndex);
    schedule(() => activateCurrentCard(token), 390);
    return;
  }

  activateCurrentCard(token);
}

function activateCurrentCard(token) {
  if (!isActive(token) || !currentCard) return;
  document.querySelectorAll(".lv21-castanet").forEach((button) => {
    button.disabled = false;
  });

  if (currentCard.type === "skip") {
    setText("lv21PhaseText", `LANE ${activeLane + 1} · SKIP`);
    document.getElementById("lv21Timer")?.classList.remove("is-running");
    acceptingInput = true;
    const cardId = currentCard.id;
    schedule(() => {
      if (isActive(token) && acceptingInput && currentCard?.id === cardId) resolveTurn(true, "SKIP");
    }, SKIP_HOLD_TIME);
    return;
  }

  const requiredTaps = getRequiredTapCount(currentCard);
  setText("lv21PhaseText", currentCard.type === "reverse"
    ? `LANE ${activeLane + 1} · ×${requiredTaps} · REVERSE`
    : `LANE ${activeLane + 1} · ×${requiredTaps}`);
  startTimer(requiredTaps, token);
  acceptingInput = true;
}

function handleCastanetPress(event) {
  const button = event.target.closest(".lv21-castanet");
  if (!button || !running || !acceptingInput || !currentCard) return;
  event.preventDefault();
  const pressedLane = Number(button.dataset.lane);
  if (pressedLane !== activeLane) {
    resolveTurn(false, "ORDER");
    return;
  }

  if (currentCard.type === "skip") {
    animateCastanet(button);
    playLv21CastanetSound(0, activeLane);
    resolveTurn(false, "SKIP_PRESS");
    return;
  }

  const requiredTaps = getRequiredTapCount(currentCard);
  currentTapCount += 1;
  animateCastanet(button);
  playLv21CastanetSound(currentTapCount - 1, activeLane);
  pulseCard(activeLane);

  if (currentTapCount > requiredTaps) {
    window.clearTimeout(pendingSuccessTimer);
    resolveTurn(false, "OVER");
    return;
  }
  if (currentTapCount === requiredTaps) {
    window.clearTimeout(pendingSuccessTimer);
    resolveTurn(true, "CLEAR");
  }
}

function startTimer(number, token) {
  window.clearTimeout(limitTimer);
  const timer = document.getElementById("lv21Timer");
  const duration = LIMITS[number];
  timer?.style.setProperty("--duration", `${duration}ms`);
  timer?.classList.remove("is-running");
  void timer?.offsetWidth;
  timer?.classList.add("is-running");
  limitTimer = window.setTimeout(() => {
    if (isActive(token) && acceptingInput) resolveTurn(false, "TIME");
  }, duration);
}

function resolveTurn(success, reason) {
  if (!running || !acceptingInput || !currentCard) return;
  acceptingInput = false;
  window.clearTimeout(limitTimer);
  window.clearTimeout(pendingSuccessTimer);
  document.getElementById("lv21Timer")?.classList.remove("is-running");
  document.querySelectorAll(".lv21-castanet").forEach((button) => { button.disabled = true; });
  const lane = document.querySelector(`.lv21-lane[data-lane="${activeLane}"]`);
  lane?.classList.remove("is-active", "is-success", "is-fail");
  lane?.classList.add(success ? "is-success" : "is-fail");
  schedule(() => lane?.classList.remove("is-success", "is-fail"), RESULT_FLASH_TIME);
  if (!success) {
    failures += 1;
    playLv21FailSound();
  }
  if (currentCard.type === "reverse") direction *= -1;
  processedCards += 1;
  updateProgress();
  completeCard(gameToken);
}

function completeCard(token) {
  if (!isActive(token)) return;
  const finishedLane = activeLane;
  const finished = laneQueues[finishedLane].shift();
  if (!finished) {
    advanceTurn(token);
    return;
  }

  // 다음 카드가 남아 있으면 기존 카드는 그대로 유지합니다.
  // 같은 블럭이 다시 active되어 새 카드가 완전히 덮은 뒤에 제거됩니다.
  // 더 이상 받을 카드가 없을 때만 마지막 카드를 퇴장시키며,
  // 다음 턴은 별도의 대기 없이 즉시 시작합니다.
  if (laneQueues[finishedLane].length === 0) removeLastCard(finishedLane);
  advanceTurn(token);
}

function removeLastCard(laneIndex) {
  const cards = [...document.querySelectorAll(`#lv21Stack${laneIndex} .lv21-card`)];
  if (!cards.length) return;
  cards.forEach((card) => card.classList.add("is-spent"));
  schedule(() => cards.forEach((card) => card.remove()), 420);
}

function advanceTurn(token) {
  if (!isActive(token)) return;
  if (processedCards >= totalCardCount) {
    finishGame(token);
    return;
  }
  const nextLane = findNextLane(activeLane, direction);
  if (nextLane < 0) {
    finishGame(token);
    return;
  }
  beginTurn(token, nextLane);
}

function finishGame(token) {
  if (!isActive(token)) return;
  running = false;
  acceptingInput = false;
  window.clearTimeout(limitTimer);
  document.querySelectorAll(".lv21-lane").forEach((lane) => lane.classList.remove("is-active"));
  document.querySelectorAll(".lv21-castanet").forEach((button) => { button.disabled = true; });
  setText("lv21PhaseText", "COMPLETE");
  updateDeckCount(0);
  const success = failures === 0;
  playLv21FinishSound(success);
  setText("lv21ResultKicker", success ? "CARD RHYTHM COMPLETE" : "CARD RHYTHM REVIEW");
  setText("lv21ResultTitle", success ? "완벽한 카드 리듬입니다" : "리듬을 한 번 더 맞춰보세요");
  setText("lv21ResultDescription", success
    ? `${NUMBER_CARD_COUNT}장의 숫자카드, ${skipCardCount}장의 건너뛰기 카드와 ${reverseCardCount}장의 진행순서 바꾸기 카드를 모두 정확하게 연주했습니다.`
    : `${totalCardCount}장의 카드를 끝까지 연주했습니다. ${failures}번의 리듬을 다시 맞추면 됩니다.`);
  toggle("lv21NextButton", !success);
  toggle("lv21RetryButton", success);
  schedule(() => show("lv21Result"), 650);
}

function dealCard(card, initial) {
  const stack = document.getElementById(`lv21Stack${card.lane}`);
  if (!stack) return;
  const coveredCards = initial ? [] : [...stack.querySelectorAll(".lv21-card")];
  const element = document.createElement("article");
  const typeClass = card.type === "skip" ? "is-skip" : card.type === "reverse" ? "is-reverse" : "is-number";
  element.className = `lv21-card ${typeClass} ${initial ? "is-initial-deal" : "is-redeal"}`;
  element.dataset.cardId = card.id;
  element.style.setProperty("--card", card.color.base);
  element.style.setProperty("--card-deep", card.color.deep);
  element.style.setProperty("--card-glow", card.color.glow);
  if (card.type === "skip") {
    element.innerHTML = `<small class="lv21-skip-mark"><i></i></small><strong class="lv21-skip-mark"><i></i></strong><b class="lv21-skip-mark"><i></i></b>`;
  } else if (card.type === "reverse") {
    element.innerHTML = `<small class="lv21-reverse-mark"><i></i></small><strong class="lv21-reverse-mark"><i></i></strong><b class="lv21-reverse-mark"><i></i></b>`;
    coveredCards.at(-1)?.classList.add("is-reverse-underlay");
  } else {
    element.innerHTML = `<small>${card.number}</small><strong>${card.number}</strong><b>${card.number}</b>`;
  }
  stack.append(element);
  dealtCards += 1;
  updateDeckCount(totalCardCount - dealtCards);
  schedule(() => element.classList.add("is-settled"), 30);
  if (coveredCards.length && card.type !== "reverse") removeCoveredCardsAfterDeal(coveredCards, element);
}

function collapseReversePairThenDeal(token, card) {
  const stack = document.getElementById(`lv21Stack${card.lane}`);
  if (!stack) return;
  const pair = [...stack.querySelectorAll(".lv21-card")];
  pair.forEach((element) => element.classList.add("is-pair-collapsing"));
  schedule(() => {
    if (!isActive(token)) return;
    dealCard(card, false);
    playLv21DealSound(card.lane);
    schedule(() => activateCurrentCard(token), 390);
  }, 280);
}

function removeCoveredCardsAfterDeal(coveredCards, incomingCard) {
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    coveredCards.forEach((card) => card.remove());
  };

  incomingCard.addEventListener("transitionend", (event) => {
    if (event.propertyName === "transform" && incomingCard.classList.contains("is-settled")) remove();
  }, { once: true });

  schedule(remove, 820);
}

function pulseCard(laneIndex) {
  const card = document.querySelector(`#lv21Stack${laneIndex} .lv21-card:last-child`);
  card?.classList.remove("is-hit");
  void card?.offsetWidth;
  card?.classList.add("is-hit");
}

function animateCastanet(button) {
  button.classList.remove("is-hit");
  void button.offsetWidth;
  button.classList.add("is-hit");
}

function updateProgress() {
  const ratio = totalCardCount > 0 ? processedCards / totalCardCount : 0;
  document.getElementById("lv21ProgressBar")?.style.setProperty("width", `${ratio * 100}%`);
  setText("lv21CountText", `${processedCards} / ${totalCardCount}`);
}

function updateDeckCount(count) {
  const safeCount = Math.max(0, count);
  setText("lv21DeckCount", String(safeCount));
  document.getElementById("lv21Deck")?.classList.toggle("is-empty", safeCount === 0);
}

function clearStacks() {
  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    const stack = document.getElementById(`lv21Stack${lane}`);
    if (stack) stack.replaceChildren();
  }
  document.querySelectorAll(".lv21-lane").forEach((lane) => lane.classList.remove("is-active", "is-success", "is-fail"));
  document.querySelectorAll(".lv21-castanet").forEach((button) => { button.disabled = true; });
}

function findNextLane(fromLane, step) {
  for (let offset = 1; offset <= LANE_COUNT; offset += 1) {
    const candidate = (fromLane + step * offset + LANE_COUNT * 2) % LANE_COUNT;
    if (laneQueues[candidate]?.length) return candidate;
  }
  return -1;
}

function getRequiredTapCount(card) {
  return card?.type === "reverse" ? card.sourceNumber : card?.number ?? 0;
}

function insertReverseCards(count) {
  const candidates = [];
  [0, LANE_COUNT - 1].forEach((lane) => {
    laneQueues[lane].forEach((card) => {
      if (card.type === "number") candidates.push({ lane, cardId: card.id });
    });
  });
  shuffle(candidates);

  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.shift();
    if (!candidate) break;
    const queue = laneQueues[candidate.lane];
    const numberIndex = queue.findIndex((card) => card.id === candidate.cardId);
    if (numberIndex < 0) continue;
    const numberCard = queue[numberIndex];
    queue.splice(numberIndex + 1, 0, {
      id: `reverse-${index}-${candidate.lane}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
      type: "reverse",
      lane: candidate.lane,
      number: 0,
      sourceNumber: numberCard.number,
      sourceCardId: numberCard.id,
      color: laneColors[candidate.lane],
    });
  }
}

function randomInteger(minimum, maximum) {
  return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

function schedule(callback, delay) {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
  return timer;
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
  return items;
}

function isActive(token) {
  return running && token === gameToken && document.getElementById("lv21Page");
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function hide(id) {
  const element = document.getElementById(id);
  if (element) element.hidden = true;
}

function show(id) {
  const element = document.getElementById(id);
  if (element) element.hidden = false;
}

function toggle(id, hidden) {
  const element = document.getElementById(id);
  if (element) element.hidden = hidden;
}

function cancelGame() {
  running = false;
  acceptingInput = false;
  gameToken += 1;
  window.clearTimeout(limitTimer);
  window.clearTimeout(pendingSuccessTimer);
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  stopLv21Sounds();
}

function destroyPage() {
  cancelGame();
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
