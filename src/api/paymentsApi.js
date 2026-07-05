import { authFetch } from "../auth/authFetch.js";

const PAYMENTS_API_BASE_URL = "/payments";

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

export async function createCheckout({ planCode }) {
  const response = await authFetch(`${PAYMENTS_API_BASE_URL}/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      planCode,
    }),
  });

  return handleJsonResponse(response);
}

export async function getMyPayments() {
  const response = await authFetch(`${PAYMENTS_API_BASE_URL}/me`, {
    method: "GET",
  });

  return handleJsonResponse(response);
}
