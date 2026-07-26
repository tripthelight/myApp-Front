import mainStyle from "../../assets/scss/main/common.scss?inline";
import mainTemplate from "./main.html?raw";
import { renderView } from "../../shared/dom.js";
import { navigate } from "../../app/router.js";
import { getClearedLevels, isLevelUnlocked } from "../../game/levelProgress.js";

const LEVEL_COUNT = 30;
const NOTE_SYMBOLS = ["♪", "♫", "♩", "♬", "♭", "♯"];

export function renderMainPage() {
  renderView(mainTemplate, mainStyle);
  const clearedLevels = getClearedLevels();
  renderScore(clearedLevels);
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
  staff.setAttribute("aria-label", "오선보");
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
  note.setAttribute("aria-label", unlocked ? `레벨 ${level}${cleared ? ", 클리어 완료" : ""}` : `레벨 ${level}, 잠김`);
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
  const type = (level - 1) % 15;
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
  ][type];
  return `<svg ${common}><g>${art}</g></svg>`;
}
