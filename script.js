const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const overlay = document.getElementById("overlay");
const overlayLabel = document.getElementById("overlayLabel");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const actionButton = document.getElementById("actionButton");
const difficultySlider = document.getElementById("difficultySlider");
const difficultyValue = document.getElementById("difficultyValue");
const wordCountSlider = document.getElementById("wordCountSlider");
const wordCountValue = document.getElementById("wordCountValue");
const allowedLettersInput = document.getElementById("allowedLettersInput");
const wpmBurst = document.getElementById("wpmBurst");

const wordDisplay = document.getElementById("wordDisplay");
const repeatTrack = document.getElementById("repeatTrack");
const nextLetter = document.getElementById("nextLetter");
const typedDisplay = document.getElementById("typedDisplay");
const wordsScore = document.getElementById("wordsScore");
const pipesScore = document.getElementById("pipesScore");
const lettersScore = document.getElementById("lettersScore");
const bestScore = document.getElementById("bestScore");

const CONFIG = {
  baseGravity: 280,
  defaultDifficulty: 4,
  defaultWordGroups: 1,
  defaultAllowedLetters: "abcdefghijklmnopqrstuvwxyz",
  wordsPerGroup: 1000,
  gravityStep: 50,
  flapBoost: 145,
  maxRiseSpeed: -420,
  maxFallSpeed: 700,
  birdX: 220,
  birdRadius: 18,
  groundHeight: 82,
  pipeWidth: 96,
  pipeGap: 182,
  pipeSpawnSeconds: 1.65,
  pipeBreatherMultiplier: 2.25,
  pipeBreatherMin: 3,
  pipeBreatherMax: 5,
  baseSpeed: 215,
  wordRepeats: 3,
  countdownSeconds: 3,
  burstWindowMs: 15000,
  backgroundChunkWidth: 280
};

const bird = {
  x: CONFIG.birdX,
  y: canvas.height * 0.42,
  vy: 0,
  radius: CONFIG.birdRadius,
  tilt: 0
};

const state = {
  mode: "ready",
  wordsCleared: 0,
  pipesCleared: 0,
  lettersHit: 0,
  best: readBestScore(),
  wordBag: [],
  currentWord: "",
  previousWord: "",
  repeatIndex: 0,
  charIndex: 0,
  letterIndex: 0,
  typedResults: [],
  correctLetterTimes: [],
  bestBurstWpm: 0,
  hasArmor: true,
  armorInvincibleTimer: 0,
  armorShards: [],
  spawnTimer: 0,
  pipeSpawnCount: 0,
  nextBreatherAt: 0,
  nextPipeSpawnSeconds: CONFIG.pipeSpawnSeconds,
  lastTime: 0,
  worldOffset: 0,
  countdownLeft: CONFIG.countdownSeconds
};

let pipes = [];
let animationFrame = 0;

function readBestScore() {
  try {
    return Number(localStorage.getItem("flappy-type-best") || 0);
  } catch {
    return 0;
  }
}

function writeBestScore(value) {
  try {
    localStorage.setItem("flappy-type-best", String(value));
  } catch {
    return;
  }
}

function shuffle(values) {
  const copy = [...values];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function activeWords() {
  const requestedCount = currentWordGroups() * CONFIG.wordsPerGroup;
  const allowedLetters = new Set(currentAllowedLetters());
  const words = GOOGLE_10000_WORDS
    .slice(0, requestedCount)
    .filter((word) => [...word].every((letter) => allowedLetters.has(letter)));

  return words.length ? words : ["a"];
}

function refillWordBag() {
  state.wordBag = shuffle(activeWords().filter((word) => word !== state.previousWord));
}

function nextWord() {
  if (!state.wordBag.length) {
    refillWordBag();
  }

  const picked = state.wordBag.pop() || "about";
  state.previousWord = state.currentWord;
  state.currentWord = picked;
  state.repeatIndex = 0;
  state.charIndex = 0;
  state.letterIndex = 0;
  state.typedResults = [];
  state.correctLetterTimes = [];
  state.bestBurstWpm = 0;
}

function resetBird() {
  bird.x = CONFIG.birdX;
  bird.y = canvas.height * 0.42;
  bird.vy = 0;
  bird.tilt = 0;
}

function resetGame() {
  state.mode = "ready";
  state.wordsCleared = 0;
  state.pipesCleared = 0;
  state.lettersHit = 0;
  state.correctLetterTimes = [];
  state.bestBurstWpm = 0;
  state.hasArmor = true;
  state.armorInvincibleTimer = 0;
  state.armorShards = [];
  state.spawnTimer = 0;
  state.pipeSpawnCount = 0;
  state.nextBreatherAt = randomBreatherInterval();
  state.nextPipeSpawnSeconds = CONFIG.pipeSpawnSeconds;
  state.lastTime = 0;
  state.worldOffset = 0;
  state.countdownLeft = CONFIG.countdownSeconds;
  pipes = [];

  refillWordBag();
  nextWord();
  resetBird();
  syncHud();
  showOverlay(
    "Ready",
    "Start Flying",
    "Type the repeated word sequence. Correct letters lift the bird, the gaps are just visual, and mistakes flash red without moving the target."
  );
}

function startGame() {
  if (state.mode === "running" || state.mode === "countdown") {
    return;
  }

  if (state.mode === "gameover") {
    resetGame();
  }

  state.mode = "countdown";
  state.lastTime = 0;
  state.countdownLeft = CONFIG.countdownSeconds;
  bird.vy = 0;
  overlay.classList.add("is-hidden");
}

function beginRun() {
  state.mode = "running";
  state.lastTime = 0;
  state.spawnTimer = state.nextPipeSpawnSeconds * 0.55;
  bird.vy = 0;
}

function gameOver() {
  state.mode = "gameover";
  state.best = Math.max(state.best, state.wordsCleared);
  writeBestScore(state.best);
  syncHud();
  showOverlay(
    "Game Over",
    "Try Another Run",
    `You cleared ${state.wordsCleared} word${state.wordsCleared === 1 ? "" : "s"} and passed ${state.pipesCleared} pipe${state.pipesCleared === 1 ? "" : "s"}.`
  );
}

function showOverlay(label, title, text) {
  overlayLabel.textContent = label;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  actionButton.textContent = state.mode === "gameover" ? "Play Again" : "Start Game";
  overlay.classList.remove("is-hidden");
}

function currentSpeed() {
  return CONFIG.baseSpeed + Math.min(state.wordsCleared * 4, 72);
}

function currentGap() {
  return Math.max(146, CONFIG.pipeGap - Math.min(state.wordsCleared * 2.5, 34));
}

function randomBreatherInterval() {
  const range = CONFIG.pipeBreatherMax - CONFIG.pipeBreatherMin + 1;
  return CONFIG.pipeBreatherMin + Math.floor(Math.random() * range);
}

function scheduleNextPipeDelay() {
  state.pipeSpawnCount += 1;

  if (state.pipeSpawnCount >= state.nextBreatherAt) {
    state.nextPipeSpawnSeconds = CONFIG.pipeSpawnSeconds * CONFIG.pipeBreatherMultiplier;
    state.nextBreatherAt = state.pipeSpawnCount + randomBreatherInterval();
    return;
  }

  state.nextPipeSpawnSeconds = CONFIG.pipeSpawnSeconds;
}

function currentDifficulty() {
  return Number(difficultySlider.value || CONFIG.defaultDifficulty);
}

function currentWordGroups() {
  return Number(wordCountSlider.value || CONFIG.defaultWordGroups);
}

function currentAllowedLetters() {
  return allowedLettersInput.value || CONFIG.defaultAllowedLetters;
}

function currentGravity() {
  return CONFIG.baseGravity + (currentDifficulty() - CONFIG.defaultDifficulty) * CONFIG.gravityStep;
}

function syncDifficulty() {
  difficultyValue.textContent = String(currentDifficulty());
}

function syncWordCount() {
  wordCountValue.textContent = String(currentWordGroups());
}

function updateWordCount() {
  syncWordCount();
  refillWordBag();

  if (!activeWords().includes(state.currentWord)) {
    nextWord();
    syncHud();
  }
}

function updateAllowedLetters() {
  const normalizedLetters = [...new Set(allowedLettersInput.value.toLowerCase().replace(/[^a-z]/g, ""))]
    .sort()
    .join("");
  allowedLettersInput.value = normalizedLetters;
  refillWordBag();

  if (!activeWords().includes(state.currentWord)) {
    nextWord();
    syncHud();
  }
}

function targetPhrase() {
  return Array(CONFIG.wordRepeats).fill(state.currentWord).join(" ");
}

function syncPhrasePosition() {
  state.repeatIndex = Math.min(CONFIG.wordRepeats - 1, Math.floor(state.letterIndex / state.currentWord.length));
  state.charIndex = state.letterIndex - state.repeatIndex * state.currentWord.length;
}

function targetLetters() {
  return state.currentWord.repeat(CONFIG.wordRepeats);
}

function phraseIndexForLetterIndex(letterIndex) {
  const wordLength = state.currentWord.length;
  const repeat = Math.min(CONFIG.wordRepeats - 1, Math.floor(letterIndex / wordLength));
  const char = letterIndex - repeat * wordLength;

  return repeat * (wordLength + 1) + char;
}

function letterIndexForPhraseIndex(phraseIndex) {
  const wordLength = state.currentWord.length;
  const segmentLength = wordLength + 1;
  const repeat = Math.floor(phraseIndex / segmentLength);
  const char = phraseIndex - repeat * segmentLength;

  if (char >= wordLength) {
    return -1;
  }

  return repeat * wordLength + char;
}

function pruneBurstTimes(now = performance.now()) {
  const cutoff = now - CONFIG.burstWindowMs;
  state.correctLetterTimes = state.correctLetterTimes.filter((time) => time >= cutoff);
}

function recordCorrectLetter() {
  const now = performance.now();
  pruneBurstTimes(now);
  state.correctLetterTimes.push(now);
  updateBurstWpm(now);
}

function updateBurstWpm(now = performance.now()) {
  pruneBurstTimes(now);
  let best = 0;

  for (let i = 2; i < state.correctLetterTimes.length; i += 1) {
    const elapsedMs = state.correctLetterTimes[i] - state.correctLetterTimes[i - 2];

    if (elapsedMs > 0) {
      best = Math.max(best, 72000 / elapsedMs);
    }
  }

  state.bestBurstWpm = Math.round(best);
  wpmBurst.textContent = String(state.bestBurstWpm);
}

function spawnPipe() {
  const gap = currentGap();
  const ceilingMargin = 60;
  const groundY = canvas.height - CONFIG.groundHeight;
  const minTopHeight = 72;
  const maxTopHeight = groundY - gap - ceilingMargin;
  const topHeight = minTopHeight + Math.random() * Math.max(10, maxTopHeight - minTopHeight);
  const pipeNumber = state.pipeSpawnCount + 1;

  pipes.push({
    number: pipeNumber,
    isGolden: pipeNumber % 10 === 0,
    x: canvas.width + CONFIG.pipeWidth,
    width: CONFIG.pipeWidth,
    topHeight,
    gap,
    scored: false
  });
}

function bumpBird() {
  bird.vy = Math.max(CONFIG.maxRiseSpeed, bird.vy - CONFIG.flapBoost);
}

function advanceWord(wasCorrect) {
  state.typedResults[state.letterIndex] = wasCorrect;
  state.letterIndex += 1;

  if (wasCorrect) {
    state.lettersHit += 1;
    recordCorrectLetter();
    bumpBird();
  }

  if (state.letterIndex >= targetLetters().length) {
    state.wordsCleared += 1;
    nextWord();
  } else {
    syncPhrasePosition();
  }

  syncHud();
}

function handleCharacterInput(character) {
  if (!/^[a-z]$/.test(character) || state.mode === "gameover" || state.mode === "countdown") {
    return;
  }

  if (state.mode === "ready") {
    startGame();
    return;
  }

  const expected = targetLetters()[state.letterIndex];
  advanceWord(character === expected);
}

function undoLastCharacter() {
  if (state.mode !== "running" || state.letterIndex <= 0) {
    return;
  }

  const previousIndex = state.letterIndex - 1;
  const wasCorrect = state.typedResults[previousIndex];
  state.typedResults.pop();
  state.letterIndex = previousIndex;

  if (wasCorrect) {
    state.lettersHit = Math.max(0, state.lettersHit - 1);
    state.correctLetterTimes.pop();
    updateBurstWpm();
  }

  syncPhrasePosition();
  syncHud();
}

function syncHud() {
  wordDisplay.textContent = state.currentWord;
  nextLetter.textContent = targetLetters()[state.letterIndex] || state.currentWord[0] || "";
  wordsScore.textContent = String(state.wordsCleared);
  pipesScore.textContent = String(state.pipesCleared);
  lettersScore.textContent = String(state.lettersHit);
  bestScore.textContent = String(state.best);
  wpmBurst.textContent = String(state.bestBurstWpm);

  renderRepeatTrack();
  renderTypedPreview();
}

function renderRepeatTrack() {
  repeatTrack.innerHTML = "";

  for (let i = 0; i < CONFIG.wordRepeats; i += 1) {
    const chip = document.createElement("div");
    chip.className = "repeat-chip";

    if (i < state.repeatIndex) {
      chip.classList.add("is-complete");
    } else if (i === state.repeatIndex) {
      chip.classList.add("is-active");
      const fill = `${(Math.min(state.charIndex, state.currentWord.length) / state.currentWord.length) * 100}%`;
      chip.style.setProperty("--fill", fill);
    }

    repeatTrack.appendChild(chip);
  }
}

function renderTypedPreview() {
  typedDisplay.innerHTML = "";
  const phrase = targetPhrase();
  const activePhraseIndex = phraseIndexForLetterIndex(state.letterIndex);

  for (let i = 0; i < phrase.length; i += 1) {
    const span = document.createElement("span");
    span.className = "typed-letter";
    span.textContent = phrase[i] === " " ? "" : phrase[i];
    const letterIndex = letterIndexForPhraseIndex(i);

    if (phrase[i] === " ") {
      span.classList.add("is-gap");
    } else if (letterIndex >= 0 && letterIndex < state.letterIndex) {
      span.classList.add(state.typedResults[letterIndex] ? "is-hit" : "is-miss");
    } else if (i === activePhraseIndex) {
      span.classList.add("is-next");
    }

    typedDisplay.appendChild(span);
  }
}

function hitPipe(pipe) {
  const birdTop = bird.y - bird.radius;
  const birdBottom = bird.y + bird.radius;
  const birdLeft = bird.x - bird.radius;
  const birdRight = bird.x + bird.radius;
  const pipeRight = pipe.x + pipe.width;
  const gapTop = pipe.topHeight;
  const gapBottom = pipe.topHeight + pipe.gap;

  if (birdRight < pipe.x || birdLeft > pipeRight) {
    return false;
  }

  return birdTop < gapTop || birdBottom > gapBottom;
}

function breakArmor() {
  state.hasArmor = false;
  state.armorInvincibleTimer = 3;
  bird.vy = Math.min(bird.vy, -180);

  const shardColors = ["#e7f7ff", "#a9cde2", "#6f8da5", "#ffffff"];
  state.armorShards = Array.from({ length: 10 }, (_, index) => ({
    x: bird.x - 8 + (index % 5) * 5,
    y: bird.y - 20 + Math.floor(index / 5) * 5,
    vx: -150 + Math.random() * 210,
    vy: -210 + Math.random() * 120,
    size: 3 + Math.random() * 4,
    rotation: Math.random() * Math.PI,
    spin: -5 + Math.random() * 10,
    color: shardColors[index % shardColors.length],
    life: 1.15
  }));
}

function handlePipeHit(pipe) {
  if (state.armorInvincibleTimer > 0) {
    pipe.armorBroken = true;
    return;
  }

  if (!state.hasArmor || pipe.armorBroken) {
    gameOver();
    return;
  }

  pipe.armorBroken = true;
  breakArmor();
}

function updateArmorShards(dt) {
  state.armorInvincibleTimer = Math.max(0, state.armorInvincibleTimer - dt);

  for (const shard of state.armorShards) {
    shard.x += shard.vx * dt;
    shard.y += shard.vy * dt;
    shard.vy += 760 * dt;
    shard.rotation += shard.spin * dt;
    shard.life -= dt;
  }

  state.armorShards = state.armorShards.filter((shard) => shard.life > 0);
}

function update(dt) {
  if (state.mode === "countdown") {
    state.worldOffset += currentSpeed() * 0.2 * dt;
    state.countdownLeft = Math.max(0, state.countdownLeft - dt);
    bird.y += Math.sin(performance.now() / 260) * 0.16;
    bird.tilt = Math.sin(performance.now() / 420) * 0.08;

    if (state.countdownLeft <= 0) {
      beginRun();
    }

    return;
  }

  if (state.mode !== "running") {
    bird.y += Math.sin(performance.now() / 240) * 0.18;
    updateArmorShards(dt);
    return;
  }

  state.spawnTimer += dt;
  state.worldOffset += currentSpeed() * dt;
  updateBurstWpm();
  updateArmorShards(dt);

  if (state.spawnTimer >= state.nextPipeSpawnSeconds) {
    state.spawnTimer = 0;
    spawnPipe();
    scheduleNextPipeDelay();
  }

  bird.vy = Math.min(CONFIG.maxFallSpeed, bird.vy + currentGravity() * dt);
  bird.y += bird.vy * dt;
  bird.tilt = Math.max(-0.65, Math.min(1.2, bird.vy / 340));

  const groundY = canvas.height - CONFIG.groundHeight;
  const speed = currentSpeed();

  for (const pipe of pipes) {
    pipe.x -= speed * dt;

    if (!pipe.scored && pipe.x + pipe.width < bird.x) {
      pipe.scored = true;
      state.pipesCleared += 1;
      syncHud();
    }

    if (hitPipe(pipe)) {
      handlePipeHit(pipe);
    }
  }

  pipes = pipes.filter((pipe) => pipe.x + pipe.width > -8);

  if (bird.y + bird.radius >= groundY) {
    bird.y = groundY - bird.radius;
    gameOver();
  }

  if (bird.y - bird.radius <= 0) {
    bird.y = bird.radius;
    bird.vy = Math.max(bird.vy, 80);
  }
}

function drawBackground() {
  const groundY = canvas.height - CONFIG.groundHeight;
  drawPixelSky(groundY);
  drawPixelSunAndClouds(groundY);
  drawAtmosphericLayer(0.22, drawFarPixelChunk, 0.42);
  drawAtmosphericLayer(0.42, drawMidPixelChunk, 0.68);
  drawPixelLayer(0.72, drawNearPixelChunk);
  drawPixelGround(groundY);
}

function drawPixelSky(groundY) {
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, "#73d7f5");
  sky.addColorStop(0.42, "#b8f0ee");
  sky.addColorStop(0.72, "#e3f3d6");
  sky.addColorStop(1, "#f5dc96");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, groundY);
}

function drawPixelSunAndClouds(groundY) {
  const sunX = positiveModulo(760 - state.worldOffset * 0.035, canvas.width + 260) - 90;
  pixelRect(sunX, 72, 54, 54, "#fff2a6");
  pixelRect(sunX + 8, 64, 38, 8, "#fff7c8");
  pixelRect(sunX + 8, 126, 38, 8, "#f9d77a");
  pixelRect(sunX - 8, 84, 8, 30, "#fff7c8");
  pixelRect(sunX + 54, 84, 8, 30, "#f4c560");

  drawPixelLayer(0.13, (chunkIndex, x) => {
    const rng = seededRandom(chunkIndex * 91 + 17);
    const cloudCount = rng() > 0.28 ? 1 : 2;

    for (let i = 0; i < cloudCount; i += 1) {
      const cloudX = x + 24 + rng() * 230;
      const cloudY = 58 + rng() * 98;
      const scale = rng() > 0.45 ? 1 : 0.72;
      drawPixelCloud(cloudX, Math.min(cloudY, groundY - 250), scale);
    }
  });
}

function drawPixelLayer(scrollFactor, drawChunk) {
  const chunkWidth = CONFIG.backgroundChunkWidth;
  const offset = state.worldOffset * scrollFactor;
  const firstChunk = Math.floor(offset / chunkWidth) - 1;
  const chunksNeeded = Math.ceil(canvas.width / chunkWidth) + 3;

  for (let i = 0; i < chunksNeeded; i += 1) {
    const chunkIndex = firstChunk + i;
    const x = chunkIndex * chunkWidth - offset;
    drawChunk(chunkIndex, x);
  }
}

function drawAtmosphericLayer(scrollFactor, drawChunk, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  drawPixelLayer(scrollFactor, drawChunk);
  ctx.restore();
}

function drawFarPixelChunk(chunkIndex, x) {
  const groundY = canvas.height - CONFIG.groundHeight;
  const rng = seededRandom(chunkIndex * 131 + 3);
  const biome = chunkBiome(chunkIndex);
  const baseY = groundY - 94;

  if (biome === "city" || biome === "toNature") {
    const buildingCount = 4 + Math.floor(rng() * 3);

    for (let i = 0; i < buildingCount; i += 1) {
      const width = 42 + Math.floor(rng() * 42);
      const height = 72 + Math.floor(rng() * 92);
      const bx = x + i * 76 + Math.floor(rng() * 18);
      const by = baseY - height;
      drawPixelBuilding(bx, by, width, height, rng, true);
    }
  }

  if (biome === "nature" || biome === "toCity" || biome === "toNature") {
    const hillColor = biome === "nature" ? "#7bbd78" : "#86ad7f";
    drawPixelHill(x - 20, baseY + 52, 170, 78, hillColor);
    drawPixelHill(x + 122, baseY + 70, 220, 104, biome === "nature" ? "#6faa6e" : "#789979");
    drawPixelHill(x + 258, baseY + 50, 150, 76, hillColor);
  }
}

function drawMidPixelChunk(chunkIndex, x) {
  const groundY = canvas.height - CONFIG.groundHeight;
  const rng = seededRandom(chunkIndex * 149 + 29);
  const biome = chunkBiome(chunkIndex);

  if (biome === "city") {
    drawCityBlock(x, groundY, rng);
    return;
  }

  if (biome === "toCity") {
    drawPixelTrees(x, groundY, rng, 3);
    drawTownBlock(x + 142, groundY, rng);
    drawCityBlock(x + 232, groundY, rng, 0.68);
    return;
  }

  if (biome === "toNature") {
    drawCityBlock(x - 12, groundY, rng, 0.7);
    drawTownBlock(x + 128, groundY, rng);
    drawPixelTrees(x + 228, groundY, rng, 3);
    return;
  }

  drawPixelTrees(x, groundY, rng, 6);
  drawPixelFence(x, groundY, rng);
}

function drawNearPixelChunk(chunkIndex, x) {
  const groundY = canvas.height - CONFIG.groundHeight;
  const rng = seededRandom(chunkIndex * 181 + 43);
  const biome = chunkBiome(chunkIndex);

  if (biome === "city") {
    for (let i = 0; i < 3; i += 1) {
      const lampX = x + 38 + i * 112 + Math.floor(rng() * 18);
      drawPixelStreetlight(lampX, groundY);
    }
    return;
  }

  if (biome === "toCity" || biome === "toNature") {
    drawPixelFence(x, groundY, rng);
    drawPixelMailbox(x + 62 + rng() * 70, groundY);
    drawPixelStreetlight(x + 230 + rng() * 38, groundY);
    return;
  }

  drawPixelFlowers(x, groundY, rng);
}

function drawPixelGround(groundY) {
  pixelRect(0, groundY, canvas.width, CONFIG.groundHeight, "#d6ac5c");
  pixelRect(0, groundY, canvas.width, 10, "#f3d278");
  pixelRect(0, groundY + 10, canvas.width, 10, "#bde072");

  const tileSize = 24;
  const offset = positiveModulo(state.worldOffset * 0.72, tileSize);
  for (let x = -offset; x < canvas.width + tileSize; x += tileSize) {
    pixelRect(x + 5, groundY + 45, 12, 10, "#bd9145");
    pixelRect(x + 2, groundY + 68, 6, 6, "#c99e4e");
  }
}

function chunkBiome(chunkIndex) {
  const cycleLength = 12;
  const cycle = Math.floor(chunkIndex / cycleLength);
  const phase = positiveModulo(chunkIndex, cycleLength);
  const rng = seededRandom(cycle * 257 + 89);
  const natureLength = 4 + Math.floor(rng() * 3);
  const toCityLength = 1;
  const cityLength = 3;
  const toNatureStart = natureLength + toCityLength + cityLength;

  if (phase < natureLength) {
    return "nature";
  }

  if (phase < natureLength + toCityLength) {
    return "toCity";
  }

  if (phase < toNatureStart) {
    return "city";
  }

  return "toNature";
}

function drawPixelCloud(x, y, scale) {
  const s = 8 * scale;
  pixelRect(x + s * 1, y + s * 1, s * 5, s * 3, "rgba(255, 255, 255, 0.74)");
  pixelRect(x, y + s * 2, s * 8, s * 3, "rgba(255, 255, 255, 0.82)");
  pixelRect(x + s * 2, y, s * 3, s * 2, "rgba(255, 255, 255, 0.78)");
  pixelRect(x + s * 6, y + s * 2, s * 3, s * 2, "rgba(255, 255, 255, 0.68)");
  pixelRect(x + s * 1, y + s * 5, s * 6, s, "rgba(199, 232, 237, 0.38)");
}

function drawPixelHill(x, y, width, height, color) {
  const step = 18;
  for (let i = 0; i < width; i += step) {
    const center = width * 0.5;
    const distance = Math.abs(i - center) / center;
    const columnHeight = Math.max(18, height * (1 - distance * distance));
    pixelRect(x + i, y - columnHeight, step + 1, columnHeight, color);
  }
}

function drawCityBlock(x, groundY, rng, scale = 1) {
  const count = 3 + Math.floor(rng() * 3);

  for (let i = 0; i < count; i += 1) {
    const width = (48 + Math.floor(rng() * 40)) * scale;
    const height = (92 + Math.floor(rng() * 112)) * scale;
    const bx = x + i * 70 * scale + Math.floor(rng() * 24);
    const by = groundY - height - 8;
    drawPixelBuilding(bx, by, width, height, rng, false);
  }
}

function drawPixelBuilding(x, y, width, height, rng, muted) {
  const colors = muted
    ? ["#7aa5ae", "#6f9aa8", "#86aab0"]
    : ["#3f6576", "#4b7482", "#355a6f", "#5d7e88"];
  const color = colors[Math.floor(rng() * colors.length)];
  pixelRect(x, y, width, height, color);
  pixelRect(x, y, width, 7, muted ? "#98bcc1" : "#6f92a1");
  pixelRect(x + width - 8, y + 10, 8, height - 10, "rgba(22, 50, 68, 0.2)");

  if (rng() > 0.62) {
    pixelRect(x + 10, y - 10, width - 20, 10, muted ? "#86aab0" : "#587887");
  }

  for (let wy = y + 18; wy < y + height - 10; wy += 20) {
    for (let wx = x + 10; wx < x + width - 12; wx += 18) {
      const lit = rng() > 0.48;
      pixelRect(wx, wy, 8, 10, lit ? "#ffe78a" : "#294b5e");
    }
  }
}

function drawTownBlock(x, groundY, rng) {
  const houseColors = ["#d87854", "#d8a65c", "#c96d78", "#7faec2"];

  for (let i = 0; i < 2; i += 1) {
    const bx = x + i * 86 + Math.floor(rng() * 18);
    const by = groundY - 70 - Math.floor(rng() * 20);
    pixelRect(bx, by + 24, 62, 50, houseColors[Math.floor(rng() * houseColors.length)]);
    pixelRect(bx - 8, by + 12, 78, 14, "#7b4b55");
    pixelRect(bx + 8, by + 42, 12, 14, "#ffe6a3");
    pixelRect(bx + 38, by + 42, 12, 14, "#ffe6a3");
    pixelRect(bx + 25, by + 54, 13, 20, "#5e4051");
  }
}

function drawPixelTrees(x, groundY, rng, count) {
  for (let i = 0; i < count; i += 1) {
    const treeX = x + 12 + i * 55 + Math.floor(rng() * 22);
    const trunkHeight = 34 + Math.floor(rng() * 20);
    const canopySize = 42 + Math.floor(rng() * 22);
    const baseY = groundY - 8;
    pixelRect(treeX + canopySize * 0.42, baseY - trunkHeight, 9, trunkHeight, "#7b553d");
    pixelRect(treeX + canopySize * 0.16, baseY - trunkHeight - canopySize * 0.56, canopySize * 0.72, canopySize * 0.52, "#4d9b5a");
    pixelRect(treeX, baseY - trunkHeight - canopySize * 0.34, canopySize, canopySize * 0.42, "#5ab967");
    pixelRect(treeX + canopySize * 0.22, baseY - trunkHeight - canopySize * 0.78, canopySize * 0.6, canopySize * 0.36, "#6bc56f");
    pixelRect(treeX + canopySize * 0.62, baseY - trunkHeight - canopySize * 0.24, canopySize * 0.2, canopySize * 0.12, "#3f874d");
  }
}

function drawPixelFence(x, groundY, rng) {
  const y = groundY - 38;
  pixelRect(x, y + 12, CONFIG.backgroundChunkWidth, 7, "#d7c28b");
  pixelRect(x, y + 28, CONFIG.backgroundChunkWidth, 7, "#bd9f68");

  for (let px = x + Math.floor(rng() * 18); px < x + CONFIG.backgroundChunkWidth; px += 34) {
    pixelRect(px, y, 8, 42, "#e8d59b");
  }
}

function drawPixelFlowers(x, groundY, rng) {
  for (let i = 0; i < 10; i += 1) {
    const fx = x + Math.floor(rng() * CONFIG.backgroundChunkWidth);
    const fy = groundY - 18 - Math.floor(rng() * 14);
    pixelRect(fx, fy + 6, 3, 8, "#3f8b49");
    pixelRect(fx - 3, fy, 4, 4, rng() > 0.5 ? "#ffdf5a" : "#f46f70");
    pixelRect(fx + 2, fy + 1, 4, 4, rng() > 0.5 ? "#f46f70" : "#ffffff");
  }
}

function drawPixelStreetlight(x, groundY) {
  pixelRect(x, groundY - 78, 6, 70, "#3e5360");
  pixelRect(x - 7, groundY - 82, 20, 6, "#3e5360");
  pixelRect(x + 7, groundY - 76, 14, 10, "#ffe69a");
  pixelRect(x + 9, groundY - 66, 10, 4, "rgba(255, 230, 154, 0.42)");
}

function drawPixelMailbox(x, groundY) {
  pixelRect(x, groundY - 42, 7, 34, "#6c4b3c");
  pixelRect(x - 10, groundY - 58, 34, 18, "#477aa0");
  pixelRect(x - 10, groundY - 64, 24, 8, "#5e99bc");
  pixelRect(x + 14, groundY - 54, 10, 14, "#315775");
}

function pixelRect(x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(width), Math.ceil(height));
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function seededRandom(seed) {
  let value = Math.floor(seed) || 1;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function drawPipes() {
  const groundY = canvas.height - CONFIG.groundHeight;

  for (const pipe of pipes) {
    const capHeight = 24;
    const gapBottom = pipe.topHeight + pipe.gap;
    const bodyColor = pipe.isGolden ? "#f4bd2f" : "#35ad61";
    const capColor = pipe.isGolden ? "#d99a18" : "#2c9553";
    const shineColor = pipe.isGolden ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.18)";

    ctx.fillStyle = bodyColor;
    ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
    ctx.fillRect(pipe.x, gapBottom, pipe.width, groundY - gapBottom);

    ctx.fillStyle = capColor;
    ctx.fillRect(pipe.x - 4, pipe.topHeight - capHeight, pipe.width + 8, capHeight);
    ctx.fillRect(pipe.x - 4, gapBottom, pipe.width + 8, capHeight);

    ctx.fillStyle = shineColor;
    ctx.fillRect(pipe.x + 12, 0, 10, pipe.topHeight);
    ctx.fillRect(pipe.x + 12, gapBottom, 10, groundY - gapBottom);

    if (pipe.isGolden) {
      drawGoldenPipeNumber(pipe, gapBottom, groundY);
    }
  }
}

function drawGoldenPipeNumber(pipe, gapBottom, groundY) {
  const topLabelY = Math.max(34, pipe.topHeight - 54);
  const bottomLabelY = Math.min(groundY - 34, gapBottom + 54);
  const labelX = pipe.x + pipe.width / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '800 26px "Trebuchet MS", sans-serif';
  ctx.fillStyle = "rgba(94, 57, 0, 0.9)";
  ctx.strokeStyle = "rgba(255, 244, 183, 0.95)";
  ctx.lineWidth = 4;

  if (pipe.topHeight > 74) {
    ctx.strokeText(String(pipe.number), labelX, topLabelY);
    ctx.fillText(String(pipe.number), labelX, topLabelY);
  }

  if (groundY - gapBottom > 74) {
    ctx.strokeText(String(pipe.number), labelX, bottomLabelY);
    ctx.fillText(String(pipe.number), labelX, bottomLabelY);
  }

  ctx.restore();
}

function drawParachute() {
  if (state.mode !== "countdown") {
    return;
  }

  const sway = Math.sin(performance.now() / 420) * 5;
  const canopyX = bird.x + sway;
  const canopyY = bird.y - 86;

  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(71, 86, 112, 0.58)";
  ctx.beginPath();
  ctx.moveTo(canopyX - 48, canopyY + 20);
  ctx.lineTo(bird.x - 14, bird.y - 12);
  ctx.moveTo(canopyX - 16, canopyY + 24);
  ctx.lineTo(bird.x - 7, bird.y - 14);
  ctx.moveTo(canopyX + 16, canopyY + 24);
  ctx.lineTo(bird.x + 8, bird.y - 14);
  ctx.moveTo(canopyX + 48, canopyY + 20);
  ctx.lineTo(bird.x + 15, bird.y - 12);
  ctx.stroke();

  const canopy = ctx.createLinearGradient(canopyX - 54, canopyY - 28, canopyX + 54, canopyY + 28);
  canopy.addColorStop(0, "#ffef7a");
  canopy.addColorStop(0.52, "#ff7b5c");
  canopy.addColorStop(1, "#4fc4ff");

  ctx.fillStyle = canopy;
  ctx.strokeStyle = "rgba(22, 50, 68, 0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(canopyX - 58, canopyY + 22);
  ctx.quadraticCurveTo(canopyX - 43, canopyY - 28, canopyX, canopyY - 34);
  ctx.quadraticCurveTo(canopyX + 43, canopyY - 28, canopyX + 58, canopyY + 22);
  ctx.quadraticCurveTo(canopyX + 34, canopyY + 8, canopyX + 18, canopyY + 22);
  ctx.quadraticCurveTo(canopyX, canopyY + 8, canopyX - 18, canopyY + 22);
  ctx.quadraticCurveTo(canopyX - 34, canopyY + 8, canopyX - 58, canopyY + 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.moveTo(canopyX - 18, canopyY + 20);
  ctx.quadraticCurveTo(canopyX - 24, canopyY - 6, canopyX - 18, canopyY - 28);
  ctx.moveTo(canopyX + 18, canopyY + 20);
  ctx.quadraticCurveTo(canopyX + 24, canopyY - 6, canopyX + 18, canopyY - 28);
  ctx.stroke();
  ctx.restore();
}

function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.tilt);

  ctx.fillStyle = "#ffd24f";
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff9d2d";
  ctx.beginPath();
  ctx.moveTo(10, -2);
  ctx.lineTo(28, 2);
  ctx.lineTo(10, 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff1bf";
  ctx.beginPath();
  ctx.ellipse(-4, 4, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(Math.sin(state.worldOffset / 42) * 0.12 - bird.vy / 1800);
  ctx.fillStyle = "#f3b13a";
  ctx.beginPath();
  ctx.ellipse(-6, 1, 12, 7, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(5, -5, 5.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#132738";
  ctx.beginPath();
  ctx.arc(7, -4, 2.2, 0, Math.PI * 2);
  ctx.fill();

  if (state.hasArmor) {
    drawBirdArmor();
  }

  ctx.restore();
}

function drawBirdArmor() {
  const shine = ctx.createLinearGradient(-15, -23, 14, -3);
  shine.addColorStop(0, "#f3fbff");
  shine.addColorStop(0.48, "#a9cde2");
  shine.addColorStop(1, "#5d7f99");

  ctx.fillStyle = shine;
  ctx.strokeStyle = "#3f6378";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(-15, -9);
  ctx.lineTo(-10, -19);
  ctx.lineTo(0, -23);
  ctx.lineTo(11, -20);
  ctx.lineTo(17, -11);
  ctx.quadraticCurveTo(7, -15, -2, -14);
  ctx.quadraticCurveTo(-10, -14, -15, -9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#eaf8ff";
  ctx.fillRect(-8, -18, 6, 3);
  ctx.fillRect(2, -20, 7, 3);

  ctx.fillStyle = "rgba(34, 58, 74, 0.74)";
  ctx.fillRect(7, -12, 11, 4);
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fillRect(9, -12, 5, 1);
}

function drawArmorShards() {
  for (const shard of state.armorShards) {
    ctx.save();
    ctx.translate(shard.x, shard.y);
    ctx.rotate(shard.rotation);
    ctx.globalAlpha = Math.max(0, Math.min(1, shard.life));
    ctx.fillStyle = shard.color;
    ctx.strokeStyle = "rgba(55, 82, 102, 0.45)";
    ctx.lineWidth = 1;
    ctx.fillRect(-shard.size / 2, -shard.size / 2, shard.size, shard.size * 0.72);
    ctx.strokeRect(-shard.size / 2, -shard.size / 2, shard.size, shard.size * 0.72);
    ctx.restore();
  }
}

function drawCountdown() {
  if (state.mode !== "countdown") {
    return;
  }

  const number = Math.max(1, Math.ceil(state.countdownLeft));
  const pulse = 1 + (1 - (state.countdownLeft % 1 || 1)) * 0.08;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height * 0.36);
  ctx.scale(pulse, pulse);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(22, 50, 68, 0.25)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(255, 255, 255, 0.84)";
  ctx.beginPath();
  ctx.arc(0, 0, 74, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#163244";
  ctx.font = '800 82px "Trebuchet MS", sans-serif';
  ctx.fillText(String(number), 0, 6);
  ctx.restore();
}

function drawPhraseBanner() {
  const phrase = targetPhrase();
  const activePhraseIndex = phraseIndexForLetterIndex(state.letterIndex);
  ctx.save();

  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  roundRect(ctx, 86, 24, canvas.width - 172, 74, 20);
  ctx.fill();

  let fontSize = 30;
  let gap = 7;
  let metrics = measurePhrase(phrase, fontSize, gap);

  while (metrics.width > canvas.width - 220 && fontSize > 17) {
    fontSize -= 1;
    gap = Math.max(4, gap - 0.1);
    metrics = measurePhrase(phrase, fontSize, gap);
  }

  const startX = (canvas.width - metrics.width) / 2;
  const centerY = 61;
  let x = startX;

  ctx.textBaseline = "middle";

  for (let i = 0; i < phrase.length; i += 1) {
    const char = phrase[i];
    const width = char === " " ? Math.max(20, fontSize * 0.72) : metrics.charWidths[i];
    const isGap = char === " ";
    const letterIndex = letterIndexForPhraseIndex(i);
    const isTyped = !isGap && letterIndex >= 0 && letterIndex < state.letterIndex;
    const isHit = isTyped && state.typedResults[letterIndex];
    const isMiss = isTyped && !state.typedResults[letterIndex];
    const isNext = i === activePhraseIndex;

    if (isHit || isMiss || isNext) {
      ctx.fillStyle = isMiss
        ? "rgba(201, 74, 74, 0.88)"
        : isHit
          ? "rgba(43, 159, 100, 0.86)"
          : "rgba(255, 214, 77, 0.42)";
      roundRect(ctx, x - 5, centerY - 22, width + 10, 44, 12);
      ctx.fill();
    }

    if (isNext && !isMiss) {
      ctx.strokeStyle = "rgba(218, 170, 0, 0.56)";
      ctx.lineWidth = 2;
      roundRect(ctx, x - 5, centerY - 22, width + 10, 44, 12);
      ctx.stroke();
    }

    if (!isGap) {
      ctx.fillStyle = isHit || isMiss ? "#ffffff" : "#163244";
      ctx.font = `800 ${fontSize}px "Trebuchet MS", sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(char, x, centerY + 1);
    }

    x += width + gap;
  }

  ctx.restore();
}

function measurePhrase(phrase, fontSize, gap) {
  ctx.font = `800 ${fontSize}px "Trebuchet MS", sans-serif`;
  const charWidths = [...phrase].map((char) => {
    if (char === " ") {
      return Math.max(20, fontSize * 0.72);
    }

    return ctx.measureText(char).width;
  });
  const width = charWidths.reduce((total, value) => total + value, 0) + gap * (phrase.length - 1);

  return { charWidths, width };
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawPipes();
  drawParachute();
  drawBird();
  drawArmorShards();
  drawPhraseBanner();
  drawCountdown();
}

function tick(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }

  const dt = Math.min(0.032, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;

  update(dt);
  render();
  animationFrame = requestAnimationFrame(tick);
}

function handleKeydown(event) {
  if (event.target === allowedLettersInput) {
    return;
  }

  const key = event.key.toLowerCase();

  if (event.key === "Enter") {
    event.preventDefault();
    if (state.mode !== "running" && state.mode !== "countdown") {
      resetGame();
      startGame();
    }
    return;
  }

  if (event.key === " ") {
    event.preventDefault();
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    undoLastCharacter();
    return;
  }

  handleCharacterInput(key);
}

actionButton.addEventListener("click", () => {
  if (state.mode === "gameover") {
    resetGame();
  }

  startGame();
});

difficultySlider.addEventListener("input", syncDifficulty);
wordCountSlider.addEventListener("input", updateWordCount);
allowedLettersInput.addEventListener("input", updateAllowedLetters);
window.addEventListener("keydown", handleKeydown);

syncDifficulty();
syncWordCount();
resetGame();
cancelAnimationFrame(animationFrame);
animationFrame = requestAnimationFrame(tick);
