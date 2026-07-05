import homeTemplate from "./home.html?raw";
import { $all, renderView } from "../../shared/dom.js";
import { navigate } from "../../app/router.js";

export function renderHomePage() {
  renderView(homeTemplate);

  $all("[data-home-route]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate(button.dataset.homeRoute);
    });
  });
}
