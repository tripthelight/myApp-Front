import { translateElementBeforeReveal } from "../i18n/i18n.js";
const view = document.querySelector("#appView");
const PAGE_STYLE_ID = "page-scoped-style";

export function renderView(html, pageStyle = null) {
  removePageStyle();

  view.innerHTML = html;

  if (pageStyle) {
    applyPageStyle(pageStyle);
  }

  // 전체 화면을 숨기지 않고, 비동기 번역이 필요한 텍스트만 Skeleton으로 표시합니다.
  void translateElementBeforeReveal(view);
}

function applyPageStyle(cssText) {
  const style = document.createElement("style");
  style.id = PAGE_STYLE_ID;
  style.textContent = cssText;
  document.head.appendChild(style);
}

function removePageStyle() {
  document.querySelector(`#${PAGE_STYLE_ID}`)?.remove();
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $all(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

export function setMessage(element, message, type = "normal") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = `message message-${type}`;
}