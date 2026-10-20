// Accounts and saved progress.
// Online mode uses Supabase (one row per user in the "progress" table).
// Demo mode (no keys in config.js) keeps progress in this browser only.

window.Store = (function () {
  const cfg = window.APP_CONFIG || {};
  const online = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const client = online ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const LOCAL_KEY = 'eeasy-progress-v1';

  let user = null;
  let username = '';
  let saveTimer = null;
  let onSaveError = function () {};

  function emptyProgress() {
    return { known: {}, learning: {}, quizzes: [], xp: 0, streak: { last: null, count: 0 } };
  }

  function normalize(p) {
    return Object.assign(emptyProgress(), p || {});
  }

  function nameFor(u) {
    return (u.user_metadata && u.user_metadata.username) || u.email.split('@')[0];
  }

  async function getSession() {
    if (!online) return null;
    const { data } = await client.auth.getSession();
    user = data.session ? data.session.user : null;
    if (user) username = nameFor(user);
    return user;
  }

  async function signUp(email, password, name) {
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { username: name } } });
    if (error) throw error;
    if (!data.session) return { needsConfirm: true };
    user = data.user;
    username = name;
    return { needsConfirm: false };
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    user = data.user;
    username = nameFor(user);
  }

  async function signOut() {
    clearTimeout(saveTimer);
    await client.auth.signOut();
    user = null;
    username = '';
  }

  async function load() {
    if (!online) {
      try { return normalize(JSON.parse(localStorage.getItem(LOCAL_KEY))); } catch (e) { return emptyProgress(); }
    }
    const { data, error } = await client.from('progress').select('data').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (data) return normalize(data.data);
    const fresh = emptyProgress();
    const ins = await client.from('progress').insert({ user_id: user.id, username, xp: 0, data: fresh });
    if (ins.error) throw ins.error;
    return fresh;
  }

  function save(p) {
    if (!online) {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(p)); } catch (e) { /* storage blocked */ }
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async function () {
      if (!user) return;
      const { error } = await client.from('progress').upsert({
        user_id: user.id, username, xp: p.xp, data: p, updated_at: new Date().toISOString()
      });
      if (error) onSaveError(error);
    }, 600);
  }

  async function leaderboard() {
    if (!online || !user) return null;
    const { data, error } = await client.from('progress').select('user_id, username, xp').order('xp', { ascending: false }).limit(10);
    return error ? [] : data;
  }

  return {
    online, getSession, signUp, signIn, signOut, load, save, leaderboard,
    setSaveErrorHandler: function (fn) { onSaveError = fn; },
    get user() { return user; },
    get username() { return username; }
  };
})();
