import lv1Style from "../../../assets/scss/game/lv1/common.scss?inline";
import lv1Template from "./lv1.html?raw";
import { renderView } from "../../../shared/dom.js";
import {
  readySound,
  unlockSoundOnNextGesture,
  playStartSound,
  playOkSound,
  playFailSound,
} from "../../../module/sound/sound.js";

const RECT_TRANSITION_MS = 200;
const TOUCH_TARGET_MS = 800;
const TOUCH_TOLERANCE_MS = 80;
const FEEDBACK_MS = 700;

let activeGameRunId = 0;
let activeAbortController = null;

function delay(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timerId = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timerId);
        resolve();
      },
      { once: true }
    );
  });
}

function nextFrame(signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    requestAnimationFrame(resolve);
  });
}

function stopActiveGame() {
  activeGameRunId += 1;

  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
}

function createGameRun() {
  stopActiveGame();

  activeAbortController = new AbortController();

  return {
    id: activeGameRunId,
    signal: activeAbortController.signal,
  };
}

function isCurrentGameRun(run) {
  const WRAP = document.getElementById("appView");

  return (
    run &&
    !run.signal.aborted &&
    run.id === activeGameRunId &&
    Boolean(WRAP?.querySelector(".rectangle-1"))
  );
}

function waitTransitionEnd(el, run) {
  return new Promise((resolve) => {
    if (!isCurrentGameRun(run)) {
      resolve();
      return;
    }

    let done = false;

    const finish = () => {
      if (done) return;
      done = true;

      el.removeEventListener("transitionend", onEnd);
      clearTimeout(fallbackTimerId);
      resolve();
    };

    const onEnd = (e) => {
      if (e.propertyName !== "background-color") return;
      finish();
    };

    el.addEventListener("transitionend", onEnd);

    const fallbackTimerId = setTimeout(finish, RECT_TRANSITION_MS + 80);

    run.signal.addEventListener("abort", finish, { once: true });
  });
}

function showResultButton(type, onClick) {
  const WRAP = document.getElementById("appView");
  if (!WRAP) return;

  const oldButton = WRAP.querySelector(".result-button");
  oldButton?.remove();

  const button = document.createElement("button");
  button.className = `result-button ${type === "NEXT" ? "is-next" : "is-retry"}`;
  button.textContent = type;

  button.addEventListener("click", onClick);

  WRAP.appendChild(button);
}

function resetRects(rects) {
  rects.forEach((rect) => {
    rect.style.transition = "none";
    rect.style.left = "0px";
    rect.style.backgroundColor = "rgba(0,0,255,0)";
  });

  document.body.offsetWidth;

  rects.forEach((rect) => {
    rect.style.transitionProperty = "left, background-color";
    rect.style.transitionDuration = `${RECT_TRANSITION_MS}ms`;
    rect.style.transitionTimingFunction = "ease-in";
  });
}

async function playRect(rects, index, run) {
  if (!isCurrentGameRun(run)) return;

  const rect = rects[index];
  const w = rect.getBoundingClientRect().width;

  const startLeft = index === 0 ? 0 : w * (index - 1);
  const endLeft = index === 0 ? 0 : w * index;
  const alpha = 1 - 0.2 * index;

  rect.style.transition = "none";
  rect.style.left = `${startLeft}px`;
  rect.style.backgroundColor = "rgba(0,0,255,0)";

  rect.offsetWidth;

  rect.style.transitionProperty = "left, background-color";
  rect.style.transitionDuration = `${RECT_TRANSITION_MS}ms`;
  rect.style.transitionTimingFunction = "ease-in";

  const transitionEnd = waitTransitionEnd(rect, run);

  await nextFrame(run.signal);

  if (!isCurrentGameRun(run)) return;

  rect.style.left = `${endLeft}px`;
  rect.style.backgroundColor = `rgba(0,0,255,${alpha})`;

  await transitionEnd;
}

async function showResult(result, run) {
  const WRAP = document.getElementById("appView");
  if (!WRAP || !isCurrentGameRun(run)) return;

  const oldResult = WRAP.querySelector(".success-pop, .fail-pop");
  oldResult?.remove();

  const resultWrap = document.createElement("div");

  if (result) {
    resultWrap.className = "success-pop";

    const mark = document.createElement("div");
    mark.className = "success-pop__mark";

    const sparks = [
      ["#ff4d6d", 0, -110, 0],
      ["#ffd166", 76, -88, 35],
      ["#06d6a0", 112, -20, 75],
      ["#4cc9f0", 94, 70, 120],
      ["#b517ff", 32, 116, 165],
      ["#ff9f1c", -46, 108, 210],
      ["#2ec4b6", -106, 48, 255],
      ["#f72585", -112, -30, 300],
      ["#8ac926", -66, -96, 335],
      ["#ff70a6", 46, -126, 20],
      ["#70d6ff", 126, 30, 95],
      ["#e9ff70", -126, 12, 280],
    ];

    sparks.forEach(([color, x, y, rotate], index) => {
      const spark = document.createElement("span");
      spark.className = "success-pop__spark";
      spark.style.setProperty("--c", color);
      spark.style.setProperty("--x", `${x}px`);
      spark.style.setProperty("--y", `${y}px`);
      spark.style.setProperty("--r", `${rotate}deg`);
      spark.style.setProperty("--delay", `${index * 12}ms`);
      resultWrap.appendChild(spark);
    });

    resultWrap.appendChild(mark);
  } else {
    resultWrap.className = "fail-pop";
  }

  WRAP.appendChild(resultWrap);

  await delay(FEEDBACK_MS, run.signal);

  if (!isCurrentGameRun(run)) return;

  resultWrap.remove();
}

function playJudgeSound(result, run) {
  readySound().then((ready) => {
    if (!ready || !isCurrentGameRun(run)) return;

    if (result) {
      playOkSound();
    } else {
      playFailSound();
    }
  });
}

function startTouchJudge(run) {
  const targetTime = performance.now() + TOUCH_TARGET_MS;

  return new Promise((resolve) => {
    if (!isCurrentGameRun(run)) {
      resolve(false);
      return;
    }

    let judged = false;

    const finish = (result) => {
      if (judged) return;
      judged = true;

      window.removeEventListener("pointerdown", onPointerDown);
      clearTimeout(timeoutId);

      if (!isCurrentGameRun(run)) {
        resolve(false);
        return;
      }

      playJudgeSound(result, run);
      showResult(result, run).then(() => resolve(result));
    };

    const onPointerDown = () => {
      const touchedAt = performance.now();
      const diff = Math.abs(touchedAt - targetTime);

      finish(diff <= TOUCH_TOLERANCE_MS);
    };

    window.addEventListener("pointerdown", onPointerDown);

    const timeoutId = setTimeout(() => {
      finish(false);
    }, TOUCH_TARGET_MS + TOUCH_TOLERANCE_MS);

    run.signal.addEventListener(
      "abort",
      () => {
        window.removeEventListener("pointerdown", onPointerDown);
        clearTimeout(timeoutId);
        resolve(false);
      },
      { once: true }
    );
  });
}

function goToLv2() {
  window.history.pushState({}, "", "/lv2");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function rectangleAni() {
  const run = createGameRun();

  const WRAP = document.getElementById("appView");
  if (!WRAP) return;

  const RECTS = [...WRAP.querySelectorAll('[class^="rectangle-"]')];
  if (RECTS.length < 4) return;

  unlockSoundOnNextGesture();

  readySound().then((ready) => {
    if (ready && isCurrentGameRun(run)) {
      playStartSound();
    }
  });

  resetRects(RECTS);

  const judgePromises = [];

  for (let i = 0; i < 4; i++) {
    if (!isCurrentGameRun(run)) return;

    await playRect(RECTS, i, run);

    if (i < 3) {
      judgePromises.push(startTouchJudge(run));
      await delay(TOUCH_TARGET_MS, run.signal);
    }
  }

  if (!isCurrentGameRun(run)) return;

  const results = await Promise.all(judgePromises);

  if (!isCurrentGameRun(run)) return;

  const allSuccess = results.every(Boolean);

  if (allSuccess) {
    showResultButton("NEXT", () => {
      stopActiveGame();
      goToLv2();
    });
  } else {
    showResultButton("RETRY", () => {
      rectangleAni();
    });
  }
}

export function renderPage() {
  stopActiveGame();
  renderView(lv1Template, lv1Style);
  lv1Main();
}

function lv1Main() {
  rectangleAni();
}