const view = document.querySelector("#appView");

export function renderView(html) {
  view.innerHTML = html;
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
