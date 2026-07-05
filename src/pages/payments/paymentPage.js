import { createCheckout, getMyPayments, getPaymentEntitlement } from "../../api/paymentsApi.js";
import { $, $all, renderView } from "../../shared/dom.js";

const plans = [
  {
    code: "basic",
    name: "Basic Plan",
    price: "4,900원",
    description: "결제 흐름을 테스트하기 좋은 기본 플랜입니다.",
  },
  {
    code: "pro",
    name: "Pro Plan",
    price: "9,900원",
    description: "추후 유료 기능 확장에 사용할 수 있는 프로 플랜입니다.",
  },
];

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ko-KR");
}

function renderEntitlement(entitlement) {
  if (!entitlement?.paid) {
    return `
      <div class="empty-box">
        현재 유료 플랜이 없습니다.
      </div>
    `;
  }

  return `
    <div class="empty-box">
      현재 유료 플랜: <strong>${entitlement.planName}</strong>
      <br />
      결제 완료 시간: ${formatDate(entitlement.paidAt)}
    </div>
  `;
}

function renderPaymentRows(payments) {
  if (!payments.length) {
    return `<div class="empty-box">아직 결제 내역이 없습니다.</div>`;
  }

  return `
    <div class="payment-list">
      ${payments
        .map(
          (payment) => `
            <article class="payment-row">
              <div>
                <strong>${payment.planName}</strong>
                <p>${Number(payment.amount).toLocaleString("ko-KR")} ${String(payment.currency).toUpperCase()}</p>
              </div>
              <div>
                <span class="status-badge">${payment.status}</span>
                <p>${formatDate(payment.paidAt || payment.createdAt)}</p>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

export async function renderPaymentPage(initialMessage = "") {
  renderView(`
    <section class="app-view">
      <article class="card">
        <p class="eyebrow">Payments</p>
        <h2>결제 테스트</h2>
        <p class="help-text">Stripe 테스트 결제로 플랜 결제 흐름을 확인합니다.</p>

        <div id="paymentEntitlementBox" class="empty-box">유료 상태를 확인하는 중입니다.</div>

        <div class="pricing-grid">
          ${plans
            .map(
              (plan) => `
                <article class="pricing-card">
                  <h3>${plan.name}</h3>
                  <strong>${plan.price}</strong>
                  <p>${plan.description}</p>
                  <button type="button" data-plan-code="${plan.code}">결제하기</button>
                </article>
              `
            )
            .join("")}
        </div>
        <p id="paymentMessage" class="message">${initialMessage}</p>
      </article>

      <article class="card">
        <div class="section-header">
          <h2>내 결제 내역</h2>
          <button id="reloadPaymentsButton" type="button" class="secondary">새로고침</button>
        </div>
        <div id="myPaymentsBox" class="empty-box">결제 내역을 불러오는 중입니다.</div>
      </article>
    </section>
  `);

  $all("[data-plan-code]").forEach((button) => {
    button.addEventListener("click", async () => {
      await handleCheckout(button.dataset.planCode);
    });
  });

  $("#reloadPaymentsButton").addEventListener("click", loadPaymentData);

  await loadPaymentData();
}

async function handleCheckout(planCode) {
  const message = $("#paymentMessage");
  message.textContent = "Stripe 결제 페이지를 준비하는 중입니다.";
  message.className = "message";

  try {
    const checkout = await createCheckout({ planCode });
    window.location.href = checkout.checkoutUrl;
  } catch (error) {
    message.textContent = "결제 페이지 생성에 실패했습니다.";
    message.className = "message message-error";
  }
}

async function loadPaymentData() {
  await Promise.all([
    loadPaymentEntitlement(),
    loadMyPayments(),
  ]);
}

async function loadPaymentEntitlement() {
  const box = $("#paymentEntitlementBox");

  try {
    const entitlement = await getPaymentEntitlement();
    box.innerHTML = renderEntitlement(entitlement);
    box.className = "";
  } catch (error) {
    box.className = "empty-box error-box";
    box.textContent = "유료 상태를 확인하지 못했습니다.";
  }
}

async function loadMyPayments() {
  const box = $("#myPaymentsBox");

  try {
    const payments = await getMyPayments();
    box.innerHTML = renderPaymentRows(payments);
    box.className = "";
  } catch (error) {
    box.className = "empty-box error-box";
    box.textContent = "결제 내역을 불러오지 못했습니다.";
  }
}