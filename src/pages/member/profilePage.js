import {
  deleteMyAccount,
  getMyInfo,
  updateMyInfo,
  updateMyPassword,
} from "../../api/memberApi.js";
import { $, renderView, setMessage } from "../../shared/dom.js";
import { appState, clearSelectedBoardId, setLoginUser } from "../../app/state.js";
import { clearSession } from "../../app/session.js";
import { navigate, updateHeader } from "../../app/router.js";
import profileTemplate from "./profile.html?raw";

export function renderProfilePage() {
  renderView(profileTemplate);
  fillProfileForm();

  $("#profileForm").addEventListener("submit", handleProfileSubmit);
  $("#passwordForm").addEventListener("submit", handlePasswordSubmit);
  $("#deleteAccountButton").addEventListener("click", handleDeleteAccount);
}

function fillProfileForm() {
  const user = appState.loginUser;
  const isSocialUser = Boolean(user?.social);

  $("#loginTypeText").textContent = `로그인 방식: ${
    isSocialUser ? "소셜 로그인" : "ID / Password 로그인"
  }`;
  $("#profileUsername").value = user?.username ?? "";
  $("#profileNickname").value = user?.nickname ?? "";
  $("#profileEmail").value = user?.email ?? "";

  $("#profileNickname").readOnly = isSocialUser;
  $("#profileEmail").readOnly = isSocialUser;
  $("#updateProfileButton").hidden = isSocialUser;
  $("#passwordSection").hidden = isSocialUser;
}

async function handleProfileSubmit(event) {
  event.preventDefault();

  const profileMessage = $("#profileMessage");

  if (appState.loginUser?.social) {
    setMessage(profileMessage, "소셜 로그인 회원은 여기서 회원정보를 수정할 수 없습니다.", "error");
    return;
  }

  const username = $("#profileUsername").value.trim();
  const nickname = $("#profileNickname").value.trim();
  const email = $("#profileEmail").value.trim();

  if (!username || !nickname) {
    setMessage(profileMessage, "닉네임을 입력하세요.", "error");
    return;
  }

  try {
    await updateMyInfo({ username, nickname, email });
    setLoginUser(await getMyInfo());
    fillProfileForm();
    updateHeader();
    setMessage(profileMessage, "회원정보가 수정되었습니다.", "success");
  } catch (error) {
    setMessage(profileMessage, "회원정보 수정에 실패했습니다.", "error");
  }
}

async function handlePasswordSubmit(event) {
  event.preventDefault();

  const passwordMessage = $("#passwordMessage");
  const currentPassword = $("#currentPassword").value.trim();
  const newPassword = $("#newPassword").value.trim();
  const newPasswordConfirm = $("#newPasswordConfirm").value.trim();

  if (currentPassword.length < 4) {
    setMessage(passwordMessage, "현재 비밀번호를 입력하세요.", "error");
    return;
  }

  if (newPassword.length < 4) {
    setMessage(passwordMessage, "비밀번호는 4자 이상 입력하세요.", "error");
    return;
  }

  if (newPassword !== newPasswordConfirm) {
    setMessage(passwordMessage, "새 비밀번호와 확인 값이 일치하지 않습니다.", "error");
    return;
  }

  try {
    await updateMyPassword({
      currentPassword,
      password: newPassword,
    });

    window.alert("비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
    clearSession();
    updateHeader();
    await navigate("auth");
  } catch (error) {
    setMessage(passwordMessage, "비밀번호 변경에 실패했습니다.", "error");
  }
}

async function handleDeleteAccount() {
  const username = appState.loginUser?.username;

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
    await deleteMyAccount({ username });
    clearSession();
    clearSelectedBoardId();
    updateHeader();
    await navigate("home");
  } catch (error) {
    setMessage($("#profileMessage"), "회원탈퇴에 실패했습니다.", "error");
  }
}
