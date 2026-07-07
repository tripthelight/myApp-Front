import { pathForRoute } from "./routes.js";

export function writeHistory(route, { replace = false } = {}) {
  if (replace) {
    replaceHistory(route);
    return;
  }

  const path = pathForRoute(route);

  if (window.location.pathname === path && window.history.state?.route === route) {
    return;
  }

  window.history.pushState({ route }, "", path);
}

export function replaceHistory(route) {
  const path = pathForRoute(route);
  window.history.replaceState({ route }, "", path);
}