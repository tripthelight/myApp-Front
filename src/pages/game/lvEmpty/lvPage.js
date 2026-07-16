import lvStyle from "../../../assets/scss/game/lv/common.scss?inline";
import lvTemplate from "./lv.html?raw";
import { renderView } from "../../../shared/dom.js";

export function renderPage() {
  renderView(lvTemplate, lvStyle);
}
