import { appState } from "./state.js";
import { protectedRoutes } from "./routes.js";

export function resolveRouteForSession(route) {
  if (route === "auth" && appState.loginUser) {
    return "home";
  }

  if (protectedRoutes.has(route) && !appState.loginUser) {
    return "auth";
  }

  return route;
}
