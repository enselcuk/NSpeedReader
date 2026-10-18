const sampleText = `Hızlı okuma yalnızca kelimeleri daha hızlı görmek değildir. Göz, kısa sıçramalarla ilerler; beyin ise anlamı cümle parçaları halinde toplar. Bu yüzden iyi bir okuma ritmi, her kelimeye aynı süreyi vermek yerine uzun kelimelerde, noktalama işaretlerinde ve yeni fikir başlangıçlarında küçük duraklamalar yapar. Böylece hız artarken anlama korunur.`;

const sourceText = document.getElementById("sourceText");
const wordDisplay = document.getElementById("wordDisplay");
const previousText = document.getElementById("previousText");
const nextText = document.getElementById("nextText");
const progressLabel = document.getElementById("progressLabel");
const progressBar = document.getElementById("progressBar");
const positionSlider = document.getElementById("positionSlider");
const positionLabel = document.getElementById("positionLabel");
const pauseLabel = document.getElementById("pauseLabel");
const playBtn = document.getElementById("playBtn");
const playIcon = document.getElementById("playIcon");
const playText = document.getElementById("playText");
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const resetBtn = document.getElementById("resetBtn");
const pasteBtn = document.getElementById("pasteBtn");
const quickPasteBtn = document.getElementById("quickPasteBtn");
const clearBtn = document.getElementById("clearBtn");
const textStatus = document.getElementById("textStatus");
const wpmInput = document.getElementById("wpmInput");
const groupSize = document.getElementById("groupSize");
const comprehensionInput = document.getElementById("comprehensionInput");
const comprehensionValue = document.getElementById("comprehensionValue");
const fontFamilyInput = document.getElementById("fontFamilyInput");
const themeInput = document.getElementById("themeInput");
const fontSizeInput = document.getElementById("fontSizeInput");
const fontSizeValue = document.getElementById("fontSizeValue");
const backgroundColorInput = document.getElementById("backgroundColorInput");
const textColorInput = document.getElementById("textColorInput");
const focusColorInput = document.getElementById("focusColorInput");
const semanticPauseInput = document.getElementById("semanticPauseInput");
const punctuationPauseInput = document.getElementById("punctuationPauseInput");
const focusLetterInput = document.getElementById("focusLetterInput");
const breathingPauseInput = document.getElementById("breathingPauseInput");
const wordCount = document.getElementById("wordCount");
const durationLabel = document.getElementById("durationLabel");
const chunkCount = document.getElementById("chunkCount");
const quickFontSize = document.getElementById("quickFontSize");
const fontDownBtn = document.getElementById("fontDownBtn");
const fontUpBtn = document.getElementById("fontUpBtn");
const settingsToggle = document.getElementById("settingsToggle");
const settingsClose = document.getElementById("settingsClose");
const settingsBackdrop = document.getElementById("settingsBackdrop");

const fontStacks = {
  system: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
  serif: `Georgia, "Times New Roman", serif`,
  mono: `"SFMono-Regular", Consolas, "Liberation Mono", monospace`,
  dyslexic: `"Trebuchet MS", Verdana, Arial, sans-serif`,
};

const themes = {
  paper: {
    pageStart: "#f7faf8",
    pageMid: "#eef4f8",
    pageEnd: "#f8f4ef",
    background: "#fbf7ef",
    text: "#18212f",
    focus: "#be123c",
    context: "rgba(102, 112, 133, 0.72)",
  },
  warm: {
    pageStart: "#f8f1e8",
    pageMid: "#f5eadc",
    pageEnd: "#eef3ee",
    background: "#fff4df",
    text: "#2b2118",
    focus: "#0f766e",
    context: "rgba(92, 76, 59, 0.72)",
  },
  sage: {
    pageStart: "#eef6f0",
    pageMid: "#e3efe8",
    pageEnd: "#f6f4ea",
    background: "#eef7ed",
    text: "#14231a",
    focus: "#b45309",
    context: "rgba(70, 93, 78, 0.76)",
  },
  night: {
    pageStart: "#111827",
    pageMid: "#172033",
    pageEnd: "#20212b",
    background: "#101820",
    text: "#edf2ec",
    focus: "#fbbf24",
    context: "rgba(210, 221, 214, 0.62)",
  },
};

let chunks = [];
let currentIndex = 0;
let timer = null;

sourceText.value = sampleText;

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function tokenize(text) {
  const matches = normalizeText(text).match(/[^\s]+/g);
  return matches ? matches : [];
}

function cleanWord(word) {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function hasSentenceEnd(word) {
  return /[.!?…]["')\]]?$/.test(word);
}

function hasClauseBreak(word) {
  return /[,;:]["')\]]?$/.test(word);
}

function startsNewIdea(word) {
  return /^(ama|fakat|çünkü|ancak|böylece|dolayısıyla|sonra|önce|ayrıca|örneğin|bu yüzden|therefore|however|because|meanwhile)$/i.test(cleanWord(word));
}

function shouldEndChunk(words, startIndex, sizeMode) {
  const last = words[words.length - 1] || "";
  if (hasSentenceEnd(last) || hasClauseBreak(last)) return true;
  if (sizeMode !== "auto") return words.length >= Number(sizeMode);

  const averageLength = words.reduce((sum, word) => sum + cleanWord(word).length, 0) / words.length;
  if (words.length >= 3) return true;
  if (words.length >= 2 && averageLength >= 7) return true;
  if (startIndex > 0 && words.length >= 1 && startsNewIdea(words[0])) return true;
  return false;
}

function buildChunks() {
  const words = tokenize(sourceText.value);
  const result = [];
  const mode = groupSize.value;
  let buffer = [];
  let start = 0;

  words.forEach((word, index) => {
    if (buffer.length === 0) start = index;
    buffer.push(word);

    if (shouldEndChunk(buffer, start, mode)) {
      result.push(createChunk(buffer, start));
      buffer = [];
    }
  });

  if (buffer.length) result.push(createChunk(buffer, start));
  return result;
}

function createChunk(words, startIndex) {
  const rawText = words.join(" ");
  return {
    words,
    text: rawText,
    startIndex,
    wordCount: words.length,
    lastWord: words[words.length - 1] || "",
  };
}

function getDelay(chunk) {
  const wpm = clamp(Number(wpmInput.value) || 360, 80, 900);
  const basePerWord = 60000 / wpm;
  const comprehension = Number(comprehensionInput.value) / 100;
  const textLength = chunk.words.reduce((sum, word) => sum + cleanWord(word).length, 0);
  let delay = basePerWord * chunk.wordCount;

  if (punctuationPauseInput.checked) {
    if (hasSentenceEnd(chunk.lastWord)) delay += 300 + 420 * comprehension;
    else if (hasClauseBreak(chunk.lastWord)) delay += 130 + 260 * comprehension;
  }

  if (semanticPauseInput.checked) {
    if (textLength >= 16) delay += 90 + textLength * 5 * comprehension;
    if (chunk.words.some((word) => startsNewIdea(word))) delay += 180 * comprehension;
    if (chunk.text.includes("(") || chunk.text.includes(")") || chunk.text.includes("-")) delay += 100 * comprehension;
  }

  if (breathingPauseInput.checked && hasSentenceEnd(chunk.lastWord) && chunk.wordCount >= 2) {
    delay += 140 + 180 * comprehension;
  }

  return Math.round(clamp(delay, 140, 2200));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rebuild(keepIndex = true) {
  const oldIndex = currentIndex;
  chunks = buildChunks();
  currentIndex = keepIndex ? clamp(oldIndex, 0, Math.max(chunks.length - 1, 0)) : 0;
  positionSlider.max = String(Math.max(chunks.length - 1, 0));
  render();
}

function render() {
  const chunk = chunks[currentIndex];
  const totalWords = chunks.reduce((sum, item) => sum + item.wordCount, 0);
  const readWords = chunks.slice(0, currentIndex).reduce((sum, item) => sum + item.wordCount, 0) + (chunk ? chunk.wordCount : 0);
  const progress = chunks.length ? Math.round((currentIndex / Math.max(chunks.length - 1, 1)) * 100) : 0;

  renderWordDisplay(chunk);
  previousText.textContent = chunks[currentIndex - 1]?.text || "";
  nextText.textContent = chunks[currentIndex + 1]?.text || "";
  positionSlider.value = String(currentIndex);
  positionLabel.textContent = chunks.length ? `${currentIndex + 1} / ${chunks.length}` : "0 / 0";
  pauseLabel.textContent = chunk ? `Duraklama: ${getDelay(chunk)} ms` : "Duraklama: 0 ms";
  progressLabel.textContent = `${progress}%`;
  progressBar.style.width = `${progress}%`;
  wordCount.textContent = String(totalWords);
  chunkCount.textContent = String(chunks.length);
  durationLabel.textContent = formatDuration(estimateDuration());
  backBtn.disabled = currentIndex <= 0;
  forwardBtn.disabled = currentIndex >= chunks.length - 1;
  positionSlider.disabled = chunks.length === 0;

  if (totalWords === 0) positionLabel.textContent = `${readWords} / ${totalWords}`;
}

function renderWordDisplay(chunk) {
  wordDisplay.replaceChildren();
  if (!chunk) {
    wordDisplay.textContent = "Metin yok";
    return;
  }

  chunk.words.forEach((word, index) => {
    if (index > 0) {
      const space = document.createElement("span");
      space.className = "word-space";
      space.textContent = " ";
      wordDisplay.append(space);
    }
    wordDisplay.append(createWordToken(word));
  });
}

function createWordToken(word) {
  const token = document.createElement("span");
  token.className = "word-token";

  if (!focusLetterInput.checked) {
    token.textContent = word;
    return token;
  }

  const letters = Array.from(word);
  const visibleLetters = letters
    .map((letter, index) => ({ letter, index }))
    .filter(({ letter }) => /\p{L}|\p{N}/u.test(letter));

  if (visibleLetters.length < 2) {
    token.textContent = word;
    return token;
  }

  const focusVisibleIndex = getFocusIndex(visibleLetters.length);
  const focusIndex = visibleLetters[focusVisibleIndex].index;

  letters.forEach((letter, index) => {
    const span = document.createElement("span");
    span.textContent = letter;
    if (index === focusIndex) span.className = "focus-letter";
    token.append(span);
  });

  return token;
}

function getFocusIndex(length) {
  if (length <= 1) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  return 3;
}

function estimateDuration() {
  return chunks.reduce((sum, chunk) => sum + getDelay(chunk), 0);
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function play() {
  if (!chunks.length) return;
  stop(false);
  playBtn.dataset.playing = "true";
  playIcon.textContent = "⏸";
  playText.textContent = "Duraklat";
  scheduleNext();
}

function scheduleNext() {
  render();
  const chunk = chunks[currentIndex];
  if (!chunk) {
    stop();
    return;
  }

  timer = window.setTimeout(() => {
    if (currentIndex >= chunks.length - 1) {
      stop();
      return;
    }
    currentIndex += 1;
    scheduleNext();
  }, getDelay(chunk));
}

function stop(renderAfter = true) {
  if (timer) window.clearTimeout(timer);
  timer = null;
  playBtn.dataset.playing = "false";
  playIcon.textContent = "▶";
  playText.textContent = "Oynat";
  if (renderAfter) render();
}

function togglePlay() {
  if (playBtn.dataset.playing === "true") stop();
  else play();
}

function move(delta) {
  stop(false);
  currentIndex = clamp(currentIndex + delta, 0, Math.max(chunks.length - 1, 0));
  render();
}

function reset() {
  stop(false);
  currentIndex = 0;
  render();
}

let statusTimer = null;

function showStatus(message) {
  textStatus.textContent = message;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    textStatus.textContent = "";
  }, 3000);
}

function setText(text) {
  stop(false);
  sourceText.value = text;
  rebuild(false);
}

function clearText() {
  setText("");
  sourceText.focus();
  showStatus("Metin temizlendi.");
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showStatus("Panoda metin yok.");
      return;
    }
    setText(text);
    showStatus("Panodaki metin yapıştırıldı.");
  } catch {
    // Clipboard read blocked (permission or insecure context): fall back to manual paste.
    setSettingsOpen(true);
    sourceText.focus();
    sourceText.select();
    showStatus("Pano erişimi yok; metni elle yapıştırın (Ctrl/Cmd+V).");
  }
}

function applyReadingStyle() {
  const root = document.documentElement;
  const fontSize = `${fontSizeInput.value}px`;
  root.style.setProperty("--reader-font", fontStacks[fontFamilyInput.value] || fontStacks.system);
  root.style.setProperty("--reader-size", fontSize);
  fontSizeValue.textContent = fontSize.replace("px", " px");
  quickFontSize.textContent = fontSizeValue.textContent;
  render();
}

function applyTheme(themeName = themeInput.value) {
  const theme = themes[themeName] || {
    pageStart: backgroundColorInput.value,
    pageMid: backgroundColorInput.value,
    pageEnd: backgroundColorInput.value,
    background: backgroundColorInput.value,
    text: textColorInput.value,
    focus: focusColorInput.value,
    context: mixContextColor(textColorInput.value),
  };
  const root = document.documentElement;

  root.style.setProperty("--page-start", theme.pageStart);
  root.style.setProperty("--page-mid", theme.pageMid);
  root.style.setProperty("--page-end", theme.pageEnd);
  root.style.setProperty("--reader-bg", theme.background);
  root.style.setProperty("--reader-text", theme.text);
  root.style.setProperty("--focus-letter", theme.focus);
  root.style.setProperty("--reader-context", theme.context);

  backgroundColorInput.value = theme.background;
  textColorInput.value = theme.text;
  focusColorInput.value = theme.focus;
  render();
}

function applyCustomTheme() {
  themeInput.value = "custom";
  applyTheme("custom");
}

function mixContextColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "rgba(102, 112, 133, 0.72)";
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.62)`;
}

function hexToRgb(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

sourceText.addEventListener("input", () => rebuild(true));
groupSize.addEventListener("change", () => rebuild(true));
wpmInput.addEventListener("input", render);
semanticPauseInput.addEventListener("change", render);
punctuationPauseInput.addEventListener("change", render);
breathingPauseInput.addEventListener("change", render);
focusLetterInput.addEventListener("change", render);
fontFamilyInput.addEventListener("change", applyReadingStyle);
fontSizeInput.addEventListener("input", applyReadingStyle);
themeInput.addEventListener("change", () => applyTheme());
backgroundColorInput.addEventListener("input", applyCustomTheme);
textColorInput.addEventListener("input", applyCustomTheme);
focusColorInput.addEventListener("input", applyCustomTheme);
comprehensionInput.addEventListener("input", () => {
  comprehensionValue.textContent = `${comprehensionInput.value}%`;
  render();
});
positionSlider.addEventListener("input", () => {
  stop(false);
  currentIndex = Number(positionSlider.value);
  render();
});
playBtn.addEventListener("click", togglePlay);
backBtn.addEventListener("click", () => move(-1));
forwardBtn.addEventListener("click", () => move(1));
resetBtn.addEventListener("click", reset);
pasteBtn.addEventListener("click", pasteFromClipboard);
quickPasteBtn.addEventListener("click", pasteFromClipboard);
clearBtn.addEventListener("click", clearText);

function stepFontSize(delta) {
  const next = clamp(Number(fontSizeInput.value) + delta, Number(fontSizeInput.min), Number(fontSizeInput.max));
  fontSizeInput.value = String(next);
  applyReadingStyle();
}

function setSettingsOpen(open) {
  document.body.classList.toggle("settings-open", open);
  settingsBackdrop.hidden = !open;
  settingsToggle.setAttribute("aria-expanded", String(open));
  if (open) window.scrollTo({ top: 0, behavior: "smooth" });
}

fontDownBtn.addEventListener("click", () => stepFontSize(-4));
fontUpBtn.addEventListener("click", () => stepFontSize(4));
settingsToggle.addEventListener("click", () => setSettingsOpen(!document.body.classList.contains("settings-open")));
settingsClose.addEventListener("click", () => setSettingsOpen(false));
settingsBackdrop.addEventListener("click", () => setSettingsOpen(false));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setSettingsOpen(false);
  if (event.target.matches("textarea, input, select")) return;
  if (event.code === "Space") {
    event.preventDefault();
    togglePlay();
  }
  if (event.key === "ArrowLeft") move(-1);
  if (event.key === "ArrowRight") move(1);
});

applyTheme("paper");
applyReadingStyle();
rebuild(false);
