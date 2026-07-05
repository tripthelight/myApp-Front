import { getAccessToken } from "../auth/tokenStorage.js";

export const appState = {
  loginUser: null,
  selectedBoardId: null,
};

export function setLoginUser(user) {
  appState.loginUser = user;
}

export function clearLoginUser() {
  appState.loginUser = null;
}

export function setSelectedBoardId(id) {
  appState.selectedBoardId = id;
}

export function clearSelectedBoardId() {
  appState.selectedBoardId = null;
}

export function currentUsername() {
  return String(
    appState.loginUser?.username ||
      appState.loginUser?.name ||
      appState.loginUser?.email ||
      appState.loginUser?.id ||
      "사용자"
  );
}

export function isLoginUserAdmin() {
  const role = String(
    appState.loginUser?.role ||
      appState.loginUser?.roleType ||
      appState.loginUser?.authority ||
      decodeAccessTokenPayload()?.role ||
      ""
  ).toUpperCase();

  return role === "ADMIN" || role === "ROLE_ADMIN";
}

export function canManageBoard(board) {
  if (isLoginUserAdmin()) {
    return true;
  }

  return String(board?.writer ?? "") === currentUsername();
}

function decodeAccessTokenPayload() {
  const accessToken = getAccessToken();

  if (!accessToken || accessToken.split(".").length !== 3) {
    return null;
  }

  try {
    const payloadBase64Url = accessToken.split(".")[1];
    const payloadBase64 = payloadBase64Url
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const paddedPayloadBase64 = payloadBase64.padEnd(
      payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4),
      "="
    );

    return JSON.parse(atob(paddedPayloadBase64));
  } catch (error) {
    return null;
  }
}
