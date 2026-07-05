import {
  createBoard,
  deleteBoard,
  getBoard,
  getBoardList,
  updateBoard,
} from "../../api/boardApi.js";
import { appState, canManageBoard, clearSelectedBoardId, currentUsername, setSelectedBoardId } from "../../app/state.js";
import { $, $all, renderView, setMessage } from "../../shared/dom.js";
import { escapeHtml } from "../../shared/escape.js";
import boardTemplate from "./board.html?raw";

export async function renderBoardPage() {
  renderView(boardTemplate);

  $("#writerHelpText").innerHTML = `작성자는 로그인 계정 <strong>${escapeHtml(
    currentUsername()
  )}</strong>으로 저장됩니다.`;

  $("#boardForm").addEventListener("submit", handleBoardSubmit);
  $("#cancelEditButton").addEventListener("click", resetBoardForm);
  $("#reloadBoardButton").addEventListener("click", renderBoardList);

  await renderBoardList();
}

async function renderBoardList() {
  const boardList = $("#boardList");

  boardList.textContent = "게시글을 불러오는 중입니다.";

  try {
    const boards = await getBoardList();

    if (!Array.isArray(boards) || boards.length === 0) {
      boardList.innerHTML = '<div class="empty-box">등록된 게시글이 없습니다.</div>';
      return;
    }

    boardList.innerHTML = boards.map(renderBoardItem).join("");

    $all("button[data-action='edit']", boardList).forEach((button) => {
      button.addEventListener("click", () => handleEditBoard(button.dataset.id));
    });

    $all("button[data-action='delete']", boardList).forEach((button) => {
      button.addEventListener("click", () => handleDeleteBoard(button.dataset.id));
    });
  } catch (error) {
    boardList.innerHTML = '<div class="empty-box error-box">게시글 목록 조회에 실패했습니다.</div>';
  }
}

function renderBoardItem(board) {
  const id = board.id;
  const title = escapeHtml(board.title ?? "");
  const content = escapeHtml(board.content ?? "");
  const writer = escapeHtml(board.writer ?? "");
  const actionButtons = canManageBoard(board)
    ? `
      <div class="button-row">
        <button type="button" data-action="edit" data-id="${id}" class="secondary">수정</button>
        <button type="button" data-action="delete" data-id="${id}" class="danger">삭제</button>
      </div>
    `
    : "";

  return `
    <article class="board-item">
      <h3>#${id} ${title}</h3>
      <p class="board-content">${content}</p>
      <p class="help-text">작성자: ${writer}</p>
      ${actionButtons}
    </article>
  `;
}

async function handleBoardSubmit(event) {
  event.preventDefault();

  const title = $("#boardTitle").value.trim();
  const content = $("#boardContent").value.trim();
  const boardMessage = $("#boardMessage");

  setMessage(boardMessage, "");

  if (!title || !content) {
    setMessage(boardMessage, "제목과 내용을 모두 입력하세요.", "error");
    return;
  }

  try {
    if (appState.selectedBoardId) {
      await updateBoard(appState.selectedBoardId, { title, content });
      setMessage(boardMessage, "게시글이 수정되었습니다.", "success");
    } else {
      await createBoard({ title, content });
      setMessage(boardMessage, "게시글이 등록되었습니다.", "success");
    }

    resetBoardForm();
    await renderBoardList();
  } catch (error) {
    setMessage(
      boardMessage,
      appState.selectedBoardId ? "게시글 수정에 실패했습니다." : "게시글 등록에 실패했습니다.",
      "error"
    );
  }
}

async function handleEditBoard(id) {
  const boardMessage = $("#boardMessage");
  setMessage(boardMessage, "");

  try {
    const board = await getBoard(id);

    setSelectedBoardId(board.id);
    $("#formTitle").textContent = `글 수정 #${board.id}`;
    $("#boardId").value = board.id;
    $("#boardTitle").value = board.title ?? "";
    $("#boardContent").value = board.content ?? "";
    $("#submitBoardButton").textContent = "수정";
    $("#cancelEditButton").hidden = false;

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  } catch (error) {
    setMessage(boardMessage, "게시글 조회에 실패했습니다.", "error");
  }
}

async function handleDeleteBoard(id) {
  const ok = window.confirm(`#${id} 게시글을 삭제할까요?`);

  if (!ok) {
    return;
  }

  const boardMessage = $("#boardMessage");
  setMessage(boardMessage, "");

  try {
    await deleteBoard(id);

    if (String(appState.selectedBoardId) === String(id)) {
      resetBoardForm();
    }

    setMessage(boardMessage, "게시글이 삭제되었습니다.", "success");
    await renderBoardList();
  } catch (error) {
    setMessage(boardMessage, "게시글 삭제에 실패했습니다.", "error");
  }
}

function resetBoardForm() {
  clearSelectedBoardId();
  $("#formTitle").textContent = "글쓰기";
  $("#boardId").value = "";
  $("#boardTitle").value = "";
  $("#boardContent").value = "";
  $("#submitBoardButton").textContent = "등록";
  $("#cancelEditButton").hidden = true;
}
