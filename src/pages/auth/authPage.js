import {
  existsMember,
  exchangeSocialLoginToken,
  getMyInfo,
  joinMember,
  loginMember,
} from "../../api/memberApi.js";
import { removeTokens } from "../../auth/tokenStorage.js";
import { $, renderView, setMessage } from "../../shared/dom.js";
import { setLoginUser } from "../../app/state.js";
import { navigate, updateHeader } from "../../app/router.js";
import authTemplate from "./auth.html?raw";

let joinMode = false;

export function renderAuthPage(initialMessage = "") {
  renderView(authTemplate);
  joinMode = false;

  $("#loginForm").addEventListener("submit", handleLogin);
  $("#joinForm").addEventListener("submit", handleJoin);
  $("#toggleJoinButton").addEventListener("click", toggleJoinMode);

  $("#googleLoginButton").addEventListener("click", () => {
    window.location.href = createOAuth2AuthorizationUrl("google");
  });

  $("#naverLoginButton").addEventListener("click", () => {
    window.location.href = createOAuth2AuthorizationUrl("naver");
  });

  function createOAuth2AuthorizationUrl(provider) {
    const oauth2Origin =
      window.location.port === "5173"
        ? "http://127.0.0.1:8080"
        : window.location.origin;

    const successRedirectUri = `${window.location.origin}/cookie`;
    const url = new URL(`/member/oauth2/authorization/${provider}`, oauth2Origin);

    url.searchParams.set("success_redirect_uri", successRedirectUri);

    return url.toString();
  }

  if (initialMessage) {
    setMessage($("#loginMessage"), initialMessage, "error");
  }
}

export async function handleSocialLoginCallback() {
  try {
    await exchangeSocialLoginToken();
    window.history.replaceState({}, "", "/");
    setLoginUser(await getMyInfo());
    updateHeader();
    await navigate("home");
  } catch (error) {
    removeTokens();
    window.history.replaceState({}, "", "/");
    renderAuthPage("소셜 로그인 처리에 실패했습니다. 다시 로그인해 주세요.");
  }
}

function toggleJoinMode() {
  joinMode = !joinMode;

  $("#authTitle").textContent = joinMode ? "회원가입" : "로그인";
  $("#loginForm").hidden = joinMode;
  $("#joinForm").hidden = !joinMode;
  $("#toggleJoinButton").textContent = joinMode
    ? "로그인으로 전환"
    : "회원가입으로 전환";
  setMessage($("#loginMessage"), "");
}

async function handleLogin(event) {
  event.preventDefault();

  const username = $("#username").value.trim();
  const password = $("#password").value.trim();
  const loginMessage = $("#loginMessage");

  setMessage(loginMessage, "");

  try {
    await loginMember({ username, password });
    setLoginUser(await getMyInfo());
    updateHeader();
    await navigate("board");
  } catch (error) {
    removeTokens();
    setMessage(loginMessage, "로그인에 실패했습니다.", "error");
  }
}

async function handleJoin(event) {
  event.preventDefault();

  const username = $("#joinUsername").value.trim();
  const password = $("#joinPassword").value.trim();
  const nickname = $("#joinNickname").value.trim();
  const email = $("#joinEmail").value.trim();
  const loginMessage = $("#loginMessage");

  setMessage(loginMessage, "");

  if (!username || !password || !nickname) {
    setMessage(loginMessage, "아이디, 비밀번호, 닉네임을 입력하세요.", "error");
    return;
  }

  try {
    const exists = await existsMember({ username });

    if (exists) {
      setMessage(loginMessage, "이미 사용 중인 아이디입니다.", "error");
      return;
    }

    await joinMember({ username, password, nickname, email });
    toggleJoinMode();
    $("#username").value = username;
    $("#password").focus();
    setMessage(loginMessage, "회원가입이 완료되었습니다. 로그인해 주세요.", "success");
  } catch (error) {
    setMessage(loginMessage, "회원가입에 실패했습니다.", "error");
  }
}
