(() => {
  const root = document.getElementById("game"),
    canvas = document.getElementById("canvas"),
    ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id),
    drinks = [
      { e: "🍋", n: "レモン", c: "#f8d74c" },
      { e: "🥤", n: "ソーダ", c: "#9adbd3" },
      { e: "🧋", n: "タピオカ", c: "#bd8a65" },
      { e: "🍵", n: "抹茶", c: "#a4c878" },
      { e: "🧃", n: "ジュース", c: "#f5a15d" },
      { e: "🥛", n: "ミルク", c: "#fff1d5" },
      { e: "🍹", n: "トロピカル", c: "#f4a0a0" },
      { e: "☕", n: "カフェ", c: "#c99873" },
      { e: "🍓", n: "ベリーミックス", c: "#ed83a5" },
      { e: "👑", n: "スペシャル", c: "#f3ce61" },
      { e: "🍺", n: "ビール", c: "#f3ce61" },
      { e: "🍻", n: "乾杯", c: "#f3ce61" },
    ];

  let W = 360,
    H = 520,
    balls = [],
    active = null,
    drag = null,
    score = 0,
    merges = 0,
    best = 0,
    ended = false,
    settle = 0,
    last = 0,
    particles = [],
    message = "",
    messageTime = 0,
    lastSave = 0;
  try {
    best = Number(localStorage.getItem("drinkslide-best") || 0);
  } catch (e) {}
  $("best").textContent = best;
  const rand = (a, b) => a + Math.random() * (b - a),
    radius = (l) => Math.min(30, 21 + l * 1.5);
  function resize() {
    const rect = canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 2);
    W = rect.width;
    H = Math.max(440, Math.min(680, W * 1.43));
    canvas.style.height = H + "px";
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    balls.forEach((b) => {
      b.x = Math.max(radius(b.l), Math.min(W - radius(b.l), b.x));
      b.y = Math.max(radius(b.l), Math.min(H - radius(b.l), b.y));
    });
    if (active) {
      active.x = W * 0.5;
      active.y = H - 54;
      active.r = radius(active.l);
    }
  }
  function addBall(l, x, y, vx = 0, vy = 0) {
    let b = {
      l,
      x,
      y,
      vx,
      vy,
      r: radius(l),
      id: Math.random(),
      fresh: 0,
    };
    balls.push(b);
    return b;
  }
  function makeNext(next = 0) {
    let l = next;
    return {
      l,
      x: W * 0.5,
      y: H - 54,
      vx: 0,
      vy: 0,
      r: radius(l),
      id: Math.random(),
      fresh: 0,
      ready: true,
      next: chooseNext(),
    };
  }
  function chooseNext() {
    let x = Math.random();
    return x < 0.35 ? 0 : x < 0.6 ? 1 : x < 0.8 ? 2 : x < 0.92 ? 3 : 4;
  }
  function reset() {
    balls = [];
    particles = [];
    score = 0;
    merges = 0;
    ended = false;
    drag = null;
    settle = 0;
    message = "";
    messageTime = 0;
    $("overlay").classList.remove("show");
    $("overlay-clear").classList.remove("show");
    [
      [0.24, 0.24, 0],
      [0.73, 0.23, 1],
      [0.48, 0.35, 0],
      [0.22, 0.43, 1],
      [0.76, 0.44, 0],
      [0.43, 0.53, 1],
      [0.67, 0.56, 0],
    ].forEach(([x, y, l]) => addBall(l, W * x, H * y));
    active = makeNext();
    updateUI();
    saveGame();
    draw();
  }
  function saveGame() {
    try {
      localStorage.setItem(
        "drinkslide-state",
        JSON.stringify({
          version: 2,
          balls,
          active,
          score,
          merges,
          ended,
          settle,
          particles,
          message,
          messageTime,
        }),
      );
    } catch (e) {}
  }
  function restoreGame() {
    try {
      const raw = localStorage.getItem("drinkslide-state");
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (
        !s ||
        s.version !== 2 ||
        !Array.isArray(s.balls) ||
        !Number.isFinite(s.score) ||
        !Number.isFinite(s.merges)
      )
        return false;
      s.ended = false;
      balls = s.balls
        .filter(
          (b) =>
            b &&
            Number.isFinite(b.x) &&
            Number.isFinite(b.y) &&
            Number.isInteger(b.l) &&
            b.l >= 0 &&
            b.l < drinks.length,
        )
        .map((b) => ({
          ...b,
          r: radius(b.l),
          vx: 0,
          vy: 0,
          x:
            Math.hypot(b.x - s.active.x, b.y - s.active.y) <
            b.r + s.active.r + 2
              ? b.x + b.r * 4
              : b.x,
          y:
            Math.hypot(b.x - s.active.x, b.y - s.active.y) <
            b.r + s.active.r + 2
              ? b.y - b.r * 4
              : b.y,
        })); //stop balls
      active =
        s.active &&
        Number.isInteger(s.active.l) &&
        s.active.l >= 0 &&
        s.active.l < drinks.length
          ? {
              ...s.active,
              r: radius(s.active.l),
              x: W * 0.5,
              y: H - 54,
              ready: true,
            }
          : makeNext();
      score = Math.max(0, Number(s.score) || 0);
      merges = Math.max(0, Number(s.merges) || 0);
      ended = !!s.ended;
      settle = Math.max(0, Number(s.settle) || 0);
      particles = Array.isArray(s.particles) ? s.particles : [];
      message = typeof s.message === "string" ? s.message : "";
      messageTime = Math.max(0, Number(s.messageTime) || 0);
      $("overlay-clear").classList.remove("show");
      if (ended) {
        $("final").textContent =
          "スコア：" + score + " 点 ／ 合体：" + merges + " 回";
        $("overlay").classList.add("show");
      } else $("overlay").classList.remove("show");
      updateUI();
      return true;
    } catch (e) {
      return false;
    }
  }
  function updateUI() {
    $("score").textContent = score;
    $("merges").textContent = merges;
    $("best").textContent = best;
    $("nextTop").textContent = active ? drinks[active.next].e : "—";
    $("nextName").textContent = active
      ? drinks[active.next].n
      : "発射待ち";
    $("levels").innerHTML = drinks
      .slice(0, 6)
      .map(
        (d) =>
          '<div class="item"><div class="emoji">' +
          d.e +
          "</div><small>" +
          d.n +
          "</small></div>",
      )
      .join("");
  }
  function launch(dx, dy) {
    if (!active || ended) return;
    let len = Math.hypot(dx, dy);
    if (len < 10) return;
    let speed = Math.min(13, len * 0.105);
    active.vx = (dx / len) * speed;
    active.vy = (dy / len) * speed;
    active.ready = false;
    active.fresh = 8;
    balls.push(active);
    next = active.next;
    active = null;
    setTimeout(() => {
      if (!ended) {
        active = makeNext(next);
        drag = null;
        settle = 0;
        updateUI();
        saveGame();
        $("hint").textContent =
          "飲み物が滑走中！ 次の飲み物も発射できるよ。";
      }
    }, 500);
  }
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (ended || !active || !active.ready) return;
    const p = pos(e);
    if (Math.hypot(p.x - active.x, p.y - active.y) < active.r + 22) {
      drag = { now: p };
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (drag) {
      drag.now = pos(e);
      draw();
      e.preventDefault();
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const p = pos(e),
      dx = active.x - p.x,
      dy = active.y - p.y;
    launch(dx, dy > 0 ? dy * 0.6 : dy);
  });
  canvas.addEventListener("pointercancel", () => {
    drag = null;
    draw();
  });
  function burst(x, y, color) {
    for (let i = 0; i < 9; i++)
      particles.push({
        x,
        y,
        vx: rand(-3, 3),
        vy: rand(-4, 1),
        life: rand(18, 32),
        c: color,
      });
  }
  function merge(a, b) {
    const x = (a.x + b.x) / 2,
      y = (a.y + b.y) / 2;
    balls = balls.filter((q) => q !== a && q !== b);
    const l = Math.min(drinks.length - 1, a.l + 1);
    addBall(l, x, y, (a.vx + b.vx) * 0.55, (a.vy + b.vy) * 0.55);
    const pts = (l + 1) * 10;
    score += pts;
    merges++;
    if (score > best) {
      best = score;
      try {
        localStorage.setItem("drinkslide-best", String(best));
      } catch (e) {}
    }
    message = "+" + pts + "  " + drinks[l].e + " 合体！";
    messageTime = 55;
    burst(x, y, drinks[l].c);
    updateUI();
  }
  function physics() {
    let moving = false;
    for (const b of balls) {
      if (b.fresh > 0) b.fresh--;
      b.vx *= 0.992;
      b.vy *= 0.992;
      if (Math.abs(b.vx) + Math.abs(b.vy) > 0.12) moving = true;
      else {
        b.vx *= 0.8;
        b.vy *= 0.8;
      }
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < b.r + 5) {
        b.x = b.r + 5;
        b.vx = Math.abs(b.vx) * 0.7;
      }
      if (b.x > W - b.r - 5) {
        b.x = W - b.r - 5;
        b.vx = -Math.abs(b.vx) * 0.7;
      }
      if (b.y < b.r + 5) {
        b.y = b.r + 5;
        b.vy = Math.abs(b.vy) * 0.7;
      }
      if (b.y > H - b.r - 5) {
        b.y = H - b.r - 5;
        b.vy = -Math.abs(b.vy) * 0.55;
      }
    }
    let removed = new Set(),
      pairs = [];
    for (let i = 0; i < balls.length; i++)
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i],
          b = balls[j];
        if (removed.has(a) || removed.has(b)) continue;
        let dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy) || 0.001,
          min = a.r + b.r;
        if (d < min) {
          if (
            a.l === b.l &&
            a.fresh === 0 &&
            b.fresh === 0 //&&
            //a.l < drinks.length - 1
          ) {
            removed.add(a);
            removed.add(b);
            pairs.push([a, b]);
            continue;
          }
          const nx = dx / d,
            ny = dy / d,
            overlap = min - d;
          a.x -= nx * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.y += ny * overlap * 0.5;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const imp = -rel * 0.72;
            a.vx -= imp * nx;
            b.vx += imp * nx;
            a.vy -= imp * ny;
            b.vy += imp * ny;
          }
        }
      }
    pairs.forEach(([a, b]) => merge(a, b));
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life--;
    });
    particles = particles.filter((p) => p.life > 0);
    if (messageTime > 0) messageTime--;
    return moving;
  }
  function drawBall(b) {
    ctx.save();
    ctx.shadowColor = "rgba(94,60,26,.2)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = drinks[b.l].c;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r - 4, Math.PI * 1.1, Math.PI * 1.65);
    ctx.stroke();
    ctx.font =
      b.r * 1.05 + "px system-ui, Apple Color Emoji, Segoe UI Emoji";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(drinks[b.l].e, b.x, b.y + 1);
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f9ecd4";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(171,130,73,.10)";
    for (let y = 22; y < H; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#b68d5b";
    ctx.font = "700 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("SLIDE  •  MERGE  •  EVOLVE", W / 2, 22);
    ctx.strokeStyle = "rgba(165,112,50,.45)";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(10, H - 104);
    ctx.lineTo(W - 10, H - 104);
    ctx.stroke();
    ctx.setLineDash([]);
    balls.forEach(drawBall);
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / 30);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    if (active) {
      if (drag) {
        const p = drag.now,
          dx = active.x - p.x,
          dy = active.y - p.y;
        ctx.strokeStyle = "#e59c3c";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(active.x, active.y);
        ctx.lineTo(active.x + dx * 2, active.y + dy * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#9c6a30";
        ctx.font = "12px system-ui";
        ctx.fillText("ここに向かって発射！", W / 2, H - 17);
      } else {
        ctx.fillStyle = "rgba(226,160,67,.17)";
        ctx.beginPath();
        ctx.arc(active.x, active.y, active.r + 9, 0, Math.PI * 2);
        ctx.fill();
      }
      drawBall(active);
    }
    if (messageTime > 0) {
      ctx.globalAlpha = Math.min(1, messageTime / 12);
      ctx.fillStyle = "#88552a";
      ctx.font = "900 23px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(message, W / 2, H * 0.69);
      ctx.globalAlpha = 1;
    }
  }
  function tick(t) {
    if (t - last > 16) {
      last = t;
      if (!ended) {
        physics();
        const blocked =
          active &&
          balls.some(
            (b) =>
              b.fresh === 0 &&
              Math.hypot(b.x - active.x, b.y - active.y) <
                b.r + active.r + 2,
          );
        const cleared = balls.some((b) => b.l == drinks.length - 1);
        if (blocked) {
          ended = true;
          drag = null;
          $("final").textContent =
            "スコア：" + score + " 点 ／ 合体：" + merges + " 回";
          $("overlay").classList.add("show");
        }
        if (cleared) {
          ended = true;
          drag = null;
          balls = balls.map((b) => ({
            ...b,
            l: b.l == drinks.length - 1 ? chooseNext() : b.l,
          }));
          $("final-clear").textContent =
            "スコア：" + score + " 点 ／ 合体：" + merges + " 回";
          $("overlay-clear").classList.add("show");
        }
        if (t - lastSave > 350 || cleared) {
          saveGame();
          lastSave = t;
        }
      }
      draw();
    }
    requestAnimationFrame(tick);
  }
  $("reset").addEventListener("click", () => {
    if (confirm("スコアと盤面をリセットして最初から始めますか？")) {
      try {
        localStorage.removeItem("drinkslide-state");
      } catch (e) {}
      reset();
    }
  });
  $("again").addEventListener("click", () => {
    restoreGame();
  });
  $("again-clear").addEventListener("click", () => {
    restoreGame();
  });
  resize();
  if (!restoreGame()) reset();
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", saveGame);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveGame();
  });
  requestAnimationFrame(tick);
})();
