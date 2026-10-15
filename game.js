(() => {
  'use strict';

  // ===== CONSTANTS =====
  const W = 400;
  const H = 700;
  const GRAVITY = 0.55;
  const FRICTION = 0.82;
  const JUMP = -11.5;
  const SPEED = 4.2;
  const TOTAL_LEVELS = 10;

  // ===== STATE =====
  let canvas, ctx;
  let state = 'loading'; // loading, menu, playing, paused, result
  let soundOn = true;
  let vibOn = true;
  let currentLevel = 1;
  let maxUnlocked = 1;
  let score = 0;
  let coins = 0;
  let lives = 3;
  let frame = 0;
  let keys = {};
  let particles = [];
  let fireballs = [];
  let enemies = [];
  let platforms = [];
  let collectibles = [];
  let player;
  let cameraX = 0;
  let levelWidth = 2000;
  let levelComplete = false;
  let gameOver = false;
  let goalX = 1900;

  // Level themes (background colors + accent)
  const themes = [
    { sky: ['#87CEEB', '#E0F7FA'], ground: '#4CAF50', accent: '#2E7D32', name: 'Forest' },
    { sky: ['#1A237E', '#3949AB'], ground: '#5C6BC0', accent: '#7986CB', name: 'Night Crystal' },
    { sky: ['#BF360C', '#FF5722'], ground: '#E65100', accent: '#FF8A65', name: 'Volcano' },
    { sky: ['#004D40', '#26A69A'], ground: '#00695C', accent: '#4DB6AC', name: 'Jade Caves' },
    { sky: ['#4A148C', '#7B1FA2'], ground: '#6A1B9A', accent: '#CE93D8', name: 'Magic Realm' },
    { sky: ['#01579B', '#0288D1'], ground: '#0277BD', accent: '#4FC3F7', name: 'Sky Islands' },
    { sky: ['#3E2723', '#5D4037'], ground: '#4E342E', accent: '#A1887F', name: 'Ancient Ruins' },
    { sky: ['#880E4F', '#C2185B'], ground: '#AD1457', accent: '#F48FB1', name: 'Cherry Blossom' },
    { sky: ['#263238', '#455A64'], ground: '#37474F', accent: '#90A4AE', name: 'Storm Peak' },
    { sky: ['#1A237E', '#FF6F00'], ground: '#E65100', accent: '#FFD700', name: 'Final Dragon' }
  ];

  // ===== AUDIO (simple WebAudio beeps) =====
  let audioCtx;
  function playSound(type) {
    if (!soundOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      if (type === 'jump') {
        o.frequency.setValueAtTime(400, now);
        o.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        o.start(now); o.stop(now + 0.15);
      } else if (type === 'fire') {
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(180, now);
        o.frequency.exponentialRampToValueAtTime(80, now + 0.2);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        o.start(now); o.stop(now + 0.25);
      } else if (type === 'coin') {
        o.frequency.setValueAtTime(800, now);
        o.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        o.start(now); o.stop(now + 0.12);
      } else if (type === 'hit') {
        o.type = 'square';
        o.frequency.setValueAtTime(150, now);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        o.start(now); o.stop(now + 0.2);
      } else if (type === 'win') {
        o.frequency.setValueAtTime(500, now);
        o.frequency.exponentialRampToValueAtTime(900, now + 0.3);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        o.start(now); o.stop(now + 0.4);
      } else if (type === 'die') {
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(300, now);
        o.frequency.exponentialRampToValueAtTime(80, now + 0.4);
        g.gain.setValueAtTime(0.18, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        o.start(now); o.stop(now + 0.45);
      }
    } catch (e) {}
  }

  function vibrate(ms = 30) {
    if (vibOn && navigator.vibrate) navigator.vibrate(ms);
  }

  // ===== PLAYER =====
  function createPlayer(x, y) {
    return {
      x, y,
      w: 36, h: 42,
      vx: 0, vy: 0,
      onGround: false,
      facing: 1,
      invuln: 0,
      fireCooldown: 0,
      anim: 0
    };
  }

  // ===== LEVEL GENERATION =====
  function generateLevel(num) {
    platforms = [];
    enemies = [];
    collectibles = [];
    fireballs = [];
    particles = [];
    levelComplete = false;
    gameOver = false;
    lives = 3;
    score = Math.max(0, score);
    coins = 0;
    cameraX = 0;
    frame = 0;

    const theme = themes[(num - 1) % themes.length];
    levelWidth = 1600 + num * 180;
    goalX = levelWidth - 80;

    // Ground
    platforms.push({ x: 0, y: H - 60, w: levelWidth, h: 60, type: 'ground' });

    // Floating platforms
    const platCount = 8 + num * 2;
    for (let i = 0; i < platCount; i++) {
      const px = 180 + i * (levelWidth / (platCount + 1)) + (Math.random() * 60 - 30);
      const py = 280 + Math.random() * 220;
      const pw = 70 + Math.random() * 80;
      platforms.push({ x: px, y: py, w: pw, h: 18, type: 'plat' });
    }

    // Some taller walls / steps
    for (let i = 0; i < 3 + Math.floor(num / 2); i++) {
      const px = 300 + i * 350 + Math.random() * 100;
      platforms.push({ x: px, y: H - 140 - Math.random() * 80, w: 50, h: 80 + Math.random() * 40, type: 'wall' });
    }

    // Enemies
    const enemyCount = 4 + num * 2;
    for (let i = 0; i < enemyCount; i++) {
      const ex = 250 + i * (levelWidth / (enemyCount + 1)) + Math.random() * 80;
      const ey = H - 110;
      const type = Math.random() < 0.35 ? 'flyer' : 'walker';
      enemies.push({
        x: ex, y: type === 'flyer' ? 200 + Math.random() * 200 : ey,
        w: 32, h: 32,
        vx: (Math.random() < 0.5 ? -1 : 1) * (1.2 + num * 0.15),
        vy: 0,
        type,
        hp: type === 'flyer' ? 2 : 1,
        anim: 0,
        baseY: type === 'flyer' ? 200 + Math.random() * 200 : ey
      });
    }

    // Coins
    for (let i = 0; i < 12 + num * 3; i++) {
      const cx = 100 + Math.random() * (levelWidth - 200);
      const cy = 150 + Math.random() * 350;
      collectibles.push({ x: cx, y: cy, w: 18, h: 18, type: 'coin', taken: false, anim: 0 });
    }

    // Heart pickups (extra life)
    if (num % 3 === 0) {
      collectibles.push({ x: levelWidth * 0.5, y: 200, w: 22, h: 22, type: 'heart', taken: false, anim: 0 });
    }

    player = createPlayer(60, H - 120);
    updateHUD();
  }

  // ===== PARTICLES =====
  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color,
        size: 3 + Math.random() * 4
      });
    }
  }

  // ===== UPDATE =====
  function update() {
    if (state !== 'playing') return;
    frame++;

    // Player input
    let move = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A'] || keys['left']) move = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D'] || keys['right']) move = 1;

    player.vx += move * 0.9;
    player.vx *= FRICTION;
    if (Math.abs(player.vx) > SPEED) player.vx = Math.sign(player.vx) * SPEED;
    if (move !== 0) player.facing = move;

    // Jump
    if ((keys['ArrowUp'] || keys['w'] || keys['W'] || keys[' '] || keys['jump']) && player.onGround) {
      player.vy = JUMP;
      player.onGround = false;
      playSound('jump');
      vibrate(20);
    }

    // Fire
    if (player.fireCooldown > 0) player.fireCooldown--;
    if ((keys['f'] || keys['F'] || keys['fire'] || keys['Shift']) && player.fireCooldown <= 0) {
      fireballs.push({
        x: player.x + (player.facing > 0 ? player.w : -12),
        y: player.y + 12,
        vx: player.facing * 9,
        life: 45,
        w: 16, h: 12
      });
      player.fireCooldown = 18;
      playSound('fire');
      vibrate(15);
    }

    // Physics
    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;
    player.onGround = false;

    // Platform collision
    for (const p of platforms) {
      if (player.x + player.w > p.x && player.x < p.x + p.w &&
          player.y + player.h > p.y && player.y + player.h < p.y + p.h + 12 &&
          player.vy >= 0) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
      }
      // Side collision rough
      if (player.x + player.w > p.x && player.x < p.x + p.w &&
          player.y + player.h > p.y + 8 && player.y < p.y + p.h) {
        if (player.vx > 0) player.x = p.x - player.w;
        if (player.vx < 0) player.x = p.x + p.w;
        player.vx = 0;
      }
    }

    // Bounds
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > levelWidth) player.x = levelWidth - player.w;
    if (player.y > H + 50) {
      hurtPlayer();
      player.y = H - 150;
      player.vy = 0;
    }

    if (player.invuln > 0) player.invuln--;

    // Camera
    cameraX = player.x - W * 0.35;
    if (cameraX < 0) cameraX = 0;
    if (cameraX > levelWidth - W) cameraX = levelWidth - W;

    // Fireballs
    for (let i = fireballs.length - 1; i >= 0; i--) {
      const f = fireballs[i];
      f.x += f.vx;
      f.life--;
      if (f.life <= 0 || f.x < cameraX - 50 || f.x > cameraX + W + 50) {
        fireballs.splice(i, 1);
        continue;
      }
      // Hit enemies
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (f.x < e.x + e.w && f.x + f.w > e.x && f.y < e.y + e.h && f.y + f.h > e.y) {
          e.hp--;
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#ff6600', 6);
          fireballs.splice(i, 1);
          if (e.hp <= 0) {
            score += 100;
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#ffd700', 12);
            enemies.splice(j, 1);
            playSound('hit');
            vibrate(25);
          }
          break;
        }
      }
    }

    // Enemies
    for (const e of enemies) {
      e.anim++;
      if (e.type === 'walker') {
        e.x += e.vx;
        // Simple turn at edges or random
        if (e.x < 50 || e.x > levelWidth - 50 || Math.random() < 0.008) e.vx *= -1;
        // Ground stick
        e.y = H - 100;
      } else {
        e.x += e.vx * 0.7;
        e.y = e.baseY + Math.sin(frame * 0.04 + e.x * 0.01) * 40;
        if (e.x < 50 || e.x > levelWidth - 50) e.vx *= -1;
      }

      // Player collision
      if (player.invuln <= 0 &&
          player.x < e.x + e.w && player.x + player.w > e.x &&
          player.y < e.y + e.h && player.y + player.h > e.y) {
        hurtPlayer();
      }
    }

    // Collectibles
    for (const c of collectibles) {
      if (c.taken) continue;
      c.anim++;
      if (player.x < c.x + c.w && player.x + player.w > c.x &&
          player.y < c.y + c.h && player.y + player.h > c.y) {
        c.taken = true;
        if (c.type === 'coin') {
          coins++;
          score += 50;
          playSound('coin');
          spawnParticles(c.x, c.y, '#ffd700', 5);
        } else if (c.type === 'heart') {
          lives = Math.min(5, lives + 1);
          playSound('coin');
          spawnParticles(c.x, c.y, '#ff4444', 8);
        }
        updateHUD();
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Goal
    if (player.x + player.w > goalX && player.y + player.h > H - 160) {
      levelComplete = true;
      playSound('win');
      vibrate([30, 50, 30]);
      score += 500 + currentLevel * 100;
      if (currentLevel >= maxUnlocked && currentLevel < TOTAL_LEVELS) {
        maxUnlocked = currentLevel + 1;
        try { localStorage.setItem('dogeMaxLevel', maxUnlocked); } catch(e){}
      }
      showResult(true);
    }

    player.anim++;
    updateHUD();
  }

  function hurtPlayer() {
    if (player.invuln > 0) return;
    lives--;
    player.invuln = 90;
    player.vy = -8;
    playSound('die');
    vibrate(80);
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff4444', 10);
    updateHUD();
    if (lives <= 0) {
      gameOver = true;
      showResult(false);
    }
  }

  // ===== DRAW =====
  function draw() {
    const theme = themes[(currentLevel - 1) % themes.length];

    // Sky gradient
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, theme.sky[0]);
    grd.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Parallax clouds / stars
    ctx.save();
    ctx.translate(-cameraX * 0.3, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 12; i++) {
      const cx = (i * 180 + 50) % (levelWidth + 200);
      const cy = 40 + (i % 5) * 35;
      ctx.beginPath();
      ctx.arc(cx, cy, 18 + (i % 3) * 8, 0, Math.PI * 2);
      ctx.arc(cx + 22, cy + 5, 14, 0, Math.PI * 2);
      ctx.arc(cx - 18, cy + 8, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-cameraX, 0);

    // Platforms
    for (const p of platforms) {
      if (p.x + p.w < cameraX - 20 || p.x > cameraX + W + 20) continue;
      if (p.type === 'ground') {
        ctx.fillStyle = theme.ground;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = theme.accent;
        ctx.fillRect(p.x, p.y, p.w, 8);
        // Grass detail
        ctx.fillStyle = '#66BB6A';
        for (let gx = p.x; gx < p.x + p.w; gx += 18) {
          ctx.fillRect(gx, p.y - 6, 4, 8);
          ctx.fillRect(gx + 7, p.y - 10, 3, 12);
        }
      } else {
        // Rounded platform look
        ctx.fillStyle = theme.accent;
        roundRect(ctx, p.x, p.y, p.w, p.h, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(p.x + 4, p.y + 2, p.w - 8, 4);
      }
    }

    // Goal flag
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(goalX, H - 160, 8, 100);
    ctx.beginPath();
    ctx.moveTo(goalX + 8, H - 160);
    ctx.lineTo(goalX + 50, H - 145);
    ctx.lineTo(goalX + 8, H - 130);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('GOAL', goalX - 5, H - 50);

    // Collectibles
    for (const c of collectibles) {
      if (c.taken) continue;
      if (c.x < cameraX - 30 || c.x > cameraX + W + 30) continue;
      const bob = Math.sin(c.anim * 0.1) * 4;
      if (c.type === 'coin') {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(c.x + 9, c.y + 9 + bob, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffb700';
        ctx.beginPath();
        ctx.arc(c.x + 9, c.y + 9 + bob, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.font = '20px serif';
        ctx.fillText('❤️', c.x, c.y + 18 + bob);
      }
    }

    // Enemies
    for (const e of enemies) {
      if (e.x < cameraX - 40 || e.x > cameraX + W + 40) continue;
      if (e.type === 'walker') {
        // Cute evil cat / frog
        ctx.fillStyle = '#e74c3c';
        roundRect(ctx, e.x, e.y, e.w, e.h, 8);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(e.x + 10, e.y + 12, 5, 0, Math.PI * 2);
        ctx.arc(e.x + 22, e.y + 12, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(e.x + 10 + (e.vx > 0 ? 1 : -1), e.y + 12, 2.5, 0, Math.PI * 2);
        ctx.arc(e.x + 22 + (e.vx > 0 ? 1 : -1), e.y + 12, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Mouth
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x + 16, e.y + 22, 5, 0.2, Math.PI - 0.2);
        ctx.stroke();
      } else {
        // Flyer
        ctx.fillStyle = '#9b59b6';
        ctx.beginPath();
        ctx.ellipse(e.x + 16, e.y + 16, 16, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        // Wings
        const flap = Math.sin(e.anim * 0.3) * 8;
        ctx.fillStyle = '#8e44ad';
        ctx.beginPath();
        ctx.ellipse(e.x - 4, e.y + 10 + flap, 12, 6, -0.4, 0, Math.PI * 2);
        ctx.ellipse(e.x + 36, e.y + 10 - flap, 12, 6, 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(e.x + 12, e.y + 14, 4, 0, Math.PI * 2);
        ctx.arc(e.x + 22, e.y + 14, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Fireballs
    for (const f of fireballs) {
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(f.x + 8, f.y + 6, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffdd00';
      ctx.beginPath();
      ctx.arc(f.x + 8, f.y + 6, 4, 0, Math.PI * 2);
      ctx.fill();
      // Trail
      ctx.fillStyle = 'rgba(255,100,0,0.4)';
      ctx.beginPath();
      ctx.arc(f.x + 8 - f.vx * 0.5, f.y + 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player (Doge)
    if (player.invuln <= 0 || Math.floor(player.invuln / 4) % 2 === 0) {
      drawDoge(player.x, player.y, player.facing, player.onGround, player.anim);
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // Ground fade at bottom if needed
  }

  function drawDoge(x, y, facing, onGround, anim) {
    ctx.save();
    ctx.translate(x + 18, y + 21);
    if (facing < 0) ctx.scale(-1, 1);

    // Body
    ctx.fillStyle = '#F4A460';
    roundRect(ctx, -16, -8, 32, 28, 10);
    ctx.fill();

    // Belly
    ctx.fillStyle = '#FFE4C4';
    roundRect(ctx, -10, 0, 20, 18, 8);
    ctx.fill();

    // Head
    ctx.fillStyle = '#F4A460';
    ctx.beginPath();
    ctx.arc(0, -18, 16, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = '#D2691E';
    ctx.beginPath();
    ctx.moveTo(-14, -28);
    ctx.lineTo(-8, -42);
    ctx.lineTo(-2, -28);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -28);
    ctx.lineTo(8, -42);
    ctx.lineTo(2, -28);
    ctx.fill();

    // Snout
    ctx.fillStyle = '#FFE4C4';
    ctx.beginPath();
    ctx.ellipse(0, -12, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(0, -14, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-6, -20, 4.5, 0, Math.PI * 2);
    ctx.arc(6, -20, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-5, -20, 2.2, 0, Math.PI * 2);
    ctx.arc(7, -20, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Mouth smile
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -10, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Legs (simple)
    const legOff = onGround ? Math.sin(anim * 0.3) * 3 : 0;
    ctx.fillStyle = '#D2691E';
    roundRect(ctx, -12, 18, 8, 12 + legOff, 3);
    ctx.fill();
    roundRect(ctx, 4, 18, 8, 12 - legOff, 3);
    ctx.fill();

    // Tail
    ctx.strokeStyle = '#F4A460';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-16, 5);
    ctx.quadraticCurveTo(-28, -5 + Math.sin(anim * 0.2) * 6, -22, -18);
    ctx.stroke();

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ===== UI HELPERS =====
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  function updateHUD() {
    const hearts = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
    document.getElementById('hud-hearts').textContent = hearts;
    document.getElementById('hud-score').textContent = score;
    document.getElementById('hud-level').textContent = currentLevel;
    document.getElementById('hud-coins').textContent = coins;
  }

  function showResult(won) {
    state = 'result';
    document.getElementById('hud').classList.remove('visible');
    document.getElementById('controls').classList.remove('visible');
    document.getElementById('btn-pause').style.display = 'none';
    document.getElementById('result-title').textContent = won ? 'Level Complete! 🎉' : 'Game Over 😢';
    document.getElementById('result-score').textContent = score;
    document.getElementById('result-msg').textContent = won
      ? `Coins: ${coins} • Level ${currentLevel}`
      : 'Try again, much courage!';
    document.getElementById('btn-next').style.display = (won && currentLevel < TOTAL_LEVELS) ? 'block' : 'none';
    showScreen('result-screen');
  }

  function startLevel(num) {
    currentLevel = num;
    generateLevel(num);
    state = 'playing';
    showScreen(''); // hide all screens
    document.getElementById('hud').classList.add('visible');
    document.getElementById('controls').classList.add('visible');
    document.getElementById('btn-pause').style.display = 'flex';
  }

  function buildLevelGrid() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    for (let i = 1; i <= TOTAL_LEVELS; i++) {
      const btn = document.createElement('button');
      btn.className = 'level-btn ' + (i <= maxUnlocked ? 'unlocked' : 'locked');
      btn.textContent = i;
      if (i <= maxUnlocked) {
        btn.onclick = () => startLevel(i);
      }
      grid.appendChild(btn);
    }
  }

  // ===== INPUT =====
  function setupInput() {
    window.addEventListener('keydown', e => {
      keys[e.key] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (state === 'playing') pauseGame();
        else if (state === 'paused') resumeGame();
      }
    });
    window.addEventListener('keyup', e => { keys[e.key] = false; });

    // Touch controls
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const start = (e) => { e.preventDefault(); keys[key] = true; el.classList.add('active'); };
      const end = (e) => { e.preventDefault(); keys[key] = false; el.classList.remove('active'); };
      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end);
      el.addEventListener('touchcancel', end);
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
    };
    bind('btn-left', 'left');
    bind('btn-right', 'right');
    bind('btn-jump', 'jump');
    bind('btn-fire', 'fire');

    document.getElementById('btn-pause').addEventListener('click', () => {
      if (state === 'playing') pauseGame();
    });
  }

  function pauseGame() {
    state = 'paused';
    showScreen('pause-screen');
  }
  function resumeGame() {
    state = 'playing';
    showScreen('');
    document.getElementById('hud').classList.add('visible');
    document.getElementById('controls').classList.add('visible');
  }

  // ===== MENU BUTTONS =====
  function setupMenus() {
    document.getElementById('btn-play').onclick = () => startLevel(Math.min(maxUnlocked, currentLevel || 1));
    document.getElementById('btn-levels').onclick = () => {
      buildLevelGrid();
      showScreen('level-screen');
    };
    document.getElementById('btn-settings').onclick = () => showScreen('settings-screen');
    document.getElementById('btn-back-levels').onclick = () => showScreen('menu-screen');
    document.getElementById('btn-back-settings').onclick = () => showScreen('menu-screen');

    document.getElementById('btn-resume').onclick = resumeGame;
    document.getElementById('btn-restart').onclick = () => startLevel(currentLevel);
    document.getElementById('btn-quit').onclick = () => {
      state = 'menu';
      showScreen('menu-screen');
      document.getElementById('hud').classList.remove('visible');
      document.getElementById('controls').classList.remove('visible');
      document.getElementById('btn-pause').style.display = 'none';
    };

    document.getElementById('btn-next').onclick = () => {
      if (currentLevel < TOTAL_LEVELS) startLevel(currentLevel + 1);
    };
    document.getElementById('btn-retry').onclick = () => startLevel(currentLevel);
    document.getElementById('btn-menu').onclick = () => {
      state = 'menu';
      showScreen('menu-screen');
      document.getElementById('hud').classList.remove('visible');
      document.getElementById('controls').classList.remove('visible');
      document.getElementById('btn-pause').style.display = 'none';
    };

    // Toggles
    const soundToggle = document.getElementById('toggle-sound');
    const vibToggle = document.getElementById('toggle-vib');
    soundToggle.onclick = () => {
      soundOn = !soundOn;
      soundToggle.classList.toggle('on', soundOn);
      try { localStorage.setItem('dogeSound', soundOn ? '1' : '0'); } catch(e){}
    };
    vibToggle.onclick = () => {
      vibOn = !vibOn;
      vibToggle.classList.toggle('on', vibOn);
      try { localStorage.setItem('dogeVib', vibOn ? '1' : '0'); } catch(e){}
    };
  }

  // ===== LOADING + INIT =====
  function resize() {
    const container = document.getElementById('game-container');
    const rect = container.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H);
    canvas.style.width = (W * scale) + 'px';
    canvas.style.height = (H * scale) + 'px';
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = W;
    canvas.height = H;

    // Load saved progress
    try {
      maxUnlocked = parseInt(localStorage.getItem('dogeMaxLevel') || '1', 10);
      soundOn = localStorage.getItem('dogeSound') !== '0';
      vibOn = localStorage.getItem('dogeVib') !== '0';
      document.getElementById('toggle-sound').classList.toggle('on', soundOn);
      document.getElementById('toggle-vib').classList.toggle('on', vibOn);
    } catch(e){}

    setupInput();
    setupMenus();
    window.addEventListener('resize', resize);
    resize();

    // Loading animation (5 seconds)
    const fill = document.getElementById('loader-fill');
    const text = document.getElementById('loader-text');
    let progress = 0;
    const loadInterval = setInterval(() => {
      progress += 2;
      fill.style.width = progress + '%';
      if (progress >= 30) text.textContent = 'Loading levels...';
      if (progress >= 60) text.textContent = 'Preparing Doge...';
      if (progress >= 85) text.textContent = 'Almost ready!';
      if (progress >= 100) {
        clearInterval(loadInterval);
        setTimeout(() => {
          document.getElementById('loading-screen').classList.add('hide');
          state = 'menu';
          showScreen('menu-screen');
          // Register service worker for PWA
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(() => {});
          }
        }, 400);
      }
    }, 50); // ~5 seconds

    requestAnimationFrame(loop);
  }

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
