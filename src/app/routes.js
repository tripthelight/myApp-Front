const staticPageLoaders = {
  home: () => import("../pages/main/mainPage.js").then((module) => module.renderMainPage),
  main: () => import("../pages/main/mainPage.js").then((module) => module.renderMainPage),
  auth: () => import("../pages/auth/authPage.js").then((module) => module.renderAuthPage),
  profile: () => import("../pages/member/profilePage.js").then((module) => module.renderProfilePage),
  board: () => import("../pages/board/boardPage.js").then((module) => module.renderBoardPage),
  payments: () => import("../pages/payments/paymentPage.js").then((module) => module.renderPaymentPage),
  socialCallback: () => import("../pages/social/socialCallbackPage.js").then((module) => module.renderSocialCallbackPage),
};

const gamePageModules = import.meta.glob("../pages/game/lv*/lv*Page.js");

const staticRoutePaths = {
  home: "/",
  main: "/",
  auth: "/auth",
  profile: "/profile",
  board: "/board",
  payments: "/payments",
};

export const protectedRoutes = new Set(["profile", "board", "payments"]);

export function normalizeRoute(route) {
  return hasRoute(route) ? route : "home";
}

export function routeFromPath(pathname) {
  if (pathname === "/") {
    return "home";
  }

  const staticRoute = Object.entries(staticRoutePaths)
    .find(([, path]) => path === pathname)?.[0];

  if (staticRoute) {
    return staticRoute;
  }

  const gameRoute = pathname.replace("/", "");

  if (isGameRoute(gameRoute) && hasGamePage(gameRoute)) {
    return gameRoute;
  }

  return "home";
}

export function pathForRoute(route) {
  if (staticRoutePaths[route]) {
    return staticRoutePaths[route];
  }

  if (isGameRoute(route)) {
    return `/${route}`;
  }

  return staticRoutePaths.home;
}

export async function renderRoutePage(route, ...args) {
  const normalizedRoute = normalizeRoute(route);

  if (staticPageLoaders[normalizedRoute]) {
    const renderPage = await staticPageLoaders[normalizedRoute]();
    return renderPage(...args);
  }

  if (isGameRoute(normalizedRoute)) {
    const module = await loadGamePageModule(normalizedRoute);

    if (typeof module.renderPage !== "function") {
      throw new Error(`${normalizedRoute}Page.js must export renderPage().`);
    }

    return module.renderPage(...args);
  }

  const renderHomePage = await staticPageLoaders.home();
  return renderHomePage(...args);
}

function hasRoute(route) {
  return Boolean(staticPageLoaders[route]) || hasGamePage(route);
}

export function isGameRoute(route) {
  return /^lv[1-9][0-9]*$/.test(route);
}

function hasGamePage(route) {
  return Boolean(gamePageModules[gameModulePath(route)]);
}

async function loadGamePageModule(route) {
  const loader = gamePageModules[gameModulePath(route)];

  if (!loader) {
    throw new Error(`Game page not found: ${route}`);
  }

  return loader();
}

function gameModulePath(route) {
  return `../pages/game/${route}/${route}Page.js`;
}