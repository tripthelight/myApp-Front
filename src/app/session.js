import { getMyInfo, logoutMember } from "../api/memberApi.js";
import { getRefreshToken, removeTokens } from "../auth/tokenStorage.js";
import { clearLoginUser, clearSelectedBoardId, setLoginUser } from "./state.js";

export async function restoreSession() {
  try {
    const user = await getMyInfo();
    setLoginUser(user);
    return user;
  } catch (error) {
    clearSession();
    return null;
  }
}

export function clearSession() {
  removeTokens();
  clearLoginUser();
  clearSelectedBoardId();
}

export async function logoutSession() {
  try {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      await logoutMember({ refreshToken });
    }
  } catch (error) {
    // 로그아웃 API 실패 여부와 관계없이 Front 상태는 정리한다.
  } finally {
    clearSession();
  }
}
