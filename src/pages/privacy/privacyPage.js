import privacyStyle from "../../assets/scss/privacy/common.scss?inline";
import privacyTemplate from "./privacy.html?raw";
import { renderView } from "../../shared/dom.js";
import { navigate } from "../../app/router.js";

export function renderPrivacyPage() {
  document.title = "개인정보처리방침 | Beat Forever";
  renderView(privacyTemplate, privacyStyle);

  document.querySelectorAll("[data-privacy-home]").forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      await navigate("home");
    });
  });
}
