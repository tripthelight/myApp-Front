import { authFetch } from "../auth/authFetch.js";

const BOARD_API_BASE_URL = "/board";

async function handleJsonResponse(response) {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP Error: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function getBoardList() {
  const response = await authFetch(`${BOARD_API_BASE_URL}/list`, {
    method: "GET",
  });

  return handleJsonResponse(response);
}

export async function getBoard(id) {
  const response = await authFetch(`${BOARD_API_BASE_URL}/${id}`, {
    method: "GET",
  });

  return handleJsonResponse(response);
}

export async function createBoard({ title, content }) {
  const response = await authFetch(`${BOARD_API_BASE_URL}/write`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      content,
    }),
  });

  return handleJsonResponse(response);
}

export async function updateBoard(id, { title, content }) {
  const response = await authFetch(`${BOARD_API_BASE_URL}/update/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      content,
    }),
  });

  return handleJsonResponse(response);
}

export async function deleteBoard(id) {
  const response = await authFetch(`${BOARD_API_BASE_URL}/delete/${id}`, {
    method: "DELETE",
  });

  return handleJsonResponse(response);
}
