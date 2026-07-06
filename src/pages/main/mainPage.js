import mainStyle from "../../assets/scss/main/common.scss?inline";

import mainTemplate from "./main.html?raw";
import { $all, renderView } from "../../shared/dom.js";
import { navigate } from "../../app/router.js";

export function renderMainPage() {
  renderView(mainTemplate, mainStyle);

  // LEVEL 버튼 페이지 이동
  $all("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate(button.dataset.route);
    });
  });
}
