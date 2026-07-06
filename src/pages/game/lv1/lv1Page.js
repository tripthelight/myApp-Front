import lv1Style from "../../../assets/scss/game/lv1/common.scss?inline";
import lv1Template from "./lv1.html?raw";
import { renderView } from "../../../shared/dom.js";

export function renderLv1Page() {
  renderView(lv1Template, lv1Style);
}
