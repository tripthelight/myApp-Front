const view = document.querySelector("#appView");
const PAGE_STYLE_ID = "page-scoped-style";

export function renderView(html, pageStyle = null) {
  removePageStyle();
  view.innerHTML = html;

  if (pageStyle) {
    applyPageStyle(pageStyle);
  }
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