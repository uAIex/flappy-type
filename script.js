const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayLabel = document.getElementById("overlayLabel");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const actionButton = document.getElementById("actionButton");

const wordDisplay = document.getElementById("wordDisplay");
const repeatTrack = document.getElementById("repeatTrack");
const nextLetter = document.getElementById("nextLetter");
const typedDisplay = document.getElementById("typedDisplay");
const wordsScore = document.getElementById("wordsScore");
const pipesScore = document.getElementById("pipesScore");
const lettersScore = document.getElementById("lettersScore");
const bestScore = document.getElementById("bestScore");

const CONFIG = {
  gravity: 750,
  flapBoost: 145,
  maxRiseSpeed: -420,
  maxFallSpeed: 700,
  birdX: 220,
  birdRadius: 18,
  groundHeight: 82,
  pipeWidth: 96,
  pipeGap: 182,
  pipeSpawnSeconds: 1.65,
  baseSpeed: 215,
  wordRepeats: 3,
  countdownSeconds: 5
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
  phraseIndex: 0,
  spawnTimer: 0,
  lastTime: 0,
  worldOffset: 0,
  missFlash: 0,
  wrongFlashIndex: -1,
  wrongFlashTimer: 0,
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

function refillWordBag() {
  state.wordBag = shuffle(TOP_500_WORDS.filter((word) => word !== state.previousWord));
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
  state.phraseIndex = 0;
  state.wrongFlashIndex = -1;
  state.wrongFlashTimer = 0;
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
  state.spawnTimer = 0;
  state.lastTime = 0;
  state.worldOffset = 0;
  state.missFlash = 0;
  state.wrongFlashIndex = -1;
  state.wrongFlashTimer = 0;
  state.countdownLeft = CONFIG.countdownSeconds;
  pipes = [];

  refillWordBag();
  nextWord();
  resetBird();
  syncHud();
  showOverlay(
    "Ready",
    "Start Flying",
    "Type the full phrase, including the spaces between words. Correct keys lift the bird, and mistakes flash red without moving the target."
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
  state.spawnTimer = CONFIG.pipeSpawnSeconds * 0.55;
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
  return CONFIG.baseSpeed + Math.min(state.wordsCleared * 8, 72);
}

function currentGap() {
  return Math.max(146, CONFIG.pipeGap - Math.min(state.wordsCleared * 2.5, 34));
}

function targetPhrase() {
  return Array(CONFIG.wordRepeats).fill(state.currentWord).join(" ");
}

function syncPhrasePosition() {
  const segmentLength = state.currentWord.length + 1;
  state.repeatIndex = Math.min(CONFIG.wordRepeats - 1, Math.floor(state.phraseIndex / segmentLength));
  state.charIndex = state.phraseIndex - state.repeatIndex * segmentLength;
}

function spawnPipe() {
  const gap = currentGap();
  const ceilingMargin = 60;
  const groundY = canvas.height - CONFIG.groundHeight;
  const minTopHeight = 72;
  const maxTopHeight = groundY - gap - ceilingMargin;
  const topHeight = minTopHeight + Math.random() * Math.max(10, maxTopHeight - minTopHeight);

  pipes.push({
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

function advanceWord() {
  state.phraseIndex += 1;
  state.lettersHit += 1;
  bumpBird();

  if (state.phraseIndex >= targetPhrase().length) {
    state.wordsCleared += 1;
    nextWord();
  } else {
    syncPhrasePosition();
  }

  syncHud();
}

function handleCharacterInput(character) {
  if (!/^[a-z ]$/.test(character) || state.mode === "gameover" || state.mode === "countdown") {
    return;
  }

  if (state.mode === "ready") {
    startGame();
    return;
  }

  const expected = targetPhrase()[state.phraseIndex];

  if (character === expected) {
    advanceWord();
  } else {
    state.missFlash = 0.22;
    state.wrongFlashIndex = state.phraseIndex;
    state.wrongFlashTimer = 0.36;
    syncHud();
  }
}

function syncHud() {
  wordDisplay.textContent = state.currentWord;
  const nextCharacter = targetPhrase()[state.phraseIndex] || state.currentWord[0] || "";
  nextLetter.textContent = nextCharacter === " " ? "space" : nextCharacter;
  wordsScore.textContent = String(state.wordsCleared);
  pipesScore.textContent = String(state.pipesCleared);
  lettersScore.textContent = String(state.lettersHit);
  bestScore.textContent = String(state.best);

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

  for (let i = 0; i < phrase.length; i += 1) {
    const span = document.createElement("span");
    span.className = "typed-letter";
    span.textContent = phrase[i] === " " ? "space" : phrase[i];

    if (i < state.phraseIndex) {
      span.classList.add("is-hit");
    } else if (i === state.wrongFlashIndex && state.wrongFlashTimer > 0) {
      span.classList.add("is-miss");
    } else if (i === state.phraseIndex) {
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
    return;
  }

  state.spawnTimer += dt;
  state.worldOffset += currentSpeed() * dt;
  state.missFlash = Math.max(0, state.missFlash - dt);
  state.wrongFlashTimer = Math.max(0, state.wrongFlashTimer - dt);

  if (state.spawnTimer >= CONFIG.pipeSpawnSeconds) {
    state.spawnTimer = 0;
    spawnPipe();
  }

  bird.vy = Math.min(CONFIG.maxFallSpeed, bird.vy + CONFIG.gravity * dt);
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
      gameOver();
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
  const horizon = groundY - 82;

  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, "#8fe8ff");
  sky.addColorStop(0.64, "#e7fbff");
  sky.addColorStop(1, "#ffe9ab");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, groundY);

  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = "#fff7d8";
  ctx.beginPath();
  ctx.arc(780, 98, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawCloud(130 - (state.worldOffset * 0.12 % 1120), 110, 1.1);
  drawCloud(470 - (state.worldOffset * 0.1 % 1180), 80, 0.9);
  drawCloud(850 - (state.worldOffset * 0.08 % 1260), 145, 1.28);

  ctx.fillStyle = "#94c981";
  drawHill(-80 - (state.worldOffset * 0.14 % 340), horizon + 28, 360, 110);
  drawHill(210 - (state.worldOffset * 0.14 % 340), horizon + 40, 300, 95);
  drawHill(520 - (state.worldOffset * 0.14 % 340), horizon + 24, 380, 120);
  drawHill(840 - (state.worldOffset * 0.14 % 340), horizon + 38, 320, 90);

  ctx.fillStyle = "#deb35e";
  ctx.fillRect(0, groundY, canvas.width, CONFIG.groundHeight);

  ctx.fillStyle = "#c59743";
  const stripeWidth = 42;
  const stripeOffset = state.worldOffset * 0.7 % stripeWidth;
  for (let x = -stripeOffset; x < canvas.width + stripeWidth; x += stripeWidth) {
    ctx.fillRect(x, groundY + 46, stripeWidth / 2, 14);
  }
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(255, 255, 255, 0.76)";
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.arc(24, -12, 28, 0, Math.PI * 2);
  ctx.arc(56, 0, 22, 0, Math.PI * 2);
  ctx.arc(28, 9, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHill(x, y, width, height) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + width * 0.25, y - height, x + width * 0.5, y - height * 0.4);
  ctx.quadraticCurveTo(x + width * 0.72, y - height * 1.05, x + width, y);
  ctx.lineTo(x + width, canvas.height);
  ctx.lineTo(x, canvas.height);
  ctx.closePath();
  ctx.fill();
}

function drawPipes() {
  const groundY = canvas.height - CONFIG.groundHeight;

  for (const pipe of pipes) {
    const capHeight = 24;
    const gapBottom = pipe.topHeight + pipe.gap;

    ctx.fillStyle = "#35ad61";
    ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
    ctx.fillRect(pipe.x, gapBottom, pipe.width, groundY - gapBottom);

    ctx.fillStyle = "#2c9553";
    ctx.fillRect(pipe.x - 4, pipe.topHeight - capHeight, pipe.width + 8, capHeight);
    ctx.fillRect(pipe.x - 4, gapBottom, pipe.width + 8, capHeight);

    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(pipe.x + 12, 0, 10, pipe.topHeight);
    ctx.fillRect(pipe.x + 12, gapBottom, 10, groundY - gapBottom);
  }
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

  ctx.restore();
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
    const isHit = i < state.phraseIndex;
    const isMiss = i === state.wrongFlashIndex && state.wrongFlashTimer > 0;
    const isNext = i === state.phraseIndex;

    if (isHit || isMiss || isNext) {
      ctx.fillStyle = isMiss
        ? "rgba(201, 74, 74, 0.88)"
        : isHit
          ? "rgba(43, 159, 100, 0.86)"
          : "rgba(255, 139, 66, 0.18)";
      roundRect(ctx, x - 5, centerY - 22, width + 10, 44, 12);
      ctx.fill();
    }

    if (isNext && !isMiss) {
      ctx.strokeStyle = "rgba(234, 95, 27, 0.42)";
      ctx.lineWidth = 2;
      roundRect(ctx, x - 5, centerY - 22, width + 10, 44, 12);
      ctx.stroke();
    }

    if (char === " ") {
      ctx.strokeStyle = isHit ? "rgba(255, 255, 255, 0.82)" : "rgba(22, 50, 68, 0.28)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 3, centerY + 13);
      ctx.lineTo(x + width - 3, centerY + 13);
      ctx.stroke();
    } else {
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

  handleCharacterInput(key);
}

actionButton.addEventListener("click", () => {
  if (state.mode === "gameover") {
    resetGame();
  }

  startGame();
});

window.addEventListener("keydown", handleKeydown);

resetGame();
cancelAnimationFrame(animationFrame);
animationFrame = requestAnimationFrame(tick);
