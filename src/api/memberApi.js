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

function parseJwtPayload(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');

  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );

    const json = atob(paddedBase64);
    const decodedJson = decodeURIComponent(
      Array.from(json)
        .map((char) => {
          return `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`;
        })
        .join(''),
    );

    return JSON.parse(decodedJson);
  } catch (error) {
    return null;
  }
}

function shouldRefreshBeforeFetchUser(accessToken) {
  const payload = parseJwtPayload(accessToken);

  if (!payload) {
    return true;
  }

  if (payload.category !== 'access') {
    return true;
  }

  if (!payload.exp) {
    return true;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const refreshBufferSeconds = 10;

  return payload.exp <= nowSeconds + refreshBufferSeconds;
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
    },
    body: JSON.stringify({
      refreshToken,
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
  const accessToken = getAccessToken();

  if (!accessToken) {
    clearTokens();
    throw new Error('accessToken 없음');
  }

  try {
    if (shouldRefreshBeforeFetchUser(accessToken)) {
      await refreshAccessToken();
    }

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
    },
    body: JSON.stringify({
      refreshToken,
    }),
  });

  await parseResponseBody(response);

  clearTokens();

  if (!response.ok && response.status !== 204) {
    throw new Error(`로그아웃 실패: ${response.status}`);
  }
}
