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
const wpmInput = document.getElementById("wpmInput");
const groupSize = document.getElementById("groupSize");
const comprehensionInput = document.getElementById("comprehensionInput");
const comprehensionValue = document.getElementById("comprehensionValue");
const semanticPauseInput = document.getElementById("semanticPauseInput");
const punctuationPauseInput = document.getElementById("punctuationPauseInput");
const wordCount = document.getElementById("wordCount");
const durationLabel = document.getElementById("durationLabel");
const chunkCount = document.getElementById("chunkCount");

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
  return {
    words,
    text: words.join(" "),
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

  wordDisplay.textContent = chunk ? chunk.text : "Metin yok";
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

sourceText.addEventListener("input", () => rebuild(true));
groupSize.addEventListener("change", () => rebuild(true));
wpmInput.addEventListener("input", render);
semanticPauseInput.addEventListener("change", render);
punctuationPauseInput.addEventListener("change", render);
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

document.addEventListener("keydown", (event) => {
  if (event.target.matches("textarea, input, select")) return;
  if (event.code === "Space") {
    event.preventDefault();
    togglePlay();
  }
  if (event.key === "ArrowLeft") move(-1);
  if (event.key === "ArrowRight") move(1);
});

rebuild(false);
