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

export async function startApp() {
  bindLayoutEvents();

  if (window.location.pathname === "/cookie") {
    await renderSocialCallbackPage();
    return;
  }

  if (window.location.pathname === "/payment-success") {
    if (getAccessToken() || getRefreshToken()) {
      await restoreSession();
    }

    updateHeader();
    await renderPaymentPage("결제가 완료되었습니다. 웹훅 반영까지 잠시 걸릴 수 있습니다.");
    return;
  }

  if (window.location.pathname === "/payment-cancel") {
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
  await navigate("home");
}

export async function navigate(route) {
  const targetRoute = routes[route] ? route : "home";

  if ((targetRoute === "profile" || targetRoute === "board" || targetRoute === "payments") && !appState.loginUser) {
    await renderAuthPage("로그인 후 이용할 수 있습니다.");
    updateHeader();
    return;
  }

  await routes[targetRoute]();
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
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate(button.dataset.route);
    });
  });

  $("#headerLogoutButton").addEventListener("click", async () => {
    await logoutSession();
    await navigate("home");
  });
}
