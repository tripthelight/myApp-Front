import lv1Style from "../../../assets/scss/game/lv1/common.scss?inline";
import lv1Template from "./lv1.html?raw";
import { renderView } from "../../../shared/dom.js";
import { navigate } from "../../../app/router.js";
import {
  readySound,
  unlockSoundOnNextGesture,
  playStartSound,
  playOkSound,
  playFailSound,
} from "../../../module/sound/levels/lv1Sound.js";

const RECT_TRANSITION_MS = 200;
const TOUCH_TARGET_MS = 800;
const TOUCH_TOLERANCE_MS = 80;
const BLOCK_FEEDBACK_IN_MS = 420;
const BLOCK_FEEDBACK_HOLD_MS = 160;
const BLOCK_FEEDBACK_OUT_MS = 520;

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
    Boolean(WRAP?.querySelector("#lv1Page .rectangle-1"))
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

function showResultButtons(resultType, onPrimaryClick) {
  const WRAP = document.getElementById("appView");
  if (!WRAP) return;

  const oldButtonWrap = WRAP.querySelector(".result-button-wrap");
  oldButtonWrap?.remove();

  const buttonWrap = document.createElement("div");
  buttonWrap.className = "result-button-wrap";

  const primaryButton = document.createElement("button");
  primaryButton.className = `result-button ${resultType === "NEXT" ? "is-next" : "is-retry"}`;
  primaryButton.textContent = resultType;
  primaryButton.addEventListener("click", onPrimaryClick);

  const homeButton = document.createElement("button");
  homeButton.className = "result-button is-home";
  homeButton.textContent = "HOME";
  homeButton.addEventListener("click", () => {
    stopActiveGame();
    navigate("home", { replace: true });
  });

  buttonWrap.append(primaryButton, homeButton);
  WRAP.appendChild(buttonWrap);
}

function resetRects(rects) {
  rects.forEach((rect) => {
    rect.style.transition = "none";
    rect.style.left = "0%";
    rect.style.backgroundColor = "rgba(0,0,255,0)";
    rect.style.setProperty("--lv1-base-color", "rgba(0,0,255,0)");
    rect.dataset.lv1Active = "false";
    rect.classList.remove("is-judge-success", "is-judge-fail");
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
  const startLeft = index === 0 ? 0 : (index - 1) * 25;
  const endLeft = index === 0 ? 0 : index * 25;
  const alpha = 1 - 0.2 * index;

  rect.style.transition = "none";
  rect.style.left = `${startLeft}%`;
  rect.style.backgroundColor = "rgba(0,0,255,0)";
  rect.style.setProperty("--lv1-base-color", "rgba(0,0,255,0)");
  rect.dataset.lv1Active = "false";
  rect.classList.remove("is-judge-success", "is-judge-fail");

  rect.offsetWidth;

  rect.style.transitionProperty = "left, background-color";
  rect.style.transitionDuration = `${RECT_TRANSITION_MS}ms`;
  rect.style.transitionTimingFunction = "ease-in";

  const transitionEnd = waitTransitionEnd(rect, run);

  await nextFrame(run.signal);

  if (!isCurrentGameRun(run)) return;

  const baseColor = `rgba(0,0,255,${alpha})`;

  rect.style.left = `${endLeft}%`;
  rect.style.backgroundColor = baseColor;
  rect.style.setProperty("--lv1-base-color", baseColor);
  rect.dataset.lv1Active = "true";

  await transitionEnd;
}

async function waitForFeedbackTarget(rect, run) {
  while (isCurrentGameRun(run) && rect.dataset.lv1Active !== "true") {
    await nextFrame(run.signal);
  }
}

async function showBlockFeedback(rect, result, run) {
  if (!rect || !isCurrentGameRun(run)) return;

  await waitForFeedbackTarget(rect, run);

  if (!isCurrentGameRun(run)) return;

  const baseColor = rect.style.getPropertyValue("--lv1-base-color")
    || getComputedStyle(rect).getPropertyValue("--lv1-base-color").trim()
    || rect.style.backgroundColor;
  const feedbackVariable = result ? "--lv1-success-color" : "--lv1-fail-color";
  const feedbackColor = getComputedStyle(rect).getPropertyValue(feedbackVariable).trim();
  const totalDuration =
    BLOCK_FEEDBACK_IN_MS + BLOCK_FEEDBACK_HOLD_MS + BLOCK_FEEDBACK_OUT_MS;
  const feedbackInOffset = BLOCK_FEEDBACK_IN_MS / totalDuration;
  const feedbackHoldOffset =
    (BLOCK_FEEDBACK_IN_MS + BLOCK_FEEDBACK_HOLD_MS) / totalDuration;

  rect.classList.remove("is-judge-success", "is-judge-fail");
  rect.style.backgroundColor = baseColor;

  // 공통 SCSS의 prefers-reduced-motion 규칙이 CSS transition-duration을
  // 1ms !important로 덮어쓸 수 있으므로, 판정색 왕복은 Web Animations API로
  // 직접 보간한다. 이렇게 하면 어떤 OS/브라우저 모션 설정에서도
  // 기본색 → 판정색 → 기본색 변화가 실제 시간 동안 부드럽게 표시된다.
  const feedbackAnimation = rect.animate(
    [
      {
        backgroundColor: baseColor,
        offset: 0,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      {
        backgroundColor: feedbackColor,
        offset: feedbackInOffset,
        easing: "linear",
      },
      {
        backgroundColor: feedbackColor,
        offset: feedbackHoldOffset,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      {
        backgroundColor: baseColor,
        offset: 1,
      },
    ],
    {
      duration: totalDuration,
      iterations: 1,
      fill: "none",
    }
  );

  const cancelFeedback = () => feedbackAnimation.cancel();
  run.signal.addEventListener("abort", cancelFeedback, { once: true });

  try {
    await feedbackAnimation.finished;
  } catch {
    // 화면 이동이나 RETRY로 취소된 애니메이션은 정상적인 종료 흐름이다.
  } finally {
    run.signal.removeEventListener("abort", cancelFeedback);
    rect.style.backgroundColor = baseColor;
  }
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

function startTouchJudge(feedbackRect, run) {
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
      showBlockFeedback(feedbackRect, result, run).then(() => resolve(result));
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
      judgePromises.push(startTouchJudge(RECTS[i + 1], run));
      await delay(TOUCH_TARGET_MS, run.signal);
    }
  }

  if (!isCurrentGameRun(run)) return;

  const results = await Promise.all(judgePromises);

  if (!isCurrentGameRun(run)) return;

  const allSuccess = results.every(Boolean);

  if (allSuccess) {
    showResultButtons("NEXT", () => {
      stopActiveGame();
      navigate("lv2", { replace: true });
    });
  } else {
    showResultButtons("RETRY", (event) => {
      event.target?.closest(".result-button-wrap")?.remove()
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
  const readyLayer = document.getElementById("lv1Ready");
  const startButton = document.getElementById("lv1StartButton");

  if (!readyLayer || !startButton) return;

  unlockSoundOnNextGesture();
  startButton.addEventListener("click", () => {
    readyLayer.hidden = true;
    rectangleAni();
  }, { once: true });
}