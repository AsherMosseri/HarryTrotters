// Profile effects, drawn on a canvas (see FxCanvas). Each effect gets the
// canvas size and returns frame(ctx, dt, t, intro): dt and t in seconds;
// intro goes 1 → 0 over the first ~2 s after the profile opens, so effects
// open with a burst and settle into a gentle loop (like Discord's).
//
// env: { w, h, n(k) } where n scales a particle count to the canvas area.

const TAU = Math.PI * 2;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// A soft glowing dot, drawn once per color and reused (much faster than
// shadowBlur on every particle).
const glowCache = new Map();
function glow(color, r = 32) {
  const key = `${color}|${r}`;
  if (glowCache.has(key)) return glowCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0, color);
  grd.addColorStop(0.25, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, r * 2, r * 2);
  glowCache.set(key, c);
  return c;
}
const drawGlow = (ctx, color, x, y, size, alpha = 1) => {
  ctx.globalAlpha = alpha;
  ctx.drawImage(glow(color), x - size, y - size, size * 2, size * 2);
  ctx.globalAlpha = 1;
};

function star4(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.45, y - s, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
  ctx.fill();
}

function gearPath(ctx, r, teeth) {
  const inner = r * 0.82;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;
    const w = (TAU / teeth) * 0.25;
    ctx.lineTo(Math.cos(a - w * 1.4) * inner, Math.sin(a - w * 1.4) * inner);
    ctx.lineTo(Math.cos(a - w) * r, Math.sin(a - w) * r);
    ctx.lineTo(Math.cos(a + w) * r, Math.sin(a + w) * r);
    ctx.lineTo(Math.cos(a + w * 1.4) * inner, Math.sin(a + w * 1.4) * inner);
  }
  ctx.closePath();
  ctx.moveTo(r * 0.32, 0);
  ctx.arc(0, 0, r * 0.32, 0, TAU);
}

export const FX = {
  sparkles: {
    label: 'Sparkles',
    icon: '✨',
    make({ w, h, n }) {
      const colors = ['#fde68a', '#ffffff', '#f9a8d4', '#a5f3fc'];
      const mk = (burst) => {
        const a = rnd(TAU);
        const sp = burst ? rnd(80, 260) : 0;
        return {
          x: burst ? w / 2 : rnd(w),
          y: burst ? h * 0.3 : rnd(h),
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (burst ? 0 : rnd(4, 14)),
          r: rnd(3, 9),
          ph: rnd(TAU),
          sp: rnd(1.5, 3.5),
          c: pick(colors),
          life: burst ? rnd(1, 1.8) : Infinity,
        };
      };
      let ps = Array.from({ length: n(26) }, () => mk(false));
      let burst = Array.from({ length: n(40) }, () => mk(true));
      return (ctx, dt, t) => {
        ctx.globalCompositeOperation = 'lighter';
        for (const p of [...ps, ...burst]) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.96;
          p.vy *= 0.96;
          p.life -= dt;
          if (p.y < -10) ((p.y = h + 10), (p.x = rnd(w)));
          const tw = 0.5 + 0.5 * Math.sin(t * p.sp + p.ph);
          const fade = p.life === Infinity ? 1 : Math.max(0, Math.min(1, p.life));
          drawGlow(ctx, p.c, p.x, p.y, p.r * 2.4, 0.35 * tw * fade);
          ctx.globalAlpha = (0.35 + 0.65 * tw) * fade;
          ctx.fillStyle = p.c;
          star4(ctx, p.x, p.y, p.r * (0.6 + 0.6 * tw));
        }
        burst = burst.filter((p) => p.life > 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      };
    },
  },

  snow: {
    label: 'Snow globe',
    icon: '❄️',
    make({ w, h, n }) {
      const flakes = Array.from({ length: n(70) }, () => {
        const z = rnd(0.3, 1);
        return { x: rnd(w), y: rnd(h), z, ph: rnd(TAU), r: 1 + z * 3.2, vy: 10 + z * 32 };
      });
      return (ctx, dt, t, intro) => {
        for (const f of flakes) {
          // Shaken: a swirl at first, then gentle falling.
          const swirl = intro * 140;
          const dx = f.x - w / 2;
          const dy = f.y - h / 2;
          f.x += (Math.sin(t * 0.8 + f.ph) * 10 * f.z - (dy / (Math.hypot(dx, dy) + 1)) * swirl) * dt;
          f.y += (f.vy * (1 - intro * 0.7) + (dx / (Math.hypot(dx, dy) + 1)) * swirl) * dt;
          if (f.y > h + 6) ((f.y = -6), (f.x = rnd(w)));
          if (f.x < -6) f.x = w + 6;
          if (f.x > w + 6) f.x = -6;
          ctx.globalAlpha = 0.35 + f.z * 0.6;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, TAU);
          ctx.fill();
          if (f.z > 0.85) drawGlow(ctx, '#e0f2fe', f.x, f.y, f.r * 3, 0.5);
        }
        ctx.globalAlpha = 1;
      };
    },
  },

  hearts: {
    label: 'Hearts',
    icon: '💖',
    make({ w, h, n }) {
      const colors = ['#f43f5e', '#ec4899', '#fb7185', '#f472b6', '#e11d48'];
      const mk = (pop) => ({
        x: pop ? w / 2 + rnd(-30, 30) : rnd(w),
        y: pop ? h * 0.85 : h + rnd(20, h),
        vx: pop ? rnd(-160, 160) : 0,
        vy: pop ? rnd(-320, -160) : -rnd(18, 40),
        s: rnd(6, 15),
        ph: rnd(TAU),
        c: pick(colors),
        pop,
      });
      // Some already on screen, so it's never empty after the opening pop.
      const ps = Array.from({ length: n(18) }, () => ({ ...mk(false), y: rnd(h * 0.1, h * 1.3) }));
      let pops = Array.from({ length: n(24) }, () => mk(true));
      return (ctx, dt, t) => {
        for (const p of [...ps, ...pops]) {
          if (p.pop) {
            p.vy += 260 * dt;
            p.vx *= 0.98;
          }
          p.x += (p.vx + (p.pop ? 0 : Math.sin(t * 1.6 + p.ph) * 18)) * dt;
          p.y += p.vy * dt;
          if (!p.pop && p.y < -20) Object.assign(p, mk(false), { y: h + 20 });
          const beat = 1 + 0.12 * Math.sin(t * 6 + p.ph);
          drawGlow(ctx, p.c, p.x, p.y, p.s * 2.2, 0.35);
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = p.c;
          heart(ctx, p.x, p.y, p.s * beat);
        }
        pops = pops.filter((p) => p.y < h + 40);
        ctx.globalAlpha = 1;
      };
    },
  },

  fire: {
    label: 'Embers',
    icon: '🔥',
    make({ w, h, n }) {
      const mk = () => ({
        x: rnd(w),
        y: h + rnd(0, 40),
        vy: -rnd(30, 90),
        vx: rnd(-8, 8),
        r: rnd(1.5, 4),
        life: rnd(2, 5),
        age: 0,
        ph: rnd(TAU),
      });
      const ps = Array.from({ length: n(48) }, mk).map((p) => ({ ...p, y: rnd(h), age: rnd(p.life) }));
      return (ctx, dt, t, intro) => {
        // Heat glow along the bottom, flickering.
        const flick = 0.75 + 0.15 * Math.sin(t * 7) + 0.1 * Math.sin(t * 13.3);
        const g = ctx.createLinearGradient(0, h, 0, h * (0.55 - intro * 0.35));
        g.addColorStop(0, `rgba(249,115,22,${0.42 * flick + intro * 0.3})`);
        g.addColorStop(0.5, `rgba(239,68,68,${0.14 * flick + intro * 0.15})`);
        g.addColorStop(1, 'rgba(239,68,68,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (const p of ps) {
          p.age += dt;
          if (p.age > p.life) Object.assign(p, mk());
          p.x += (p.vx + Math.sin(t * 3 + p.ph) * 14) * dt;
          p.y += p.vy * (1 + intro * 2) * dt;
          const k = 1 - p.age / p.life;
          const c = k > 0.6 ? '#fde68a' : k > 0.3 ? '#fb923c' : '#ef4444';
          drawGlow(ctx, c, p.x, p.y, p.r * 3.2, 0.9 * k);
        }
        ctx.globalCompositeOperation = 'source-over';
      };
    },
  },

  gears: {
    label: 'Blueprint',
    icon: '⚙️',
    make({ w, h }) {
      const R = Math.max(26, Math.min(w, h) * 0.13);
      const gears = [
        { x: w * 0.82, y: h * 0.16, r: R * 1.3, teeth: 14, dir: 1 },
        { x: w * 0.82 - R * 2.25, y: h * 0.16 + R * 0.9, r: R * 0.95, teeth: 10, dir: -1.37 },
        { x: w * 0.14, y: h * 0.82, r: R * 1.1, teeth: 12, dir: -1 },
        { x: w * 0.14 + R * 1.95, y: h * 0.82 - R * 0.55, r: R * 0.8, teeth: 9, dir: 1.33 },
      ];
      let rot = 0;
      return (ctx, dt, t, intro) => {
        // Faint blueprint grid.
        ctx.strokeStyle = 'rgba(56,189,248,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = (t * 6) % 24; x < w; x += 24) (ctx.moveTo(x, 0), ctx.lineTo(x, h));
        for (let y = 0; y < h; y += 24) (ctx.moveTo(0, y), ctx.lineTo(w, y));
        ctx.stroke();
        rot += dt * (0.35 + intro * 4);
        for (const g of gears) {
          ctx.save();
          ctx.translate(g.x, g.y);
          ctx.rotate(rot * g.dir);
          gearPath(ctx, g.r, g.teeth);
          ctx.fillStyle = 'rgba(56,189,248,0.10)';
          ctx.fill('evenodd');
          ctx.strokeStyle = 'rgba(125,211,252,0.7)';
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.restore();
        }
      };
    },
  },

  bubbles: {
    label: 'Bubbles',
    icon: '🫧',
    make({ w, h, n }) {
      const mk = (y) => ({
        x: rnd(w),
        y: y ?? h + rnd(10, 60),
        r: rnd(5, 16),
        vy: -rnd(20, 50),
        ph: rnd(TAU),
        popAt: rnd(h * 0.05, h * 0.5),
        pop: 0,
      });
      const ps = Array.from({ length: n(18) }, () => mk(rnd(h)));
      return (ctx, dt, t, intro) => {
        for (const p of ps) {
          if (p.pop) {
            p.pop += dt;
            ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - p.pop / 0.3)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * (1 + p.pop * 3), 0, TAU);
            ctx.stroke();
            if (p.pop > 0.3) Object.assign(p, mk());
            continue;
          }
          p.y += p.vy * (1 + intro * 1.5) * dt;
          p.x += Math.sin(t * 2 + p.ph) * 12 * dt;
          if (p.y < p.popAt) p.pop = 0.001;
          const g = ctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.1, p.x, p.y, p.r);
          g.addColorStop(0, 'rgba(255,255,255,0.05)');
          g.addColorStop(0.75, 'rgba(165,243,252,0.12)');
          g.addColorStop(1, 'rgba(255,255,255,0.65)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.ellipse(p.x - p.r * 0.38, p.y - p.r * 0.42, p.r * 0.22, p.r * 0.12, -0.6, 0, TAU);
          ctx.fill();
        }
      };
    },
  },

  confetti: {
    label: 'Confetti cannon',
    icon: '🎉',
    make({ w, h, n }) {
      const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#facc15'];
      const shot = (left) => {
        const a = left ? rnd(-1.35, -0.85) : rnd(-2.3, -1.8);
        const sp = rnd(380, 720);
        return {
          x: left ? 0 : w,
          y: h,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          rot: rnd(TAU),
          vr: rnd(-12, 12),
          ph: rnd(TAU),
          c: pick(colors),
          sw: rnd(5, 9),
          sh: rnd(8, 13),
        };
      };
      let ps = [...Array.from({ length: n(45) }, () => shot(true)), ...Array.from({ length: n(45) }, () => shot(false))];
      const gentle = Array.from({ length: n(14) }, () => ({
        x: rnd(w),
        y: rnd(-h, 0),
        vx: 0,
        vy: rnd(30, 60),
        rot: rnd(TAU),
        vr: rnd(-4, 4),
        ph: rnd(TAU),
        c: pick(colors),
        sw: rnd(4, 7),
        sh: rnd(6, 10),
        slow: true,
      }));
      return (ctx, dt, t) => {
        for (const p of [...ps, ...gentle]) {
          if (!p.slow) {
            p.vy += 520 * dt;
            p.vx *= 1 - 1.6 * dt;
            p.vy *= 1 - 1.2 * dt;
          } else if (p.y > h + 10) ((p.y = -10), (p.x = rnd(w)));
          p.x += (p.vx + Math.sin(t * 2 + p.ph) * (p.slow ? 20 : 0)) * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.cos(t * 6 + p.ph)); // tumbling
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.sw / 2, -p.sh / 2, p.sw, p.sh);
          ctx.restore();
        }
        ps = ps.filter((p) => p.y < h + 30);
      };
    },
  },

  aurora: {
    label: 'Aurora',
    icon: '🌌',
    make({ w, h, n }) {
      const bands = [
        { c: [34, 211, 238], y: 0.18, a: 0.22, f: 1.3, s: 0.35 },
        { c: [74, 222, 128], y: 0.3, a: 0.2, f: 0.9, s: 0.25 },
        { c: [192, 132, 252], y: 0.42, a: 0.16, f: 1.7, s: 0.45 },
      ];
      const stars = Array.from({ length: n(30) }, () => ({ x: rnd(w), y: rnd(h * 0.6), r: rnd(0.6, 1.6), ph: rnd(TAU) }));
      return (ctx, dt, t, intro) => {
        const show = 1 - intro * 0.85;
        for (const s of stars) {
          ctx.globalAlpha = (0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + s.ph))) * show;
          ctx.fillStyle = '#fff';
          ctx.fillRect(s.x, s.y, s.r, s.r);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter';
        for (const b of bands) {
          const top = [];
          for (let x = -10; x <= w + 10; x += 12) {
            const y =
              h * b.y + Math.sin(x * 0.012 * b.f + t * b.s) * h * 0.06 + Math.sin(x * 0.03 + t * b.s * 1.7) * h * 0.02 - intro * h * 0.25;
            top.push([x, y]);
          }
          const g = ctx.createLinearGradient(0, h * b.y - h * 0.1, 0, h * b.y + h * 0.28);
          g.addColorStop(0, `rgba(${b.c},0)`);
          g.addColorStop(0.25, `rgba(${b.c},${b.a * show})`);
          g.addColorStop(1, `rgba(${b.c},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(top[0][0], top[0][1]);
          for (const [x, y] of top) ctx.lineTo(x, y);
          for (let i = top.length - 1; i >= 0; i--) ctx.lineTo(top[i][0], top[i][1] + h * 0.3);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      };
    },
  },

  fireflies: {
    label: 'Fireflies',
    icon: '🪲',
    make({ w, h, n }) {
      const fs = Array.from({ length: n(22) }, () => ({
        x: rnd(w),
        y: rnd(h),
        a: rnd(TAU),
        sp: rnd(12, 30),
        ph: rnd(TAU),
        bl: rnd(0.6, 1.4),
      }));
      return (ctx, dt, t, intro) => {
        ctx.globalCompositeOperation = 'lighter';
        for (const f of fs) {
          f.a += Math.sin(t * 0.7 + f.ph) * dt * 1.6;
          f.x += Math.cos(f.a) * f.sp * dt;
          f.y += Math.sin(f.a) * f.sp * dt;
          if (f.x < -10) f.x = w + 10;
          if (f.x > w + 10) f.x = -10;
          if (f.y < -10) f.y = h + 10;
          if (f.y > h + 10) f.y = -10;
          const blink = Math.max(0, Math.sin(t * f.bl + f.ph)) ** 2;
          const k = Math.max(blink, intro);
          drawGlow(ctx, '#d9f99d', f.x, f.y, 14, 0.55 * k);
          drawGlow(ctx, '#fef9c3', f.x, f.y, 4, k);
        }
        ctx.globalCompositeOperation = 'source-over';
      };
    },
  },

  warp: {
    label: 'Warp speed',
    icon: '🚀',
    make({ w, h, n }) {
      const mk = () => ({ x: rnd(-1, 1), y: rnd(-1, 1), z: rnd(0.05, 1) });
      const stars = Array.from({ length: n(120) }, mk);
      return (ctx, dt, t, intro) => {
        const speed = 0.16 + intro * intro * 1.6;
        const cx = w / 2;
        const cy = h * 0.32;
        const f = Math.max(w, h) * 0.5;
        ctx.lineCap = 'round';
        for (const s of stars) {
          const pz = s.z;
          s.z -= speed * dt;
          if (s.z <= 0.02) Object.assign(s, mk(), { z: 1 });
          const x1 = cx + (s.x / s.z) * f;
          const y1 = cy + (s.y / s.z) * f;
          const x0 = cx + (s.x / pz) * f;
          const y0 = cy + (s.y / pz) * f;
          const b = Math.min(1, (1 - s.z) * 1.4);
          ctx.strokeStyle = `rgba(${200 + 55 * b},${220 + 35 * b},255,${b})`;
          ctx.lineWidth = 0.8 + (1 - s.z) * 2.6;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1 + (x1 - x0) * intro * 6, y1 + (y1 - y0) * intro * 6);
          ctx.stroke();
        }
      };
    },
  },

  sakura: {
    label: 'Sakura',
    icon: '🌸',
    make({ w, h, n }) {
      const mk = (top) => ({
        x: top ? rnd(-w * 0.3, w) : rnd(w),
        y: top ? rnd(-h * 0.4, -10) : rnd(h),
        s: rnd(6, 12),
        rot: rnd(TAU),
        vr: rnd(-2, 2),
        ph: rnd(TAU),
        vy: rnd(25, 55),
        flip: rnd(1.5, 3.5),
      });
      const ps = Array.from({ length: n(36) }, () => mk(false));
      return (ctx, dt, t, intro) => {
        for (const p of ps) {
          p.x += (Math.sin(t + p.ph) * 22 + 30 + intro * 260) * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          if (p.y > h + 15 || p.x > w + 20) Object.assign(p, mk(true));
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(Math.cos(t * p.flip + p.ph), 1);
          const g = ctx.createLinearGradient(0, -p.s, 0, p.s);
          g.addColorStop(0, '#fff1f2');
          g.addColorStop(1, '#f9a8d4');
          ctx.fillStyle = g;
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.moveTo(0, -p.s);
          ctx.bezierCurveTo(p.s * 0.9, -p.s * 0.5, p.s * 0.6, p.s * 0.8, 0, p.s);
          ctx.bezierCurveTo(-p.s * 0.6, p.s * 0.8, -p.s * 0.9, -p.s * 0.5, 0, -p.s);
          ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      };
    },
  },

  lightning: {
    label: 'Lightning',
    icon: '⚡',
    make({ w, h, n }) {
      const drops = Array.from({ length: n(60) }, () => ({ x: rnd(w), y: rnd(h), l: rnd(8, 18), v: rnd(380, 560) }));
      let bolt = null;
      let next = 0.15;
      const makeBolt = () => {
        const pts = [[rnd(w * 0.2, w * 0.8), -5]];
        const branches = [];
        while (pts[pts.length - 1][1] < h * rnd(0.5, 0.9)) {
          const [x, y] = pts[pts.length - 1];
          const p = [x + rnd(-24, 24), y + rnd(12, 26)];
          pts.push(p);
          if (Math.random() < 0.18) {
            const br = [p];
            for (let i = 0; i < 5; i++) {
              const [bx, by] = br[br.length - 1];
              br.push([bx + rnd(-26, 26), by + rnd(10, 22)]);
            }
            branches.push(br);
          }
        }
        return { pts, branches, age: 0 };
      };
      const line = (ctx, pts) => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (const [x, y] of pts) ctx.lineTo(x, y);
        ctx.stroke();
      };
      return (ctx, dt) => {
        ctx.strokeStyle = 'rgba(186,230,253,0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const d of drops) {
          d.y += d.v * dt;
          d.x -= d.v * 0.15 * dt;
          if (d.y > h) ((d.y = -d.l), (d.x = rnd(w + 40)));
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + d.l * 0.15, d.y - d.l);
        }
        ctx.stroke();
        next -= dt;
        if (next <= 0) {
          bolt = makeBolt();
          next = rnd(2.2, 4.5);
        }
        if (bolt) {
          bolt.age += dt;
          const k = Math.max(0, 1 - bolt.age / 0.45) * (bolt.age < 0.08 || bolt.age > 0.14 ? 1 : 0.35);
          if (k <= 0) bolt = null;
          else {
            ctx.fillStyle = `rgba(224,242,254,${0.22 * k})`;
            ctx.fillRect(0, 0, w, h);
            ctx.lineJoin = 'round';
            ctx.strokeStyle = `rgba(125,211,252,${0.5 * k})`;
            ctx.lineWidth = 7;
            line(ctx, bolt.pts);
            ctx.strokeStyle = `rgba(255,255,255,${k})`;
            ctx.lineWidth = 2.2;
            line(ctx, bolt.pts);
            ctx.lineWidth = 1.2;
            for (const b of bolt.branches) line(ctx, b);
          }
        }
      };
    },
  },

  matrix: {
    label: 'Matrix',
    icon: '💻',
    make({ w, h }) {
      const size = 13;
      const glyphs = 'アイウエオカキクケコサシスセソ0123456789ﾊﾋﾌﾍﾎ32313FTC';
      const cols = Array.from({ length: Math.ceil(w / size) }, () => ({ y: rnd(-h, 0), v: rnd(50, 130), trail: [] }));
      return (ctx, dt, t, intro) => {
        ctx.font = `${size}px ui-monospace, Menlo, monospace`;
        ctx.textAlign = 'center';
        cols.forEach((c, i) => {
          c.y += c.v * (1 + intro * 2) * dt;
          const row = Math.floor(c.y / size);
          if (!c.trail.length || c.trail[c.trail.length - 1].row !== row) c.trail.push({ row, ch: pick(glyphs) });
          if (c.trail.length > 14) c.trail.shift();
          if (c.y - 14 * size > h) ((c.y = rnd(-h * 0.5, 0)), (c.trail = []));
          c.trail.forEach((g, k) => {
            const head = k === c.trail.length - 1;
            const a = ((k + 1) / c.trail.length) * 0.32;
            ctx.fillStyle = head ? 'rgba(220,252,231,0.6)' : `rgba(74,222,128,${a})`;
            ctx.fillText(Math.random() < 0.02 ? pick(glyphs) : g.ch, i * size + size / 2, g.row * size);
          });
        });
      };
    },
  },

  synthwave: {
    label: 'Synthwave',
    icon: '🌆',
    make({ w, h }) {
      return (ctx, dt, t, intro) => {
        const horizon = h * (0.8 + intro * 0.2);
        // Sun glow sitting on the horizon.
        const sun = ctx.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, w * 0.35);
        sun.addColorStop(0, 'rgba(251,146,60,0.45)');
        sun.addColorStop(0.5, 'rgba(236,72,153,0.2)');
        sun.addColorStop(1, 'rgba(236,72,153,0)');
        ctx.fillStyle = sun;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(232,121,249,0.4)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        // Lines rushing toward you.
        const off = (t * 0.6) % 1;
        for (let i = 0; i < 8; i++) {
          const k = (i + off) / 8;
          const y = horizon + (h - horizon) * k * k;
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
        for (let i = -10; i <= 10; i++) {
          ctx.moveTo(w / 2 + i * w * 0.02, horizon);
          ctx.lineTo(w / 2 + i * w * 0.16, h);
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(34,211,238,0.6)';
        ctx.beginPath();
        ctx.moveTo(0, horizon);
        ctx.lineTo(w, horizon);
        ctx.stroke();
      };
    },
  },

  circuit: {
    label: 'Circuit',
    icon: '🔌',
    make({ w, h, n }) {
      const step = 20;
      // Traces: right-angle paths from the edges inward.
      const traces = Array.from({ length: n(10) }, () => {
        const fromLeft = Math.random() < 0.5;
        let x = fromLeft ? 0 : Math.round(w / step) * step;
        let y = Math.round(rnd(h) / step) * step;
        const pts = [[x, y]];
        for (let i = 0; i < 4; i++) {
          if (i % 2 === 0) x += (fromLeft ? 1 : -1) * step * Math.ceil(rnd(1, 5));
          else y += step * Math.round(rnd(-3, 3));
          pts.push([x, y]);
        }
        let len = 0;
        for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        return { pts, len, pulse: rnd(1), sp: rnd(0.25, 0.6) };
      });
      const at = (tr, d) => {
        for (let i = 1; i < tr.pts.length; i++) {
          const [x0, y0] = tr.pts[i - 1];
          const [x1, y1] = tr.pts[i];
          const l = Math.hypot(x1 - x0, y1 - y0);
          if (d <= l) return [x0 + ((x1 - x0) * d) / l, y0 + ((y1 - y0) * d) / l];
          d -= l;
        }
        return tr.pts[tr.pts.length - 1];
      };
      return (ctx, dt, t, intro) => {
        const grow = 1 - intro;
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        for (const tr of traces) {
          ctx.strokeStyle = 'rgba(52,211,153,0.35)';
          ctx.setLineDash([tr.len * grow, tr.len]);
          ctx.beginPath();
          tr.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
          ctx.setLineDash([]);
          const [ex, ey] = tr.pts[tr.pts.length - 1];
          ctx.fillStyle = 'rgba(52,211,153,0.6)';
          ctx.beginPath();
          ctx.arc(ex, ey, 3 * grow, 0, TAU);
          ctx.fill();
          // The pulse fades in at the edge and out at the end, where the end
          // pad flashes and dims (it used to vanish the moment a pulse restarted).
          tr.pulse += tr.sp * dt;
          if (tr.pulse >= 1) ((tr.pulse %= 1), (tr.flash = 1));
          tr.flash = Math.max(0, (tr.flash || 0) - dt * 2.5);
          const [px, py] = at(tr, tr.pulse * tr.len * grow);
          ctx.globalCompositeOperation = 'lighter';
          drawGlow(ctx, '#6ee7b7', px, py, 9, 0.9 * Math.min(1, tr.pulse / 0.08, (1 - tr.pulse) / 0.08));
          const arriving = tr.pulse > 0.94 ? (tr.pulse - 0.94) * 16 : 0;
          if (arriving || tr.flash) drawGlow(ctx, '#a7f3d0', ex, ey, 12, Math.max(arriving, tr.flash * 0.96));
          ctx.globalCompositeOperation = 'source-over';
        }
      };
    },
  },
};

export const FX_IDS = Object.keys(FX);
