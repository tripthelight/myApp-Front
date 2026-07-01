import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  clearTokens,
} from "./tokenStorage.js";

const MEMBER_API_BASE_URL = "/member";

function isJwtLike(token) {
  if (!token) {
    return false;
  }

  return token.split(".").length === 3;
}

function decodeJwtPayload(token) {
  const payloadBase64Url = token.split(".")[1];

  const payloadBase64 = payloadBase64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const paddedPayloadBase64 = payloadBase64.padEnd(
    payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4),
    "="
  );

  const payloadJson = atob(paddedPayloadBase64);

  return JSON.parse(payloadJson);
}

function isJwtExpired(token) {
  if (!isJwtLike(token)) {
    return true;
  }

  try {
    const payload = decodeJwtPayload(token);

    if (!payload.exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);

    return payload.exp <= now;
  } catch (error) {
    return true;
  }
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error("No refresh token");
  }

  const response = await fetch(`${MEMBER_API_BASE_URL}/jwt/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error("Refresh token failed");
  }

  const data = await response.json();

  if (!data.accessToken) {
    throw new Error("Access token does not exist in refresh response");
  }

  setAccessToken(data.accessToken);

  return data.accessToken;
}

function forceLogout() {
  clearTokens();
  window.location.reload();
}

async function getValidAccessToken() {
  const accessToken = getAccessToken();

  if (!accessToken || isJwtExpired(accessToken)) {
    return refreshAccessToken();
  }

  return accessToken;
}

function createAuthHeaders(originalHeaders, accessToken) {
  const headers = new Headers(originalHeaders || {});

  headers.set("Authorization", `Bearer ${accessToken}`);

  return headers;
}

export async function authFetch(url, options = {}) {
  try {
    const accessToken = await getValidAccessToken();

    const firstRequestOptions = {
      ...options,
      headers: createAuthHeaders(options.headers, accessToken),
    };

    const firstResponse = await fetch(url, firstRequestOptions);

    if (firstResponse.status !== 401) {
      return firstResponse;
    }

    const newAccessToken = await refreshAccessToken();

    const retryRequestOptions = {
      ...options,
      headers: createAuthHeaders(options.headers, newAccessToken),
    };

    const retryResponse = await fetch(url, retryRequestOptions);

    if (retryResponse.status === 401) {
      forceLogout();
      throw new Error("Unauthorized after access token refresh");
    }

    return retryResponse;
  } catch (error) {
    forceLogout();
    throw error;
  }
}
