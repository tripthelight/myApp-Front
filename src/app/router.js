import { getAccessToken, getRefreshToken } from "../auth/tokenStorage.js";
import { $ } from "../shared/dom.js";
import { appState, currentUsername } from "./state.js";
import { restoreSession, logoutSession } from "./session.js";
import { normalizeRoute, routeFromPath, renderRoutePage, isGameRoute } from "./routes.js";
import { resolveRouteForSession } from "./routeGuard.js";
import { replaceHistory, writeHistory } from "./browserHistory.js";

export async function startApp() {
  bindLayoutEvents();

  if (window.location.pathname === "/cookie") {
    await renderRoutePage("socialCallback");
    return;
  }

  if (window.location.pathname === "/payment-success") {
    replaceHistory("payments");

    if (getAccessToken() || getRefreshToken()) {
      await restoreSession();
    }

    updateHeader();
    await renderRoutePage("payments", "결제가 완료되었습니다. 웹훅 반영까지 잠시 걸릴 수 있습니다.");
    return;
  }

  if (window.location.pathname === "/payment-cancel") {
    replaceHistory("payments");

    if (getAccessToken() || getRefreshToken()) {
      await restoreSession();
    }

    updateHeader();
    await renderRoutePage("payments", "결제가 취소되었습니다.");
    return;
  }

  if (getAccessToken() || getRefreshToken()) {
    await restoreSession();
  }

  updateHeader();
  await renderCurrentRoute({ replace: true });
}

export async function navigate(route, options = {}) {
  const currentRoute = routeFromPath(window.location.pathname);
  const targetRoute = normalizeRoute(route);
  const resolvedRoute = resolveRouteForSession(targetRoute);
  const shouldReplace = Boolean(options.replace) || (isGameRoute(currentRoute) && isGameRoute(resolvedRoute));

  writeHistory(resolvedRoute, { ...options, replace: shouldReplace });
  await renderRoute(resolvedRoute, targetRoute);
}

export async function renderCurrentRoute(options = {}) {
  const route = routeFromPath(window.location.pathname);

  if (options.fromPopState && isGameRoute(route)) {
    replaceHistory("home");
    await renderRoute("home", route);
    return;
  }

  const resolvedRoute = resolveRouteForSession(route);

  if (resolvedRoute !== route || options.replace) {
    replaceHistory(resolvedRoute);
  }

  await renderRoute(resolvedRoute, route);
}

async function renderRoute(route, requestedRoute = route) {
  if (route === "auth" && requestedRoute !== "auth") {
    await renderRoutePage("auth", "로그인 후 이용할 수 있습니다.");
    updateHeader();
    return;
  }

  await renderRoutePage(route);
  updateHeader();
}

export function updateHeader() {
  const headerUserText = $("#headerUserText");
  const logoutButton = $("#headerLogoutButton");

  if (!headerUserText || !logoutButton) {
    return;
  }

  if (appState.loginUser) {
    headerUserText.innerHTML = `로그인 사용자: <strong>${currentUsername()}</strong>`;
    logoutButton.hidden = false;
  } else {
    headerUserText.textContent = "로그인 전입니다.";
    logoutButton.hidden = true;
  }
}

function bindLayoutEvents() {
  window.addEventListener("popstate", async () => {
    await renderCurrentRoute({ replace: false, fromPopState: true });
  });

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate(button.dataset.route);
    });
  });

  const headerLogoutButton = $("#headerLogoutButton");
  if (!headerLogoutButton) {
    return;
  }

  $("#headerLogoutButton").addEventListener("click", async () => {
    await logoutSession();
    await navigate("home", { replace: true });
  });
}