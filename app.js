/* ФЛ1-ПОДб-11: вход + данные через Supabase. Подключается в <head> каждой страницы. */
(function () {
  const SB_URL = 'https://kmimcxrbdpsubpquenxz.supabase.co';
  const SB_KEY = 'sb_publishable__n7rX8CQCOxBvQlA3l0BBw_AnhSor-_';
  const HW_ID = 'ac41837c39a8785f2ce4';   // старый npoint ДЗ
  const NT_ID = 'b0bf097d8c176bdc856e';   // старый npoint конспектов
  const DOMAIN = '@group.local';

  const sb = supabase.createClient(SB_URL, SB_KEY);
  window.sb = sb;
  window.supabaseClient = sb;
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
      await ready;
      if (!window.currentUser) return null;
      const { data, error } = await sb.from('user_data')
        .select('value')
        .eq('user_id', window.currentUser.id)
        .eq('key', key)
        .maybeSingle();
      if (error || !data) return null;
      return data.value;
    },
    async set(key, value) {
      await ready;
      if (!window.currentUser) return;
      await sb.from('user_data').upsert({
        user_id: window.currentUser.id,
        key: key,
        value: value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,key' });
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
  #authBar{position:fixed;top:8px;right:8px;z-index:9999;display:flex;gap:6px;
