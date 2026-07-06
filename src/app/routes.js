import { renderHomePage } from "../pages/home/homePage.js";
import { renderAuthPage } from "../pages/auth/authPage.js";
import { renderProfilePage } from "../pages/member/profilePage.js";
import { renderBoardPage } from "../pages/board/boardPage.js";
import { renderPaymentPage } from "../pages/payments/paymentPage.js";

export const routes = {
  home: renderHomePage,
  auth: renderAuthPage,
  profile: renderProfilePage,
  board: renderBoardPage,
  payments: renderPaymentPage,
};

export const routePaths = {
  home: "/",
  auth: "/auth",
  profile: "/profile",
  board: "/board",
  payments: "/payments",
};

export const protectedRoutes = new Set(["profile", "board", "payments"]);

export function normalizeRoute(route) {
  return routes[route] ? route : "home";
}

export function routeFromPath(pathname) {
  return Object.entries(routePaths)
    .find(([, path]) => path === pathname)?.[0] || "home";
}
