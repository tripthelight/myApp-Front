import lv30Style from "../../../assets/scss/game/lv30/common.scss?inline";
import lv30Template from "./lv30.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv30Home,
  playLv30Letter,
  readySound,
  stopLv30Sounds,
} from "../../../module/sound/levels/lv30Sound.js";

const LETTER_COUNT = 18;
const BLOOM_STEP_MS = 118;
const BLOOM_START_DELAY_MS = 260;
const PETAL_COUNT = 9;

let pageToken = 0;
let timers = new Set();
let lifecycleController = null;
let interactionController = null;
let viewportController = null;
let mountedPathname = "";
let routeWatchTimer = 0;

export function renderPage() {
  destroyPage();
  renderView(lv30Template, lv30Style);
  const token = ++pageToken;
  mountedPathname = window.location.pathname;
  bindLifecycle();
  bindViewport();
  randomizeComposition();
  bindInteractions(token);
  startBloomSequence(token);
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
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv30Page")) destroyPage();
  }, 120);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv30Page");
    if (!page) return;
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);
    page.style.setProperty("--lv30-vw", `${width}px`);
    page.style.setProperty("--lv30-vh", `${height}px`);
    page.classList.toggle("is-compact", height < 650 || width < 520);
    page.classList.toggle("is-short", height < 540);
  };
  sync();
  window.addEventListener("resize", sync, { passive: true, signal });
  window.addEventListener("orientationchange", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true, signal });
}

function randomizeComposition() {
  document.querySelectorAll(".lv30-row").forEach((row, index) => {
    const maxX = index === 3 ? 2.8 : 7.5;
    row.style.setProperty("--row-x", `${random(-maxX, maxX).toFixed(2)}vw`);
    row.style.setProperty("--row-r", `${random(-1.8, 1.8).toFixed(2)}deg`);
    row.style.setProperty("--row-delay", `${random(0, 1.8).toFixed(2)}s`);
  });

  document.querySelectorAll(".lv30-letter").forEach((letter, index) => {
    const hue = (326 + index * 17 + random(-8, 8) + 360) % 360;
    letter.style.setProperty("--hue", hue.toFixed(0));
    letter.style.setProperty("--float-x", `${random(-5, 5).toFixed(1)}px`);
    letter.style.setProperty("--float-y", `${random(5, 11).toFixed(1)}px`);
    letter.style.setProperty("--float-r", `${random(-3.5, 3.5).toFixed(1)}deg`);
    letter.style.setProperty("--float-duration", `${random(3.4, 5.6).toFixed(2)}s`);
    letter.style.setProperty("--float-delay", `${random(-4.5, 0).toFixed(2)}s`);
  });
}

function bindInteractions(token) {
  interactionController?.abort();
  interactionController = new AbortController();
  const { signal } = interactionController;

  document.querySelectorAll(".lv30-letter").forEach((letter) => {
    letter.addEventListener("pointerdown", async (event) => {
      if (!isActive(token)) return;
      event.preventDefault();
      const index = Number(letter.dataset.index);
      await readySound();
      if (!isActive(token)) return;
      replayClass(letter, "is-touched");
      createPetalBurst(letter, index);
      const played = await playLv30Letter(index, "touch");
      if (played) document.getElementById("lv30SoundHint")?.classList.add("is-hidden");
    }, { signal });
  });

  document.getElementById("lv30HomeButton")?.addEventListener("click", async () => {
    await readySound();
    playLv30Home();
    schedule(() => {
      destroyPage();
      navigate("home", { replace: true });
    }, 110);
  }, { signal });

  document.getElementById("lv30Page")?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
}

function startBloomSequence(token) {
  const order = shuffle(Array.from({ length: LETTER_COUNT }, (_, index) => index));
  order.forEach((letterIndex, sequenceIndex) => {
    schedule(async () => {
      if (!isActive(token)) return;
      const letter = document.querySelector(`.lv30-letter[data-index="${letterIndex}"]`);
      if (!letter) return;
      letter.classList.add("is-bloomed");
      schedule(() => {
        if (isActive(token)) letter.classList.add("is-floating");
      }, 760);
      await playLv30Letter(letterIndex, "bloom");
    }, BLOOM_START_DELAY_MS + sequenceIndex * BLOOM_STEP_MS);
  });

  schedule(() => {
    if (!isActive(token)) return;
    document.getElementById("lv30Page")?.classList.add("is-complete");
  }, BLOOM_START_DELAY_MS + LETTER_COUNT * BLOOM_STEP_MS + 420);
}

function createPetalBurst(letter, index) {
  letter.querySelector(".lv30-petals")?.remove();
  const petals = document.createElement("span");
  petals.className = "lv30-petals";
  petals.setAttribute("aria-hidden", "true");

  for (let petalIndex = 0; petalIndex < PETAL_COUNT; petalIndex += 1) {
    const petal = document.createElement("i");
    const angle = (360 / PETAL_COUNT) * petalIndex + random(-13, 13);
    const distance = random(38, 64);
    petal.style.setProperty("--petal-angle", `${angle.toFixed(1)}deg`);
    petal.style.setProperty("--petal-distance", `${distance.toFixed(1)}px`);
    petal.style.setProperty("--petal-delay", `${random(0, 0.06).toFixed(3)}s`);
    petal.style.setProperty("--petal-spin", `${random(90, 260).toFixed(0)}deg`);
    petal.style.setProperty("--petal-hue", `${(326 + index * 17 + petalIndex * 9) % 360}`);
    petals.appendChild(petal);
  }

  letter.appendChild(petals);
  schedule(() => petals.remove(), 900);
}

function replayClass(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  schedule(() => element.classList.remove(className), 620);
}

function schedule(callback, delay) {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
  return timer;
}

function clearTimers() {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
}

function isActive(token) {
  return token === pageToken && window.location.pathname === mountedPathname && Boolean(document.getElementById("lv30Page"));
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function destroyPage() {
  pageToken += 1;
  clearTimers();
  lifecycleController?.abort();
  interactionController?.abort();
  viewportController?.abort();
  lifecycleController = null;
  interactionController = null;
  viewportController = null;
  window.clearInterval(routeWatchTimer);
  routeWatchTimer = 0;
  stopLv30Sounds();
}
