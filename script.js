const SHEETS = {
  snakes: "1yXErBygPUSMybc_LawpAgIR7FsG6Y4kayb4KX54SfeM",
  spiders: "1-p2tBIgnED5dSHw_NKnyFnIiTrD6oVI5caZUoc178uc",
};

const phobiaSelect = document.querySelector("#phobia-select");
const landingScreen = document.querySelector("#landing-screen");
const dailyScreen = document.querySelector("#daily-screen");
const dailyButton = document.querySelector("#daily-button");
const backButton = document.querySelector("#back-button");
const practiceButton = document.querySelector("#practice-button");
const levelSelectButton = document.querySelector("#level-select-button");
const dailyImage = document.querySelector("#daily-image");
const imageFrame = document.querySelector("#image-frame");
const imagePlaceholder = document.querySelector("#image-placeholder");
const blurProgressFill = document.querySelector("#blur-progress-fill");
const nameProgressFill = document.querySelector("#name-progress-fill");
const factProgressFill = document.querySelector("#fact-progress-fill");
const resetProgress = document.querySelector("#reset-progress");
const grayscaleOnly = document.querySelector("#grayscale-only");
const dailyName = document.querySelector("#daily-name");
const dailyFact = document.querySelector("#daily-fact");
const revealNameButton = document.querySelector("#reveal-name-button");
const revealFactButton = document.querySelector("#reveal-fact-button");
const contentWarning = document.querySelector("#content-warning");
const dailyCard = document.querySelector(".daily-card");
const levelSelect = document.querySelector("#level-select");
const levelGrid = document.querySelector("#level-grid");
const modeTitle = document.querySelector("#mode-title");
const entryModeLabel = document.querySelector("#entry-mode-label");
const entryNumber = document.querySelector("#entry-number");
const achievementStar = document.querySelector("#achievement-star");
const statusMessage = document.querySelector("#status-message");
const formMessage = document.querySelector("#form-message");
const progressCounter = document.querySelector("#progress-counter");
const actions = document.querySelector(".actions");
const BLUR_REDUCTION_PER_SECOND = 20;
const MAX_BLUR_PX = 48;
const NAME_REVEAL_PROGRESS = 20;
const FACT_REVEAL_PROGRESS = 50;

let blurProgress = 0;
let isReducingBlur = false;
let lastFrameTime = 0;
let animationFrameId = 0;
let hasCelebratedFullReveal = false;
let currentMode = "daily";
let currentPhobia = "";
let currentEntry = null;
let currentEntryCount = 0;
let currentEntries = [];

const savedPhobia = window.localStorage.getItem("phobys:selected-phobia");

if (savedPhobia && phobiaSelect) {
  phobiaSelect.value = savedPhobia;
  updateProgressCounter(savedPhobia);
}

phobiaSelect?.addEventListener("change", (event) => {
  const value = event.target.value;

  if (value) {
    window.localStorage.setItem("phobys:selected-phobia", value);
  } else {
    window.localStorage.removeItem("phobys:selected-phobia");
  }

  updateProgressCounter(value);
});

dailyButton?.addEventListener("click", async () => {
  await openEntryMode(
    currentMode === "practice" || currentMode === "level-select"
      ? "practice"
      : "daily"
  );
});

practiceButton?.addEventListener("click", async () => {
  await openEntryMode("practice");
});

levelSelectButton?.addEventListener("click", async () => {
  await openLevelSelect();
});

async function openEntryMode(mode) {
  const selectedPhobia = phobiaSelect?.value;

  if (!selectedPhobia) {
    setFormMessage("Please choose your phobia before opening Daily.");
    phobiaSelect?.focus();
    return;
  }

  currentMode = mode;
  setFormMessage("");
  blankProtectedImage();
  showDailyScreen(mode);
  setLoadingState(true);
  setStatus(mode === "daily" ? "Loading today's entry..." : "Loading a practice entry...");

  try {
    const entries = await fetchSheetEntries(SHEETS[selectedPhobia]);
    currentPhobia = selectedPhobia;
    currentEntryCount = entries.length;
    currentEntries = entries;
    updateProgressCounter(selectedPhobia, entries.length);

    const entry =
      mode === "daily" ? pickTrueDailyEntry(entries) : pickPracticeEntry(entries);

    renderDailyEntry(entry, selectedPhobia);
    setStatus("");
  } catch (error) {
    setStatus(
      "I couldn't load today's entry. Please check that the Google Sheet is shared publicly."
    );
    console.error(error);
  } finally {
    setLoadingState(false);
  }
}

backButton?.addEventListener("click", () => {
  blankProtectedImage();
  landingScreen.hidden = false;
  dailyScreen.hidden = true;
  backButton.hidden = true;
  practiceButton.hidden = true;
  levelSelectButton.hidden = true;
  dailyButton.hidden = false;
  actions?.classList.remove("has-back");
  actions?.classList.remove("has-practice");
  actions?.classList.remove("has-level-select");
  currentMode = "daily";
  dailyButton.textContent = "Daily";
  setStatus("");
});

imageFrame?.addEventListener("pointerdown", (event) => {
  if (!imageFrame.classList.contains("is-ready")) {
    return;
  }

  event.preventDefault();
  imageFrame.setPointerCapture(event.pointerId);
  startReducingBlur();
});

imageFrame?.addEventListener("pointerup", stopReducingBlur);
imageFrame?.addEventListener("pointercancel", stopReducingBlur);
window.addEventListener("pointerup", stopReducingBlur);
window.addEventListener("pointercancel", stopReducingBlur);

imageFrame?.addEventListener(
  "touchstart",
  (event) => {
    if (!imageFrame.classList.contains("is-ready")) {
      return;
    }

    event.preventDefault();
    startReducingBlur();
  },
  { passive: false }
);

window.addEventListener("touchend", stopReducingBlur);
window.addEventListener("touchcancel", stopReducingBlur);

imageFrame?.addEventListener("keydown", (event) => {
  if (event.code !== "Space" && event.code !== "Enter") {
    return;
  }

  event.preventDefault();

  if (!event.repeat) {
    startReducingBlur();
  }
});

imageFrame?.addEventListener("keyup", (event) => {
  if (event.code === "Space" || event.code === "Enter") {
    stopReducingBlur();
  }
});

revealNameButton?.addEventListener("click", () => revealText(dailyName));
revealFactButton?.addEventListener("click", () => revealText(dailyFact));
grayscaleOnly?.addEventListener("change", () => setBlurProgress(0));

function showDailyScreen(mode) {
  landingScreen.hidden = true;
  dailyScreen.hidden = false;
  contentWarning.hidden = false;
  dailyCard.hidden = false;
  levelSelect.hidden = true;
  backButton.hidden = false;
  practiceButton.hidden = mode === "practice";
  levelSelectButton.hidden = mode !== "practice";
  dailyButton.hidden = mode === "daily";
  actions?.classList.toggle("has-back", mode === "practice");
  actions?.classList.toggle("has-practice", mode === "daily");
  actions?.classList.toggle("has-level-select", mode === "practice");
  dailyButton.textContent = mode === "practice" ? "New entry" : "Daily";

  if (modeTitle) {
    modeTitle.textContent =
      mode === "practice"
        ? "Practice mode entry is below."
        : "Today's chosen-phobia entry is below.";
  }

  if (entryModeLabel) {
    entryModeLabel.textContent = mode === "practice" ? "Practice entry" : "Daily entry";
  }
}

async function openLevelSelect() {
  if (!currentPhobia) {
    return;
  }

  blankProtectedImage();
  currentMode = "level-select";
  contentWarning.hidden = true;
  dailyCard.hidden = true;
  levelSelect.hidden = false;
  backButton.hidden = false;
  practiceButton.hidden = true;
  levelSelectButton.hidden = true;
  dailyButton.hidden = false;
  dailyButton.disabled = true;
  dailyButton.textContent = "New entry";
  actions?.classList.remove("has-level-select");
  actions?.classList.add("has-back");
  setStatus("Choose an entry.");

  if (!currentEntries.length) {
    setLoadingState(true);
    currentEntries = await fetchSheetEntries(SHEETS[currentPhobia]);
    currentEntryCount = currentEntries.length;
    setLoadingState(false);
  }

  renderLevelSelect();
  dailyButton.disabled = false;
}

function renderLevelSelect() {
  const progress = getProgress(currentPhobia);
  levelGrid.innerHTML = "";

  currentEntries.forEach((entry, index) => {
    const button = document.createElement("button");
    const level = getEntryAchievementLevel(progress, String(entry.index));

    button.className = "level-button";
    button.type = "button";
    button.textContent = index + 1;
    button.addEventListener("click", () => openSpecificPracticeEntry(index));

    if (level) {
      const star = document.createElement("span");
      star.className = `level-star ${level}`;
      star.textContent = "\u2605";
      star.title = getAchievementTooltip(level);
      button.appendChild(star);
    }

    levelGrid.appendChild(button);
  });
}

function openSpecificPracticeEntry(index) {
  const entry = currentEntries[index];

  if (!entry) {
    return;
  }

  currentMode = "practice";
  showDailyScreen("practice");
  setStatus("");
  renderDailyEntry(entry, currentPhobia);
  setLoadingState(false);
}

async function fetchSheetEntries(sheetId) {
  const sheetData = await loadSheetData(sheetId);
  const rows = sheetData.table.rows;
  let columns = sheetData.table.cols.map((column) => normalize(column.label));
  let dataRows = rows;

  if (columns.every((column) => !column) && rows[0]?.c) {
    columns = rows[0].c.map((cell) => normalize(cell?.v));
    dataRows = rows.slice(1);
  }

  return dataRows
    .map((row, rowIndex) => {
      const item = {};

      columns.forEach((columnName, index) => {
        item[columnName] = row.c[index]?.v ?? "";
      });

      return {
        image: normalizeImageUrl(item.image || item.imageurl),
        name: item.name,
        fact: item.funfact || item.fact || item.funfacts,
        index: rowIndex,
      };
    })
    .filter((entry) => entry.image && entry.name && entry.fact);
}

function loadSheetData(sheetId) {
  return new Promise((resolve, reject) => {
    const callbackName = `phobysSheet${Date.now()}`;
    const queryOptions = encodeURIComponent(
      `out:json;responseHandler:${callbackName}`
    );
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("The Google Sheet request timed out."));
    }, 10000);

    window[callbackName] = (sheetData) => {
      cleanup();

      if (sheetData.status !== "ok") {
        reject(new Error("The Google Sheet returned an error."));
        return;
      }

      resolve(sheetData);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("The Google Sheet script could not be loaded."));
    };

    script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=${queryOptions}`;
    document.body.appendChild(script);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }
  });
}

function renderDailyEntry(entry, phobia) {
  resetExposureState();
  currentEntry = entry;
  updateAchievementStar();
  updateEntryNumber(entry);
  dailyImage.alt = `${entry.name} ${phobia} daily entry`;
  dailyName.textContent = entry.name;
  dailyFact.textContent = entry.fact;
  dailyImage.onload = () => {
    updateImageFrameAspect();
    imageFrame.classList.add("is-ready");
    imagePlaceholder.textContent = "Hold to slowly reduce blur";
  };
  dailyImage.onerror = () => {
    imageFrame.classList.remove("is-ready");
    imagePlaceholder.textContent = "The protected image could not be loaded.";
    setStatus("The image could not be loaded safely.");
  };
  dailyImage.src = entry.image;
}

function pickTrueDailyEntry(entries) {
  if (!entries.length) {
    throw new Error("The Google Sheet does not contain usable entries.");
  }

  const now = new Date();
  const utcDate = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const daysSinceEpoch = Math.floor(utcDate / 86400000);

  return entries[daysSinceEpoch % entries.length];
}

function pickPracticeEntry(entries) {
  if (!entries.length) {
    throw new Error("The Google Sheet does not contain usable entries.");
  }

  const randomValue = window.crypto?.getRandomValues
    ? window.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296
    : Math.random();

  return entries[Math.floor(randomValue * entries.length)];
}

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeImageUrl(value) {
  const url = String(value).trim();
  const fileMarker = "/File:";
  const fileIndex = url.indexOf(fileMarker);

  if (url.includes("wikipedia.org/wiki/") && fileIndex > -1) {
    const fileName = url.slice(fileIndex + fileMarker.length).split(/[?#]/)[0];

    return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${fileName}`;
  }

  return url;
}

function setLoadingState(isLoading) {
  dailyButton.disabled = isLoading;
  practiceButton.disabled = isLoading;
  levelSelectButton.disabled = isLoading;
  dailyButton.hidden = currentMode === "daily";
  dailyButton.textContent =
    isLoading
      ? "Loading..."
      : currentMode === "practice" || currentMode === "level-select"
        ? "New entry"
        : "Daily";
}

function setStatus(message) {
  if (statusMessage) {
    statusMessage.textContent = message;
  }
}

function setFormMessage(message) {
  if (formMessage) {
    formMessage.textContent = message;
  }
}

function startReducingBlur() {
  if (isReducingBlur || !imageFrame.classList.contains("is-ready")) {
    return;
  }

  isReducingBlur = true;
  lastFrameTime = performance.now();
  animationFrameId = window.requestAnimationFrame(updateBlurProgress);
}

function stopReducingBlur() {
  if (!isReducingBlur) {
    return;
  }

  isReducingBlur = false;
  window.cancelAnimationFrame(animationFrameId);

  if (resetProgress?.checked) {
    setBlurProgress(0);
  }
}

function updateBlurProgress(currentTime) {
  if (!isReducingBlur) {
    return;
  }

  const elapsedSeconds = (currentTime - lastFrameTime) / 1000;
  lastFrameTime = currentTime;
  setBlurProgress(blurProgress + elapsedSeconds * BLUR_REDUCTION_PER_SECOND);
  animationFrameId = window.requestAnimationFrame(updateBlurProgress);
}

function setBlurProgress(value) {
  blurProgress = Math.min(Math.max(value, 0), 100);
  const blurAmount = MAX_BLUR_PX * (1 - blurProgress / 100);
  const saturation = grayscaleOnly?.checked ? 0 : 1;

  imageFrame?.style.setProperty("--blur-amount", `${blurAmount}px`);
  imageFrame?.style.setProperty("--image-saturation", saturation);
  dailyImage.style.filter = `blur(${blurAmount}px) saturate(${saturation})`;

  if (blurProgressFill) {
    blurProgressFill.style.width = `${blurProgress}%`;
  }

  if (nameProgressFill) {
    nameProgressFill.style.width = `${Math.min(
      (blurProgress / NAME_REVEAL_PROGRESS) * 100,
      100
    )}%`;
  }

  if (factProgressFill) {
    factProgressFill.style.width = `${Math.min(
      (blurProgress / FACT_REVEAL_PROGRESS) * 100,
      100
    )}%`;
  }

  if (blurProgress >= NAME_REVEAL_PROGRESS) {
    markCurrentEntryProgress("names");
  }

  if (blurProgress >= FACT_REVEAL_PROGRESS) {
    markCurrentEntryProgress("facts");
  }

  if (blurProgress >= 100 && !hasCelebratedFullReveal) {
    celebrateFullReveal();
  }

  updateRevealButtons();
}

function updateRevealButtons() {
  revealNameButton.hidden =
    blurProgress < NAME_REVEAL_PROGRESS || dailyName.classList.contains("is-revealed");
  revealFactButton.hidden =
    blurProgress < FACT_REVEAL_PROGRESS || dailyFact.classList.contains("is-revealed");
}

function revealText(element) {
  element.classList.add("is-revealed");
  element.setAttribute("aria-hidden", "false");
  updateRevealButtons();
}

function resetExposureState() {
  stopReducingBlur();
  hasCelebratedFullReveal = false;
  imageFrame.classList.remove("is-ready");
  imageFrame.classList.remove("is-celebrating");
  dailyImage.onload = null;
  dailyImage.onerror = null;
  dailyImage.style.opacity = "0";
  dailyImage.style.filter = `blur(${MAX_BLUR_PX}px) saturate(1)`;
  dailyImage.removeAttribute("src");
  dailyImage.alt = "";
  imageFrame.style.removeProperty("--frame-aspect");
  setBlurProgress(0);
  imagePlaceholder.textContent = "Preparing protected image...";
  dailyName.classList.remove("is-revealed");
  dailyFact.classList.remove("is-revealed");
  dailyName.setAttribute("aria-hidden", "true");
  dailyFact.setAttribute("aria-hidden", "true");
  revealNameButton.hidden = true;
  revealFactButton.hidden = true;
  updateEntryNumber(null);
  updateAchievementStar();
}

function blankProtectedImage() {
  resetExposureState();
  currentEntry = null;
  updateAchievementStar();
  dailyName.textContent = "";
  dailyFact.textContent = "";
  imagePlaceholder.textContent = "Protected image area";
  setStatus("");
}

function updateImageFrameAspect() {
  const naturalRatio = dailyImage.naturalWidth / dailyImage.naturalHeight;
  const boundedRatio = Math.min(Math.max(naturalRatio || 1, 0.72), 1.85);

  imageFrame.style.setProperty("--frame-aspect", boundedRatio);
}

function updateEntryNumber(entry) {
  if (!entryNumber) {
    return;
  }

  entryNumber.textContent = entry ? `#${entry.index + 1}` : "";
}

function celebrateFullReveal() {
  hasCelebratedFullReveal = true;
  markCurrentEntryProgress("images");
  imageFrame.classList.remove("is-celebrating");
  void imageFrame.offsetWidth;
  imageFrame.classList.add("is-celebrating");
}

async function updateProgressCounter(phobia, knownTotal) {
  if (!progressCounter) {
    return;
  }

  if (!phobia || !SHEETS[phobia]) {
    renderProgressCounter(0, 0, 0, 0);
    return;
  }

  const progress = getProgress(phobia);

  if (typeof knownTotal === "number") {
    renderProgressCounter(progress.names.size, progress.facts.size, progress.images.size, knownTotal);
    return;
  }

  renderProgressCounter(progress.names.size, progress.facts.size, progress.images.size, "...");

  try {
    const entries = await fetchSheetEntries(SHEETS[phobia]);
    currentEntryCount = entries.length;
    renderProgressCounter(progress.names.size, progress.facts.size, progress.images.size, entries.length);
  } catch (error) {
    renderProgressCounter(progress.names.size, progress.facts.size, progress.images.size, "?");
  }
}

function renderProgressCounter(names, facts, images, total) {
  progressCounter.innerHTML = `
    <p>Names revealed in this category: ${names}/${total}</p>
    <p>Facts revealed in this category: ${facts}/${total}</p>
    <p>Images fully unblurred in this category: ${images}/${total}</p>
  `;
}

function markCurrentEntryProgress(track) {
  if (!currentPhobia || !currentEntry) {
    return;
  }

  const progress = getProgress(currentPhobia);
  const entryIndex = String(currentEntry.index);

  if (progress[track].has(entryIndex)) {
    return;
  }

  progress[track].add(entryIndex);
  saveProgress(currentPhobia, progress);
  updateProgressCounter(currentPhobia, currentEntryCount);
  updateAchievementStar();
}

function getProgress(phobia) {
  const progress = {
    names: new Set(),
    facts: new Set(),
    images: new Set(),
  };

  try {
    const savedValue = window.localStorage.getItem(getProgressKey(phobia, "all"));
    const parsedValue = JSON.parse(savedValue || "{}");

    progress.names = toIndexSet(parsedValue.names);
    progress.facts = toIndexSet(parsedValue.facts);
    progress.images = toIndexSet(parsedValue.images);
  } catch (error) {
    progress.names = new Set();
    progress.facts = new Set();
    progress.images = new Set();
  }

  const legacyImages = getLegacyUnblurredSet(phobia);
  legacyImages.forEach((index) => progress.images.add(index));

  return progress;
}

function saveProgress(phobia, progress) {
  window.localStorage.setItem(
    getProgressKey(phobia, "all"),
    JSON.stringify({
      names: sortIndexes(progress.names),
      facts: sortIndexes(progress.facts),
      images: sortIndexes(progress.images),
    })
  );
}

function updateAchievementStar() {
  if (!achievementStar || !currentPhobia || !currentEntry) {
    achievementStar.hidden = true;
    return;
  }

  const progress = getProgress(currentPhobia);
  const entryIndex = String(currentEntry.index);
  const level = getEntryAchievementLevel(progress, entryIndex);

  achievementStar.classList.remove("bronze", "silver", "gold");

  if (level === "gold") {
    achievementStar.hidden = false;
    achievementStar.tabIndex = 0;
    achievementStar.classList.add("gold");
    achievementStar.dataset.tooltip = getAchievementTooltip("gold");
    return;
  }

  if (level === "silver") {
    achievementStar.hidden = false;
    achievementStar.tabIndex = 0;
    achievementStar.classList.add("silver");
    achievementStar.dataset.tooltip = getAchievementTooltip("silver");
    return;
  }

  if (level === "bronze") {
    achievementStar.hidden = false;
    achievementStar.tabIndex = 0;
    achievementStar.classList.add("bronze");
    achievementStar.dataset.tooltip = getAchievementTooltip("bronze");
    return;
  }

  achievementStar.hidden = true;
  achievementStar.removeAttribute("tabindex");
}

function getEntryAchievementLevel(progress, entryIndex) {
  if (progress.images.has(entryIndex)) {
    return "gold";
  }

  if (progress.names.has(entryIndex) && progress.facts.has(entryIndex)) {
    return "silver";
  }

  if (progress.names.has(entryIndex)) {
    return "bronze";
  }

  return "";
}

function getAchievementTooltip(level) {
  if (level === "gold") {
    return "You have already unblurred this image completly once!";
  }

  if (level === "silver") {
    return "You have already managed to reveal the name and fact once";
  }

  return "You have already managed to reveal the name once";
}

function getLegacyUnblurredSet(phobia) {
  try {
    const savedValue = window.localStorage.getItem(`phobys:unblurred:${phobia}`);
    const indexes = JSON.parse(savedValue || "[]");

    return toIndexSet(indexes);
  } catch (error) {
    return new Set();
  }
}

function toIndexSet(value) {
  return new Set(Array.isArray(value) ? value.map(String) : []);
}

function sortIndexes(indexes) {
  return [...indexes].sort((a, b) => Number(a) - Number(b));
}

function getProgressKey(phobia, track) {
  return `phobys:progress:${phobia}:${track}`;
}
