const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setAccessToken(accessToken) {
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
}

export function setRefreshToken(refreshToken) {
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function setTokens(tokensOrAccessToken, maybeRefreshToken) {
  const accessToken =
    typeof tokensOrAccessToken === "object"
      ? tokensOrAccessToken?.accessToken
      : tokensOrAccessToken;

  const refreshToken =
    typeof tokensOrAccessToken === "object"
      ? tokensOrAccessToken?.refreshToken
      : maybeRefreshToken;

  setAccessToken(accessToken);
  setRefreshToken(refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function removeTokens() {
  clearTokens();
}

export function saveAccessToken(accessToken) {
  setAccessToken(accessToken);
}

export function saveTokens(tokensOrAccessToken, maybeRefreshToken) {
  setTokens(tokensOrAccessToken, maybeRefreshToken);
}
