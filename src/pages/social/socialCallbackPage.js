import callbackTemplate from "./social-callback.html?raw";
import { renderView } from "../../shared/dom.js";
import { handleSocialLoginCallback } from "../auth/authPage.js";

export async function renderSocialCallbackPage() {
  renderView(callbackTemplate);
  await handleSocialLoginCallback();
}
