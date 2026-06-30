import {
  getAccessToken,
  getRefreshToken,
} from '../auth/tokenStorage.js';

import {
  getMyInfo,
  login,
  logout,
  refreshAccessToken,
} from '../api/memberApi.js';

import {
  clearTokens,
} from '../auth/tokenStorage.js';

const app = document.querySelector('#app');

export function renderApp() {
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

        renderApp();
        printResult('로그인 성공');
      } catch (error) {
        console.error(error);
        printResult(error.message);
      }
    });
  }

  if (meBtn) {
    meBtn.addEventListener('click', async () => {
      try {
        const data = await getMyInfo();

        printResult(data);
        displayToken();
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

        renderApp();
        printResult('로그아웃 완료');
      } catch (error) {
        console.error(error);

        clearTokens();

        renderApp();
        printResult('서버 로그아웃 요청 실패. 로컬 토큰은 삭제했습니다.');
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
