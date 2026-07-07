import lv2Style from "../../../assets/scss/game/lv2/common.scss?inline";
import lv2Template from "./lv2.html?raw";
import { renderView } from "../../../shared/dom.js";

export function renderPage() {
  renderView(lv2Template, lv2Style);
  lv2Main();
}

function lv2Main() {
  console.log("lv2 init");
  
}
