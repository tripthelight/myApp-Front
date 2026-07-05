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

function createPaymentReturnUrls() {
  const isAdminPath = window.location.pathname.startsWith("/admin");
  const returnBasePath = isAdminPath ? "/admin" : "";

  return {
    successUrl: `${window.location.origin}${returnBasePath}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${window.location.origin}${returnBasePath}/payment-cancel`,
  };
}

export async function createCheckout({ planCode }) {
  const { successUrl, cancelUrl } = createPaymentReturnUrls();

  const response = await authFetch(`${PAYMENTS_API_BASE_URL}/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      planCode,
      successUrl,
      cancelUrl,
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