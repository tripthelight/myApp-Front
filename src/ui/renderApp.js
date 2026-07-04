import {
  loginMember,
  existsMember,
  joinMember,
  getMyInfo,
  updateMyInfo,
  updateMyPassword,
  deleteMyAccount,
  logoutMember,
  exchangeSocialLoginToken,
} from "../api/memberApi.js";

import {
  getBoardList,
  getBoard,
  createBoard,
  updateBoard,
  deleteBoard,
} from "../api/boardApi.js";

import {
  saveTokens,
  removeTokens,
  getAccessToken,
  getRefreshToken,
} from "../auth/tokenStorage.js";

const app = document.querySelector("#app");

let loginUser = null;
let selectedBoardId = null;
let isJoinMode = false;

export async function renderApp() {
  if (window.location.pathname === "/cookie") {
    await handleSocialLoginCallback();
    return;
  }

  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  if (!accessToken && !refreshToken) {
    renderLoginPage();
    return;
  }

  try {
    loginUser = await getMyInfo();
    renderMainPage();
    await renderBoardList();
  } catch (error) {
    removeTokens();
    loginUser = null;
    renderLoginPage();
  }
}

function renderLoginPage() {
  app.innerHTML = `
    <div style="max-width: 420px; margin: 80px auto; font-family: sans-serif;">
      <h1 id="authTitle">myApp Login</h1>

      <form id="loginForm">
        <div style="margin-bottom: 12px;">
          <label>
            Username
            <input
              id="username"
              type="text"
              autocomplete="username"
              style="width: 100%; padding: 10px; margin-top: 4px;"
              required
            />
          </label>
        </div>

        <div style="margin-bottom: 12px;">
          <label>
            Password
            <input
              id="password"
              type="password"
              autocomplete="current-password"
              style="width: 100%; padding: 10px; margin-top: 4px;"
              required
            />
          </label>
        </div>

        <button type="submit" style="width: 100%; padding: 10px;">
          로그인
        </button>
      </form>

      <form id="joinForm" style="display: none;">
        <div style="margin-bottom: 12px;">
          <label>
            Username
            <input
              id="joinUsername"
              type="text"
              autocomplete="username"
              minlength="4"
              style="width: 100%; padding: 10px; margin-top: 4px;"
              required
            />
          </label>
        </div>

        <div style="margin-bottom: 12px;">
          <label>
            Password
            <input
              id="joinPassword"
              type="password"
              autocomplete="new-password"
              minlength="4"
              style="width: 100%; padding: 10px; margin-top: 4px;"
              required
            />
          </label>
        </div>

        <div style="margin-bottom: 12px;">
          <label>
            Nickname
            <input
              id="joinNickname"
              type="text"
              style="width: 100%; padding: 10px; margin-top: 4px;"
              required
            />
          </label>
        </div>

        <div style="margin-bottom: 12px;">
          <label>
            Email
            <input
              id="joinEmail"
              type="email"
              autocomplete="email"
              style="width: 100%; padding: 10px; margin-top: 4px;"
            />
          </label>
        </div>

        <button type="submit" style="width: 100%; padding: 10px;">
          회원가입
        </button>
      </form>

      <button id="toggleJoinButton" type="button" style="width: 100%; padding: 10px; margin-top: 8px;">
        회원가입으로 전환
      </button>

      <div style="margin-top: 16px; display: grid; gap: 8px;">
        <button id="googleLoginButton" type="button" style="width: 100%; padding: 10px;">
          구글로 로그인
        </button>

        <button id="naverLoginButton" type="button" style="width: 100%; padding: 10px;">
          네이버로 로그인
        </button>
      </div>

      <p id="loginMessage" style="color: red; margin-top: 16px;"></p>
    </div>
  `;

  document.querySelector("#loginForm").addEventListener("submit", handleLogin);
  document.querySelector("#joinForm").addEventListener("submit", handleJoin);
  document.querySelector("#toggleJoinButton").addEventListener("click", toggleJoinMode);

  document.querySelector("#googleLoginButton").addEventListener("click", () => {
    window.location.href = "/member/oauth2/authorization/google";
  });

  document.querySelector("#naverLoginButton").addEventListener("click", () => {
    window.location.href = "/member/oauth2/authorization/naver";
  });
}

function toggleJoinMode() {
  isJoinMode = !isJoinMode;

  const authTitle = document.querySelector("#authTitle");
  const loginForm = document.querySelector("#loginForm");
  const joinForm = document.querySelector("#joinForm");
  const toggleJoinButton = document.querySelector("#toggleJoinButton");
  const loginMessage = document.querySelector("#loginMessage");

  authTitle.textContent = isJoinMode ? "myApp Join" : "myApp Login";
  loginForm.style.display = isJoinMode ? "none" : "block";
  joinForm.style.display = isJoinMode ? "block" : "none";
  toggleJoinButton.textContent = isJoinMode ? "로그인으로 전환" : "회원가입으로 전환";
  loginMessage.textContent = "";
}

async function handleLogin(event) {
  event.preventDefault();

  const username = document.querySelector("#username").value.trim();
  const password = document.querySelector("#password").value.trim();
  const loginMessage = document.querySelector("#loginMessage");

  loginMessage.textContent = "";

  try {
    const tokenResponse = await loginMember({
      username,
      password,
    });

    saveTokens(tokenResponse.accessToken, tokenResponse.refreshToken);

    loginUser = await getMyInfo();

    renderMainPage();
    await renderBoardList();
  } catch (error) {
    removeTokens();
    loginMessage.textContent = "로그인에 실패했습니다.";
  }
}

async function handleJoin(event) {
  event.preventDefault();

  const username = document.querySelector("#joinUsername").value.trim();
  const password = document.querySelector("#joinPassword").value.trim();
  const nickname = document.querySelector("#joinNickname").value.trim();
  const email = document.querySelector("#joinEmail").value.trim();
  const loginMessage = document.querySelector("#loginMessage");

  loginMessage.textContent = "";
  loginMessage.style.color = "red";

  if (!username || !password || !nickname) {
    loginMessage.textContent = "아이디, 비밀번호, 닉네임을 입력하세요.";
    return;
  }

  try {
    const exists = await existsMember({
      username,
    });

    if (exists) {
      loginMessage.textContent = "이미 사용 중인 아이디입니다.";
      return;
    }

    await joinMember({
      username,
      password,
      nickname,
      email,
    });

    isJoinMode = true;
    toggleJoinMode();

    document.querySelector("#username").value = username;
    document.querySelector("#password").focus();

    loginMessage.style.color = "green";
    loginMessage.textContent = "회원가입이 완료되었습니다. 로그인해 주세요.";
  } catch (error) {
    loginMessage.textContent = "회원가입에 실패했습니다.";
  }
}

async function handleSocialLoginCallback() {
  app.innerHTML = `
    <div style="max-width: 420px; margin: 80px auto; font-family: sans-serif;">
      <h1>소셜 로그인 처리 중</h1>
      <p id="socialLoginMessage">로그인 토큰을 발급받고 있습니다.</p>
    </div>
  `;

  const message = document.querySelector("#socialLoginMessage");

  try {
    await exchangeSocialLoginToken();

    window.history.replaceState({}, "", "/");

    loginUser = await getMyInfo();

    renderMainPage();
    await renderBoardList();
  } catch (error) {
    removeTokens();

    if (message) {
      message.textContent = "소셜 로그인 처리에 실패했습니다. 다시 로그인해 주세요.";
      message.style.color = "red";
    }

    setTimeout(() => {
      window.history.replaceState({}, "", "/");
      renderLoginPage();
    }, 1500);
  }
}

function renderMainPage() {
  const username =
    loginUser?.username ||
    loginUser?.name ||
    loginUser?.email ||
    loginUser?.id ||
    "사용자";

  app.innerHTML = `
    <div style="max-width: 900px; margin: 40px auto; font-family: sans-serif;">
      <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
        <div>
          <h1 style="margin: 0;">myApp Board</h1>
          <p style="margin: 8px 0 0 0;">
            로그인 사용자: <strong>${escapeHtml(String(username))}</strong>
          </p>
        </div>

        <button id="logoutButton" style="padding: 8px 14px;">
          로그아웃
        </button>
      </header>

      <section style="margin-bottom: 32px; padding: 16px; border: 1px solid #ddd;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div>
            <h2 style="margin: 0 0 8px 0;">회원정보</h2>
            <p style="margin: 0; color: #666;">
              로그인 방식: ${loginUser?.social ? "소셜 로그인" : "ID / Password 로그인"}
            </p>
          </div>

          <button id="deleteAccountButton" type="button" style="padding: 8px 14px; color: #b00020;">
            회원탈퇴
          </button>
        </div>

        <form id="profileForm" style="margin-top: 16px;">
          <div style="margin-bottom: 12px;">
            <label>
              Username
              <input
                id="profileUsername"
                type="text"
                value="${escapeAttribute(String(loginUser?.username ?? ""))}"
                style="width: 100%; padding: 10px; margin-top: 4px;"
                readonly
              />
            </label>
          </div>

          <div style="margin-bottom: 12px;">
            <label>
              Nickname
              <input
                id="profileNickname"
                type="text"
                value="${escapeAttribute(String(loginUser?.nickname ?? ""))}"
                style="width: 100%; padding: 10px; margin-top: 4px;"
                ${loginUser?.social ? "readonly" : "required"}
              />
            </label>
          </div>

          <div style="margin-bottom: 12px;">
            <label>
              Email
              <input
                id="profileEmail"
                type="email"
                value="${escapeAttribute(String(loginUser?.email ?? ""))}"
                style="width: 100%; padding: 10px; margin-top: 4px;"
                ${loginUser?.social ? "readonly" : ""}
              />
            </label>
          </div>

          <button
            id="updateProfileButton"
            type="submit"
            style="padding: 10px 16px; ${loginUser?.social ? "display: none;" : ""}"
          >
            회원정보 수정
          </button>

          <p id="profileMessage" style="margin: 12px 0 0 0;"></p>
        </form>

        <form
          id="passwordForm"
          style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #ddd; ${loginUser?.social ? "display: none;" : ""}"
        >
          <h3 style="margin: 0 0 12px 0;">비밀번호 변경</h3>

          <div style="margin-bottom: 12px;">
            <label>
              Current Password
              <input
                id="currentPassword"
                type="password"
                autocomplete="current-password"
                minlength="4"
                style="width: 100%; padding: 10px; margin-top: 4px;"
                required
              />
            </label>
          </div>

          <div style="margin-bottom: 12px;">
            <label>
              New Password
              <input
                id="newPassword"
                type="password"
                autocomplete="new-password"
                minlength="4"
                style="width: 100%; padding: 10px; margin-top: 4px;"
                required
              />
            </label>
          </div>

          <div style="margin-bottom: 12px;">
            <label>
              New Password Confirm
              <input
                id="newPasswordConfirm"
                type="password"
                autocomplete="new-password"
                minlength="4"
                style="width: 100%; padding: 10px; margin-top: 4px;"
                required
              />
            </label>
          </div>

          <button id="updatePasswordButton" type="submit" style="padding: 10px 16px;">
            비밀번호 변경
          </button>

          <p id="passwordMessage" style="margin: 12px 0 0 0;"></p>
        </form>
      </section>

      <section style="margin-bottom: 32px;">
        <h2 id="formTitle">글쓰기</h2>

        <form id="boardForm">
          <input type="hidden" id="boardId" />

          <div style="margin-bottom: 12px;">
            <label>
              제목
              <input
                id="boardTitle"
                type="text"
                style="width: 100%; padding: 10px; margin-top: 4px;"
                required
              />
            </label>
          </div>

          <div style="margin-bottom: 12px;">
            <label>
              내용
              <textarea
                id="boardContent"
                rows="6"
                style="width: 100%; padding: 10px; margin-top: 4px; resize: vertical;"
                required
              ></textarea>
            </label>
          </div>

          <div style="margin-bottom: 12px;">
            <label>
              작성자
              <input
                id="boardWriter"
                type="text"
                style="width: 100%; padding: 10px; margin-top: 4px;"
                required
              />
            </label>
          </div>

          <div style="display: flex; gap: 8px;">
            <button id="submitBoardButton" type="submit" style="padding: 10px 16px;">
              등록
            </button>

            <button id="cancelEditButton" type="button" style="padding: 10px 16px; display: none;">
              수정 취소
            </button>
          </div>
        </form>

        <p id="boardMessage" style="margin-top: 12px;"></p>
      </section>

      <section>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2>게시글 목록</h2>

          <button id="reloadBoardButton" type="button" style="padding: 8px 14px;">
            새로고침
          </button>
        </div>

        <div id="boardList">
          게시글을 불러오는 중입니다.
        </div>
      </section>
    </div>
  `;

  const writerInput = document.querySelector("#boardWriter");
  writerInput.value = String(username);

  document.querySelector("#logoutButton").addEventListener("click", handleLogout);
  document.querySelector("#profileForm").addEventListener("submit", handleProfileSubmit);
  document.querySelector("#passwordForm").addEventListener("submit", handlePasswordSubmit);
  document.querySelector("#deleteAccountButton").addEventListener("click", handleDeleteAccount);
  document.querySelector("#boardForm").addEventListener("submit", handleBoardSubmit);
  document.querySelector("#cancelEditButton").addEventListener("click", resetBoardForm);
  document.querySelector("#reloadBoardButton").addEventListener("click", renderBoardList);
}

async function handleProfileSubmit(event) {
  event.preventDefault();

  const profileMessage = document.querySelector("#profileMessage");

  if (loginUser?.social) {
    profileMessage.textContent = "소셜 로그인 회원은 여기서 회원정보를 수정할 수 없습니다.";
    profileMessage.style.color = "red";
    return;
  }

  const username = document.querySelector("#profileUsername").value.trim();
  const nickname = document.querySelector("#profileNickname").value.trim();
  const email = document.querySelector("#profileEmail").value.trim();

  profileMessage.textContent = "";
  profileMessage.style.color = "black";

  if (!username || !nickname) {
    profileMessage.textContent = "닉네임을 입력하세요.";
    profileMessage.style.color = "red";
    return;
  }

  try {
    await updateMyInfo({
      username,
      nickname,
      email,
    });

    loginUser = await getMyInfo();
    profileMessage.textContent = "회원정보가 수정되었습니다.";
    profileMessage.style.color = "green";
  } catch (error) {
    profileMessage.textContent = "회원정보 수정에 실패했습니다.";
    profileMessage.style.color = "red";
  }
}

async function handlePasswordSubmit(event) {
  event.preventDefault();

  const passwordMessage = document.querySelector("#passwordMessage");

  if (loginUser?.social) {
    passwordMessage.textContent = "소셜 로그인 회원은 비밀번호를 변경할 수 없습니다.";
    passwordMessage.style.color = "red";
    return;
  }

  const newPassword = document.querySelector("#newPassword").value.trim();
  const currentPassword = document.querySelector("#currentPassword").value.trim();
  const newPasswordConfirm = document.querySelector("#newPasswordConfirm").value.trim();

  passwordMessage.textContent = "";
  passwordMessage.style.color = "black";

  if (currentPassword.length < 4) {
    passwordMessage.textContent = "현재 비밀번호를 입력하세요.";
    passwordMessage.style.color = "red";
    return;
  }

  if (newPassword.length < 4) {
    passwordMessage.textContent = "비밀번호는 4자 이상 입력하세요.";
    passwordMessage.style.color = "red";
    return;
  }

  if (newPassword !== newPasswordConfirm) {
    passwordMessage.textContent = "새 비밀번호와 확인 값이 일치하지 않습니다.";
    passwordMessage.style.color = "red";
    return;
  }

  try {
    await updateMyPassword({
      currentPassword,
      password: newPassword,
    });

    window.alert("비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
    removeTokens();
    loginUser = null;
    selectedBoardId = null;
    isJoinMode = false;
    renderLoginPage();
  } catch (error) {
    passwordMessage.textContent = "비밀번호 변경에 실패했습니다.";
    passwordMessage.style.color = "red";
  }
}

async function handleDeleteAccount() {
  const username = loginUser?.username;

  if (!username) {
    return;
  }

  const ok = window.confirm("회원탈퇴를 진행할까요? 이 작업은 되돌릴 수 없습니다.");

  if (!ok) {
    return;
  }

  const confirmUsername = window.prompt("탈퇴하려면 현재 username을 입력하세요.");

  if (confirmUsername !== username) {
    window.alert("username이 일치하지 않아 회원탈퇴를 취소합니다.");
    return;
  }

  try {
    await deleteMyAccount({
      username,
    });

    removeTokens();
    loginUser = null;
    selectedBoardId = null;
    isJoinMode = false;
    renderLoginPage();
  } catch (error) {
    const profileMessage = document.querySelector("#profileMessage");

    if (profileMessage) {
      profileMessage.textContent = "회원탈퇴에 실패했습니다.";
      profileMessage.style.color = "red";
    }
  }
}

async function handleLogout() {
  try {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      await logoutMember({
        refreshToken,
      });
    }
  } catch (error) {
    // 로그아웃 API 실패 여부와 상관없이 Front 토큰은 제거한다.
  } finally {
    removeTokens();
    loginUser = null;
    selectedBoardId = null;
    renderLoginPage();
  }
}

async function renderBoardList() {
  const boardList = document.querySelector("#boardList");

  if (!boardList) {
    return;
  }

  boardList.innerHTML = "게시글을 불러오는 중입니다.";

  try {
    const boards = await getBoardList();

    if (!Array.isArray(boards) || boards.length === 0) {
      boardList.innerHTML = `
        <div style="padding: 20px; border: 1px solid #ddd;">
          등록된 게시글이 없습니다.
        </div>
      `;
      return;
    }

    boardList.innerHTML = boards
      .map((board) => {
        const id = board.id;
        const title = escapeHtml(board.title ?? "");
        const content = escapeHtml(board.content ?? "");
        const writer = escapeHtml(board.writer ?? "");

        return `
          <article style="border: 1px solid #ddd; padding: 16px; margin-bottom: 12px;">
            <h3 style="margin: 0 0 8px 0;">
              #${id} ${title}
            </h3>

            <p style="white-space: pre-wrap; margin: 0 0 12px 0;">${content}</p>

            <p style="margin: 0 0 12px 0; color: #666;">
              작성자: ${writer}
            </p>

            <div style="display: flex; gap: 8px;">
              <button type="button" data-action="edit" data-id="${id}" style="padding: 6px 10px;">
                수정
              </button>

              <button type="button" data-action="delete" data-id="${id}" style="padding: 6px 10px;">
                삭제
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    boardList.querySelectorAll("button[data-action='edit']").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.id;
        handleEditBoard(id);
      });
    });

    boardList.querySelectorAll("button[data-action='delete']").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.id;
        handleDeleteBoard(id);
      });
    });
  } catch (error) {
    boardList.innerHTML = `
      <div style="padding: 20px; border: 1px solid #ddd; color: red;">
        게시글 목록 조회에 실패했습니다.
      </div>
    `;
  }
}

async function handleBoardSubmit(event) {
  event.preventDefault();

  const titleInput = document.querySelector("#boardTitle");
  const contentInput = document.querySelector("#boardContent");
  const writerInput = document.querySelector("#boardWriter");
  const boardMessage = document.querySelector("#boardMessage");

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const writer = writerInput.value.trim();

  boardMessage.textContent = "";
  boardMessage.style.color = "black";

  if (!title || !content || !writer) {
    boardMessage.textContent = "제목, 내용, 작성자를 모두 입력하세요.";
    boardMessage.style.color = "red";
    return;
  }

  try {
    if (selectedBoardId) {
      await updateBoard(selectedBoardId, {
        title,
        content,
        writer,
      });

      boardMessage.textContent = "게시글이 수정되었습니다.";
    } else {
      await createBoard({
        title,
        content,
        writer,
      });

      boardMessage.textContent = "게시글이 등록되었습니다.";
    }

    resetBoardForm();
    await renderBoardList();
  } catch (error) {
    boardMessage.textContent = selectedBoardId
      ? "게시글 수정에 실패했습니다."
      : "게시글 등록에 실패했습니다.";

    boardMessage.style.color = "red";
  }
}

async function handleEditBoard(id) {
  const boardMessage = document.querySelector("#boardMessage");

  boardMessage.textContent = "";
  boardMessage.style.color = "black";

  try {
    const board = await getBoard(id);

    selectedBoardId = board.id;

    document.querySelector("#formTitle").textContent = `글 수정 #${board.id}`;
    document.querySelector("#boardId").value = board.id;
    document.querySelector("#boardTitle").value = board.title ?? "";
    document.querySelector("#boardContent").value = board.content ?? "";
    document.querySelector("#boardWriter").value = board.writer ?? "";

    document.querySelector("#submitBoardButton").textContent = "수정";
    document.querySelector("#cancelEditButton").style.display = "inline-block";

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  } catch (error) {
    boardMessage.textContent = "게시글 조회에 실패했습니다.";
    boardMessage.style.color = "red";
  }
}

async function handleDeleteBoard(id) {
  const ok = window.confirm(`#${id} 게시글을 삭제할까요?`);

  if (!ok) {
    return;
  }

  const boardMessage = document.querySelector("#boardMessage");

  boardMessage.textContent = "";
  boardMessage.style.color = "black";

  try {
    await deleteBoard(id);

    if (String(selectedBoardId) === String(id)) {
      resetBoardForm();
    }

    boardMessage.textContent = "게시글이 삭제되었습니다.";

    await renderBoardList();
  } catch (error) {
    boardMessage.textContent = "게시글 삭제에 실패했습니다.";
    boardMessage.style.color = "red";
  }
}

function resetBoardForm() {
  selectedBoardId = null;

  const formTitle = document.querySelector("#formTitle");
  const boardIdInput = document.querySelector("#boardId");
  const titleInput = document.querySelector("#boardTitle");
  const contentInput = document.querySelector("#boardContent");
  const writerInput = document.querySelector("#boardWriter");
  const submitButton = document.querySelector("#submitBoardButton");
  const cancelButton = document.querySelector("#cancelEditButton");

  if (formTitle) {
    formTitle.textContent = "글쓰기";
  }

  if (boardIdInput) {
    boardIdInput.value = "";
  }

  if (titleInput) {
    titleInput.value = "";
  }

  if (contentInput) {
    contentInput.value = "";
  }

  if (writerInput) {
    const username =
      loginUser?.username ||
      loginUser?.name ||
      loginUser?.email ||
      loginUser?.id ||
      "사용자";

    writerInput.value = String(username);
  }

  if (submitButton) {
    submitButton.textContent = "등록";
  }

  if (cancelButton) {
    cancelButton.style.display = "none";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
