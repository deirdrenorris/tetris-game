'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const COLS  = 10;
const ROWS  = 20;
const BLOCK = 24;   // display px per cell
const TILE  = 8;    // sprite sheet tile size in px
const SIDEBAR = 120;

// ─── Canvas setup ────────────────────────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');
canvas.width  = COLS * BLOCK + SIDEBAR;
canvas.height = ROWS * BLOCK;

// ─── Sprite sheet ────────────────────────────────────────────────────────────
// 8_bit_tetrominos.png: 112×80px, 8×8 tiles (14 cols × 10 rows)
// Tile index = GID - 1; col = index % 14; row = floor(index / 14)
// sx = col*8, sy = row*8
//
// GIDs identified from 8 Bit tetrominos.tmx Sprite layer (playfield blocks):
//   GID 114 → index 113 → col 1,  row 8  → sx=8,  sy=64  (I – cyan row)
//   GID  43 → index  42 → col 0,  row 3  → sx=0,  sy=24  (O – yellow pair)
//   GID  88 → index  87 → col 3,  row 6  → sx=24, sy=48  (T – purple)
//   GID  65 → index  64 → col 8,  row 4  → sx=64, sy=32  (S – green pair)
//   GID  47 → index  46 → col 4,  row 3  → sx=32, sy=24  (Z – red row)
//   GID  51 → index  50 → col 8,  row 3  → sx=64, sy=24  (J – blue pair)
//   GID 102 → index 101 → col 3,  row 7  → sx=24, sy=56  (L – orange)
const TILES = [
  { sx:  8, sy: 64 }, // 0 – I
  { sx:  0, sy: 24 }, // 1 – O
  { sx: 24, sy: 48 }, // 2 – T
  { sx: 64, sy: 32 }, // 3 – S
  { sx: 32, sy: 24 }, // 4 – Z
  { sx: 64, sy: 24 }, // 5 – J
  { sx: 24, sy: 56 }, // 6 – L
];

// Fallback solid colours (shown under/instead of sprite if sheet not ready)
const COLORS = [
  '#00f0f0', // I cyan
  '#f0f000', // O yellow
  '#a000f0', // T purple
  '#00f000', // S green
  '#f00000', // Z red
  '#0000f0', // J blue
  '#f0a000', // L orange
];

const sheet = new Image();
sheet.src = '8_bit_tetrominos/8 bit tetrominos.png';

// ─── Piece shapes (4×4 matrices, index matches TILES/COLORS) ─────────────────
const SHAPES = [
  // I
  [[0,0,0,0],
   [1,1,1,1],
   [0,0,0,0],
   [0,0,0,0]],
  // O
  [[0,1,1,0],
   [0,1,1,0],
   [0,0,0,0],
   [0,0,0,0]],
  // T
  [[0,1,0,0],
   [1,1,1,0],
   [0,0,0,0],
   [0,0,0,0]],
  // S
  [[0,1,1,0],
   [1,1,0,0],
   [0,0,0,0],
   [0,0,0,0]],
  // Z
  [[1,1,0,0],
   [0,1,1,0],
   [0,0,0,0],
   [0,0,0,0]],
  // J
  [[1,0,0,0],
   [1,1,1,0],
   [0,0,0,0],
   [0,0,0,0]],
  // L
  [[0,0,1,0],
   [1,1,1,0],
   [0,0,0,0],
   [0,0,0,0]],
];

function rotateMatrix(m) {
  const n = m.length;
  return Array.from({length: n}, (_, r) =>
    Array.from({length: n}, (_, c) => m[n - 1 - c][r])
  );
}

// ─── Game state ───────────────────────────────────────────────────────────────
let board, piece, score, gameOver;

function newBoard() {
  return Array.from({length: ROWS}, () => new Array(COLS).fill(-1));
}

function init() {
  board    = newBoard();
  score    = 0;
  gameOver = false;
  spawnPiece();
}

function spawnPiece() {
  const type = Math.floor(Math.random() * SHAPES.length);
  piece = {
    type,
    matrix: SHAPES[type].map(row => [...row]),
    x: Math.floor(COLS / 2) - 2,
    y: 0,
  };
  if (collides(piece.matrix, piece.x, piece.y)) {
    gameOver = true;
  }
}

// ─── Collision ───────────────────────────────────────────────────────────────
function collides(matrix, px, py) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const nx = px + c;
      const ny = py + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx] !== -1) return true;
    }
  }
  return false;
}

// ─── Piece actions ───────────────────────────────────────────────────────────
function moveLeft() {
  if (!collides(piece.matrix, piece.x - 1, piece.y)) piece.x--;
}

function moveRight() {
  if (!collides(piece.matrix, piece.x + 1, piece.y)) piece.x++;
}

function softDrop() {
  if (!collides(piece.matrix, piece.x, piece.y + 1)) {
    piece.y++;
  } else {
    lockPiece();
  }
}

function hardDrop() {
  while (!collides(piece.matrix, piece.x, piece.y + 1)) piece.y++;
  lockPiece();
}

function rotate() {
  const rotated = rotateMatrix(piece.matrix);
  // Try rotation with wall kicks: 0, +1, -1, +2, -2
  for (const kick of [0, 1, -1, 2, -2]) {
    if (!collides(rotated, piece.x + kick, piece.y)) {
      piece.matrix = rotated;
      piece.x += kick;
      return;
    }
  }
}

// ─── Lock & clear ────────────────────────────────────────────────────────────
function lockPiece() {
  const {matrix, x, y, type} = piece;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c] && y + r >= 0) {
        board[y + r][x + c] = type;
      }
    }
  }
  clearLines();
  spawnPiece();
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; ) {
    if (board[r].every(cell => cell !== -1)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(-1));
      cleared++;
    } else {
      r--;
    }
  }
  const points = [0, 100, 300, 500, 800];
  score += points[cleared] ?? 0;
}

// ─── Rendering ───────────────────────────────────────────────────────────────
function drawBlock(type, bx, by, alpha = 1) {
  const t = TILES[type];
  ctx.save();
  ctx.globalAlpha = alpha;

  if (sheet.complete && sheet.naturalWidth > 0) {
    // Draw sprite tile for shading/highlight texture
    ctx.drawImage(sheet, t.sx, t.sy, TILE, TILE, bx, by, BLOCK, BLOCK);
    // 'color' blend: takes hue+saturation from piece color, keeps sprite's luminosity
    // → correctly tints the brownish sprite tile with each piece's distinct color
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = COLORS[type];
    ctx.fillRect(bx, by, BLOCK, BLOCK);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    // Fallback: solid color with simple highlight
    ctx.fillStyle = COLORS[type];
    ctx.fillRect(bx, by, BLOCK, BLOCK);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(bx + 2, by + 2, BLOCK - 4, 3);
    ctx.fillRect(bx + 2, by + 2, 3, BLOCK - 4);
  }

  ctx.restore();
}

function ghostY() {
  let gy = piece.y;
  while (!collides(piece.matrix, piece.x, gy + 1)) gy++;
  return gy;
}

function draw() {
  // Background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }

  // Locked board cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== -1) {
        drawBlock(board[r][c], c * BLOCK, r * BLOCK);
      }
    }
  }

  if (!gameOver) {
    // Ghost piece
    const gy = ghostY();
    if (gy !== piece.y) {
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c]) {
            drawBlock(piece.type, (piece.x + c) * BLOCK, (gy + r) * BLOCK, 0.25);
          }
        }
      }
    }

    // Active piece
    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (piece.matrix[r][c]) {
          drawBlock(piece.type, (piece.x + c) * BLOCK, (piece.y + r) * BLOCK);
        }
      }
    }
  }

  // ── Sidebar ──
  const sx = COLS * BLOCK + 10;
  ctx.fillStyle = '#2a2a4a';
  ctx.fillRect(COLS * BLOCK, 0, SIDEBAR, ROWS * BLOCK);

  ctx.fillStyle = '#8888cc';
  ctx.font = '11px "Courier New"';
  ctx.fillText('SCORE', sx, 28);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Courier New"';
  ctx.fillText(score, sx, 48);

  ctx.fillStyle = '#8888cc';
  ctx.font = '10px "Courier New"';
  ctx.fillText('← → move', sx, ROWS * BLOCK - 90);
  ctx.fillText('↑  rotate', sx, ROWS * BLOCK - 74);
  ctx.fillText('↓  soft drop', sx, ROWS * BLOCK - 58);
  ctx.fillText('SPC hard drop', sx, ROWS * BLOCK - 42);

  // Game over overlay
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 22px "Courier New"';
    ctx.fillText('GAME OVER', COLS * BLOCK / 2, ROWS * BLOCK / 2 - 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px "Courier New"';
    ctx.fillText(`Score: ${score}`, COLS * BLOCK / 2, ROWS * BLOCK / 2 + 8);

    ctx.fillStyle = '#aaaaff';
    ctx.font = '12px "Courier New"';
    ctx.fillText('Press R to restart', COLS * BLOCK / 2, ROWS * BLOCK / 2 + 34);
    ctx.textAlign = 'left';
  }
}

// ─── Game loop ────────────────────────────────────────────────────────────────
let lastTime        = 0;
let dropAccumulator = 0;
const DROP_INTERVAL = 800; // ms per automatic drop

function loop(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (!gameOver) {
    dropAccumulator += dt;
    if (dropAccumulator >= DROP_INTERVAL) {
      softDrop();
      dropAccumulator = 0;
    }
  }

  draw();
  requestAnimationFrame(loop);
}

// ─── Input ───────────────────────────────────────────────────────────────────
const GAME_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ',
]);

document.addEventListener('keydown', e => {
  if (GAME_KEYS.has(e.key)) e.preventDefault();

  if (gameOver) {
    if (e.key === 'r' || e.key === 'R') init();
    return;
  }

  switch (e.key) {
    case 'ArrowLeft':  moveLeft();  break;
    case 'ArrowRight': moveRight(); break;
    case 'ArrowDown':  softDrop();  break;
    case 'ArrowUp':    if (!e.repeat) rotate(); break;
    case ' ':          if (!e.repeat) hardDrop(); break;
  }
});

// ─── Button controls (mobile) ────────────────────────────────────────────────
let moveRepeatTimer = null;

function startMove(fn) {
  fn();
  moveRepeatTimer = setInterval(fn, 100);
}

function stopMove() {
  clearInterval(moveRepeatTimer);
  moveRepeatTimer = null;
}

const btnLeft  = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');

for (const evt of ['mousedown', 'touchstart']) {
  btnLeft.addEventListener(evt,  e => { e.preventDefault(); if (!gameOver) startMove(moveLeft);  }, { passive: false });
  btnRight.addEventListener(evt, e => { e.preventDefault(); if (!gameOver) startMove(moveRight); }, { passive: false });
}
for (const evt of ['mouseup', 'touchend', 'touchcancel']) {
  btnLeft.addEventListener(evt,  stopMove);
  btnRight.addEventListener(evt, stopMove);
}

// ─── Touch input ─────────────────────────────────────────────────────────────
let touchStartX = 0;
let touchStartY = 0;
const SWIPE_THRESHOLD = 20; // px min distance to count as a swipe

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (gameOver) { init(); return; }

  if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
    rotate(); // tap
  } else if (absDx > absDy) {
    if (dx > 0) moveRight(); else moveLeft(); // horizontal swipe
  } else {
    if (dy > 0) softDrop(); else hardDrop(); // vertical swipe
  }
}, { passive: false });

// ─── Start ───────────────────────────────────────────────────────────────────
function start() {
  init();
  requestAnimationFrame(loop);
}

sheet.onload  = start;
sheet.onerror = start;
if (sheet.complete) start();
