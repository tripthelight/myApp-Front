import {
  loginMember,
  getMyInfo,
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
      <h1>myApp Login</h1>

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

  document.querySelector("#googleLoginButton").addEventListener("click", () => {
    window.location.href = "/member/oauth2/authorization/google";
  });

  document.querySelector("#naverLoginButton").addEventListener("click", () => {
    window.location.href = "/member/oauth2/authorization/naver";
  });
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
  document.querySelector("#boardForm").addEventListener("submit", handleBoardSubmit);
  document.querySelector("#cancelEditButton").addEventListener("click", resetBoardForm);
  document.querySelector("#reloadBoardButton").addEventListener("click", renderBoardList);
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
