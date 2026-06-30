import './scss/style.scss'

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="page">
    <section class="card">
      <h1>myApp Member Login Test</h1>
      <p class="description">
        Member API 로그인, 토큰 저장, 내 정보 조회를 테스트합니다.
      </p>

      <div class="form">
        <label>
          Username
          <input id="username" type="text" value="testuser1" />
        </label>

        <label>
          Password
          <input id="password" type="password" value="1234" />
        </label>

        <div class="buttons">
          <button id="loginBtn" type="button">로그인</button>
          <button id="meBtn" type="button">내 정보 조회</button>
          <button id="clearBtn" type="button">토큰 삭제</button>
        </div>
      </div>

      <div class="token-box">
        <h2>Access Token</h2>
        <pre id="tokenOutput">아직 토큰 없음</pre>
      </div>

      <div class="result-box">
        <h2>Result</h2>
        <pre id="resultOutput">아직 요청 없음</pre>
      </div>
    </section>
  </main>
`;

const usernameInput = document.querySelector('#username');
const passwordInput = document.querySelector('#password');
const loginBtn = document.querySelector('#loginBtn');
const meBtn = document.querySelector('#meBtn');
const clearBtn = document.querySelector('#clearBtn');
const tokenOutput = document.querySelector('#tokenOutput');
const resultOutput = document.querySelector('#resultOutput');

const ACCESS_TOKEN_KEY = 'myapp_member_access_token';
const REFRESH_TOKEN_KEY = 'myapp_member_refresh_token';

function pretty(data) {
  return JSON.stringify(data, null, 2);
}

function setResult(data) {
  if (typeof data === 'string') {
    resultOutput.textContent = data;
    return;
  }

  resultOutput.textContent = pretty(data);
}

function refreshTokenView() {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);

  if (!accessToken) {
    tokenOutput.textContent = '아직 토큰 없음';
    return;
  }

  tokenOutput.textContent = accessToken;
}

async function readResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return await response.json();
  }

  return await response.text();
}

async function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    setResult('username/password를 입력하세요.');
    return;
  }

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

  const data = await readResponse(response);

  if (!response.ok) {
    setResult({
      status: response.status,
      error: data,
    });
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);

  refreshTokenView();

  setResult({
    status: response.status,
    message: '로그인 성공',
    response: data,
  });
}

async function getMe() {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);

  if (!accessToken) {
    setResult('accessToken이 없습니다. 먼저 로그인하세요.');
    return;
  }

  const response = await fetch('/member/user', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await readResponse(response);

  setResult({
    status: response.status,
    response: data,
  });
}

function clearToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);

  refreshTokenView();
  setResult('토큰 삭제 완료');
}

loginBtn.addEventListener('click', login);
meBtn.addEventListener('click', getMe);
clearBtn.addEventListener('click', clearToken);

refreshTokenView();

console.log('myApp Front initialized');
