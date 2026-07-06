import { routePaths } from "./routes.js";

export function writeHistory(route, { replace = false } = {}) {
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

export function replaceHistory(route) {
  const path = routePaths[route] || routePaths.home;
  window.history.replaceState({ route }, "", path);
}
