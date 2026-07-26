import { COMMON_TRANSLATIONS } from "./locales/common.js";
import { GAME_TRANSLATIONS } from "./locales/game.js";
import { LANGUAGE_OPTIONS, resolveBrowserLanguage } from "./languages.js";

const STORAGE_KEY = "rhythm-language";
const CACHE_PREFIX = "rhythm-game-translation:";
const TRANSLATABLE_ATTRIBUTES = ["aria-label", "title", "placeholder", "alt"];
const KOREAN_PATTERN = /[가-힣]/;
const SKIP_SELECTOR = "script, style, code, pre, svg, [data-i18n-ignore]";
const SKELETON_STYLE_ID = "app-i18n-skeleton-style";

const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const pendingRoots = new Set();
const translationPromises = new Map();
const translatorPromises = new Map();
const networkQueue = [];
let activeNetworkJobs = 0;
const MAX_NETWORK_JOBS = 2;

let selectedLanguage = "system";
let activeLanguage = "en";
let observer = null;
let flushScheduled = false;
let languageGeneration = 0;
const skeletonTextNodes = new WeakMap();
const internalTextWriteCounts = new WeakMap();

export function initializeI18n() {
  installSkeletonStyle();
  selectedLanguage = readStoredLanguage();
  activeLanguage = selectedLanguage === "system" ? resolveBrowserLanguage() : selectedLanguage;
  applyDocumentLanguage();
  startObserver();
  translateDocument();
}


export async function translateElementBeforeReveal(root) {
  if (!root) return;

  // 로컬 사전 번역은 즉시 반영하고, 아직 비동기 번역이 필요한 텍스트만
  // 개별 Skeleton으로 가립니다. 전체 화면은 절대 숨기지 않습니다.
  translateElementImmediately(root);
  await translateSubtree(root);
}

export function translateElementImmediately(root) {
  if (!root || activeLanguage === "ko") return true;

  if (root.nodeType === Node.TEXT_NODE) {
    return translateTextNodeImmediately(root);
  }

  if (root.nodeType !== Node.ELEMENT_NODE || shouldSkipElement(root)) return true;

  let complete = translateAttributesImmediately(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE && shouldSkipElement(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node;
  while ((node = walker.nextNode())) {
    const translated = node.nodeType === Node.TEXT_NODE
      ? translateTextNodeImmediately(node)
      : translateAttributesImmediately(node);
    complete = translated && complete;
  }

  return complete;
}

function translateTextNodeImmediately(node) {
  const parent = node.parentElement;
  if (!parent || shouldSkipElement(parent)) return true;

  const current = node.nodeValue || "";
  if (!current.trim() || !KOREAN_PATTERN.test(current)) return true;

  if (!originalText.has(node)) originalText.set(node, current);
  const source = originalText.get(node);
  const leading = source.match(/^\s*/)?.[0] || "";
  const trailing = source.match(/\s*$/)?.[0] || "";
  const core = source.trim().replace(/\s+/g, " ");
  const translated = lookupLocalTranslation(core, activeLanguage);

  if (translated && translated !== core) {
    const value = `${leading}${translated}${trailing}`;
    if (node.nodeValue !== value) writeTextNode(node, value);
    return true;
  }

  return activeLanguage === "ko";
}

function translateAttributesImmediately(element) {
  let complete = true;

  for (const name of TRANSLATABLE_ATTRIBUTES) {
    if (!element?.hasAttribute?.(name)) continue;
    const current = element.getAttribute(name) || "";
    if (!KOREAN_PATTERN.test(current)) continue;

    const map = originalAttributes.get(element) || {};
    if (!map[name]) {
      map[name] = current;
      originalAttributes.set(element, map);
    }

    const translated = lookupLocalTranslation(map[name], activeLanguage);
    if (translated && translated !== map[name]) {
      if (element.getAttribute(name) !== translated) element.setAttribute(name, translated);
    } else if (activeLanguage !== "ko") {
      complete = false;
    }
  }

  return complete;
}

export function getLanguageOptions() { return LANGUAGE_OPTIONS; }
export function getSelectedLanguage() { return selectedLanguage; }
export function getActiveLanguage() { return activeLanguage; }

export async function setLanguage(value) {
  const supported = LANGUAGE_OPTIONS.some((option) => option.value === value) ? value : "system";
  selectedLanguage = supported;
  activeLanguage = supported === "system" ? resolveBrowserLanguage() : supported;
  languageGeneration += 1;

  try { localStorage.setItem(STORAGE_KEY, supported); } catch { /* 현재 화면에는 계속 적용 */ }

  applyDocumentLanguage();
  restoreKnownOriginals(document.body);
  await translateDocument();

  window.dispatchEvent(new CustomEvent("app-language-change", {
    detail: { selectedLanguage, activeLanguage },
  }));
}

// 동기적으로 사용하는 공통 UI용 함수입니다. 게임의 방대한 동적 문구는 DOM 번역 계층이 처리합니다.
export function t(source) {
  return lookupLocalTranslation(source, activeLanguage) || source;
}

export async function translateDocument(options = {}) {
  if (!document.body) return;
  if (options.restore) restoreKnownOriginals(document.body);
  await translateSubtree(document.body);
}

function readStoredLanguage() {
  try {
    const value = localStorage.getItem(STORAGE_KEY) || "system";
    return LANGUAGE_OPTIONS.some((option) => option.value === value) ? value : "system";
  } catch { return "system"; }
}

function applyDocumentLanguage() {
  document.documentElement.lang = activeLanguage === "zh" ? "zh-CN" : activeLanguage;
  document.documentElement.dataset.language = activeLanguage;
}

function startObserver() {
  observer?.disconnect();
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          translateElementImmediately(node);
          prepareSkeletons(node);
          queueTranslation(node);
        });
      } else if (mutation.type === "characterData") {
        if (consumeInternalTextWrite(mutation.target)) continue;
        const current = mutation.target.nodeValue || "";
        if (skeletonTextNodes.has(mutation.target) && !current) continue;
        if (skeletonTextNodes.has(mutation.target) && current) clearTextSkeleton(mutation.target);
        if (KOREAN_PATTERN.test(current)) originalText.set(mutation.target, current);
        translateElementImmediately(mutation.target);
        prepareSkeletons(mutation.target);
        queueTranslation(mutation.target);
      } else if (mutation.type === "attributes") {
        rememberAttribute(mutation.target, mutation.attributeName);
        translateElementImmediately(mutation.target);
        queueTranslation(mutation.target);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: TRANSLATABLE_ATTRIBUTES,
  });
}

function queueTranslation(root) {
  if (!root?.isConnected || activeLanguage === "ko") return;
  pendingRoots.add(root);
  if (flushScheduled) return;

  flushScheduled = true;
  queueMicrotask(async () => {
    flushScheduled = false;
    const roots = compactPendingRoots([...pendingRoots]);
    pendingRoots.clear();
    await Promise.allSettled(roots.map((root) => translateSubtree(root)));
  });
}

function compactPendingRoots(roots) {
  return roots.filter((root, index) => {
    if (!root?.isConnected) return false;
    return !roots.some((candidate, candidateIndex) => (
      candidateIndex !== index &&
      candidate?.nodeType === Node.ELEMENT_NODE &&
      candidate.contains?.(root)
    ));
  });
}

async function translateSubtree(root) {
  if (!root || activeLanguage === "ko") return;
  const jobs = [];

  if (root.nodeType === Node.TEXT_NODE) {
    jobs.push(translateTextNode(root));
  } else if (root.nodeType === Node.ELEMENT_NODE && !shouldSkipElement(root)) {
    collectElementJobs(root, jobs);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE && shouldSkipElement(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) jobs.push(translateTextNode(node));
      else collectElementJobs(node, jobs);
    }
  }

  await Promise.allSettled(jobs);
}

function collectElementJobs(element, jobs) {
  for (const name of TRANSLATABLE_ATTRIBUTES) jobs.push(translateAttribute(element, name));
}

async function translateTextNode(node) {
  const parent = node.parentElement;
  if (!parent || shouldSkipElement(parent)) return;

  const current = node.nodeValue || "";
  const remembered = originalText.get(node);
  const source = remembered || current;
  if (!source.trim() || !KOREAN_PATTERN.test(source)) {
    clearTextSkeleton(node);
    return;
  }
  if (!remembered) originalText.set(node, source);

  const local = translatePreservingWhitespaceImmediately(source, activeLanguage);
  if (local) {
    if (node.nodeValue !== local) writeTextNode(node, local);
    clearTextSkeleton(node);
    return;
  }

  const requestGeneration = languageGeneration;
  ensureTextSkeleton(node, source, requestGeneration);

  try {
    const translated = await translatePreservingWhitespace(source);
    if (requestGeneration !== languageGeneration || !node.isConnected) return;
    if (translated && node.nodeValue !== translated) writeTextNode(node, translated);
  } finally {
    clearTextSkeleton(node, requestGeneration);
  }
}

async function translateAttribute(element, name) {
  if (!element?.hasAttribute?.(name)) return;
  const current = element.getAttribute(name) || "";
  const map = originalAttributes.get(element) || {};
  const source = map[name] || current;
  if (!KOREAN_PATTERN.test(source)) return;

  if (!map[name]) {
    map[name] = source;
    originalAttributes.set(element, map);
  }

  const requestGeneration = languageGeneration;
  const translated = await translateValue(source);
  if (requestGeneration !== languageGeneration || !element.isConnected) return;
  if (translated && translated !== element.getAttribute(name)) element.setAttribute(name, translated);
}

function rememberAttribute(element, name) {
  const value = element?.getAttribute?.(name);
  if (!value || !KOREAN_PATTERN.test(value)) return;
  const map = originalAttributes.get(element) || {};
  map[name] = value;
  originalAttributes.set(element, map);
}

function translatePreservingWhitespaceImmediately(source, language) {
  if (!source || language === "ko") return source;
  const leading = source.match(/^\s*/)?.[0] || "";
  const trailing = source.match(/\s*$/)?.[0] || "";
  const core = source.trim().replace(/\s+/g, " ");
  const translated = lookupLocalTranslation(core, language);
  return translated && translated !== core ? `${leading}${translated}${trailing}` : "";
}

function prepareSkeletons(root) {
  if (!root || activeLanguage === "ko") return;

  if (root.nodeType === Node.TEXT_NODE) {
    prepareTextNodeSkeleton(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE || shouldSkipElement(root)) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement && !shouldSkipElement(node.parentElement)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  let node;
  while ((node = walker.nextNode())) prepareTextNodeSkeleton(node);
}

function prepareTextNodeSkeleton(node) {
  const existing = skeletonTextNodes.get(node);
  if (existing?.generation === languageGeneration) return;
  const source = originalText.get(node) || node.nodeValue || "";
  if (!source.trim() || !KOREAN_PATTERN.test(source)) return;
  if (translatePreservingWhitespaceImmediately(source, activeLanguage)) return;
  ensureTextSkeleton(node, source, languageGeneration);
}

function ensureTextSkeleton(node, source, generation = languageGeneration) {
  if (!node?.parentElement) return;

  const existing = skeletonTextNodes.get(node);
  if (existing?.generation === generation) return;
  if (existing) existing.placeholder.remove();

  const coreLength = Math.max(3, Math.min(28, source.trim().length));
  const placeholder = document.createElement("span");
  placeholder.className = "i18n-skeleton";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.setAttribute("data-i18n-ignore", "");
  placeholder.style.setProperty("--i18n-skeleton-width", `${Math.max(3.5, coreLength * 0.62)}em`);

  skeletonTextNodes.set(node, { placeholder, generation });
  node.parentNode.insertBefore(placeholder, node);
  writeTextNode(node, "");
}

function clearTextSkeleton(node, generation = null) {
  const entry = skeletonTextNodes.get(node);
  if (!entry || (generation !== null && entry.generation !== generation)) return;
  skeletonTextNodes.delete(node);
  entry.placeholder.remove();
}

async function translatePreservingWhitespace(source) {
  const leading = source.match(/^\s*/)?.[0] || "";
  const trailing = source.match(/\s*$/)?.[0] || "";
  const core = source.trim().replace(/\s+/g, " ");
  return `${leading}${await translateValue(core)}${trailing}`;
}

async function translateValue(source) {
  if (!source || activeLanguage === "ko") return source;

  const local = lookupLocalTranslation(source, activeLanguage);
  if (local && local !== source) return local;

  const cached = readCache(activeLanguage, source);
  if (cached) return cached;

  const key = `${activeLanguage}\u0000${source}`;
  if (translationPromises.has(key)) return translationPromises.get(key);

  const promise = translateWithAvailableEngine(source, activeLanguage)
    .then((translated) => {
      const result = translated?.trim() ? translated : fallbackTranslation(source, activeLanguage);
      if (result && result !== source) writeCache(activeLanguage, source, result);
      return result;
    })
    .catch(() => fallbackTranslation(source, activeLanguage))
    .finally(() => translationPromises.delete(key));

  translationPromises.set(key, promise);
  return promise;
}

function lookupLocalTranslation(source, language) {
  if (language === "ko") return source;
  return COMMON_TRANSLATIONS[language]?.[source]
    || GAME_TRANSLATIONS[language]?.[source]
    || (language === "en" ? COMMON_TRANSLATIONS.en?.[source] || GAME_TRANSLATIONS.en?.[source] : "")
    || "";
}

async function translateWithAvailableEngine(source, targetLanguage) {
  const browserResult = await translateWithBrowser(source, targetLanguage).catch(() => "");
  if (browserResult?.trim()) return browserResult;
  return enqueueNetworkTranslation(source, targetLanguage);
}

function enqueueNetworkTranslation(source, targetLanguage) {
  return new Promise((resolve) => {
    networkQueue.push({ source, targetLanguage, resolve });
    drainNetworkQueue();
  });
}

function drainNetworkQueue() {
  while (activeNetworkJobs < MAX_NETWORK_JOBS && networkQueue.length) {
    const job = networkQueue.shift();
    activeNetworkJobs += 1;
    translateWithNetwork(job.source, job.targetLanguage)
      .then(job.resolve, () => job.resolve(""))
      .finally(() => {
        activeNetworkJobs -= 1;
        drainNetworkQueue();
      });
  }
}

async function translateWithNetwork(source, targetLanguage) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6500);
  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "ko");
    url.searchParams.set("tl", targetLanguage === "zh" ? "zh-CN" : targetLanguage);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", source);

    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) return "";
    const payload = await response.json();
    return Array.isArray(payload?.[0])
      ? payload[0].map((part) => part?.[0] || "").join("")
      : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

async function translateWithBrowser(source, targetLanguage) {
  if (!("Translator" in globalThis)) return "";
  const target = targetLanguage === "zh" ? "zh" : targetLanguage;
  const pairKey = `ko:${target}`;

  if (!translatorPromises.has(pairKey)) {
    translatorPromises.set(pairKey, createBrowserTranslator(target).catch(() => null));
  }

  const translator = await translatorPromises.get(pairKey);
  if (!translator) return "";
  return translator.translate(source);
}

async function createBrowserTranslator(targetLanguage) {
  const options = { sourceLanguage: "ko", targetLanguage };
  if (typeof globalThis.Translator.availability === "function") {
    const availability = await globalThis.Translator.availability(options);
    if (availability === "unavailable") return null;
  }
  return globalThis.Translator.create(options);
}

function fallbackTranslation(source, language) {
  // 내장 번역기를 지원하지 않는 브라우저에서도 이미 등록된 게임 문구는 로컬 사전을 사용합니다.
  // 미등록 동적 문구는 영어 사전을 마지막 안전장치로 사용하되, 한국어 원문을 덮어써 의미를 숨기지 않습니다.
  return lookupLocalTranslation(source, language)
    || lookupLocalTranslation(source, "en")
    || source;
}

function cacheKey(language) { return `${CACHE_PREFIX}${language}`; }
function readCache(language, source) {
  try { return JSON.parse(localStorage.getItem(cacheKey(language)) || "{}")[source] || ""; }
  catch { return ""; }
}
function writeCache(language, source, translated) {
  try {
    const key = cacheKey(language);
    const cache = JSON.parse(localStorage.getItem(key) || "{}");
    cache[source] = translated;
    const entries = Object.entries(cache);
    localStorage.setItem(key, JSON.stringify(entries.length > 1200 ? Object.fromEntries(entries.slice(-1200)) : cache));
  } catch { /* 저장 실패는 게임 진행에 영향을 주지 않습니다. */ }
}

function restoreKnownOriginals(root) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE && originalText.has(root)) {
    const source = originalText.get(root);
    if (root.nodeValue !== source) writeTextNode(root, source);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  restoreElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE && originalText.has(node)) {
      const source = originalText.get(node);
      if (node.nodeValue !== source) writeTextNode(node, source);
    } else if (node.nodeType === Node.ELEMENT_NODE) restoreElement(node);
  }
}

function restoreElement(element) {
  const attrs = originalAttributes.get(element);
  if (!attrs) return;
  for (const [name, value] of Object.entries(attrs)) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }
}


function installSkeletonStyle() {
  if (document.getElementById(SKELETON_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SKELETON_STYLE_ID;
  style.textContent = `
    .i18n-skeleton {
      display: inline-block;
      width: min(var(--i18n-skeleton-width, 8em), 88%);
      min-width: 3.5em;
      height: 0.92em;
      border-radius: 999px;
      vertical-align: -0.08em;
      background: linear-gradient(100deg,
        rgba(148, 163, 184, 0.20) 20%,
        rgba(255, 255, 255, 0.68) 42%,
        rgba(148, 163, 184, 0.20) 64%);
      background-size: 220% 100%;
      animation: i18n-skeleton-shimmer 1.15s ease-in-out infinite;
      pointer-events: none;
    }

    html[data-theme="dark"] .i18n-skeleton {
      background: linear-gradient(100deg,
        rgba(100, 116, 139, 0.24) 20%,
        rgba(226, 232, 240, 0.20) 42%,
        rgba(100, 116, 139, 0.24) 64%);
      background-size: 220% 100%;
    }

    @keyframes i18n-skeleton-shimmer {
      from { background-position: 110% 0; }
      to { background-position: -110% 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .i18n-skeleton { animation: none; }
    }
  `;
  document.head.appendChild(style);
}

function writeTextNode(node, value) {
  if (!node || node.nodeValue === value) return;
  internalTextWriteCounts.set(node, (internalTextWriteCounts.get(node) || 0) + 1);
  node.nodeValue = value;
}

function consumeInternalTextWrite(node) {
  const count = internalTextWriteCounts.get(node) || 0;
  if (count <= 0) return false;
  if (count === 1) internalTextWriteCounts.delete(node);
  else internalTextWriteCounts.set(node, count - 1);
  return true;
}

function shouldSkipElement(element) { return element.matches?.(SKIP_SELECTOR); }
