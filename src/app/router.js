import { getAccessToken, getRefreshToken } from "../auth/tokenStorage.js";
import { $ } from "../shared/dom.js";
import { appState, currentUsername } from "./state.js";
import { restoreSession, logoutSession } from "./session.js";
import { renderHomePage } from "../pages/home/homePage.js";
import { renderAuthPage } from "../pages/auth/authPage.js";
import { renderProfilePage } from "../pages/member/profilePage.js";
import { renderBoardPage } from "../pages/board/boardPage.js";
import { renderPaymentPage } from "../pages/payments/paymentPage.js";
import { renderSocialCallbackPage } from "../pages/social/socialCallbackPage.js";

const routes = {
  home: renderHomePage,
  auth: renderAuthPage,
  profile: renderProfilePage,
  board: renderBoardPage,
  payments: renderPaymentPage,
};

const routePaths = {
  home: "/",
  auth: "/auth",
  profile: "/profile",
  board: "/board",
  payments: "/payments",
};

const protectedRoutes = new Set(["profile", "board", "payments"]);

export async function startApp() {
  bindLayoutEvents();

  if (window.location.pathname === "/cookie") {
    await renderSocialCallbackPage();
    return;
  }

  if (window.location.pathname === "/payment-success") {
    replaceHistory("payments");

    if (getAccessToken() || getRefreshToken()) {
      await restoreSession();
    }

    updateHeader();
    await renderPaymentPage("결제가 완료되었습니다. 웹훅 반영까지 잠시 걸릴 수 있습니다.");
    return;
  }

  if (window.location.pathname === "/payment-cancel") {
    replaceHistory("payments");

    if (getAccessToken() || getRefreshToken()) {
      await restoreSession();
    }

    updateHeader();
    await renderPaymentPage("결제가 취소되었습니다.");
    return;
  }

  if (getAccessToken() || getRefreshToken()) {
    await restoreSession();
  }

  updateHeader();
  await renderCurrentRoute({ replace: true });
}

export async function navigate(route, options = {}) {
  const targetRoute = routes[route] ? route : "home";
  const resolvedRoute = resolveRouteForSession(targetRoute);

  writeHistory(resolvedRoute, options);
  await renderRoute(resolvedRoute, targetRoute);
}

export async function renderCurrentRoute(options = {}) {
  const route = routeFromPath(window.location.pathname);
  const resolvedRoute = resolveRouteForSession(route);

  if (resolvedRoute !== route || options.replace) {
    replaceHistory(resolvedRoute);
  }

  await renderRoute(resolvedRoute, route);
}

async function renderRoute(route, requestedRoute = route) {
  if (route === "auth" && requestedRoute !== "auth") {
    await renderAuthPage("로그인 후 이용할 수 있습니다.");
    updateHeader();
    return;
  }

  await routes[route]();
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
    await renderCurrentRoute({ replace: false });
  });

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate(button.dataset.route);
    });
  });

  $("#headerLogoutButton").addEventListener("click", async () => {
    await logoutSession();
    await navigate("home", { replace: true });
  });
}

function routeFromPath(pathname) {
  return Object.entries(routePaths)
    .find(([, path]) => path === pathname)?.[0] || "home";
}

function resolveRouteForSession(route) {
  if (route === "auth" && appState.loginUser) {
    return "home";
  }

  if (protectedRoutes.has(route) && !appState.loginUser) {
    return "auth";
  }

  return route;
}

function writeHistory(route, { replace = false } = {}) {
  if (replace) {
    replaceHistory(route);
    return;
  }

  const path = routePaths[route] || routePaths.home;

  if (window.location.pathname === path && window.history.state?.route === route) {
    return;
  }

  window.history.pushState({ route }, "", path);
}

function replaceHistory(route) {
  const path = routePaths[route] || routePaths.home;
  window.history.replaceState({ route }, "", path);
}