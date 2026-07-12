import lv7Template from "./lv7.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";

const lv7Style = `
  .lv7-placeholder {
    display: grid;
    place-content: center;
    justify-items: center;
    width: 100%;
    min-height: 100svh;
    padding: 24px;
    color: #454958;
    background: linear-gradient(145deg, #eef3fb, #faedf3);
    text-align: center;
  }
  .lv7-placeholder span { color: #858b9d; font-size: 11px; font-weight: 800; letter-spacing: .2em; }
  .lv7-placeholder strong { margin-top: 8px; font-size: clamp(34px, 8vw, 64px); letter-spacing: .06em; }
  .lv7-placeholder p { margin: 12px 0 24px; color: #777d8e; }
  .lv7-placeholder button { min-width: 126px; min-height: 48px; border: 0; border-radius: 14px; color: #fff; background: #7c8393; font: inherit; font-weight: 800; letter-spacing: .12em; cursor: pointer; }
  @media (prefers-color-scheme: dark) {
    .lv7-placeholder { color: #ececf4; background: linear-gradient(145deg, #1b2130, #2b2028); }
    .lv7-placeholder span, .lv7-placeholder p { color: #afb3c2; }
  }
`;

export function renderPage() {
  renderView(lv7Template, lv7Style);
  document.getElementById("lv7HomeButton")?.addEventListener("click", () => {
    navigate("home", { replace: true });
  });
}
