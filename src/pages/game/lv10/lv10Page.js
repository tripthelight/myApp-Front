import lv10Style from "../../../assets/scss/game/lv10/common.scss?inline";
import lv10Template from "./lv10.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";

export function renderPage() {
  renderView(lv10Template, lv10Style);
  document.getElementById("lv10HomeButton")?.addEventListener("click", () => {
    navigate("home", { replace: true });
  });
}
