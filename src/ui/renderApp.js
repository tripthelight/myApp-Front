import {
  loginMember,
  logoutMember,
  fetchMemberUserWithAutoRefresh,
} from '../api/memberApi.js';

import {
  getAccessToken,
  clearTokens,
} from '../auth/tokenStorage.js';

export async function renderApp() {
  const app = document.querySelector('#app');

  app.innerHTML = `
    <div>
      <h1>myApp Member Login</h1>
      <p>로그인 상태 확인 중...</p>
    </div>
  `;

  const accessToken = getAccessToken();

  if (!accessToken) {
    renderLoginForm();
    return;
  }

  try {
    const user = await fetchMemberUserWithAutoRefresh();

    renderLoggedIn(user);
  } catch (error) {
    console.log('로그인 상태 자동 복원 실패:', error.message);

    clearTokens();
    renderLoginForm();
  }
}

function renderLoginForm() {
  const app = document.querySelector('#app');

  app.innerHTML = `
    <div>
      <h1>myApp Member Login</h1>

      <form id="loginForm">
        <div>
          <label for="username">Username</label>
          <input id="username" type="text" value="testuser1" />
        </div>

        <div>
          <label for="password">Password</label>
          <input id="password" type="password" value="1234" />
        </div>

        <button type="submit">로그인</button>
      </form>

      <pre id="result"></pre>
    </div>
  `;

  const loginForm = document.querySelector('#loginForm');
  const result = document.querySelector('#result');

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.querySelector('#username').value;
    const password = document.querySelector('#password').value;

    try {
      result.textContent = '로그인 중...';

      await loginMember(username, password);

      const user = await fetchMemberUserWithAutoRefresh();

      renderLoggedIn(user);
    } catch (error) {
      console.error(error);

      result.textContent = `로그인 실패: ${error.message}`;
    }
  });
}

function renderLoggedIn(user) {
  const app = document.querySelector('#app');

  app.innerHTML = `
    <div>
      <h1>로그인 성공</h1>

      <h2>내 정보</h2>
      <pre>${JSON.stringify(user, null, 2)}</pre>

      <button id="reloadUserButton">내 정보 다시 조회</button>
      <button id="logoutButton">로그아웃</button>

      <pre id="result"></pre>
    </div>
  `;

  const reloadUserButton = document.querySelector('#reloadUserButton');
  const logoutButton = document.querySelector('#logoutButton');
  const result = document.querySelector('#result');

  reloadUserButton.addEventListener('click', async () => {
    try {
      result.textContent = '내 정보 다시 조회 중...';

      const refreshedUser = await fetchMemberUserWithAutoRefresh();

      renderLoggedIn(refreshedUser);
    } catch (error) {
      console.error(error);

      clearTokens();
      renderLoginForm();
    }
  });

  logoutButton.addEventListener('click', async () => {
    try {
      result.textContent = '로그아웃 중...';

      await logoutMember();

      renderLoginForm();
    } catch (error) {
      console.error(error);

      clearTokens();
      renderLoginForm();
    }
  });
}
