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
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('user-theme', t); } catch (e) {}
  }
  let savedTheme = 'dark';
  try { savedTheme = localStorage.getItem('user-theme') === 'light' ? 'light' : 'dark'; } catch (e) {}
  document.documentElement.setAttribute('data-theme', savedTheme);
  window.toggleTheme = function () {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  };

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
    if (window.isAdmin) return ' · админ';
    if (!window.isVerified) return ' · ждёт подтверждения';
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
        const { error: pe } = await sb.from('student_passwords').upsert({ login, password: pass });
        if (pe) console.error(pe);
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

    let learned = new Set(), enLearned = new Set(), chLearned = new Set();
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
    } catch (e) {}
    const EN = await loadEnWords();

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
    const SUBJ = [['all', 'Все'], ['en', '🇬🇧 Английский'], ['ph', '🔤 Фонетика'], ['ch', '🀄 Китайский']];
    const BLOCK = { en: enHtml, ph: phHtml, ch: chHtml };
    let subj = 'all';
    try { subj = localStorage.getItem('prg_subject') || 'all'; } catch (e) {}
    if (!BLOCK[subj]) subj = 'all';
    const paint = () => {
      back.querySelector('#prgBox').innerHTML =
        `<div class="top"><h3>📊 Прогресс: ${esc((window.userProfile && window.userProfile.nick) || login || 'гость')}</h3><button class="x" aria-label="Закрыть">✕</button></div>` +
        (window.authUser ? `<div class="pcard">${avatarHtml(window.userProfile, 46, (login || '?').charAt(0).toUpperCase())}<div class="pn"><b>${esc((window.userProfile && window.userProfile.nick) || login)}</b><small>логин: ${esc(login)}</small></div><button type="button" class="pedit">✏️ Изменить</button></div>` : '') +
        (window.authUser && !window.isVerified ? `<div class="pend">⏳ Аккаунт ждёт подтверждения админом. Пока он не подтверждён, прогресс хранится только в этом браузере, а Конспекты, База и Журнал скрыты. Профиль (ник и аватарка) сохраняется.</div>` : '') +
        `<div class="sel">${SUBJ.map(([k, t]) => `<button data-k="${k}" class="${subj === k ? 'on' : ''}">${t}</button>`).join('')}</div>` +
        (subj === 'all' ? enHtml + phHtml + chHtml : BLOCK[subj] || '<div class="sub">Нет данных</div>');
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
