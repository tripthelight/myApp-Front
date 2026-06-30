import './scss/style.scss';

const API_BASE_URL = '';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

const app = document.querySelector('#app');

renderApp();

function renderApp() {
  const isLoggedIn = Boolean(getAccessToken());

  app.innerHTML = `
    <main class="app">
      <header class="app-header">
        <h1>myApp</h1>
        <p>Member 로그인 연동 화면</p>
      </header>

      ${
        isLoggedIn
          ? `
            <section class="card">
              <h2>로그인 상태</h2>
              <p class="status success">현재 로그인 상태입니다.</p>

              <div class="button-row">
                <button id="meBtn">내 정보 조회</button>
                <button id="refreshTestBtn">Refresh Token 재발급 테스트</button>
                <button id="logoutBtn" class="danger">로그아웃</button>
              </div>
            </section>
          `
          : `
            <section class="card">
              <h2>로그인</h2>

              <div class="form-row">
                <label for="username">Username</label>
                <input id="username" type="text" value="testuser1" autocomplete="username" />
              </div>

              <div class="form-row">
                <label for="password">Password</label>
                <input id="password" type="password" value="1234" autocomplete="current-password" />
              </div>

              <div class="button-row">
                <button id="loginBtn">로그인</button>
              </div>
            </section>
          `
      }

      <section class="card">
        <h2>Token</h2>
        <pre id="tokenOutput"></pre>
      </section>

      <section class="card">
        <h2>Result</h2>
        <pre id="resultOutput">결과 없음</pre>
      </section>
    </main>
  `;

  bindEvents();
  displayToken();
}

function bindEvents() {
  const loginBtn = document.querySelector('#loginBtn');
  const meBtn = document.querySelector('#meBtn');
  const refreshTestBtn = document.querySelector('#refreshTestBtn');
  const logoutBtn = document.querySelector('#logoutBtn');

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const usernameInput = document.querySelector('#username');
      const passwordInput = document.querySelector('#password');

      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();

      if (!username || !password) {
        alert('username과 password를 입력하세요.');
        return;
      }

      try {
        await login(username, password);

        printResult('로그인 성공');
        renderApp();
      } catch (error) {
        console.error(error);
        printResult(error.message);
      }
    });
  }

  if (meBtn) {
    meBtn.addEventListener('click', async () => {
      try {
        await getMyInfo();
      } catch (error) {
        console.error(error);
        printResult(error.message);
      }
    });
  }

  if (refreshTestBtn) {
    refreshTestBtn.addEventListener('click', async () => {
      try {
        await refreshAccessToken();

        displayToken();
        printResult('Refresh Token 재발급 성공');
        alert('Refresh Token 재발급 성공');
      } catch (error) {
        console.error(error);
        printResult(error.message);
        alert('Refresh Token 재발급 실패');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await logout();

        printResult('로그아웃 완료');
        renderApp();
      } catch (error) {
        console.error(error);

        clearTokens();
        printResult('서버 로그아웃 요청 실패. 로컬 토큰은 삭제했습니다.');
        renderApp();
      }
    });
  }
}

function stringify(value) {
  return JSON.stringify(value, null, 2);
}

function printResult(value) {
  const resultOutput = document.querySelector('#resultOutput');

  if (!resultOutput) {
    return;
  }

  if (typeof value === 'string') {
    resultOutput.textContent = value;
    return;
  }

  resultOutput.textContent = stringify(value);
}

function displayToken() {
  const tokenOutput = document.querySelector('#tokenOutput');

  if (!tokenOutput) {
    return;
  }

  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  if (!accessToken && !refreshToken) {
    tokenOutput.textContent = '아직 토큰 없음';
    return;
  }

  tokenOutput.textContent = stringify({
    accessToken,
    refreshToken,
  });
}

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function saveTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function removeBearerPrefix(token) {
  if (!token) {
    return null;
  }

  return token.replace(/^Bearer\s+/i, '');
}

async function readResponseSafely(response) {
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

async function login(username, password) {
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

async function refreshAccessToken() {
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

async function apiFetch(url, options = {}, retry = true) {
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
    renderApp();

    alert('로그인이 만료되었습니다. 다시 로그인해주세요.');

    throw error;
  }
}

async function getMyInfo() {
  const response = await apiFetch('/member/user', {
    method: 'GET',
  });

  const data = await readResponseSafely(response);

  printResult({
    status: response.status,
    response: data,
  });

  displayToken();

  return data;
}

async function logout() {
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

console.log('myApp Front initialized');
