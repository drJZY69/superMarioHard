// ===== إعداد الكانفس =====
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const levelNumberEl = document.getElementById("level-number");
const deathsCountEl = document.getElementById("deaths-count");
const messageEl = document.getElementById("message");
const btnNext = document.getElementById("btn-next");
const btnRestart = document.getElementById("btn-restart");

// ===== تحكم =====
const keys = {
  left: false,
  right: false,
  jump: false,
};

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW")
    keys.jump = true;

  if (e.code === "KeyR") restartLevel();
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  if (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW")
    keys.jump = false;
});

// ===== أصوات بسيطة (بدون ملفات) =====
function playBeep(type = "normal") {
  try {
    const ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctxAudio.createOscillator();
    const gain = ctxAudio.createGain();

    osc.connect(gain);
    gain.connect(ctxAudio.destination);

    if (type === "win") osc.frequency.value = 880;
    else if (type === "death") osc.frequency.value = 140;
    else if (type === "jump") osc.frequency.value = 440;
    else osc.frequency.value = 300;

    gain.gain.value = 0.05;
    osc.start();
    osc.stop(ctxAudio.currentTime + 0.1);
  } catch (e) {
    // لو المتصفح مانع الصوت، نتجاهل
  }
}

// ===== إعداد اللعبة =====
const TILE_SIZE = 30;
const GRAVITY = 0.5;
const MOVE_SPEED = 3.2;
const JUMP_FORCE = 10;

// الرموز في الماب:
// # = بلوك ثابت
// P = اللاعب
// E = باب الخروج
// ^ = شوك
// K = مفتاح
// D = باب مقفول يحتاج مفتاح
// B = زر (عند الوقوف عليه يفتح بلوكات معينة)
// X = بلوك مخفي يظهر بعد الضغط على الزر
// . = فراغ

// 7 مراحل – من 5 وطالع أصعب
const LEVELS = [
  // 1: مرحلة تعليم بسيطة
  [
    "########################",
    "#......................#",
    "#......................#",
    "#..........E...........#",
    "#......................#",
    "#......................#",
    "#..P...................#",
    "########################",
  ],
  // 2: لازم تقفز فوق حفرة
  [
    "########################",
    "#......................#",
    "#......................#",
    "#..........E...........#",
    "#......................#",
    "#......######..........#",
    "#..P...................#",
    "########################",
  ],
  // 3: شوك تحتك، لازم قفزة دقيقة
  [
    "########################",
    "#......................#",
    "#......................#",
    "#..........E...........#",
    "#......................#",
    "#..^^^^^^..............#",
    "#..P...................#",
    "########################",
  ],
  // 4: مفتاح + باب مقفول
  [
    "########################",
    "#......................#",
    "#..............E.......#",
    "#............D##########",
    "#......................#",
    "#..P........K..........#",
    "########################",
    "########################",
  ],
  // 5: من هنا تبدأ الصعوبة – لازم تضغط زر عشان يطلعلك بلوكات تمشي عليها
  [
    "########################",
    "#......................#",
    "#..........E...........#",
    "#......................#",
    "#..B...................#",
    "#..P.....XXXXXXXXX.....#",
    "########################",
    "########################",
  ],
  // 6: شوك + مفتاح + باب + زر يفتح طريق آمن
  [
    "########################",
    "#......................#",
    "#..............E.......#",
    "#............D##########",
    "#......^^^^^^^^^^......#",
    "#..P..B..K..XXXXXXXX...#",
    "########################",
    "########################",
  ],
  // 7: أخطر مرحلة – قفزات ضيقة، شوك، مفتاح، زر
  [
    "########################",
    "#......................#",
    "#..............E.......#",
    "#............D##########",
    "#....^^^^..............#",
    "#..P..B..K..XXXXXXX....#",
    "#......................#",
    "########################",
  ],
];

let currentLevelIndex = 0;
let deathsCount = 0;

let player = {
  x: 0,
  y: 0,
  w: 24,
  h: 28,
  vx: 0,
  vy: 0,
  onGround: false,
  hasKey: false,
};

let tiles = [];
let exitTile = null;
let doors = [];
let spikes = [];
let buttons = [];
let hiddenBlocks = [];
let buttonActivated = false;

function loadLevel(index) {
  const map = LEVELS[index];
  tiles = [];
  exitTile = null;
  doors = [];
  spikes = [];
  buttons = [];
  hiddenBlocks = [];
  buttonActivated = false;
  player.hasKey = false;

  map.forEach((row, yIndex) => {
    for (let xIndex = 0; xIndex < row.length; xIndex++) {
      const ch = row[xIndex];
      const x = xIndex * TILE_SIZE;
      const y = yIndex * TILE_SIZE;

      if (ch === "#") {
        tiles.push({ x, y, w: TILE_SIZE, h: TILE_SIZE, type: "solid" });
      } else if (ch === "P") {
        player.x = x + 3;
        player.y = y - 5;
      } else if (ch === "E") {
        exitTile = { x, y, w: TILE_SIZE, h: TILE_SIZE };
      } else if (ch === "^") {
        spikes.push({ x, y, w: TILE_SIZE, h: TILE_SIZE });
      } else if (ch === "K") {
        tiles.push({ x, y, w: TILE_SIZE, h: TILE_SIZE, type: "key" });
      } else if (ch === "D") {
        const door = { x, y, w: TILE_SIZE, h: TILE_SIZE, locked: true };
        doors.push(door);
      } else if (ch === "B") {
        buttons.push({ x, y, w: TILE_SIZE, h: TILE_SIZE });
      } else if (ch === "X") {
        hiddenBlocks.push({ x, y, w: TILE_SIZE, h: TILE_SIZE, active: false });
      }
    }
  });

  levelNumberEl.textContent = index + 1;
  updateMessage();
}

function restartLevel() {
  loadLevel(currentLevelIndex);
  playBeep("normal");
}

btnRestart.addEventListener("click", restartLevel);

btnNext.addEventListener("click", () => {
  if (currentLevelIndex < LEVELS.length - 1) {
    currentLevelIndex++;
    loadLevel(currentLevelIndex);
    btnNext.style.display = "none";
  }
});

// ===== مساعدة في التصادم =====
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// ===== منطق الموت والفوز =====
function killPlayer() {
  deathsCount++;
  deathsCountEl.textContent = deathsCount;
  playBeep("death");
  loadLevel(currentLevelIndex);
}

function winLevel() {
  playBeep("win");
  if (currentLevelIndex === LEVELS.length - 1) {
    messageEl.textContent = "مبروك! خلّصت جميع المراحل 🔥";
    btnNext.style.display = "none";
  } else {
    messageEl.textContent = "أحسنت! اضغط على زر المرحلة التالية.";
    btnNext.style.display = "block";
  }
}

// ===== تحديث الرسالة حسب المرحلة =====
function updateMessage() {
  if (currentLevelIndex === 0) {
    messageEl.textContent = "تحرك يمين ويسار ووصل للباب.";
  } else if (currentLevelIndex === 1) {
    messageEl.textContent = "انتبه للحفرة، استخدم القفز.";
  } else if (currentLevelIndex === 2) {
    messageEl.textContent = "الشوك يقتلك فوراً! قفزتك لازم تكون مضبوطة.";
  } else if (currentLevelIndex === 3) {
    messageEl.textContent = "خذ المفتاح الذهبي وافتح الباب المقفول.";
  } else if (currentLevelIndex === 4) {
    messageEl.textContent =
      "اضغط على الزر عشان تفعّل البلوكات المخفية وتمشي عليها.";
  } else if (currentLevelIndex === 5) {
    messageEl.textContent =
      "مفتاح + زر + شوك: فكّر بالترتيب الصح قبل ما تتحرك.";
  } else if (currentLevelIndex === 6) {
    messageEl.textContent =
      "آخر تحدي! كل حركة محسوبة – زر، مفتاح، باب، وشوك.";
  }
}

// ===== حلقة التحديث =====
let lastTime = 0;

function gameLoop(timestamp) {
  const delta = (timestamp - lastTime) / 16.67; // تقريباً 60FPS
  lastTime = timestamp;

  update(delta);
  draw();

  requestAnimationFrame(gameLoop);
}

// ===== تحديث المنطق =====
function update(delta) {
  // حركة أفقية
  if (keys.left) player.vx = -MOVE_SPEED;
  else if (keys.right) player.vx = MOVE_SPEED;
  else player.vx = 0;

  // قفز
  if (keys.jump && player.onGround) {
    player.vy = -JUMP_FORCE;
    player.onGround = false;
    playBeep("jump");
  }

  // جاذبية
  player.vy += GRAVITY * delta;

  // نسخ الكائن قبل الحركة
  let nextX = player.x + player.vx * delta;
  let nextY = player.y + player.vy * delta;

  const futureRectX = { x: nextX, y: player.y, w: player.w, h: player.h };
  const futureRectY = { x: nextX, y: nextY, w: player.w, h: player.h };

  player.onGround = false;

  // تصادم مع البلوكات الصلبة
  tiles.forEach((t) => {
    if (t.type === "solid") {
      // محور X
      if (rectsOverlap(futureRectX, t)) {
        if (player.vx > 0) nextX = t.x - player.w;
        if (player.vx < 0) nextX = t.x + t.w;
        player.vx = 0;
      }
      // محور Y
      const tempRectY = { x: nextX, y: nextY, w: player.w, h: player.h };
      if (rectsOverlap(tempRectY, t)) {
        if (player.vy > 0) {
          nextY = t.y - player.h;
          player.onGround = true;
        }
        if (player.vy < 0) {
          nextY = t.y + t.h;
        }
        player.vy = 0;
      }
    }
  });

  // أبواب مقفولة
  doors.forEach((d) => {
    if (d.locked) {
      // نعامل الباب كأنه بلوك صلب
      const t = d;
      const tempRectX = { x: nextX, y: player.y, w: player.w, h: player.h };
      if (rectsOverlap(tempRectX, t)) {
        if (player.vx > 0) nextX = t.x - player.w;
        if (player.vx < 0) nextX = t.x + t.w;
        player.vx = 0;
      }
      const tempRectY = { x: nextX, y: nextY, w: player.w, h: player.h };
      if (rectsOverlap(tempRectY, t)) {
        if (player.vy > 0) {
          nextY = t.y - player.h;
          player.onGround = true;
        }
        if (player.vy < 0) {
          nextY = t.y + t.h;
        }
        player.vy = 0;
      }
    }
  });

  // بلوكات مخفية مفعّلة
  hiddenBlocks.forEach((hb) => {
    if (hb.active) {
      const t = hb;
      const tempRectX = { x: nextX, y: player.y, w: player.w, h: player.h };
      if (rectsOverlap(tempRectX, t)) {
        if (player.vx > 0) nextX = t.x - player.w;
        if (player.vx < 0) nextX = t.x + t.w;
        player.vx = 0;
      }
      const tempRectY = { x: nextX, y: nextY, w: player.w, h: player.h };
      if (rectsOverlap(tempRectY, t)) {
        if (player.vy > 0) {
          nextY = t.y - player.h;
          player.onGround = true;
        }
        if (player.vy < 0) {
          nextY = t.y + t.h;
        }
        player.vy = 0;
      }
    }
  });

  // تحديث مكان اللاعب بعد التصادمات
  player.x = nextX;
  player.y = nextY;

  const playerRect = { x: player.x, y: player.y, w: player.w, h: player.h };

  // التقاط المفتاح
  tiles = tiles.filter((t) => {
    if (t.type === "key" && rectsOverlap(playerRect, t)) {
      player.hasKey = true;
      playBeep("normal");
      messageEl.textContent = "جميل! الآن دور الباب المقفول.";
      return false;
    }
    return true;
  });

  // فتح الأبواب إذا عنده مفتاح ويصطدم بالباب
  doors.forEach((d) => {
    if (d.locked && player.hasKey && rectsOverlap(playerRect, d)) {
      d.locked = false;
      playBeep("normal");
      messageEl.textContent = "الباب انفتح! توجّه للباب الأخضر.";
    }
  });

  // الأزرار – تفعل البلوكات المخفية
  buttons.forEach((b) => {
    if (rectsOverlap(playerRect, b)) {
      if (!buttonActivated) {
        buttonActivated = true;
        hiddenBlocks.forEach((hb) => (hb.active = true));
        playBeep("normal");
        messageEl.textContent = "المنصّات ظهرت! استغلها قبل لا تغلط.";
      }
    }
  });

  // الشوك
  for (const s of spikes) {
    if (rectsOverlap(playerRect, s)) {
      killPlayer();
      return;
    }
  }

  // الخروج
  if (exitTile && rectsOverlap(playerRect, exitTile)) {
    winLevel();
  }

  // لو وقع تحت الشاشة: موت
  if (player.y > canvas.height + 200) {
    killPlayer();
  }
}

// ===== الرسم =====
function drawGrid() {
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let x = 0; x < canvas.width; x += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // خلفية بسيطة
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#24123a");
  gradient.addColorStop(1, "#050009");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();

  // بلوكات صلبة
  tiles.forEach((t) => {
    if (t.type === "solid") {
      ctx.fillStyle = "#3b2a52";
      ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.strokeStyle = "#9270ff";
      ctx.strokeRect(t.x, t.y, t.w, t.h);
    } else if (t.type === "key") {
      ctx.fillStyle = "#ffd86b";
      ctx.fillRect(t.x + 8, t.y + 8, t.w - 16, t.h - 16);
    }
  });

  // أبواب
  doors.forEach((d) => {
    if (d.locked) ctx.fillStyle = "#555";
    else ctx.fillStyle = "#3ad66b";
    ctx.fillRect(d.x, d.y, d.w, d.h);
  });

  // بلوكات مخفية
  hiddenBlocks.forEach((hb) => {
    if (hb.active) {
      ctx.fillStyle = "#274f9f";
      ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
    } else {
      // خط خفيف كمؤشر
      ctx.strokeStyle = "rgba(120,120,255,0.2)";
      ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
    }
  });

  // الأزرار
  buttons.forEach((b) => {
    ctx.fillStyle = "#ff7f50";
    ctx.fillRect(b.x + 4, b.y + 10, b.w - 8, b.h - 14);
  });

  // الشوك
  spikes.forEach((s) => {
    ctx.fillStyle = "#ff4c4c";
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + s.h);
    ctx.lineTo(s.x + s.w / 2, s.y);
    ctx.lineTo(s.x + s.w, s.y + s.h);
    ctx.closePath();
    ctx.fill();
  });

  // باب الخروج
  if (exitTile) {
    ctx.fillStyle = "#3ad66b";
    ctx.fillRect(exitTile.x + 6, exitTile.y, exitTile.w - 12, exitTile.h);
    ctx.fillStyle = "#1b3324";
    ctx.fillRect(exitTile.x + exitTile.w / 2 - 4, exitTile.y + 10, 8, 16);
  }

  // اللاعب (الشخصية)
  ctx.fillStyle = "#ffcc33";
  ctx.fillRect(player.x, player.y, player.w, player.h);
  // رأس بسيط
  ctx.fillStyle = "#ffe8a3";
  ctx.fillRect(player.x + 4, player.y - 10, player.w - 8, 10);
  // عينين
  ctx.fillStyle = "#000";
  ctx.fillRect(player.x + 8, player.y - 7, 3, 3);
  ctx.fillRect(player.x + player.w - 11, player.y - 7, 3, 3);
}

// ===== بدء اللعبة =====
loadLevel(currentLevelIndex);
requestAnimationFrame(gameLoop);
