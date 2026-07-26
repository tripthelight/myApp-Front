import { initializeTheme } from "./app/theme.js";
import { preparePwa } from "./app/pwa.js";
import "./assets/scss/common.scss";
import { startApp } from "./app/router.js";
import { initializeI18n } from "./i18n/i18n.js";
// import "./scss/style.scss";

const shouldStartApp = await preparePwa();

if (shouldStartApp) {
  initializeTheme();
  initializeI18n();
  await startApp();
}
