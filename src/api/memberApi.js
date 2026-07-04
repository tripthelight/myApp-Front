import {
  saveTokens,
  saveAccessToken,
  getRefreshToken,
  removeTokens,
} from "../auth/tokenStorage.js";
import { authFetch } from "../auth/authFetch.js";

const MEMBER_API_BASE_URL = "/member";

async function handleJsonResponse(response) {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP Error: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function loginMember({ username, password }) {
  const response = await fetch(`${MEMBER_API_BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const tokenResponse = await handleJsonResponse(response);

  saveTokens(tokenResponse.accessToken, tokenResponse.refreshToken);

  return tokenResponse;
}

export async function existsMember({ username }) {
  const response = await fetch(`${MEMBER_API_BASE_URL}/user/exist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
    }),
  });

  return handleJsonResponse(response);
}

export async function joinMember({ username, password, nickname, email }) {
  const response = await fetch(`${MEMBER_API_BASE_URL}/user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
      nickname,
      email,
    }),
  });

  return handleJsonResponse(response);
}

export async function getMyInfo() {
  const response = await authFetch(`${MEMBER_API_BASE_URL}/user`, {
    method: "GET",
  });

  return handleJsonResponse(response);
}

export async function updateMyInfo({ username, nickname, email }) {
  const response = await authFetch(`${MEMBER_API_BASE_URL}/user`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      nickname,
      email,
    }),
  });

  return handleJsonResponse(response);
}

export async function deleteMyAccount({ username }) {
  const response = await authFetch(`${MEMBER_API_BASE_URL}/user`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
    }),
  });

  const result = await handleJsonResponse(response);
  removeTokens();

  return result;
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error("Refresh token does not exist.");
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

  const tokenResponse = await handleJsonResponse(response);

  saveAccessToken(tokenResponse.accessToken);

  return tokenResponse.accessToken;
}

export async function logoutMember({ refreshToken }) {
  const response = await fetch(`${MEMBER_API_BASE_URL}/jwt/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refreshToken,
    }),
  });

  await handleJsonResponse(response);

  removeTokens();
}

export async function exchangeSocialLoginToken() {
  const response = await fetch(`${MEMBER_API_BASE_URL}/jwt/exchange`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const tokenResponse = await handleJsonResponse(response);

  saveTokens(tokenResponse.accessToken, tokenResponse.refreshToken);

  return tokenResponse;
}
