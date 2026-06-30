import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  saveAccessToken,
  clearTokens,
} from '../auth/tokenStorage.js';

const MEMBER_API_BASE_URL = '/member';

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

  if (!response.ok) {
    throw new Error(`로그인 실패: ${response.status}`);
  }

  const data = await response.json();

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

  if (!response.ok) {
    throw new Error(`내 정보 조회 실패: ${response.status}`);
  }

  return await response.json();
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error('refreshToken 없음');
  }

  const response = await fetch(`${MEMBER_API_BASE_URL}/jwt/refresh`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${refreshToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`accessToken 재발급 실패: ${response.status}`);
  }

  const data = await response.json();

  if (!data.accessToken) {
    throw new Error('재발급 응답에 accessToken 없음');
  }

  saveAccessToken(data.accessToken);

  return data.accessToken;
}

export async function fetchMemberUserWithAutoRefresh() {
  try {
    return await fetchMemberUser();
  } catch (accessError) {
    console.log('accessToken으로 /member/user 조회 실패:', accessError.message);
    console.log('refreshToken으로 accessToken 재발급 시도');

    try {
      await refreshAccessToken();

      return await fetchMemberUser();
    } catch (refreshError) {
      console.log('refreshToken 재발급 실패:', refreshError.message);
      console.log('토큰 삭제 후 로그인 화면으로 이동 처리');

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
      Authorization: `Bearer ${refreshToken}`,
    },
  });

  clearTokens();

  if (!response.ok && response.status !== 204) {
    throw new Error(`로그아웃 실패: ${response.status}`);
  }
}
