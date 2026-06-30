import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '../auth/tokenStorage.js';

const API_BASE_URL = '';

function removeBearerPrefix(token) {
  if (!token) {
    return null;
  }

  return token.replace(/^Bearer\s+/i, '');
}

export async function readResponseSafely(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('JSON 파싱 실패. 원본 응답:', text);
    return text;
  }
}

function extractTokens(response, data = {}) {
  const accessToken =
    data.accessToken ||
    data.access ||
    data.data?.accessToken ||
    data.data?.access ||
    response.headers.get('accessToken') ||
    response.headers.get('access-token') ||
    response.headers.get('access') ||
    response.headers.get('Authorization') ||
    response.headers.get('authorization');

  const refreshToken =
    data.refreshToken ||
    data.refresh ||
    data.data?.refreshToken ||
    data.data?.refresh ||
    response.headers.get('refreshToken') ||
    response.headers.get('refresh-token') ||
    response.headers.get('refresh') ||
    response.headers.get('Authorization-Refresh') ||
    response.headers.get('authorization-refresh');

  return {
    accessToken: removeBearerPrefix(accessToken),
    refreshToken: removeBearerPrefix(refreshToken),
  };
}

export async function login(username, password) {
  const response = await fetch('/member/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const data = await readResponseSafely(response);

  console.log('login status:', response.status);
  console.log('login body:', data);
  console.log('login access header:', response.headers.get('access'));
  console.log('login refresh header:', response.headers.get('refresh'));
  console.log('login authorization header:', response.headers.get('Authorization'));

  if (!response.ok) {
    throw new Error(`로그인 실패: ${response.status}`);
  }

  const { accessToken, refreshToken } = extractTokens(response, data);

  console.log('추출된 accessToken:', accessToken);
  console.log('추출된 refreshToken:', refreshToken);

  if (!accessToken || !refreshToken) {
    throw new Error('로그인 응답에서 accessToken 또는 refreshToken을 찾지 못했습니다.');
  }

  saveTokens(accessToken, refreshToken);

  return data;
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error('refreshToken이 없습니다.');
  }

  const response = await fetch('/member/jwt/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${refreshToken}`,
      refresh: refreshToken,
    },
    body: JSON.stringify({
      refreshToken,
    }),
  });

  const data = await readResponseSafely(response);

  console.log('refresh status:', response.status);
  console.log('refresh body:', data);
  console.log('refresh access header:', response.headers.get('access'));
  console.log('refresh refresh header:', response.headers.get('refresh'));
  console.log('refresh authorization header:', response.headers.get('Authorization'));

  if (!response.ok) {
    throw new Error(`refresh 실패: ${response.status}`);
  }

  const tokens = extractTokens(response, data);

  const newAccessToken = tokens.accessToken;
  const newRefreshToken = tokens.refreshToken || refreshToken;

  console.log('재발급 accessToken:', newAccessToken);
  console.log('재발급 refreshToken:', newRefreshToken);

  if (!newAccessToken) {
    throw new Error('refresh 응답에서 새 accessToken을 찾지 못했습니다.');
  }

  saveTokens(newAccessToken, newRefreshToken);

  return newAccessToken;
}

export async function apiFetch(url, options = {}, retry = true) {
  const accessToken = getAccessToken();

  const headers = {
    ...(options.headers || {}),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (response.status !== 401 || !retry) {
    return response;
  }

  try {
    const newAccessToken = await refreshAccessToken();

    const retryHeaders = {
      ...(options.headers || {}),
      Authorization: `Bearer ${newAccessToken}`,
    };

    return await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: retryHeaders,
    });
  } catch (error) {
    console.error('토큰 재발급 실패:', error);

    clearTokens();

    alert('로그인이 만료되었습니다. 다시 로그인해주세요.');

    throw error;
  }
}

export async function getMyInfo() {
  const response = await apiFetch('/member/user', {
    method: 'GET',
  });

  const data = await readResponseSafely(response);

  return {
    status: response.status,
    response: data,
  };
}

export async function logout() {
  const refreshToken = getRefreshToken();

  if (refreshToken) {
    const response = await fetch('/member/jwt/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`,
        refresh: refreshToken,
      },
      body: JSON.stringify({
        refreshToken,
      }),
    });

    console.log('logout status:', response.status);
  }

  clearTokens();
}
