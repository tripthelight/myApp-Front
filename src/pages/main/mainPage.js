import mainStyle from "../../assets/scss/main/common.scss?inline";
import mainTemplate from "./main.html?raw";
import { renderView } from "../../shared/dom.js";
import { navigate } from "../../app/router.js";
import { getClearedLevels, isLevelUnlocked } from "../../game/levelProgress.js";
import { getTheme, setTheme } from "../../app/theme.js";
import { getLanguageOptions, getSelectedLanguage, setLanguage, t } from "../../i18n/i18n.js";

const LEVEL_COUNT = 30;
const NOTE_SYMBOLS = ["♪", "♫", "♩", "♬", "♭", "♯"];

export function renderMainPage() {
  renderView(mainTemplate, mainStyle);
  const clearedLevels = getClearedLevels();
  renderScore(clearedLevels);
  bindMainMenu();
  updatePwaInstallGuide();
}

function updatePwaInstallGuide() {
  const section = document.getElementById("pwaInstallSection");
  const status = document.getElementById("pwaInstallStatus");
  const warning = document.getElementById("pwaSecurityWarning");
  if (!section || !status || !warning) return;

  const userAgent = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  if (!isIos || isStandalone) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  warning.hidden = window.isSecureContext;
  status.textContent = window.isSecureContext
    ? "Safari의 공유 메뉴에서 홈 화면에 추가하면 앱처럼 실행할 수 있습니다."
    : "현재 주소는 iPhone에서 안전한 HTTPS로 인정되지 않았습니다.";
}

function clearLevel(_btn) {
  _btn.addEventListener("click", () => {
    const slcLevel = document.querySelector(".main-sidebar__section select#SLC_LEVEL_CLEAR");
    if (!slcLevel) return;
    const OPTION = slcLevel.value;
    if (!OPTION) return;

    const CLEAR_STORAGE_KEY = "__m4f8p2_v3";

    const clearCode = {
      LEVEL_1: '{"_7qN4":"fdpjVIkHmwMdu64h","_p2X9":"EUzqcQ","_k8R1":"1lqlt4412ov0bs"}',
      LEVEL_2: '{"_7qN4":"XEbsq_rG5sVMQKQD","_p2X9":"3_HK6A","_k8R1":"6oi5sgjmirwy"}',
      LEVEL_3: '{"_7qN4":"9VXqLAgmzxOUwNu_","_p2X9":"I6NvPg","_k8R1":"l1z12hoqpqi9"}',
      LEVEL_4: '{"_7qN4":"KQDGOmTQFMxec3vl","_p2X9":"e7TGGA","_k8R1":"14rb6s21md4ege"}',
      LEVEL_5: '{"_7qN4":"RJUnt3qXAfm2vrY5","_p2X9":"jbnjuA","_k8R1":"555x2yh69gu0"}',
      LEVEL_6: '{"_7qN4":"Dj3zW82CKf8569uK","_p2X9":"RtT8tA","_k8R1":"9490ou19gikm2"}',
      LEVEL_7: '{"_7qN4":"7WyAypLpcU6t7CfI","_p2X9":"W2rezw","_k8R1":"9oh3m41jtqvd0"}',
      LEVEL_8: '{"_7qN4":"i06SYzXxxRktBv8X","_p2X9":"MbfGZw","_k8R1":"1rpmxqsmybwyo"}',
      LEVEL_9: '{"_7qN4":"kGWECj9UaEWelk-P","_p2X9":"m3Mn6A","_k8R1":"1d0psdk9hje8q"}',
      LEVEL_10: '{"_7qN4":"Rr4Bw3Xo6_eDU5dj","_p2X9":"MN4Row","_k8R1":"9o91mxiae54f"}',
      LEVEL_11: '{"_7qN4":"9owMYLhxTm9udEPS","_p2X9":"bXalhA","_k8R1":"196j6idhmoztx"}',
      LEVEL_12: '{"_7qN4":"_hKpnXIk5AyS3ij5","_p2X9":"d4cCyA","_k8R1":"8ad648zr8cki"}',
      LEVEL_13: '{"_7qN4":"YxLPhINGJov5JWVm","_p2X9":"OdR1ug","_k8R1":"195spdurqqvn4"}',
      LEVEL_14: '{"_7qN4":"O0hYxGdLPUsR_SkQ","_p2X9":"aHxI5g","_k8R1":"s914iacp7jhw"}',
      LEVEL_15: '{"_7qN4":"gBz5wgXrM7_We1TA","_p2X9":"Gwn70w","_k8R1":"sykyhi1k26e3c"}',
      LEVEL_16: '{"_7qN4":"kFZp10EHS97nwpku","_p2X9":"p3jrWA","_k8R1":"1cvi31pwbn613"}',
      LEVEL_17: '{"_7qN4":"u_x4_PmwyFdRwXi_","_p2X9":"VMEQYQ","_k8R1":"5iura12qklvv"}',
      LEVEL_18: '{"_7qN4":"aNEk7raWmf7mcOO7","_p2X9":"jwytHg","_k8R1":"15g6m5j1qkmb1d"}',
      LEVEL_19: '{"_7qN4":"k0yn3pdaYuylnNa0","_p2X9":"9w4gZA","_k8R1":"t0ucnd1rt1uz5"}',
      LEVEL_20: '{"_7qN4":"qapDXDNyCXRyfnYk","_p2X9":"c_fTCg","_k8R1":"g3c9wq1wqembc"}',
      LEVEL_21: '{"_7qN4":"6qmvzDnzR4x-E4E7","_p2X9":"foYseQ","_k8R1":"49fjn6akcl36"}',
      LEVEL_22: '{"_7qN4":"DJq7ih75gk6RYkis","_p2X9":"pCRE9g","_k8R1":"881998tilm9i"}',
      LEVEL_23: '{"_7qN4":"jodakk6NGMuIWhvs","_p2X9":"ta5YsA","_k8R1":"ul452awm5mv6"}',
      LEVEL_24: '{"_7qN4":"D5fEFmzWIosLUjwp","_p2X9":"MukUFQ","_k8R1":"1jwncup1w6we3v"}',
      LEVEL_25: '{"_7qN4":"KhomvNWcF1qBNYSf","_p2X9":"79bBzQ","_k8R1":"1c1e3h310airtp"}',
      LEVEL_26: '{"_7qN4":"m_YtXvYLeJDi7KdF","_p2X9":"Zr0ZdA","_k8R1":"di9014k72ybk"}',
      LEVEL_27: '{"_7qN4":"FGfJ7gWTslIt-yZ2","_p2X9":"MyrNfQ","_k8R1":"i1ixdagw5pie"}',
      LEVEL_28: '{"_7qN4":"XlXXm6Qi9SzVIJFo","_p2X9":"L9c27A","_k8R1":"aq0xje11m73mk"}',
      LEVEL_29: '{"_7qN4":"UuOtBreZJoYB_Hb-","_p2X9":"W0qq-Q","_k8R1":"1ukvrf8h3goxg"}',
      LEVEL_30: '{"_7qN4":"aW-h-U8hbi6BCy5M","_p2X9":"NSTo1g","_k8R1":"1l0j9tt1rgvm81"}',
      LEVEL_ALL: '{"_7qN4":"1NdEqx-ZuXMnsVfU","_p2X9":"JqU_TA","_k8R1":"3tsqh1lndlct"}'
    };

    function applyLevelOption(option) {
      if (option === "RESET") {
        window.localStorage.clear();
        location.reload();
        return;
      }

      const value = clearCode[option];

      if (!value) {
        return;
      }

      window.localStorage.clear();
      window.localStorage.setItem(CLEAR_STORAGE_KEY, value);
      location.reload();
    }

    applyLevelOption(OPTION);
  });
}

function bindMainMenu() {
  const page = document.getElementById("mainScorePage");
  const menuButton = document.getElementById("mainMenuButton");
  const closeButton = document.getElementById("mainSidebarCloseButton");
  const sidebar = document.getElementById("mainSidebar");
  const backdrop = document.getElementById("mainSidebarBackdrop");
  const darkModeToggle = document.getElementById("darkModeToggle");
  const darkModeStatus = document.getElementById("darkModeStatus");
  const languageButton = document.getElementById("languageButton");
  const languageList = document.getElementById("languageList");
  const languageCurrent = document.getElementById("languageCurrent");

  const btnLevelOk = document.querySelector(".main-sidebar__section button.btnOk");

  if (!page || !menuButton || !closeButton || !sidebar || !backdrop || !darkModeToggle || !darkModeStatus || !languageButton || !languageList || !languageCurrent) return;

  const updateThemeControl = () => {
    const isDark = getTheme() === "dark";
    darkModeToggle.checked = isDark;
    darkModeStatus.textContent = t(isDark ? "어두운 파스텔 테마가 적용되었습니다." : "밝은 파스텔 테마가 적용되었습니다.");
  };

  const openMenu = () => {
    page.classList.add("is-menu-open");
    sidebar.setAttribute("aria-hidden", "false");
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.setAttribute("aria-label", t("메뉴 닫기"));
    backdrop.hidden = false;
    window.requestAnimationFrame(() => closeButton.focus({ preventScroll: true }));
  };

  const closeMenu = () => {
    page.classList.remove("is-menu-open");
    sidebar.setAttribute("aria-hidden", "true");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", t("메뉴 열기"));
    backdrop.hidden = true;
    menuButton.focus({ preventScroll: true });
  };

  const renderLanguageList = () => {
    const selected = getSelectedLanguage();
    const options = getLanguageOptions();
    languageCurrent.textContent = options.find((option) => option.value === selected)?.label || "System Language";
    languageList.replaceChildren(...options.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.role = "option";
      button.dataset.language = option.value;
      button.className = option.value === selected ? "is-selected" : "";
      button.setAttribute("aria-selected", String(option.value === selected));
      button.innerHTML = `<span>${option.label}</span>${option.value === selected ? '<b aria-hidden="true">✓</b>' : ""}`;
      return button;
    }));
  };

  const closeLanguageList = () => {
    languageList.hidden = true;
    languageButton.setAttribute("aria-expanded", "false");
  };

  languageButton.addEventListener("click", () => {
    const willOpen = languageList.hidden;
    languageList.hidden = !willOpen;
    languageButton.setAttribute("aria-expanded", String(willOpen));
  });
  languageList.addEventListener("click", async (event) => {
    const option = event.target.closest("[data-language]");
    if (!option) return;
    await setLanguage(option.dataset.language);
    renderLanguageList();
    closeLanguageList();
    updateThemeControl();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".language-picker")) closeLanguageList();
  });
  window.addEventListener("app-language-change", renderLanguageList, { once: true });
  renderLanguageList();

  menuButton.addEventListener("click", () => {
    if (page.classList.contains("is-menu-open")) closeMenu();
    else openMenu();

    // if (btnAllClear) allClearLevel(btnAllClear);
    // if (btnClearHistory) clearHistory(btnClearHistory);
    if (btnLevelOk) clearLevel(btnLevelOk);
  });
  closeButton.addEventListener("click", closeMenu);
  backdrop.addEventListener("click", closeMenu);
  darkModeToggle.addEventListener("change", () => {
    setTheme(darkModeToggle.checked ? "dark" : "light");
    updateThemeControl();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && page.isConnected && page.classList.contains("is-menu-open")) closeMenu();
  });

  updateThemeControl();
}

function renderScore(clearedLevels) {
  const sheet = document.getElementById("scoreSheet");
  if (!sheet) return;

  let resizeTimer = 0;

  const drawScore = () => {
    const notesPerStaff = getNotesPerStaff(sheet.clientWidth);
    const fragment = document.createDocumentFragment();

    for (let startLevel = 1; startLevel <= LEVEL_COUNT; startLevel += notesPerStaff) {
      const staff = createStaff();
      const endLevel = Math.min(startLevel + notesPerStaff - 1, LEVEL_COUNT);

      staff.style.setProperty("--notes-per-staff", endLevel - startLevel + 1);
      for (let level = startLevel; level <= endLevel; level += 1) {
        staff.querySelector(".score-staff__notes").appendChild(
          createNote(level, clearedLevels.has(level), isLevelUnlocked(level)),
        );
      }
      fragment.appendChild(staff);
    }

    sheet.replaceChildren(fragment);
  };

  const handleResize = () => {
    if (!sheet.isConnected) {
      window.removeEventListener("resize", handleResize);
      return;
    }
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(drawScore, 120);
  };

  drawScore();
  window.addEventListener("resize", handleResize);
}

function getNotesPerStaff(width) {
  if (width < 430) return 3;
  if (width < 680) return 4;
  if (width < 920) return 5;
  if (width < 1180) return 6;
  return 8;
}

function createStaff() {
  const staff = document.createElement("section");
  staff.className = "score-staff";
  staff.setAttribute("aria-label", t("오선보"));
  staff.innerHTML = `
    <span class="score-staff__clef" aria-hidden="true">𝄞</span>
    <span class="score-staff__bar score-staff__bar--start" aria-hidden="true"></span>
    <span class="score-staff__bar score-staff__bar--end" aria-hidden="true"></span>
    <span class="score-staff__lines" aria-hidden="true">
      <i></i><i></i><i></i><i></i><i></i>
    </span>
    <div class="score-staff__notes"></div>
  `;
  return staff;
}
function createNote(level, cleared, unlocked) {
  const note = document.createElement("button");
  const seed = seeded(level);
  const staffStep = Math.floor(seed * 9);
  const flip = level % 4 === 0 || level % 7 === 0;

  note.type = "button";
  note.className = `score-note ${cleared ? "is-cleared" : ""} ${unlocked ? "is-unlocked" : "is-locked"} ${flip ? "is-flipped" : ""}`;
  note.style.setProperty("--staff-step", staffStep);
  note.style.setProperty("--note-tilt", `${(-5 + seeded(level + 91) * 10).toFixed(2)}deg`);
  note.style.setProperty("--note-delay", `${(-seeded(level + 51) * 5).toFixed(2)}s`);
  note.setAttribute("aria-label", unlocked ? `${t("레벨")} ${level}${cleared ? `, ${t("클리어 완료")}` : ""}` : `${t("레벨")} ${level}, ${t("잠김")}`);
  note.innerHTML = `
    <span class="score-note__stem" aria-hidden="true"><i>${NOTE_SYMBOLS[level % NOTE_SYMBOLS.length]}</i></span>
    <span class="score-note__head">
      <span class="score-note__art" aria-hidden="true">${unlocked ? thumbnail(level) : lockIcon()}</span>
      <b>LV.${String(level).padStart(2, "0")}</b>
    </span>
  `;

  if (unlocked) {
    note.addEventListener("click", () => navigate(`lv${level}`));
  } else {
    note.disabled = true;
  }
  return note;
}

function seeded(value) {
  const x = Math.sin(value * 9283.31 + 17.17) * 43758.5453;
  return x - Math.floor(x);
}

function lockIcon() {
  return `<svg viewBox="0 0 64 64"><path d="M21 29v-7c0-8 5-13 11-13s11 5 11 13v7"/><rect x="15" y="27" width="34" height="27" rx="9"/><circle cx="32" cy="39" r="3"/><path d="M32 42v5"/></svg>`;
}

function thumbnail(level) {
  const common = `viewBox="0 0 80 58" preserveAspectRatio="xMidYMid meet"`;
  const art = [
    `<rect x="7" y="9" width="14" height="40" rx="4"/><rect x="25" y="9" width="14" height="40" rx="4"/><rect x="43" y="9" width="14" height="40" rx="4"/><rect x="61" y="9" width="12" height="40" rx="4"/>`,
    `<circle cx="23" cy="22" r="12"/><circle cx="55" cy="36" r="14"/><circle cx="55" cy="36" r="5" class="line"/>`,
    `<rect x="12" y="9" width="30" height="26" rx="5"/><rect x="38" y="25" width="30" height="25" rx="5"/><circle cx="40" cy="29" r="5" class="accent"/>`,
    `<circle cx="28" cy="28" r="20"/><circle cx="49" cy="28" r="20"/><path d="M38 11a20 20 0 0 1 0 34a20 20 0 0 1 0-34Z" class="accent"/>`,
    `<path d="M9 29h62M40 6v46" class="line"/><circle cx="20" cy="17" r="7"/><circle cx="59" cy="42" r="7"/>`,
    `<path d="M40 7v44M23 18l17-11 17 11M23 40l17 11 17-11" class="line"/><circle cx="40" cy="29" r="9"/>`,
    `<circle cx="40" cy="29" r="21" class="line"/><path d="M17 29h46" class="line"/><circle cx="27" cy="29" r="7"/><circle cx="53" cy="29" r="7"/>`,
    `<path d="M10 29 25 12 40 29 55 12 70 29 55 46 40 29 25 46Z"/><circle cx="40" cy="29" r="5" class="accent"/>`,
    `<path d="M9 44 40 10l31 34" class="line"/><path d="M16 44h48" class="line"/><circle cx="40" cy="28" r="9"/>`,
    `<path d="M12 18h28v22H12z"/><path d="m48 13 20 16-20 16z"/><circle cx="35" cy="29" r="6" class="accent"/>`,
    `<path d="M8 29h64" class="line"/><path d="M18 16v26M32 10v38M47 15v28M62 20v18" class="line"/><circle cx="47" cy="29" r="7"/>`,
    `<path d="m12 39 18-20 12 10 15-17 12 13" class="line"/><path d="m58 13 11 12-15 3"/><circle cx="22" cy="40" r="6"/>`,
    `<circle cx="40" cy="29" r="22"/><circle cx="40" cy="29" r="14" class="line"/><circle cx="40" cy="29" r="5" class="accent"/><path d="M40 7v44" class="line"/>`,
    `<path d="M11 43h58M18 15h44" class="line"/><path d="m17 35 12-15 11 13 11-10 13 12"/><circle cx="64" cy="35" r="5" class="accent"/>`,
    `<path d="M12 17h56v28H12z"/><path d="M18 23h13v16H18zM35 23h9v16h-9zM48 23h14v16H48z" class="line"/>`,
    `<rect x="9" y="11" width="12" height="36" rx="5"/><rect x="27" y="18" width="12" height="29" rx="5"/><rect x="45" y="8" width="12" height="39" rx="5"/><rect x="63" y="24" width="8" height="23" rx="4"/><path d="M15 16v18M33 23v14M51 13v22M67 29v10" class="accent"/>`,
    `<path d="M9 44h62" class="line"/><circle cx="22" cy="18" r="9"/><circle cx="42" cy="29" r="8" class="accent"/><circle cx="61" cy="14" r="7"/><path d="M22 27 26 44M42 37v7M61 21l-4 23" class="line"/>`,
    `<path d="M7 43h66" class="line"/><rect x="10" y="9" width="10" height="32" rx="3"/><rect x="23" y="16" width="10" height="25" rx="3"/><rect x="36" y="6" width="10" height="35" rx="3"/><rect x="49" y="20" width="10" height="21" rx="3"/><rect x="62" y="12" width="8" height="29" rx="3"/><path d="M8 47h64" class="accent"/>`,
    `<rect x="9" y="10" width="27" height="17" rx="5"/><rect x="44" y="10" width="27" height="17" rx="5"/><rect x="9" y="32" width="27" height="17" rx="5"/><rect x="44" y="32" width="27" height="17" rx="5"/><circle cx="22" cy="19" r="4" class="accent"/><circle cx="57" cy="41" r="4" class="accent"/>`,
    `<path d="M14 12h52L18 46h48" class="line"/><path d="M14 12 18 46M66 12 18 46M18 46h48"/><circle cx="52" cy="22" r="5" class="accent"/>`,
    `<path d="M8 42h64" class="line"/><path d="M17 37c0-10 8-18 18-18s18 8 18 18"/><path d="M27 39c0-8 6-14 13-14s13 6 13 14" class="accent"/><rect x="57" y="13" width="13" height="22" rx="3"/>`,
    `<rect x="7" y="19" width="11" height="24" rx="4"/><rect x="21" y="12" width="11" height="31" rx="4"/><rect x="35" y="20" width="11" height="23" rx="4"/><rect x="49" y="9" width="11" height="34" rx="4"/><rect x="63" y="16" width="10" height="27" rx="4"/><circle cx="68" cy="20" r="4" class="accent"/>`,
    `<rect x="8" y="8" width="64" height="42" rx="5" class="line"/><path d="M14 18h26M14 26h38M14 34h31M14 42h45" class="line"/><circle cx="51" cy="26" r="5" class="accent"/><path d="m59 16 7 5-7 5"/>`,
    `<path d="M9 29h62" class="line"/><circle cx="18" cy="20" r="6"/><rect x="29" y="14" width="12" height="12" rx="3"/><path d="m53 13 8 7-8 7-8-7Z"/><circle cx="67" cy="38" r="5" class="accent"/><path d="M18 26v18M35 26v18M53 27v17M67 43v1" class="line"/>`,
    `<path d="M8 18h64M8 40h64" class="line"/><rect x="12" y="23" width="14" height="12" rx="3"/><rect x="32" y="23" width="14" height="12" rx="3"/><rect x="52" y="23" width="14" height="12" rx="3"/><rect x="32" y="23" width="14" height="12" rx="3" class="accent"/>`,
    `<path d="M12 49 25 9h30l13 40" class="line"/><path d="M26 18 18 49M40 18v31M54 18l8 31" class="line"/><circle cx="40" cy="38" r="6"/><path d="M35 12h10" class="accent"/>`,
    `<rect x="8" y="10" width="64" height="38" rx="8" class="line"/><path d="M15 39h50" class="line"/><rect x="18" y="27" width="9" height="12" rx="3"/><rect x="35" y="16" width="9" height="23" rx="3" class="accent"/><rect x="53" y="22" width="9" height="17" rx="3"/>`,
    `<path d="M10 15h60M10 43h60" class="line"/><rect x="18" y="8" width="12" height="28" rx="4"/><rect x="50" y="20" width="12" height="30" rx="4" class="accent"/><path d="M24 36v8M56 14v6" class="line"/>`,
    `<circle cx="40" cy="29" r="23"/><circle cx="40" cy="29" r="17" class="line"/><circle cx="40" cy="29" r="8" class="accent"/><circle cx="40" cy="29" r="2"/><path d="M40 6v8M63 29h8" class="line"/><circle cx="58" cy="20" r="5"/>`,
    `<circle cx="18" cy="17" r="7"/><circle cx="31" cy="14" r="6" class="accent"/><circle cx="43" cy="18" r="7"/><circle cx="56" cy="15" r="6"/><circle cx="25" cy="31" r="7"/><circle cx="39" cy="30" r="7" class="accent"/><circle cx="53" cy="31" r="7"/><circle cx="32" cy="44" r="6"/><circle cx="47" cy="44" r="6"/>`,
  ][level - 1];

  return art ? `<svg ${common}><g>${art}</g></svg>` : lockIcon();
}
