import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  saveAccessToken,
  clearTokens,
} from '../auth/tokenStorage.js';

const MEMBER_API_BASE_URL = '/member';

async function parseResponseBody(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

export async function loginMember(username, password) {
  const response = await fetch(`${MEMBER_API_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(`로그인 실패: ${response.status}`);
  }

  if (!data || !data.accessToken || !data.refreshToken) {
    throw new Error('로그인 응답에 accessToken 또는 refreshToken 없음');
  }

  saveTokens(data.accessToken, data.refreshToken);

  return data;
}

export async function fetchMemberUser() {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error('accessToken 없음');
  }

  const response = await fetch(`${MEMBER_API_BASE_URL}/user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(`내 정보 조회 실패: ${response.status}`);
  }

  return data;
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error('refreshToken 없음');
  }

  const response = await fetch(`${MEMBER_API_BASE_URL}/jwt/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      refresh: refreshToken,
    },
    body: JSON.stringify({
      refreshToken: refreshToken,
      refresh: refreshToken,
    }),
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(`accessToken 재발급 실패: ${response.status}`);
  }

  if (!data || !data.accessToken) {
    throw new Error('재발급 응답에 accessToken 없음');
  }

  if (data.refreshToken) {
    saveTokens(data.accessToken, data.refreshToken);
  } else {
    saveAccessToken(data.accessToken);
  }

  return data.accessToken;
}

export async function fetchMemberUserWithAutoRefresh() {
  try {
    return await fetchMemberUser();
  } catch (accessError) {
    try {
      await refreshAccessToken();

      return await fetchMemberUser();
    } catch (refreshError) {
      clearTokens();

      throw refreshError;
    }
  }
}

export async function logoutMember() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    clearTokens();
    return;
  }

  const response = await fetch(`${MEMBER_API_BASE_URL}/jwt/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      refresh: refreshToken,
    },
    body: JSON.stringify({
      refreshToken: refreshToken,
      refresh: refreshToken,
    }),
  });

  await parseResponseBody(response);

  clearTokens();

  if (!response.ok && response.status !== 204) {
    throw new Error(`로그아웃 실패: ${response.status}`);
  }
}
