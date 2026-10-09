/* ФЛ1-ПОДб-11: вход + данные через Supabase. Подключается в <head> каждой страницы. */
(function () {
  const SB_URL = 'https://kmimcxrbdpsubpquenxz.supabase.co';
  const SB_KEY = 'sb_publishable__n7rX8CQCOxBvQlA3l0BBw_AnhSor-_';
  const HW_ID = 'ac41837c39a8785f2ce4';   // старый npoint ДЗ
  const NT_ID = 'b0bf097d8c176bdc856e';   // старый npoint конспектов
  const DOMAIN = '@group.local';

  const sb = supabase.createClient(SB_URL, SB_KEY);
  window.sb = sb;
  window.isAdmin = false;
  window.currentUser = null;

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
    const nw = JSON.parse(o.body);
    const up = Object.keys(nw).filter(k => nw[k] !== hwCache[k]).map(k => ({ key: k, text: nw[k] }));
    const del = Object.keys(hwCache).filter(k => !(k in nw));
    if (up.length) { const { error } = await sb.from('homework').upsert(up); if (error) throw error; }
    if (del.length) { const { error } = await sb.from('homework').delete().in('key', del); if (error) throw error; }
    hwCache = nw;
    return J({});
  }

  async function nt(o) {
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

  /* ---------- данные ученика (карточки и т.д.) ---------- */
  window.userData = {
    async get(key) {
      const { data } = await sb.from('user_data').select('value').eq('key', key).maybeSingle();
      return data ? data.value : null;
    },
    async set(key, value) {
      await sb.from('user_data').upsert({ user_id: window.currentUser.id, key, value });
    }
  };

  /* ---------- интерфейс входа ---------- */
  const css = document.createElement('style');
  css.textContent = `
  #authGate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#080b14;color:#f4f7ff;font:15px system-ui,sans-serif;padding:16px}
  #authGate form{width:min(360px,100%);background:#131928;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:26px;display:grid;gap:12px}
  #authGate h2{margin:0 0 4px;font-size:22px}
  #authGate input{padding:13px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#fff;font:inherit}
  #authGate button{padding:13px;border:0;border-radius:12px;background:linear-gradient(135deg,#7c6cff,#8b5cf6);color:#fff;font-weight:700;font:inherit;cursor:pointer}
  #authErr{color:#ff6878;font-size:13px;min-height:16px}
  #authBar{position:fixed;top:8px;right:8px;z-index:9999;display:flex;gap:6px;align-items:center;font:12px system-ui,sans-serif}
  #authBar span{background:rgba(20,25,40,.85);color:#aeb8cc;padding:6px 10px;border-radius:99px}
  #authBar button{background:rgba(20,25,40,.85);color:#f4f7ff;border:1px solid rgba(255,255,255,.15);border-radius:99px;padding:6px 10px;font:inherit;cursor:pointer}`;
  document.head.appendChild(css);

  function showGate() {
    const g = document.createElement('div');
    g.id = 'authGate';
    g.innerHTML = `<form><h2>🎓 ФЛ1 • ПОДб-11</h2>
      <input id="aLogin" placeholder="Логин" autocomplete="username" autocapitalize="none" required>
      <input id="aPass" type="password" placeholder="Пароль" autocomplete="current-password" required>
      <div id="authErr"></div><button type="submit">Войти</button></form>`;
    document.body.appendChild(g);
    g.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      const login = g.querySelector('#aLogin').value.trim().toLowerCase();
      const { error } = await sb.auth.signInWithPassword({ email: login + DOMAIN, password: g.querySelector('#aPass').value });
      if (error) { g.querySelector('#authErr').textContent = 'Неверный логин или пароль'; return; }
      g.remove();
      init();
    };
  }

  async function init() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return showGate();
    window.currentUser = session.user;
    const { data: p } = await sb.from('profiles').select('login,full_name,role').eq('id', session.user.id).maybeSingle();
    window.isAdmin = !!p && p.role === 'admin';
    if (!window.isAdmin) {
      const s = document.createElement('style');
      s.textContent = '.add-box,.delete-btn{display:none!important}';
      document.head.appendChild(s);
    }
    const bar = document.createElement('div');
    bar.id = 'authBar';
    bar.innerHTML = `<span id="bProfile" role="button" tabindex="0" title="Мой прогресс" style="cursor:pointer">📊 ${p ? p.login : ''}${window.isAdmin ? ' · админ' : ''}</span><button id="bOut">Выйти</button>`;
    bar.querySelector('#bProfile').onclick = () => openProgress(p ? p.login : '');
    document.body.appendChild(bar);
    bar.querySelector('#bOut').onclick = async () => { await sb.auth.signOut(); location.reload(); };
    resolveReady();
    document.dispatchEvent(new Event('auth-ready'));
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

  /* ---------- слова устного английского: список лежит в words-data.js (общий для words.html и этого окна) ---------- */
  function loadEnWords() {
    return new Promise(res => {
      if (window.EN_WORDS) return res(window.EN_WORDS);
      const s = document.createElement('script');
      s.src = 'words-data.js?v=1';
      s.onload = () => res(window.EN_WORDS || []);
      s.onerror = () => res([]);
      document.head.appendChild(s);
    });
  }

  /* ---------- стили окна прогресса и отступ под нижнюю панель ---------- */
  const css2 = document.createElement('style');
  css2.textContent = `
  body{padding-bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}
  #prgBack{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  #prgBox{width:min(560px,100%);max-height:88vh;overflow:auto;background:#131928;color:#f4f7ff;border:1px solid rgba(255,255,255,.1);border-radius:22px 22px 0 0;padding:20px 18px calc(22px + env(safe-area-inset-bottom,0px))}
  @media(min-width:600px){#prgBack{align-items:center}#prgBox{border-radius:22px}}
  #prgBox h3{margin:0;font-size:20px}
  #prgBox h4{margin:24px 0 0;font-size:16px}
  #prgBox .top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
  #prgBox .x{background:rgba(255,255,255,.08);color:#fff;border:0;border-radius:50%;width:34px;height:34px;font-size:16px;cursor:pointer}
  #prgBox .sub{color:#aeb8cc;font-size:13px;margin:4px 0 12px}
  #prgBox .bar{height:10px;border-radius:6px;background:rgba(255,255,255,.1);overflow:hidden}
  #prgBox .bar i{display:block;height:100%;background:linear-gradient(90deg,#7c6cff,#45caff);border-radius:6px}
  #prgBox .sel{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0}
  #prgBox .sel button{padding:7px 12px;border-radius:99px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#aeb8cc;font-size:13px;font-weight:700;cursor:pointer}
  #prgBox .sel button.on{background:linear-gradient(135deg,#7c6cff,#8b5cf6);border-color:transparent;color:#fff}
  #prgBox h4:first-of-type{margin-top:18px}
  #prgBox .grp{margin-top:18px}
  #prgBox .gh{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:14px;margin-bottom:8px;gap:10px}
  #prgBox .gh small{color:#aeb8cc;font-weight:600;white-space:nowrap}
  #prgBox .ch{display:flex;flex-wrap:wrap;gap:6px}
  #prgBox .ch span{padding:5px 10px;border-radius:99px;font-size:13px;border:1px solid rgba(255,255,255,.12);color:#78839a}
  #prgBox .ch span.ok{background:rgba(34,197,94,.16);border-color:rgba(34,197,94,.5);color:#86efac}
  #prgBox .go{display:block;margin-top:14px;text-align:center;padding:13px;border-radius:12px;background:linear-gradient(135deg,#7c6cff,#8b5cf6);color:#fff;font-weight:700;text-decoration:none}`;
  document.head.appendChild(css2);

  /* ---------- нижняя навигация (в Shadow DOM: стили страниц на неё не влияют) ---------- */
  const PAGES = [
    ['index.html', '🏠', 'Главная'],
    ['hw.html', '📚', 'ДЗ'],
    ['notes.html', '📖', 'Конспекты'],
    ['base.html', '🗂️', 'База'],
    ['phonetics.html', '🔤', 'Фонетика'],
    ['words.html', '🇬🇧', 'Слова'],
    ['china.html', '🀄', 'Китайский']
  ];
  const NAV_CSS = `
  :host{all:initial}
  .wrap{display:flex;justify-content:center;padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));background:rgba(12,16,28,.92);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-top:1px solid rgba(255,255,255,.1);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;box-sizing:border-box}
  .in{display:flex;align-items:flex-start;gap:2px;width:min(640px,100%)}
  a{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border-radius:12px;color:#9aa5bd;text-decoration:none;font-size:10px;font-weight:600;line-height:1.1;text-align:center;-webkit-tap-highlight-color:transparent}
  a b{font-size:20px;line-height:1;font-weight:400}
  a span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  a.on{color:#fff;background:rgba(124,108,255,.35)}
  .wrap.light{background:rgba(255,255,255,.94);border-top-color:rgba(20,30,50,.12)}
  .wrap.light a{color:#5d687b}
  .wrap.light a.on{color:#3b2fb0;background:rgba(124,108,255,.18)}`;

  function buildNav() {
    if (document.getElementById('siteNav')) return;
    let cur = location.pathname.split('/').pop();
    if (!cur) cur = 'index.html';
    const host = document.createElement('div');
    host.id = 'siteNav';
    const hs = [['position', 'fixed'], ['left', '0'], ['right', '0'], ['bottom', '0'], ['top', 'auto'],
      ['height', 'auto'], ['width', 'auto'], ['margin', '0'], ['padding', '0'], ['transform', 'none'],
      ['display', 'block'], ['z-index', '9998']];
    hs.forEach(([k, v]) => host.style.setProperty(k, v, 'important'));
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + NAV_CSS + '</style><div class="wrap"><div class="in">' +
      PAGES.map(([h, i, t]) =>
        `<a href="${h}"${h === cur ? ' class="on" aria-current="page"' : ''}><b>${i}</b><span>${t}</span></a>`).join('') +
      '</div></div>';
    const wrap = root.querySelector('.wrap');
    const syncTheme = () => wrap.classList.toggle('light', document.documentElement.getAttribute('data-theme') === 'light');
    syncTheme();
    new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.body.appendChild(host);
  }
  if (document.body) buildNav(); else document.addEventListener('DOMContentLoaded', buildNav);

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

    /* устный английский */
    const enTotal = EN.reduce((n, g) => n + g.words.length, 0);
    const enDone = EN.reduce((n, g) => n + g.words.filter(w => enLearned.has(w[0])).length, 0);
    const enPct = enTotal ? Math.round(enDone / enTotal * 100) : 0;

    const enHtml = enTotal ?
      `<h4>🇬🇧 Устный английский</h4>
       <div class="sub">Выучено слов: ${enDone} из ${enTotal} (${enPct}%)</div>
       <div class="bar"><i style="width:${enPct}%"></i></div>` +
      EN.map(g => {
        const n = g.words.filter(w => enLearned.has(w[0])).length;
        return `<div class="grp"><div class="gh"><span>${esc(g.title)}</span><small>${n} / ${g.words.length}</small></div>
          <div class="ch">${g.words.map(w => `<span class="${enLearned.has(w[0]) ? 'ok' : ''}">${enLearned.has(w[0]) ? '✓ ' : ''}${esc(w[0])}</span>`).join('')}</div></div>`;
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
        `<div class="top"><h3>📊 Прогресс: ${esc(login)}</h3><button class="x" aria-label="Закрыть">✕</button></div>` +
        `<div class="sel">${SUBJ.map(([k, t]) => `<button data-k="${k}" class="${subj === k ? 'on' : ''}">${t}</button>`).join('')}</div>` +
        (subj === 'all' ? enHtml + phHtml + chHtml : BLOCK[subj] || '<div class="sub">Нет данных</div>');
      back.querySelector('.x').onclick = close;
      back.querySelectorAll('.sel button').forEach(b => b.onclick = () => {
        subj = b.dataset.k;
        try { localStorage.setItem('prg_subject', subj); } catch (e) {}
        paint();
      });
    };
    paint();
  }

  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
