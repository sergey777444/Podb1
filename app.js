/* ФЛ1-ПОДб-11: вход/регистрация + данные через Supabase + тема + нижняя навигация. Подключается в <head> каждой страницы.
   Режимы:
   - админ                    → всё
   - подтверждённый ученик    → всё, кроме правки ДЗ/конспектов
   - неподтверждённый (гость) → урезанный сайт, прогресс только в браузере, профиль (ник/аватар) сохраняется */
(function () {
  const SB_URL = 'https://kmimcxrbdpsubpquenxz.supabase.co';
  const SB_KEY = 'sb_publishable__n7rX8CQCOxBvQlA3l0BBw_AnhSor-_';
  const HW_ID = 'ac41837c39a8785f2ce4';   // старый npoint ДЗ
  const NT_ID = 'b0bf097d8c176bdc856e';   // старый npoint конспектов
  const DOMAIN = '@group.local';

  /* ---------- тема: одна на все страницы ---------- */
  /* ---------- анимированные фоны тем (canvas): Терминал, Сакура, Лес, Космос ---------- */
  const FXMAP = { terminal: { op: 0.3, fps: 15 }, sakura: { op: 1, fps: 40 }, forest: { op: 1, fps: 40 }, midnight: { op: 1, fps: 30 } };
  let fx = null;
  function buildFx(kind, ctx, w, h) {
    const R = Math.random, TAU = Math.PI * 2;
    if (kind === 'terminal') {
      const FS = 16, CH = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789'.split('');
      ctx.fillStyle = '#050805'; ctx.fillRect(0, 0, w, h);
      const drops = Array.from({ length: Math.ceil(w / FS) }, () => -R() * (h / FS));
      return () => {
        ctx.fillStyle = 'rgba(5,8,5,.14)'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#39ff6a'; ctx.font = FS + 'px monospace';
        for (let i = 0; i < drops.length; i++) {
          if (drops[i] > 0) ctx.fillText(CH[R() * CH.length | 0], i * FS, drops[i] * FS);
          if (drops[i] * FS > h && R() > 0.975) drops[i] = 0;
          drops[i]++;
        }
      };
    }
    if (kind === 'sakura') {
      const n = Math.max(14, Math.min(36, Math.round(w / 32)));
      const P = Array.from({ length: n }, () => ({ x: R() * w, y: R() * h, s: 6 + R() * 8, vy: 0.5 + R(), ph: R() * TAU, sw: 0.4 + R() * 0.8, r: R() * TAU, vr: (R() - 0.5) * 0.04, a: 0.55 + R() * 0.4 }));
      return () => {
        ctx.clearRect(0, 0, w, h);
        for (const p of P) {
          p.y += p.vy; p.ph += 0.02; p.x += Math.sin(p.ph) * p.sw + 0.25; p.r += p.vr;
          if (p.y > h + 20 || p.x > w + 20) { p.y = -20; p.x = R() * w * 0.9; }
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = p.a;
          ctx.fillStyle = '#ffb3c9'; ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ff8fb0'; ctx.beginPath(); ctx.ellipse(p.s * 0.35, 0, p.s * 0.4, p.s * 0.22, 0, 0, TAU); ctx.fill();
          ctx.restore();
        }
      };
    }
    if (kind === 'forest') {
      const n = Math.max(16, Math.min(40, Math.round(w / 28)));
      const F = Array.from({ length: n }, () => ({ x: R() * w, y: R() * h, a: R() * TAU, s: 0.2 + R() * 0.4, ph: R() * TAU, r: 1.2 + R() * 1.8 }));
      return () => {
        ctx.clearRect(0, 0, w, h);
        for (const f of F) {
          f.a += (R() - 0.5) * 0.25; f.x += Math.cos(f.a) * f.s; f.y += Math.sin(f.a) * f.s * 0.8 - 0.05; f.ph += 0.03;
          if (f.x < -10) f.x = w + 10; if (f.x > w + 10) f.x = -10; if (f.y < -10) f.y = h + 10; if (f.y > h + 10) f.y = -10;
          const al = 0.35 + 0.65 * (Math.sin(f.ph) * 0.5 + 0.5);
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 7);
          g.addColorStop(0, 'rgba(230,255,122,' + al + ')'); g.addColorStop(1, 'rgba(230,255,122,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 7, 0, TAU); ctx.fill();
        }
      };
    }
    if (kind === 'midnight') {
      const n = Math.min(170, Math.round(w * h / 7000));
      const S = Array.from({ length: n }, () => ({ x: R() * w, y: R() * h, r: 0.3 + R() * 1.1, ph: R() * TAU, sp: 0.01 + R() * 0.03 }));
      let shoot = null, next = 120;
      return () => {
        ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#fff';
        for (const s of S) { s.ph += s.sp; ctx.globalAlpha = 0.25 + 0.75 * (Math.sin(s.ph) * 0.5 + 0.5); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
        if (--next <= 0 && !shoot) { shoot = { x: R() * w * 0.7, y: R() * h * 0.4, l: 0 }; next = 200 + R() * 300; }
        if (shoot) {
          shoot.x += 9; shoot.y += 4.5; shoot.l++;
          const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - 70, shoot.y - 35);
          g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - 70, shoot.y - 35); ctx.stroke();
          if (shoot.l > 45) shoot = null;
        }
      };
    }
    return null;
  }
  function stopFx() {
    if (!fx) return;
    cancelAnimationFrame(fx.raf);
    window.removeEventListener('resize', fx.onResize);
    document.removeEventListener('visibilitychange', fx.onVis);
    fx.c.remove();
    fx = null;
  }
  function startFx(kind) {
    const cfg = FXMAP[kind];
    if (!cfg || !document.body) return;
    if (fx && fx.kind === kind) return;
    stopFx();
    if (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const c = document.createElement('canvas');
    c.id = 'bgFx';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:0;pointer-events:none;opacity:' + cfg.op;
    document.body.insertBefore(c, document.body.firstChild);
    const ctx = c.getContext('2d');
    let last = 0;
    const build = () => { c.width = window.innerWidth; c.height = window.innerHeight; fx.draw = buildFx(kind, ctx, c.width, c.height); };
    const loop = t => {
      fx.raf = requestAnimationFrame(loop);
      if (t - last < 1000 / cfg.fps || !fx.draw) return;
      last = t; fx.draw();
    };
    fx = { kind, c, raf: 0, draw: null, onResize: () => build(), onVis: () => { if (document.hidden) cancelAnimationFrame(fx.raf); else fx.raf = requestAnimationFrame(loop); } };
    build();
    window.addEventListener('resize', fx.onResize);
    document.addEventListener('visibilitychange', fx.onVis);
    fx.raf = requestAnimationFrame(loop);
  }
  function syncFx() {
    const t = document.documentElement.getAttribute('data-theme');
    if (FXMAP[t]) startFx(t); else stopFx();
  }
  document.addEventListener('DOMContentLoaded', syncFx);
  if (document.body) syncFx();

  const THEMES = [['dark', '📓 Тетрадь · тёмная'], ['light', '📓 Тетрадь · светлая'], ['sakura', '🌸 Сакура'], ['forest', '🌲 Лес'], ['midnight', '🌌 Космос'],
    ['paper', '📜 Старая бумага'], ['glass', '🧊 Аврора'], ['minimal', '⬜ Минимал'], ['terminal', '💻 Терминал'], ['neon', '🌆 Неон']];
  function applyTheme(t) {
    if (!THEMES.some(x => x[0] === t)) t = 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('user-theme', t); } catch (e) {}
    syncFx();
  }
  let savedTheme = 'dark';
  try { const v = localStorage.getItem('user-theme'); if (THEMES.some(x => x[0] === v)) savedTheme = v; } catch (e) {}
  document.documentElement.setAttribute('data-theme', savedTheme);
  window.setTheme = applyTheme;
  /* кнопка 🌓: тёмная ↔ светлая (остальные темы выбираются в профиле) */
  window.toggleTheme = function () {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  };

  /* дополнительные темы: переопределяют переменные из theme.css, HTML менять не нужно */
  const themeCss = document.createElement('style');
  themeCss.textContent = `
  [data-theme="forest"] input[type=date]::-webkit-calendar-picker-indicator,
  [data-theme="midnight"] input[type=date]::-webkit-calendar-picker-indicator,
  [data-theme="terminal"] input[type=date]::-webkit-calendar-picker-indicator,
  [data-theme="glass"] input[type=date]::-webkit-calendar-picker-indicator,
  [data-theme="neon"] input[type=date]::-webkit-calendar-picker-indicator{filter:invert(1)}
  /* цвета тонов на странице китайского */
  [data-theme="forest"],[data-theme="midnight"],[data-theme="terminal"],[data-theme="glass"],[data-theme="neon"]{--t1:#7aa2ff!important;--t2:#4fd1a0!important;--t3:#f0b44c!important;--t4:#ff7b63!important}

  /* ===== стили: меняют форму, шрифты, фон и анимацию, а не только цвета ===== */

  /* 💻 Терминал: моноширинный шрифт, острые углы, зелёный свет, строки развёртки */
  [data-theme="terminal"]{--bg:#050805;--grid:#0c170c;--ink:#a6ffb4;--soft:#4fa86a;--card:#091209;--line:#2fd35a;--shc:transparent;--r:0px;--sh:none;
    --blue:#3dd9ff;--blue-s:#0b3a45;--red:#ff5470;--red-s:#4a1620;--green:#39ff6a;--violet:#c792ff;--ok-bg:rgba(57,255,106,.12);--no-bg:rgba(255,84,112,.14);
    --serif:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--sans:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
  [data-theme="terminal"] *,[data-theme="terminal"] *::before,[data-theme="terminal"] *::after{border-radius:0!important;font-style:normal!important}
  [data-theme="terminal"] body::before{display:none}
  [data-theme="terminal"] body::after{left:0;right:0;width:auto;opacity:.5;background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 1px,transparent 1px 3px)}
  [data-theme="terminal"] .hero::after{display:none}
  [data-theme="terminal"] h1{text-shadow:0 0 10px rgba(57,255,106,.55)}
  [data-theme="terminal"] .hero h1::before{content:"> "}

  /* 🌆 Неон: тёмно-фиолетовый фон, голубые рамки, розовые тени и свечение */
  [data-theme="neon"]{--bg:#12002b;--grid:#2a0a55;--ink:#fdf2ff;--soft:#b79adf;--card:#1d0a3d;--line:#2de2e6;--shc:#ff2bd6;--yel:#ffe94d;
    --blue:#4cc9f0;--blue-s:#3a1f7a;--red:#ff3d81;--red-s:#5a1040;--green:#3dffb0;--violet:#b388ff;--ok-bg:rgba(61,255,176,.14);--no-bg:rgba(255,61,129,.16)}
  [data-theme="neon"] body::before{background:#ff2bd6;box-shadow:0 0 12px #ff2bd6;opacity:.9}
  [data-theme="neon"] body::after{display:none}
  [data-theme="neon"] body{background-image:radial-gradient(560px 420px at 10% 0%,rgba(255,43,214,.28),transparent 65%),radial-gradient(520px 480px at 100% 35%,rgba(45,226,230,.2),transparent 65%);background-size:auto;background-attachment:fixed}
  [data-theme="neon"] #authGate,[data-theme="terminal"] #authGate{background-image:none}
  [data-theme="terminal"] body{background-image:none}
  [data-theme="neon"] h1{text-shadow:0 0 16px rgba(255,43,214,.7)}
  [data-theme="neon"] .hero,[data-theme="neon"] .box{box-shadow:4px 4px 0 var(--shc),0 0 22px rgba(45,226,230,.25)}

  
  /* 🌸 Сакура: нежный розовый, мягкие тени, округлый шрифт, лепестки */
  [data-theme="sakura"]{--bg:#fff0f4;--grid:rgba(240,150,180,.12);--ink:#4a2332;--soft:#9a6b7d;--card:#fffafc;--line:#f0b4c8;--shc:rgba(232,120,160,.28);--yel:#ffc2d4;--r:24px;--sh:0 10px 28px rgba(232,120,160,.22);
    --blue:#6b8cff;--blue-s:#d9e2ff;--red:#ec4f83;--red-s:#ffd0df;--green:#3fb97a;--violet:#b583f5;--ok-bg:rgba(63,185,122,.14);--no-bg:rgba(236,79,131,.12);
    --serif:"Playfair Display",Georgia,"Times New Roman",serif;--sans:ui-rounded,"SF Pro Rounded","Nunito","Segoe UI",system-ui,sans-serif}
  [data-theme="sakura"] body{background-image:linear-gradient(180deg,#fff0f4 0%,#ffe2ec 60%,#ffd6e4 100%);background-size:auto;background-attachment:fixed}
  [data-theme="sakura"] body::before{left:0;right:0;width:auto;opacity:1;background:radial-gradient(520px 380px at 92% 0%,rgba(255,170,200,.5),transparent 70%),radial-gradient(440px 340px at 0% 100%,rgba(255,200,215,.55),transparent 70%)}
  [data-theme="sakura"] body::after,[data-theme="sakura"] .hero::after{display:none}
  [data-theme="sakura"] .hero,[data-theme="sakura"] .box,[data-theme="sakura"] .subject,[data-theme="sakura"] .note-card,[data-theme="sakura"] .pair-card,[data-theme="sakura"] .acc{box-shadow:var(--sh)}
  [data-theme="sakura"] #authGate{background-image:linear-gradient(180deg,#fff0f4,#ffd6e4)}

  /* 🌲 Лес: глубокий зелёный, туман внизу, светлячки */
  [data-theme="forest"]{--bg:#0b1a12;--grid:rgba(120,180,140,.06);--ink:#e8f1e2;--soft:#8fae98;--card:#132a1d;--line:#3d6b52;--shc:rgba(0,0,0,.55);--yel:#f2d36b;--r:18px;--sh:0 8px 24px rgba(0,0,0,.45);
    --blue:#7cc4ff;--blue-s:#1f4a63;--red:#ff8a7a;--red-s:#5a2a24;--green:#6ee7a0;--violet:#c2a6ff;--ok-bg:rgba(110,231,160,.14);--no-bg:rgba(255,138,122,.14);
    --serif:"Merriweather",Georgia,serif}
  [data-theme="forest"] body{background-image:radial-gradient(760px 520px at 50% -10%,rgba(80,160,100,.28),transparent 70%),linear-gradient(180deg,#0b1a12,#07110b);background-size:auto;background-attachment:fixed}
  [data-theme="forest"] body::before{left:0;right:0;top:auto;bottom:0;width:auto;height:38vh;opacity:1;background:linear-gradient(0deg,rgba(70,140,90,.3),transparent)}
  [data-theme="forest"] body::after,[data-theme="forest"] .hero::after{display:none}
  [data-theme="forest"] .hero,[data-theme="forest"] .box,[data-theme="forest"] .subject,[data-theme="forest"] .note-card,[data-theme="forest"] .pair-card,[data-theme="forest"] .acc{box-shadow:var(--sh)}
  [data-theme="forest"] #authGate{background-image:linear-gradient(180deg,#0b1a12,#07110b)}

  /* 🌌 Космос: чёрное небо, мерцающие звёзды, луна, падающие звёзды */
  [data-theme="midnight"]{--bg:#02030a;--grid:rgba(120,130,255,.05);--ink:#e9ecff;--soft:#8a90bd;--card:#0a0d1f;--line:#38407f;--shc:rgba(90,100,255,.3);--yel:#ffd666;--r:14px;--sh:0 0 0 1px rgba(110,120,255,.18),0 10px 30px rgba(0,0,40,.6);
    --blue:#6c8dff;--blue-s:#1c2a66;--red:#ff6b8a;--red-s:#4a1a2c;--green:#4be3a0;--violet:#9b8cff;--ok-bg:rgba(75,227,160,.14);--no-bg:rgba(255,107,138,.14)}
  [data-theme="midnight"] body{background-image:radial-gradient(900px 600px at 85% -10%,rgba(80,90,220,.28),transparent 65%),radial-gradient(700px 500px at 0% 100%,rgba(120,60,200,.18),transparent 65%);background-size:auto;background-attachment:fixed}
  [data-theme="midnight"] body::before{left:auto;right:6%;top:5%;bottom:auto;width:64px;height:64px;border-radius:50%;opacity:.9;background:radial-gradient(circle at 35% 35%,#fff,#cfd6ff 55%,#8f9aff 100%);box-shadow:0 0 60px 12px rgba(150,160,255,.35)}
  [data-theme="midnight"] body::after,[data-theme="midnight"] .hero::after{display:none}
  [data-theme="midnight"] #authGate{background-image:none}

  /* 📜 Старая бумага: газетный шрифт с засечками, двойные рамки, плотная бумага с виньеткой */
  [data-theme="paper"]{--bg:#eee3c8;--grid:rgba(90,65,30,.1);--ink:#2a2016;--soft:#6b5a43;--card:#f8f0da;--line:#3b2d1a;--shc:rgba(59,45,26,.45);--yel:#e9c46a;--r:3px;--sh:3px 3px 0 rgba(59,45,26,.4);
    --blue:#1f4e79;--blue-s:#c3d2e0;--red:#a63a2b;--red-s:#e8c5be;--green:#3d6b3a;--violet:#6b4a8a;--ok-bg:rgba(61,107,58,.14);--no-bg:rgba(166,58,43,.12);
    --serif:Georgia,"Times New Roman",serif;--sans:Georgia,"Times New Roman",serif}
  [data-theme="paper"] body{background-image:repeating-linear-gradient(0deg,rgba(90,65,30,.045) 0 1px,transparent 1px 4px),repeating-linear-gradient(90deg,rgba(90,65,30,.03) 0 1px,transparent 1px 5px),radial-gradient(ellipse at center,transparent 50%,rgba(120,80,30,.22) 100%);background-size:auto;background-attachment:fixed}
  [data-theme="paper"] *:not(.av){border-radius:4px!important}
  [data-theme="paper"] .hero,[data-theme="paper"] .box{border-style:double;border-width:5px}
  [data-theme="paper"] h1{text-transform:uppercase;letter-spacing:.04em;font-style:normal}
  [data-theme="paper"] .hero::after{display:none}
  [data-theme="paper"] #authGate{background-image:none}

  /* 🧊 Аврора: матовое стекло поверх переливающегося северного сияния */
  @keyframes auroraMove{0%{transform:translate3d(-3%,-2%,0) scale(1)}50%{transform:translate3d(4%,3%,0) scale(1.08)}100%{transform:translate3d(-2%,5%,0) scale(1.02)}}
  [data-theme="glass"]{--bg:#0a0f2c;--grid:rgba(255,255,255,.05);--ink:#f4f6ff;--soft:#b3bbe6;--card:rgba(255,255,255,.1);--line:rgba(255,255,255,.28);--shc:transparent;--r:26px;--sh:inset 0 1px 0 rgba(255,255,255,.28),0 14px 40px rgba(0,0,0,.35);
    --blue:#8fb0ff;--blue-s:rgba(143,176,255,.25);--red:#ff7aa0;--red-s:rgba(255,122,160,.25);--green:#5eeab0;--violet:#c2a8ff;--ok-bg:rgba(94,234,176,.16);--no-bg:rgba(255,122,160,.16);
    --sans:ui-rounded,"SF Pro Rounded","Segoe UI",system-ui,sans-serif}
  [data-theme="glass"] body{background-image:none;background-color:#0a0f2c}
  [data-theme="glass"] body::before{left:-20%;right:-20%;top:-20%;bottom:-20%;width:auto;opacity:1;animation:auroraMove 22s ease-in-out infinite alternate;
    background:radial-gradient(560px 420px at 20% 20%,rgba(124,92,255,.65),transparent 65%),radial-gradient(520px 480px at 80% 30%,rgba(45,226,230,.45),transparent 65%),radial-gradient(620px 520px at 50% 85%,rgba(255,60,200,.4),transparent 65%),radial-gradient(420px 380px at 10% 80%,rgba(60,200,120,.3),transparent 65%)}
  [data-theme="glass"] body::after,[data-theme="glass"] .hero::after{display:none}
  [data-theme="glass"] .hero,[data-theme="glass"] .box,[data-theme="glass"] .alert,[data-theme="glass"] .subject,[data-theme="glass"] .note-card,[data-theme="glass"] .pair-card,[data-theme="glass"] .acc,[data-theme="glass"] .w,[data-theme="glass"] .today-pair,[data-theme="glass"] .q-btn,[data-theme="glass"] .tools{-webkit-backdrop-filter:blur(18px) saturate(1.3);backdrop-filter:blur(18px) saturate(1.3);box-shadow:var(--sh)}
  [data-theme="glass"] .deck .face{background:#1b2260;-webkit-backdrop-filter:none;backdrop-filter:none}
  [data-theme="glass"] #authGate{background-image:radial-gradient(560px 420px at 20% 20%,rgba(124,92,255,.6),transparent 65%),radial-gradient(520px 480px at 80% 30%,rgba(45,226,230,.4),transparent 65%)}

  /* ⬜ Минимал (швейцарский): чёрное на белом, один оранжевый акцент, острые углы, плотный гротеск */
  [data-theme="minimal"]{--bg:#ffffff;--grid:#ededed;--ink:#000;--soft:#5c5c5c;--card:#ffffff;--line:#000;--shc:transparent;--yel:#ff5a1f;--r:0px;--sh:none;
    --blue:#0050ff;--blue-s:#d6e2ff;--red:#ff2d2d;--red-s:#ffd6d6;--green:#00a651;--violet:#6a3dff;--ok-bg:rgba(0,166,81,.1);--no-bg:rgba(255,45,45,.08);
    --serif:"Helvetica Neue",Helvetica,Arial,sans-serif;--sans:"Helvetica Neue",Helvetica,Arial,sans-serif}
  [data-theme="minimal"] *:not(.av){border-radius:0!important}
  [data-theme="minimal"] *{font-style:normal!important}
  [data-theme="minimal"] body{background-image:none}
  [data-theme="minimal"] body::before,[data-theme="minimal"] body::after,[data-theme="minimal"] .hero::after{display:none}
  [data-theme="minimal"] h1{text-transform:uppercase;letter-spacing:-.03em;font-weight:900}
  [data-theme="minimal"] .badge{transform:none}
  [data-theme="minimal"] #authGate{background-image:none}
  `;
  document.head.appendChild(themeCss);

  const sb = supabase.createClient(SB_URL, SB_KEY);
  window.sb = sb;
  window.isAdmin = false;
  window.isVerified = false;
  window.isGuest = true;        /* true, пока не вошёл или не подтверждён */
  window.authUser = null;       /* любой вошедший (даже неподтверждённый) */
  window.currentUser = null;    /* только подтверждённый/админ — по нему страницы решают, сохранять ли в облако */

  let resolveReady;
  const ready = new Promise(r => (resolveReady = r));
  window.authReady = ready;

  /* ---------- перехват запросов к npoint -> Supabase ---------- */
  const origFetch = window.fetch.bind(window);
  const J = d => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const isGet = o => !o || !o.method || o.method.toUpperCase() === 'GET';
  let hwCache = {}, ntCache = [];

  window.fetch = async function (url, opts) {
    const u = String(url);
    if (u.includes(HW_ID) || u.includes(NT_ID)) {
      await ready;
      /* неподтверждённые не пишут ДЗ и не видят/не пишут конспекты */
      if (window.isGuest) {
        if (u.includes(NT_ID)) return J([]);
        if (u.includes(HW_ID) && !isGet(opts)) {
          return new Response(JSON.stringify({ error: 'guest' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
      }
      try { return u.includes(HW_ID) ? await hw(opts) : await nt(opts); }
      catch (e) { console.error(e); return new Response('{}', { status: 500 }); }
    }
    return origFetch(url, opts);
  };

  async function hw(o) {
    if (isGet(o)) {
      const { data, error } = await sb.from('homework').select('key,text');
      if (error) throw error;
      hwCache = {}; data.forEach(r => (hwCache[r.key] = r.text));
      return J(hwCache);
    }
    if (window.isGuest || !window.isAdmin) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    const nw = JSON.parse(o.body);
    const up = Object.keys(nw).filter(k => nw[k] !== hwCache[k]).map(k => ({ key: k, text: nw[k] }));
    const del = Object.keys(hwCache).filter(k => !(k in nw));
    if (up.length) { const { error } = await sb.from('homework').upsert(up); if (error) throw error; }
    if (del.length) { const { error } = await sb.from('homework').delete().in('key', del); if (error) throw error; }
    hwCache = nw;
    return J({});
  }

  async function nt(o) {
    if (window.isGuest) return J([]);
    if (isGet(o)) {
      const { data, error } = await sb.from('notes').select('*').order('id', { ascending: false });
      if (error) throw error;
      ntCache = data.map(r => ({
        id: r.id, subject: r.subject, title: r.title, lectureNum: r.lecture_num,
        lectureDate: r.lecture_date, content: r.content, link: r.link,
        addedDate: new Date(r.added_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
      }));
      return J(ntCache);
    }
    if (!window.isAdmin) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    const nw = JSON.parse(o.body);
    const old = new Set(ntCache.map(n => n.id)), cur = new Set(nw.map(n => n.id));
    const add = nw.filter(n => !old.has(n.id)).map(n => ({
      id: n.id, subject: n.subject, title: n.title, lecture_num: n.lectureNum,
      lecture_date: n.lectureDate || null, content: n.content, link: n.link
    }));
    const del = [...old].filter(i => !cur.has(i));
    if (add.length) { const { error } = await sb.from('notes').insert(add); if (error) throw error; }
    if (del.length) { const { error } = await sb.from('notes').delete().in('id', del); if (error) throw error; }
    ntCache = nw;
    return J({});
  }

  /* ---------- данные ученика (прогресс карточек и т.д.) ----------
     'profile' (ник/аватар) доступен любому вошедшему, остальное — только подтверждённым. */
  window.userData = {
    async get(key) {
      if (!window.authUser) return null;
      if (key !== 'profile' && !window.isVerified) return null;
      const { data } = await sb.from('user_data').select('value').eq('key', key).eq('user_id', window.authUser.id).maybeSingle();
      return data ? data.value : null;
    },
    async set(key, value) {
      if (!window.authUser) return;
      if (key !== 'profile' && !window.isVerified) return;
      await sb.from('user_data').upsert({ user_id: window.authUser.id, key, value });
    }
  };

  /* ---------- интерфейс входа и верхняя панель (используют переменные из theme.css) ---------- */
  const css = document.createElement('style');
  css.textContent = `
  #authGate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;color:var(--ink,#1b1f3b);font:15px var(--sans,system-ui,sans-serif);
    background-color:var(--bg,#14162a);background-image:linear-gradient(var(--grid,#1f2345) 1px,transparent 1px),linear-gradient(90deg,var(--grid,#1f2345) 1px,transparent 1px);background-size:24px 24px}
  #authGate form{position:relative;width:min(360px,100%);display:grid;gap:12px;padding:26px 22px;background:var(--card,#1e2240);border:2px solid var(--line,#e9e6d8);border-radius:16px;box-shadow:5px 5px 0 var(--shc,#000)}
  #authGate h2{margin:0 0 4px;font:italic 800 26px var(--serif,Georgia,serif)}
  #authGate input{padding:12px 14px;border:2px solid var(--line,#e9e6d8);border-radius:12px;background:var(--bg,#14162a);color:var(--ink,#fff);font:600 15px var(--sans,system-ui,sans-serif);outline:none}
  #authGate input:focus{box-shadow:3px 3px 0 var(--yel,#ffd84d)}
  #authGate button{padding:12px;border:2px solid var(--line,#e9e6d8);border-radius:12px;background:var(--yel,#ffd84d);color:#1b1f3b;font:800 15px var(--sans,system-ui,sans-serif);box-shadow:3px 3px 0 var(--shc,#000);cursor:pointer}
  #authGate button:active{transform:translate(3px,3px);box-shadow:none}
  #authGate button:disabled{opacity:.6}
  #authGate .atabs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  #authGate .atabs button{padding:9px;background:var(--card,#1e2240);color:var(--ink,#fff);box-shadow:2px 2px 0 var(--shc,#000);font-size:14px}
  #authGate .atabs button.on{background:var(--yel,#ffd84d);color:#1b1f3b}
  #authGate .ahint{margin:0;color:var(--soft,#9ca0bd);font-size:12.5px;line-height:1.45}
  #authErr{min-height:16px;color:var(--red,#ff5a70);font-size:13px;font-weight:700}
  #authErr.ok{color:var(--green,#34d27b)}
  #authBar{position:fixed;top:8px;right:10px;z-index:9999;display:flex;gap:6px;align-items:center;font:700 12px var(--sans,system-ui,sans-serif)}
  #authBar span,#authBar button{padding:5px 10px;border:2px solid var(--line,#e9e6d8);border-radius:99px;background:var(--card,#1e2240);color:var(--ink,#fff);font:inherit;box-shadow:2px 2px 0 var(--shc,#000)}
  #authBar button{cursor:pointer}
  #authBar button:active{transform:translate(2px,2px);box-shadow:none}
  /* скрытие для неподтверждённых */
  html.is-guest .guest-hide,
  html.is-guest .add-box,
  html.is-guest .delete-btn,
  html.is-guest .admin-box,
  html.is-guest .admin-toggle-box,
  html.is-guest .btn-toggle{display:none!important}
  `;
  document.head.appendChild(css);

  function setGuestMode(on) {
    window.isGuest = !!on;
    document.documentElement.classList.toggle('is-guest', !!on);
  }

  function mountBar(inner, onOut) {
    const old = document.getElementById('authBar');
    if (old) old.remove();
    const bar = document.createElement('div');
    bar.id = 'authBar';
    bar.innerHTML = inner + '<button id="bTheme" type="button" aria-label="Сменить тему" title="Тема">🌓</button><button id="bOut" type="button">Выйти</button>';
    document.body.appendChild(bar);
    bar.querySelector('#bTheme').onclick = window.toggleTheme;
    bar.querySelector('#bOut').onclick = onOut;
    return bar;
  }


  /* ---------- профиль: никнейм и аватарка (хранятся в user_data под ключом 'profile') ---------- */
  const escH = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const AV_EMOJI = ['🦊','🐼','🐨','🦁','🐯','🐸','🐵','🦄','🐙','🦉','🐧','🐱','🐶','🐰','🦋','🐢','🌵','🍀','🌸','🍉','🚀','🎧','🎮','📚'];
  const AV_COLORS = ['#ffd84d','#7aa2ff','#ff7b8a','#4fd1a0','#a290ff','#f0b44c','#5ad0e6','#f7a8d8'];

  function avatarHtml(pr, size, letter) {
    pr = pr || {};
    const s = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.55)}px`;
    if (typeof pr.photo === 'string' && pr.photo.indexOf('data:image/') === 0) {
      return `<i class="av" style="${s};background-image:url(${pr.photo})"></i>`;
    }
    const col = /^#[0-9a-f]{6}$/i.test(pr.color || '') ? pr.color : AV_COLORS[0];
    const em = AV_EMOJI.indexOf(pr.emoji) >= 0 ? pr.emoji : escH(letter || '?');
    return `<i class="av" style="${s};background-color:${col}">${em}</i>`;
  }

  window.avatarHtml = avatarHtml;

  function statusSuffix() {
    return '';
  }

  function paintBar() {
    const el = document.getElementById('bProfile');
    if (!el) return;
    const pr = window.userProfile || {};
    const name = pr.nick || window.userLogin || '';
    el.innerHTML = avatarHtml(pr, 20, name.charAt(0).toUpperCase()) + '<b class="nm"></b>';
    el.querySelector('.nm').textContent = name + statusSuffix();
  }

  function openProfileEditor(login, done) {
    const cur = window.userProfile || {};
    const st = { nick: cur.nick || '', emoji: cur.emoji || '', color: cur.color || AV_COLORS[0], photo: cur.photo || '' };
    const back = document.createElement('div');
    back.id = 'pfBack';
    back.innerHTML = `<div id="pfBox">
      <div class="top"><h3>✏️ Профиль</h3><button class="x" type="button" aria-label="Закрыть">✕</button></div>
      <div class="pv"></div>
      <label for="pfNick">Никнейм</label>
      <input id="pfNick" maxlength="20" autocomplete="off" placeholder="Логин для входа: ${escH(login)}">
      <label>Аватарка</label>
      <div class="em">${AV_EMOJI.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>
      <div class="cl">${AV_COLORS.map(c => `<button type="button" data-c="${c}" style="background:${c}" aria-label="Цвет"></button>`).join('')}</div>
      <div class="ph"><button type="button" id="pfPhoto">📷 Своё фото</button><button type="button" id="pfDel">Убрать фото</button></div>
      <label>Тема сайта (на этом устройстве)</label>
      <div class="th">${THEMES.map(([k, t]) => `<button type="button" data-t="${k}">${t}</button>`).join('')}</div>
      <input type="file" id="pfFile" accept="image/*" hidden>
      <div id="pfErr"></div>
      <button type="button" class="go" id="pfSave">Сохранить</button>
      <button type="button" class="go ghost" id="pfClear">Сбросить на логин</button>
    </div>`;
    document.body.appendChild(back);
    const $ = s => back.querySelector(s);
    const close = () => back.remove();
    back.addEventListener('click', e => { if (e.target === back) close(); });
    $('.x').onclick = close;
    $('#pfNick').value = st.nick;

    const sync = () => {
      $('.pv').innerHTML = avatarHtml(st, 88, (st.nick || login).charAt(0).toUpperCase());
      back.querySelectorAll('.em button').forEach(b => b.classList.toggle('on', !st.photo && b.dataset.e === st.emoji));
      back.querySelectorAll('.cl button').forEach(b => b.classList.toggle('on', b.dataset.c === st.color));
      $('#pfDel').style.display = st.photo ? '' : 'none';
    };
    const syncTh = () => back.querySelectorAll('.th button').forEach(b => b.classList.toggle('on', b.dataset.t === document.documentElement.getAttribute('data-theme')));
    back.querySelectorAll('.th button').forEach(b => b.onclick = () => { applyTheme(b.dataset.t); syncTh(); });
    syncTh();
    back.querySelectorAll('.em button').forEach(b => b.onclick = () => { st.emoji = b.dataset.e; st.photo = ''; sync(); });
    back.querySelectorAll('.cl button').forEach(b => b.onclick = () => { st.color = b.dataset.c; sync(); });
    $('#pfDel').onclick = () => { st.photo = ''; sync(); };
    $('#pfNick').oninput = e => { st.nick = e.target.value; sync(); };
    $('#pfPhoto').onclick = () => $('#pfFile').click();
    $('#pfFile').onchange = e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const m = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 128, 128);
        st.photo = c.toDataURL('image/jpeg', 0.82);
        URL.revokeObjectURL(url);
        $('#pfErr').textContent = '';
        sync();
      };
      img.onerror = () => { URL.revokeObjectURL(url); $('#pfErr').textContent = 'Не удалось открыть это изображение'; };
      img.src = url;
      e.target.value = '';
    };

    const save = async value => {
      const btn = $('#pfSave');
      btn.disabled = true;
      const { error } = await sb.from('user_data').upsert({ user_id: window.authUser.id, key: 'profile', value });
      btn.disabled = false;
      if (error) { console.error(error); $('#pfErr').textContent = 'Не удалось сохранить, попробуйте ещё раз'; return; }
      window.userProfile = value;
      paintBar();
      close();
      if (done) done();
    };
    $('#pfSave').onclick = () => save({
      nick: st.nick.replace(/\s+/g, ' ').trim().slice(0, 20),
      emoji: st.emoji, color: st.color, photo: st.photo
    });
    $('#pfClear').onclick = () => save({});
    sync();
    setTimeout(() => $('#pfNick').focus(), 50);
  }

  /* ---------- вход / регистрация ---------- */
  function showGate() {
    if (document.getElementById('authGate')) return;
    const g = document.createElement('div');
    g.id = 'authGate';
    g.innerHTML = `<form novalidate><h2>🎓 ФЛ1 • ПОДб-11</h2>
      <div class="atabs"><button type="button" data-m="in" class="on">Вход</button><button type="button" data-m="up">Регистрация</button></div>
      <input id="aName" class="up" placeholder="Фамилия и имя" autocomplete="name" hidden>
      <input id="aLogin" placeholder="Логин" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false">
      <input id="aPass" type="password" placeholder="Пароль" autocomplete="current-password">
      <input id="aPass2" class="up" type="password" placeholder="Повторите пароль" autocomplete="new-password" hidden>
      <p class="ahint up" hidden>Логин: 3–20 символов, латиница, цифры, . _ -<br>После регистрации админ должен подтвердить аккаунт — до этого сайт работает в ограниченном режиме.</p>
      <div id="authErr"></div><button type="submit" id="aSubmit">Войти</button>
      </form>`;
    document.body.appendChild(g);
    const $ = s => g.querySelector(s);
    let mode = 'in';
    const err = (t, ok) => { const e = $('#authErr'); e.textContent = t || ''; e.className = ok ? 'ok' : ''; };
    g.querySelectorAll('.atabs button').forEach(b => b.onclick = () => {
      mode = b.dataset.m;
      g.querySelectorAll('.atabs button').forEach(x => x.classList.toggle('on', x === b));
      g.querySelectorAll('.up').forEach(el => (el.hidden = mode !== 'up'));
      $('#aPass').autocomplete = mode === 'up' ? 'new-password' : 'current-password';
      $('#aSubmit').textContent = mode === 'up' ? 'Зарегистрироваться' : 'Войти';
      err('');
    });
    g.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      err('');
      const login = $('#aLogin').value.trim().toLowerCase();
      const pass = $('#aPass').value;
      const btn = $('#aSubmit');
      if (mode === 'in') {
        if (!login || !pass) return err('Введите логин и пароль');
        btn.disabled = true;
        const { error } = await sb.auth.signInWithPassword({ email: login + DOMAIN, password: pass });
        btn.disabled = false;
        if (error) return err('Неверный логин или пароль');
      } else {
        const name = $('#aName').value.replace(/\s+/g, ' ').trim();
        if (name.length < 3) return err('Введите фамилию и имя');
        if (!/^[a-z0-9._-]{3,20}$/.test(login)) return err('Логин: 3–20 символов, латиница, цифры, . _ -');
        if (pass.length < 6) return err('Пароль — минимум 6 символов');
        if (pass !== $('#aPass2').value) return err('Пароли не совпадают');
        btn.disabled = true;
        const { data, error } = await sb.auth.signUp({
          email: login + DOMAIN, password: pass, options: { data: { full_name: name } }
        });
        if (error) {
          btn.disabled = false;
          return err(/already|registered|exists/i.test(error.message) ? 'Этот логин уже занят' : 'Не удалось зарегистрироваться: ' + error.message);
        }
        if (!data.session) {
          btn.disabled = false;
          return err('Аккаунт создан, но вход не выполнен. Выключите «Confirm email» в Supabase.');
        }
        /* пароль для админ-панели (таблица читается только админами) */
        let { error: pe } = await sb.from('student_passwords').insert({ login, password: pass });
        if (pe) ({ error: pe } = await sb.from('student_passwords').update({ password: pass }).eq('login', login));
        if (pe) { console.error('student_passwords:', pe); alert('Аккаунт создан, но пароль не записался в админ-список: ' + pe.message); }
        btn.disabled = false;
      }
      g.remove();
      init();
    };
  }

  async function init() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return showGate();
    window.authUser = session.user;

    let { data: p } = await sb.from('profiles').select('login,full_name,role,verified').eq('id', session.user.id).maybeSingle();
    if (!p) { /* профиль создаётся триггером — на всякий случай одна повторная попытка */
      await new Promise(r => setTimeout(r, 700));
      ({ data: p } = await sb.from('profiles').select('login,full_name,role,verified').eq('id', session.user.id).maybeSingle());
    }
    window.isAdmin = !!p && p.role === 'admin';
    window.isVerified = window.isAdmin || (!!p && p.verified === true);
    window.currentUser = window.isVerified ? session.user : null;
    setGuestMode(!window.isVerified);
    window.userLogin = p ? p.login : (session.user.email || '').split('@')[0];

    if (!window.isAdmin) {
      const s = document.createElement('style');
      s.textContent = '.add-box,.delete-btn,.admin-box,.admin-toggle-box,.btn-toggle{display:none!important}';
      document.head.appendChild(s);
    }

    /* неподтверждённые не видят Базу, Конспекты и Журнал */
    if (window.isGuest) {
      const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      if (page === 'base.html' || page === 'notes.html' || page === 'journal.html' || page === 'admin.html') {
        location.replace('index.html');
        return;
      }
    }

    try { window.userProfile = (await window.userData.get('profile')) || {}; } catch (e) { window.userProfile = {}; }

    /* пересобрать нижнюю навигацию под текущий статус */
    const oldNav = document.getElementById('siteNav');
    if (oldNav) oldNav.remove();
    buildNav();

    const bar = mountBar(
      `<span id="bProfile" role="button" tabindex="0" title="Мой профиль и прогресс" style="cursor:pointer"></span>`,
      async () => {
        await sb.auth.signOut();
        location.reload();
      });
    paintBar();
    if (window.isAdmin) {
      const ab = document.createElement('button');
      ab.type = 'button'; ab.textContent = '🛠'; ab.title = 'Админка: аккаунты учеников'; ab.setAttribute('aria-label', 'Админка');
      ab.onclick = () => { location.href = 'admin.html'; };
      bar.insertBefore(ab, bar.querySelector('#bTheme'));
    }
    bar.querySelector('#bProfile').onclick = () => openProgress(window.userLogin);
    resolveReady();
    document.dispatchEvent(new Event('auth-ready'));
    if (window.isGuest) document.dispatchEvent(new Event('guest-ready'));
  }

  /* ---------- слова для карточек (копия WD из phonetics.html — при правке менять в обоих местах) ---------- */
  const PH_WORDS = {
    'iː': ['Edith','evening','easy','Jean','cheese','see','tea','pea','tree','eating','Peter','meat','please'],
    'ɪ': ['it’s','isn’t','ill','Indian','interesting','Tim','film','minutes','beginning','Mrs. Smith'],
    'e': ['pen','Ben','ten','set','bell','checks','any','everybody','everything','Eddie','Ellen','spend','friend','left','shelf','ten pence','Jenny','jealous','America','expensive','cigarettes','help yourself'],
    'æ': ['apple','perhaps','passenger','hijacker','black','Miss Bradley','Anne','Amsterdam','Alice','Miss Allen','slacks','camera','lavatory','travelling','handbag','left hand']
  };

  /* ---------- китайские слова для окна прогресса (копия списков из china.html — при правке менять в обоих местах; id = иероглифы) ---------- */
  const CH_WORDS = {"Основные": ["是", "哪", "国", "人", "从", "哪儿 / 哪里", "来"], "Страны": ["俄罗斯", "中国", "白俄罗斯", "美国", "英国", "法国", "加拿大", "韩国", "日本", "新加坡", "马来西亚", "澳大利亚"], "Еда": ["包子", "饺子", "面条", "馒头", "米饭"], "Напитки и фрукты": ["水", "茶", "牛奶", "咖啡", "可乐", "果汁", "汽水", "草莓", "西瓜", "苹果", "葡萄", "橙子", "香蕉", "橘子"], "Места": ["邮局", "学校", "银行", "博物馆", "公交车站", "公园", "商店", "电影院", "图书馆", "大学", "餐厅", "饭馆", "酒店", "药店", "医院"], "Глаголы": ["去", "在"]};

  /* ---------- слова устного английского: списки лежат в words-data.js (EN_WORDS) и words-vb.js (EN_VB, Vocabulary Builder) ---------- */
  function loadScriptOnce(src, prop) {
    return new Promise(res => {
      if (window[prop]) return res(window[prop]);
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => res(window[prop] || []);
      s.onerror = () => res([]);
      document.head.appendChild(s);
    });
  }
  async function loadEnWords() {
    const a = await loadScriptOnce('words-data.js?v=6', 'EN_WORDS');
    const b = await loadScriptOnce('words-vb.js?v=2', 'EN_VB');
    return a.concat(b);
  }
  /* латынь: лексические минимумы лежат в words-latin.js (LAT_WORDS); ключ слова в сохранении — лемма (w[0]) */
  async function loadLatWords() {
    return loadScriptOnce('words-latin.js?v=1', 'LAT_WORDS');
  }
  /* ключ слова в сохранении — само слово: выученное в одной категории считается выученным во всех */
  const enKey = (g, w) => w[0];

  /* ---------- стили окна прогресса и отступ под нижнюю панель ---------- */
  const css2 = document.createElement('style');
  css2.textContent = `
  body{padding-bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}
  #prgBack{position:fixed;inset:0;z-index:100000;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55);font-family:var(--sans,system-ui,sans-serif)}
  #prgBox{width:min(560px,100%);max-height:88vh;overflow:auto;padding:20px 18px calc(22px + env(safe-area-inset-bottom,0px));background:var(--bg,#14162a);color:var(--ink,#f1efe6);border:2px solid var(--line,#e9e6d8);border-radius:20px 20px 0 0;box-shadow:0 -5px 0 var(--yel,#ffd84d)}
  @media(min-width:600px){#prgBack{align-items:center}#prgBox{border-radius:20px;box-shadow:6px 6px 0 var(--shc,#000)}}
  #prgBox h3{margin:0;font:italic 800 22px var(--serif,Georgia,serif)}
  #prgBox h4{margin:24px 0 0;font:italic 800 18px var(--serif,Georgia,serif)}
  #prgBox .top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
  #prgBox .x{width:34px;height:34px;border:2px solid var(--line,#e9e6d8);border-radius:50%;background:var(--card,#1e2240);color:var(--ink,#fff);font-size:15px;cursor:pointer}
  #prgBox .sub{margin:4px 0 12px;color:var(--soft,#9ca0bd);font-size:13px;font-weight:600}
  #prgBox .bar{height:14px;margin:0;border:2px solid var(--line,#e9e6d8);border-radius:99px;background:var(--card,#1e2240);overflow:hidden}
  #prgBox .bar i{display:block;height:100%;background:repeating-linear-gradient(45deg,var(--blue,#7aa2ff) 0 8px,var(--violet,#a290ff) 8px 16px)}
  #prgBox .sel{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0}
  #prgBox .sel button{padding:7px 12px;border:2px solid var(--line,#e9e6d8);border-radius:99px;background:var(--card,#1e2240);color:var(--ink,#fff);font:700 13px var(--sans,system-ui,sans-serif);box-shadow:2px 2px 0 var(--shc,#000);cursor:pointer}
  #prgBox .sel button.on{background:var(--yel,#ffd84d);color:#1b1f3b}
  #prgBox h4:first-of-type{margin-top:18px}
  #prgBox .grp{margin-top:18px}
  #prgBox .gh{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;font-weight:800;font-size:14px}
  #prgBox .gh small{color:var(--soft,#9ca0bd);font-weight:700;white-space:nowrap}
  #prgBox .ch{display:flex;flex-wrap:wrap;gap:6px}
  #prgBox .ch span{padding:4px 10px;border:2px dashed var(--soft,#9ca0bd);border-radius:99px;color:var(--soft,#9ca0bd);font-size:13px}
  #prgBox .ch span.ok{border:2px solid var(--green,#34d27b);background:var(--ok-bg,rgba(52,210,123,.14));color:var(--green,#34d27b);font-weight:700}
  #prgBox .go{display:block;margin-top:14px;padding:12px;border:2px solid var(--line,#e9e6d8);border-radius:12px;background:var(--yel,#ffd84d);color:#1b1f3b;text-align:center;font-weight:800;text-decoration:none;box-shadow:3px 3px 0 var(--shc,#000)}
  #prgBox .pend{margin:12px 0 0;padding:10px 12px;border:2px dashed var(--red,#ff5a70);border-radius:12px;background:var(--no-bg,rgba(255,90,112,.14));font-size:13px;line-height:1.5}`;
  document.head.appendChild(css2);

  const css3 = document.createElement('style');
  css3.textContent = `
  .av{display:inline-grid;place-items:center;flex:none;border:2px solid var(--line,#e9e6d8);border-radius:50%;background-size:cover;background-position:center;color:#1b1f3b;font-style:normal;font-weight:800;line-height:1;vertical-align:middle;overflow:hidden}
  #authBar{max-width:calc(100vw - 20px)}
  #authBar .nm{display:inline-block;max-width:150px;margin-left:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;font-weight:700}
  #authBar #bProfile{display:inline-flex;align-items:center}
  #prgBox .pcard{display:flex;align-items:center;gap:12px;margin:0 0 12px;padding:10px 12px;border:2px dashed var(--line,#e9e6d8);border-radius:14px;background:var(--card,#1e2240)}
  #prgBox .pn{flex:1;min-width:0;display:flex;flex-direction:column}
  #prgBox .pn b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px}
  #prgBox .pn small{color:var(--soft,#9ca0bd);font-size:12px}
  #prgBox .pedit{padding:7px 12px;border:2px solid var(--line,#e9e6d8);border-radius:99px;background:var(--yel,#ffd84d);color:#1b1f3b;font:800 13px var(--sans,system-ui,sans-serif);box-shadow:2px 2px 0 var(--shc,#000);cursor:pointer}
  #pfBack{position:fixed;inset:0;z-index:100001;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.6);font-family:var(--sans,system-ui,sans-serif)}
  #pfBox{width:min(460px,100%);max-height:92vh;overflow:auto;padding:20px 18px calc(22px + env(safe-area-inset-bottom,0px));background:var(--bg,#14162a);color:var(--ink,#f1efe6);border:2px solid var(--line,#e9e6d8);border-radius:20px 20px 0 0;box-shadow:0 -4px 0 var(--shc,#000)}
  @media(min-width:600px){#pfBack{align-items:center}#pfBox{border-radius:20px;box-shadow:6px 6px 0 var(--shc,#000)}}
  #pfBox .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
  #pfBox h3{font:italic 800 21px var(--serif,Georgia,serif)}
  #pfBox .x{width:34px;height:34px;border:2px solid var(--line,#e9e6d8);border-radius:50%;background:var(--card,#1e2240);color:var(--ink,#fff);font-size:15px;cursor:pointer}
  #pfBox .pv{display:flex;justify-content:center;margin:6px 0 14px}
  #pfBox label{display:block;margin:12px 0 6px;color:var(--soft,#9ca0bd);font:800 11px var(--sans,system-ui,sans-serif);letter-spacing:.07em;text-transform:uppercase}
  #pfBox #pfNick{width:100%;padding:11px 13px;border:2px solid var(--line,#e9e6d8);border-radius:12px;background:var(--card,#1e2240);color:var(--ink,#fff);font:600 16px var(--sans,system-ui,sans-serif);outline:none}
  #pfBox #pfNick:focus{box-shadow:3px 3px 0 var(--yel,#ffd84d)}
  #pfBox .em,#pfBox .cl,#pfBox .ph{display:flex;flex-wrap:wrap;gap:8px}
  #pfBox .cl{margin-top:10px}#pfBox .ph{margin-top:12px}
  #pfBox .em button{width:44px;height:44px;border:2px solid var(--line,#e9e6d8);border-radius:12px;background:var(--card,#1e2240);font-size:22px;cursor:pointer}
  #pfBox .cl button{width:34px;height:34px;border:2px solid var(--line,#e9e6d8);border-radius:50%;cursor:pointer}
  #pfBox .em button.on,#pfBox .cl button.on{outline:3px solid var(--violet,#a290ff);outline-offset:2px}
  #pfBox .ph button{padding:9px 14px;border:2px solid var(--line,#e9e6d8);border-radius:99px;background:var(--card,#1e2240);color:var(--ink,#fff);font:700 13px var(--sans,system-ui,sans-serif);cursor:pointer}
  #pfBox .th{display:flex;flex-wrap:wrap;gap:8px}
  #pfBox .th button{padding:8px 13px;border:2px solid var(--line,#e9e6d8);border-radius:99px;background:var(--card,#1e2240);color:var(--ink,#fff);font:700 13px var(--sans,system-ui,sans-serif);cursor:pointer}
  #pfBox .th button.on{background:var(--yel,#ffd84d);color:#1b1f3b}
  #pfErr{min-height:18px;margin-top:8px;color:var(--red,#ff5a70);font-size:13px;font-weight:700}
  #pfBox .go{display:block;width:100%;margin-top:8px;padding:12px;border:2px solid var(--line,#e9e6d8);border-radius:12px;background:var(--yel,#ffd84d);color:#1b1f3b;text-align:center;font:800 15px var(--sans,system-ui,sans-serif);box-shadow:3px 3px 0 var(--shc,#000);cursor:pointer}
  #pfBox .go.ghost{background:var(--card,#1e2240);color:var(--ink,#fff)}
  #pfBox .go:disabled{opacity:.5}
  `;
  document.head.appendChild(css3);


  /* ---------- нижняя навигация (в Shadow DOM: стили страниц на неё не влияют) ---------- */
  const PAGES_ALL = [
    ['index.html', '🏠', 'Главная'],
    ['hw.html', '📚', 'ДЗ'],
    ['journal.html', '📓', 'Журнал'],
    ['notes.html', '📖', 'Конспекты'],
    ['base.html', '🗂️', 'База'],
    ['phonetics.html', '🔤', 'Фонетика'],
    ['words.html', '🇬🇧', 'Слова'],
    ['latin.html', '🏛️', 'Латынь'],
    ['china.html', '🀄', 'Китайский']
  ];
  /* неподтверждённые не видят Конспекты, Базу и Журнал */
  const PAGES_GUEST = PAGES_ALL.filter(([h]) => h !== 'notes.html' && h !== 'base.html' && h !== 'journal.html');

  const NAV_CSS = `
  :host{all:initial}
  .wrap{display:flex;justify-content:center;padding:8px 8px calc(8px + env(safe-area-inset-bottom,0px));background:var(--bg,#14162a);border-top:2px solid var(--line,#e9e6d8);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;box-sizing:border-box}
  .in{display:flex;align-items:flex-start;gap:4px;width:min(720px,100%)}
  a{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 2px;border:2px solid transparent;border-radius:12px;color:var(--soft,#9ca0bd);text-decoration:none;font-size:10px;font-weight:700;line-height:1.1;text-align:center;-webkit-tap-highlight-color:transparent;transition:transform .15s}
  a b{font-size:20px;line-height:1;font-weight:400}
  a span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  a.on{background:var(--yel,#ffd84d);color:#1b1f3b;border-color:var(--line,#e9e6d8);box-shadow:2px 2px 0 var(--shc,#000);transform:translateY(-3px)}
  a:focus-visible{outline:3px solid var(--violet,#a290ff);outline-offset:1px}
  @media (prefers-reduced-motion:reduce){a{transition:none}}`;

  function buildNav() {
    if (document.getElementById('siteNav')) return;
    let cur = location.pathname.split('/').pop();
    if (!cur) cur = 'index.html';
    const pages = window.isGuest ? PAGES_GUEST : PAGES_ALL;
    const host = document.createElement('div');
    host.id = 'siteNav';
    const hs = [['position', 'fixed'], ['left', '0'], ['right', '0'], ['bottom', '0'], ['top', 'auto'],
      ['height', 'auto'], ['width', 'auto'], ['margin', '0'], ['padding', '0'], ['transform', 'none'],
      ['display', 'block'], ['z-index', '9998']];
    hs.forEach(([k, v]) => host.style.setProperty(k, v, 'important'));
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + NAV_CSS + '</style><div class="wrap"><div class="in">' +
      pages.map(([h, i, t]) =>
        `<a href="${h}"${h === cur ? ' class="on" aria-current="page"' : ''}><b>${i}</b><span>${t}</span></a>`).join('') +
      '</div></div>';
    const wrap = root.querySelector('.wrap');
    const syncTheme = () => wrap.classList.toggle('light', document.documentElement.getAttribute('data-theme') === 'light');
    syncTheme();
    new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.body.appendChild(host);
  }

  /* ---------- окно прогресса по словам ---------- */
  async function openProgress(login) {
    if (document.getElementById('prgBack')) return;
    const back = document.createElement('div');
    back.id = 'prgBack';
    back.innerHTML = '<div id="prgBox"><div class="sub">Загрузка…</div></div>';
    document.body.appendChild(back);
    const close = () => back.remove();
    back.addEventListener('click', e => { if (e.target === back) close(); });

    let learned = new Set(), enLearned = new Set(), chLearned = new Set(), laLearned = new Set();
    try {
      const saved = await window.userData.get('phonetics_learned_words');
      if (Array.isArray(saved)) learned = new Set(saved);
    } catch (e) { console.error(e); }
    try {
      const saved = await window.userData.get('english_learned_words');
      if (Array.isArray(saved)) enLearned = new Set(saved);
    } catch (e) { console.error(e); }
    try {
      const saved = await window.userData.get('chinese_learned_words');
      if (Array.isArray(saved)) chLearned = new Set(saved);
    } catch (e) { console.error(e); }
    try {
      const saved = await window.userData.get('latin_learned_words');
      if (Array.isArray(saved)) laLearned = new Set(saved);
    } catch (e) { console.error(e); }
    /* если облако пустое — подтянуть localStorage (в т.ч. для неподтверждённых) */
    try {
      if (!learned.size) {
        const a = JSON.parse(localStorage.getItem('phonetics_learned_words') || '[]');
        if (Array.isArray(a)) learned = new Set(a);
      }
      if (!enLearned.size) {
        const a = JSON.parse(localStorage.getItem('english_learned_words') || '[]');
        if (Array.isArray(a)) enLearned = new Set(a);
      }
      if (!chLearned.size) {
        const a = JSON.parse(localStorage.getItem('chinese_learned_words') || '[]');
        if (Array.isArray(a)) chLearned = new Set(a);
      }
      if (!laLearned.size) {
        const a = JSON.parse(localStorage.getItem('latin_learned_words') || '[]');
        if (Array.isArray(a)) laLearned = new Set(a);
      }
    } catch (e) {}
    const EN = await loadEnWords();
    const LA = await loadLatWords();

    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    /* фонетика */
    const keys = Object.keys(PH_WORDS);
    const total = keys.reduce((n, k) => n + PH_WORDS[k].length, 0);
    const done = keys.reduce((n, k) => n + PH_WORDS[k].filter(w => learned.has(w)).length, 0);
    const pct = total ? Math.round(done / total * 100) : 0;

    const phHtml =
      `<h4>🔤 Фонетика</h4>
       <div class="sub">Выучено слов: ${done} из ${total} (${pct}%)</div>
       <div class="bar"><i style="width:${pct}%"></i></div>` +
      keys.map(k => {
        const list = PH_WORDS[k], n = list.filter(w => learned.has(w)).length;
        return `<div class="grp"><div class="gh"><span>[${esc(k)}]</span><small>${n} / ${list.length}</small></div>
          <div class="ch">${list.map(w => `<span class="${learned.has(w) ? 'ok' : ''}">${learned.has(w) ? '✓ ' : ''}${esc(w)}</span>`).join('')}</div></div>`;
      }).join('') +
      `<a class="go" href="phonetics.html">Открыть карточки</a>`;

    /* устный английский (включая Vocabulary Builder — у него свои независимые ключи) */
    const enTotal = EN.reduce((n, g) => n + g.words.length, 0);
    const enDone = EN.reduce((n, g) => n + g.words.filter(w => enLearned.has(enKey(g, w))).length, 0);
    const enPct = enTotal ? Math.round(enDone / enTotal * 100) : 0;

    const enHtml = enTotal ?
      `<h4>🇬🇧 Устный английский</h4>
       <div class="sub">Выучено слов: ${enDone} из ${enTotal} (${enPct}%)</div>
       <div class="bar"><i style="width:${enPct}%"></i></div>` +
      EN.map(g => {
        const n = g.words.filter(w => enLearned.has(enKey(g, w))).length;
        return `<div class="grp"><div class="gh"><span>${esc(g.title)}</span><small>${n} / ${g.words.length}</small></div>
          <div class="ch">${g.words.map(w => { const ok = enLearned.has(enKey(g, w)); return `<span class="${ok ? 'ok' : ''}">${ok ? '✓ ' : ''}${esc(w[0])}</span>`; }).join('')}</div></div>`;
      }).join('') +
      `<a class="go" href="words.html">Открыть слова</a>` : '';

    /* латынь: лексические минимумы */
    const laTotal = LA.reduce((n, g) => n + g.words.length, 0);
    const laDone = LA.reduce((n, g) => n + g.words.filter(w => laLearned.has(w[0])).length, 0);
    const laPct = laTotal ? Math.round(laDone / laTotal * 100) : 0;

    const laHtml = laTotal ?
      `<h4>🏛️ Латынь</h4>
       <div class="sub">Выучено слов: ${laDone} из ${laTotal} (${laPct}%)</div>
       <div class="bar"><i style="width:${laPct}%"></i></div>` +
      LA.map(g => {
        const n = g.words.filter(w => laLearned.has(w[0])).length;
        return `<div class="grp"><div class="gh"><span>${esc(g.title)}</span><small>${n} / ${g.words.length}</small></div>
          <div class="ch">${g.words.map(w => { const ok = laLearned.has(w[0]); return `<span class="${ok ? 'ok' : ''}">${ok ? '✓ ' : ''}${esc(w[0])}</span>`; }).join('')}</div></div>`;
      }).join('') +
      `<a class="go" href="latin.html">Открыть слова</a>` : '';

    /* китайский */
    const chKeys = Object.keys(CH_WORDS);
    const chTotal = chKeys.reduce((n, k) => n + CH_WORDS[k].length, 0);
    const chDone = chKeys.reduce((n, k) => n + CH_WORDS[k].filter(w => chLearned.has(w)).length, 0);
    const chPct = chTotal ? Math.round(chDone / chTotal * 100) : 0;

    const chHtml =
      `<h4>🀄 Китайский</h4>
       <div class="sub">Выучено слов: ${chDone} из ${chTotal} (${chPct}%)</div>
       <div class="bar"><i style="width:${chPct}%"></i></div>` +
      chKeys.map(k => {
        const list = CH_WORDS[k], n = list.filter(w => chLearned.has(w)).length;
        return `<div class="grp"><div class="gh"><span>${esc(k)}</span><small>${n} / ${list.length}</small></div>
          <div class="ch">${list.map(w => `<span class="${chLearned.has(w) ? 'ok' : ''}">${chLearned.has(w) ? '✓ ' : ''}${esc(w)}</span>`).join('')}</div></div>`;
      }).join('') +
      `<a class="go" href="china.html">Открыть карточки</a>`;

    /* выбор предмета: запоминаем в браузере */
    const SUBJ = [['all', 'Все'], ['en', '🇬🇧 Английский'], ['la', '🏛️ Латынь'], ['ph', '🔤 Фонетика'], ['ch', '🀄 Китайский']];
    const BLOCK = { en: enHtml, la: laHtml, ph: phHtml, ch: chHtml };
    let subj = 'all';
    try { subj = localStorage.getItem('prg_subject') || 'all'; } catch (e) {}
    if (!BLOCK[subj]) subj = 'all';
    const paint = () => {
      back.querySelector('#prgBox').innerHTML =
        `<div class="top"><h3>📊 Прогресс: ${esc((window.userProfile && window.userProfile.nick) || login || 'гость')}</h3><button class="x" aria-label="Закрыть">✕</button></div>` +
        (window.authUser ? `<div class="pcard">${avatarHtml(window.userProfile, 46, (login || '?').charAt(0).toUpperCase())}<div class="pn"><b>${esc((window.userProfile && window.userProfile.nick) || login)}</b><small>логин: ${esc(login)}</small></div><button type="button" class="pedit">✏️ Изменить</button></div>` : '') +
        `<div class="sel">${SUBJ.map(([k, t]) => `<button data-k="${k}" class="${subj === k ? 'on' : ''}">${t}</button>`).join('')}</div>` +
        (subj === 'all' ? enHtml + laHtml + phHtml + chHtml : BLOCK[subj] || '<div class="sub">Нет данных</div>');
      back.querySelector('.x').onclick = close;
      const pe = back.querySelector('.pedit');
      if (pe) pe.onclick = () => openProfileEditor(login, paint);
      back.querySelectorAll('.sel button').forEach(b => b.onclick = () => {
        subj = b.dataset.k;
        try { localStorage.setItem('prg_subject', subj); } catch (e) {}
        paint();
      });
    };
    paint();
  }

  /* init + nav после готовности */
  async function boot() {
    if (document.body) {
      await init();
      buildNav();
    } else {
      document.addEventListener('DOMContentLoaded', async () => {
        await init();
        buildNav();
      });
    }
  }
  boot();
})();
