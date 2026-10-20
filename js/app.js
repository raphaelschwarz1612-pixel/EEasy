(function () {
  const TOPICS = window.TOPICS;
  const WORDS = window.WORDS;
  const Store = window.Store;
  const QUIZ_LENGTH = 10;
  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'cards', label: '🃏 Flashcards' },
    { id: 'quiz', label: '✅ Quiz' },
    { id: 'words', label: '📖 Word list' }
  ];

  const state = {
    tab: TABS.some(function (t) { return '#' + t.id === location.hash; }) ? location.hash.slice(1) : 'overview',
    progress: null,
    loadError: '',
    board: null,
    auth: { mode: 'signin', msg: '', msgType: 'error', busy: false },
    cards: { topic: 'all', hideKnown: true, deck: [], i: 0, flipped: false, built: false },
    quizTopic: 'all',
    quiz: null,
    list: { q: '', topic: 'all' }
  };

  // ---------- helpers ----------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dayKey(d);
  }

  function topicName(id) {
    const t = TOPICS.find(function (t) { return t.id === id; });
    return t ? t.icon + ' ' + t.name : '🌐 All topics';
  }

  function wordsFor(topic) {
    return topic === 'all' ? WORDS : WORDS.filter(function (w) { return w.topic === topic; });
  }

  function topicOptions(selected) {
    return '<option value="all"' + (selected === 'all' ? ' selected' : '') + '>🌐 All topics</option>' +
      TOPICS.map(function (t) {
        return '<option value="' + t.id + '"' + (selected === t.id ? ' selected' : '') + '>' + t.icon + ' ' + esc(t.name) + '</option>';
      }).join('');
  }

  function statusOf(w) {
    const p = state.progress;
    if (p.known[w.id]) return { key: 'known', label: 'Known', cls: 'status-good' };
    if (p.learning[w.id]) return { key: 'learning', label: 'Learning', cls: 'status-warning' };
    return { key: 'new', label: 'New', cls: 'status-new' };
  }

  function gapRegex(w) {
    return new RegExp('\\b' + w.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
  }

  function currentStreak() {
    const s = state.progress.streak;
    return (s.last === dayKey() || s.last === yesterdayKey()) ? s.count : 0;
  }

  // Counts today as a learning day for the streak.
  function touch() {
    const s = state.progress.streak;
    const today = dayKey();
    if (s.last === today) return;
    s.count = s.last === yesterdayKey() ? s.count + 1 : 1;
    s.last = today;
  }

  function commit() {
    Store.save(state.progress);
  }

  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'success');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  // ---------- header ----------

  function renderHeader() {
    let right = '';
    if (!Store.online) {
      right = '<span class="chip">Demo mode</span>';
    } else if (Store.user) {
      right = '<span class="chip">👤 ' + esc(Store.username) + '</span>' +
        '<button class="btn-ghost" data-action="signout">Sign out</button>';
    }
    document.getElementById('account').innerHTML = right;
  }

  // ---------- auth screen ----------

  function renderAuth() {
    const a = state.auth;
    const signup = a.mode === 'signup';
    return '<div class="auth-wrap"><div class="form-section auth-card">' +
      '<div class="segmented">' +
        '<button class="' + (!signup ? 'active' : '') + '" data-action="auth-mode" data-mode="signin">Sign in</button>' +
        '<button class="' + (signup ? 'active' : '') + '" data-action="auth-mode" data-mode="signup">Create account</button>' +
      '</div>' +
      '<h3>' + (signup ? 'Create your free account' : 'Welcome back') + '</h3>' +
      '<p class="muted">' + (signup
        ? 'Your words, quiz scores and streak are saved to your account, so you can learn on any phone or laptop.'
        : 'Sign in to continue where you stopped.') + '</p>' +
      (a.msg ? '<div class="alert ' + a.msgType + '">' + esc(a.msg) + '</div>' : '') +
      '<form id="auth-form" novalidate>' +
        (signup ? '<div class="form-group"><label for="auth-name">Username</label><input id="auth-name" type="text" autocomplete="nickname" maxlength="20" placeholder="e.g. lena_19" required></div>' : '') +
        '<div class="form-group"><label for="auth-email">Email</label><input id="auth-email" type="email" autocomplete="email" placeholder="you@example.com" required></div>' +
        '<div class="form-group"><label for="auth-pass">Password</label><input id="auth-pass" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" placeholder="At least 6 characters" required></div>' +
        '<button type="submit" class="btn-block"' + (a.busy ? ' disabled' : '') + '>' + (a.busy ? 'Please wait…' : (signup ? 'Create account' : 'Sign in')) + '</button>' +
      '</form>' +
    '</div></div>';
  }

  async function submitAuth() {
    const a = state.auth;
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-pass').value;
    const nameEl = document.getElementById('auth-name');
    const name = nameEl ? nameEl.value.trim() : '';

    if (a.mode === 'signup' && !/^[\w.-]{3,20}$/.test(name)) {
      return setAuthMsg('Choose a username with 3 to 20 letters, numbers, dots, dashes or underscores.');
    }
    if (!email || pass.length < 6) {
      return setAuthMsg('Enter your email and a password with at least 6 characters.');
    }

    a.busy = true; a.msg = ''; render();
    try {
      if (a.mode === 'signup') {
        const res = await Store.signUp(email, pass, name);
        if (res.needsConfirm) {
          a.busy = false; a.mode = 'signin';
          return setAuthMsg('Account created. Open the link in the email we sent you, then sign in here.', 'success');
        }
      } else {
        await Store.signIn(email, pass);
      }
      a.busy = false;
      await afterLogin();
    } catch (err) {
      a.busy = false;
      setAuthMsg(err.message || 'Something went wrong. Check your connection and try again.');
    }
  }

  function setAuthMsg(msg, type) {
    state.auth.msg = msg;
    state.auth.msgType = type || 'error';
    render();
  }

  async function afterLogin() {
    try {
      state.progress = await Store.load();
      state.loadError = '';
    } catch (err) {
      state.loadError = 'Your progress could not be loaded (' + (err.message || 'unknown error') + '). If you set up the app yourself, check that you ran supabase/setup.sql.';
    }
    state.board = null;
    render();
    loadBoard();
  }

  async function loadBoard() {
    if (!Store.online || !Store.user) return;
    state.board = await Store.leaderboard();
    if (state.tab === 'overview') render();
  }

  // ---------- overview ----------

  function renderOverview() {
    const p = state.progress;
    const known = Object.keys(p.known).length;
    const learning = Object.keys(p.learning).length;
    const quizzes = p.quizzes;
    const avg = quizzes.length
      ? Math.round(quizzes.reduce(function (s, q) { return s + q.score / q.total; }, 0) / quizzes.length * 100)
      : null;
    const streak = currentStreak();

    const seed = dayKey().split('-').join('');
    const wotd = WORDS[Number(seed) % WORDS.length];

    let html = '<div class="grid">' +
      metric('📚 Words known', known, 'of ' + WORDS.length, learning + ' still learning') +
      metric('✅ Quiz average', avg === null ? '—' : avg + '%', '', quizzes.length + ' quiz' + (quizzes.length === 1 ? '' : 'zes') + ' taken') +
      metric('🔥 Day streak', streak, streak === 1 ? 'day' : 'days', streak ? 'Learn today to keep it going' : 'Learn today to start one') +
      metric('⭐ XP', p.xp, 'points', '+5 per known word, +10 per correct answer') +
    '</div>';

    html += '<div class="two-col">';

    html += '<div class="chart-container"><div class="chart-title">Progress by topic</div>' +
      TOPICS.map(function (t) {
        const tw = wordsFor(t.id);
        const k = tw.filter(function (w) { return p.known[w.id]; }).length;
        const pct = Math.round(k / tw.length * 100);
        return '<div class="topic-row"><div class="topic-head"><span>' + t.icon + ' ' + esc(t.name) + '</span>' +
          '<span class="num">' + k + ' / ' + tw.length + '</span></div>' +
          '<div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
      }).join('') + '</div>';

    html += '<div class="stack">';

    html += '<div class="chart-container wotd"><div class="chart-title">Word of the day</div>' +
      '<div class="wotd-word">' + esc(wotd.w) + ' <span class="pos">' + esc(wotd.pos) + '</span></div>' +
      '<div class="wotd-def">' + esc(wotd.def) + '</div>' +
      '<div class="wotd-de">🇩🇪 ' + esc(wotd.de) + '</div>' +
      '<div class="wotd-ex">“' + esc(wotd.ex) + '”</div></div>';

    const recent = quizzes.slice(-10);
    html += '<div class="chart-container"><div class="chart-title">Last quizzes</div>' +
      (recent.length
        ? '<div class="mini-chart">' + recent.map(function (q) {
            const pct = Math.round(q.score / q.total * 100);
            return '<div class="mini-col" title="' + esc(q.date) + ': ' + q.score + '/' + q.total + '"><span class="mini-val">' + pct + '</span><div class="mini-bar" style="height:' + Math.max(pct, 4) + '%"></div></div>';
          }).join('') + '</div><div class="muted small">Score in % for your last ' + recent.length + ' quiz' + (recent.length === 1 ? '' : 'zes') + '</div>'
        : '<div class="empty-state"><h3>No quizzes yet</h3><p>Take your first quiz to see your scores here.</p><button data-action="tab" data-tab="quiz">Start a quiz</button></div>') +
      '</div>';

    html += '</div></div>';

    if (Store.online) {
      html += '<div class="chart-container"><div class="chart-title">🏆 Leaderboard</div>';
      if (!state.board) {
        html += '<p class="muted">Loading…</p>';
      } else if (!state.board.length) {
        html += '<p class="muted">Nobody has earned XP yet. Be the first.</p>';
      } else {
        html += state.board.map(function (r, i) {
          const me = Store.user && r.user_id === Store.user.id;
          return '<div class="list-item' + (me ? ' me' : '') + '"><div><span class="rank">' + (i + 1) + '</span>' + esc(r.username) + (me ? ' (you)' : '') + '</div><strong class="num">' + r.xp + ' XP</strong></div>';
        }).join('');
      }
      html += '</div>';
    }

    return html;
  }

  function metric(label, value, unit, meta) {
    return '<div class="card metric-card"><div class="metric-label">' + label + '</div>' +
      '<div class="metric-value num">' + value + (unit ? ' <span class="metric-unit">' + unit + '</span>' : '') + '</div>' +
      '<div class="metric-meta">' + meta + '</div></div>';
  }

  // ---------- flashcards ----------

  function buildDeck() {
    const c = state.cards;
    let pool = wordsFor(c.topic);
    if (c.hideKnown) pool = pool.filter(function (w) { return !state.progress.known[w.id]; });
    c.deck = shuffle(pool);
    c.i = 0;
    c.flipped = false;
    c.built = true;
  }

  function renderCards() {
    const c = state.cards;
    if (!c.built) buildDeck();
    let html = '<div class="toolbar">' +
      '<div class="form-group"><label for="cards-topic">Topic</label><select id="cards-topic" data-change="cards-topic">' + topicOptions(c.topic) + '</select></div>' +
      '<label class="check"><input id="cards-hide" type="checkbox" data-change="cards-hide"' + (c.hideKnown ? ' checked' : '') + '> Hide words I know</label>' +
    '</div>';

    if (!c.deck.length) {
      return html + '<div class="chart-container empty-state"><h3>🎉 You know every word here</h3><p>Pick another topic, or untick “Hide words I know” to practise them again.</p></div>';
    }
    if (c.i >= c.deck.length) {
      return html + '<div class="chart-container empty-state"><h3>Deck finished</h3><p>You went through all ' + c.deck.length + ' cards. Shuffle them to go again.</p><button data-action="cards-restart">Shuffle and restart</button></div>';
    }

    const w = c.deck[c.i];
    const st = statusOf(w);
    html += '<div class="deck-meta"><span class="num">Card ' + (c.i + 1) + ' of ' + c.deck.length + '</span><span class="status-badge ' + st.cls + '">' + st.label + '</span></div>' +
      '<div class="bar thin"><div class="bar-fill" style="width:' + Math.round(c.i / c.deck.length * 100) + '%"></div></div>' +
      '<button class="flashcard' + (c.flipped ? ' flipped' : '') + '" data-action="cards-flip" aria-label="Flip card">' +
        (c.flipped
          ? '<span class="fc-word small-word">' + esc(w.w) + '</span>' +
            '<span class="fc-def">' + esc(w.def) + '</span>' +
            '<span class="fc-de">🇩🇪 ' + esc(w.de) + '</span>' +
            '<span class="fc-ex">“' + esc(w.ex) + '”</span>'
          : '<span class="fc-topic">' + topicName(w.topic) + '</span>' +
            '<span class="fc-word">' + esc(w.w) + '</span>' +
            '<span class="pos">' + esc(w.pos) + '</span>' +
            '<span class="fc-hint">Tap to see the meaning</span>') +
      '</button>' +
      '<div class="button-group">' +
        '<button class="btn-secondary" data-action="cards-learning">🔁 Still learning</button>' +
        '<button class="btn-success" data-action="cards-known">✓ I know it</button>' +
      '</div>';
    return html;
  }

  function cardAnswer(knowIt) {
    const c = state.cards;
    const w = c.deck[c.i];
    const p = state.progress;
    if (knowIt) {
      if (!p.known[w.id]) p.xp += 5;
      p.known[w.id] = true;
      delete p.learning[w.id];
    } else {
      p.learning[w.id] = true;
      delete p.known[w.id];
    }
    touch();
    commit();
    c.i += 1;
    c.flipped = false;
    render();
  }

  // ---------- quiz ----------

  function makeQuestion(w, pool) {
    const types = ['def', 'de'];
    if (gapRegex(w).test(w.ex)) types.push('gap', 'gap');
    const type = types[Math.floor(Math.random() * types.length)];
    let prompt;
    if (type === 'def') prompt = 'Which word means <em>“' + esc(w.def) + '”</em>?';
    else if (type === 'de') prompt = 'What is the English word for <em>“' + esc(w.de) + '”</em>?';
    else prompt = 'Fill the gap: <em>“' + esc(w.ex.replace(gapRegex(w), '_____')) + '”</em>';
    const others = shuffle(pool.filter(function (x) { return x.id !== w.id; })).slice(0, 3);
    return { word: w, type: type, prompt: prompt, options: shuffle([w].concat(others)), picked: null };
  }

  function startQuiz() {
    const pool = wordsFor(state.quizTopic);
    const picks = shuffle(pool).slice(0, QUIZ_LENGTH);
    state.quiz = {
      topic: state.quizTopic,
      qs: picks.map(function (w) { return makeQuestion(w, pool); }),
      i: 0,
      score: 0,
      done: false
    };
    render();
  }

  function renderQuiz() {
    const z = state.quiz;
    if (!z) {
      return '<div class="form-section quiz-start"><h3>✅ Short quiz</h3>' +
        '<p class="muted">' + QUIZ_LENGTH + ' quick questions: meanings, gap sentences and German translations. You get 10 XP for every right answer.</p>' +
        '<div class="form-group"><label for="quiz-topic">Topic</label><select id="quiz-topic" data-change="quiz-topic">' + topicOptions(state.quizTopic) + '</select></div>' +
        '<button data-action="quiz-start">Start quiz</button></div>';
    }

    if (z.done) {
      const wrong = z.qs.filter(function (q) { return q.options[q.picked].id !== q.word.id; });
      const pct = Math.round(z.score / z.qs.length * 100);
      const msg = pct === 100 ? 'Perfect score! 🎉' : pct >= 70 ? 'Great work!' : pct >= 40 ? 'Good effort. Keep practising.' : 'Keep going. Try the flashcards first.';
      return '<div class="form-section quiz-result"><div class="metric-label">' + topicName(z.topic) + '</div>' +
        '<div class="result-score num">' + z.score + ' / ' + z.qs.length + '</div>' +
        '<p>' + msg + ' You earned <strong>' + (z.score * 10) + ' XP</strong>.</p>' +
        (wrong.length ? '<div class="chart-title">Words to review</div>' + wrong.map(function (q) {
          return '<div class="list-item"><div><strong>' + esc(q.word.w) + '</strong><br><span class="muted small">' + esc(q.word.def) + ' · ' + esc(q.word.de) + '</span></div></div>';
        }).join('') : '') +
        '<div class="button-group"><button data-action="quiz-start">Try another quiz</button><button class="btn-secondary" data-action="quiz-reset">Change topic</button></div></div>';
    }

    const q = z.qs[z.i];
    const answered = q.picked !== null;
    return '<div class="deck-meta"><span class="num">Question ' + (z.i + 1) + ' of ' + z.qs.length + '</span><span class="num">Score: ' + z.score + '</span></div>' +
      '<div class="bar thin"><div class="bar-fill" style="width:' + Math.round(z.i / z.qs.length * 100) + '%"></div></div>' +
      '<div class="form-section"><div class="quiz-prompt">' + q.prompt + '</div>' +
      '<div class="options">' + q.options.map(function (o, idx) {
        let cls = 'option';
        if (answered) {
          if (o.id === q.word.id) cls += ' correct';
          else if (idx === q.picked) cls += ' wrong';
        }
        return '<button class="' + cls + '" data-action="quiz-pick" data-idx="' + idx + '"' + (answered ? ' disabled' : '') + '>' + esc(o.w) + '</button>';
      }).join('') + '</div>' +
      (answered
        ? '<div class="feedback ' + (q.options[q.picked].id === q.word.id ? 'good' : 'bad') + '">' +
            (q.options[q.picked].id === q.word.id ? '✓ Correct!' : '✗ The answer is <strong>' + esc(q.word.w) + '</strong>.') +
            ' <span class="muted">“' + esc(q.word.ex) + '”</span></div>' +
          '<div class="button-group"><button data-action="quiz-next">' + (z.i + 1 < z.qs.length ? 'Next question' : 'See result') + '</button></div>'
        : '') +
      '</div>';
  }

  function quizPick(idx) {
    const z = state.quiz;
    const q = z.qs[z.i];
    if (q.picked !== null) return;
    q.picked = idx;
    if (q.options[idx].id === q.word.id) z.score += 1;
    render();
  }

  function quizNext() {
    const z = state.quiz;
    z.i += 1;
    if (z.i >= z.qs.length) {
      z.done = true;
      const p = state.progress;
      p.quizzes.push({ date: dayKey(), topic: z.topic, score: z.score, total: z.qs.length });
      p.quizzes = p.quizzes.slice(-50);
      p.xp += z.score * 10;
      touch();
      commit();
    }
    render();
  }

  // ---------- word list ----------

  function renderWords() {
    const l = state.list;
    return '<div class="toolbar">' +
      '<div class="form-group grow"><label for="list-q">Search</label><input id="list-q" type="search" data-input="list-q" placeholder="Search English or German…" value="' + esc(l.q) + '"></div>' +
      '<div class="form-group"><label for="list-topic">Topic</label><select id="list-topic" data-change="list-topic">' + topicOptions(l.topic) + '</select></div>' +
    '</div><div class="chart-container" id="list-body">' + renderWordRows() + '</div>';
  }

  function renderWordRows() {
    const l = state.list;
    const q = l.q.trim().toLowerCase();
    const rows = wordsFor(l.topic).filter(function (w) {
      return !q || w.w.toLowerCase().includes(q) || w.de.toLowerCase().includes(q) || w.def.toLowerCase().includes(q);
    });
    if (!rows.length) return '<div class="empty-state"><h3>No words found</h3><p>Try a different search or topic.</p></div>';
    return '<div class="muted small list-hint">' + rows.length + ' words · tap a badge to change its status</div>' +
      rows.map(function (w) {
        const st = statusOf(w);
        return '<div class="list-item word-row"><div class="word-text"><strong>' + esc(w.w) + '</strong> <span class="pos">' + esc(w.pos) + '</span><br>' +
          '<span class="small">' + esc(w.def) + '</span><br><span class="muted small">🇩🇪 ' + esc(w.de) + '</span></div>' +
          '<button class="status-badge ' + st.cls + '" data-action="word-cycle" data-id="' + w.id + '" aria-label="Change status of ' + esc(w.w) + '">' + st.label + '</button></div>';
      }).join('');
  }

  function cycleWord(id) {
    const p = state.progress;
    if (p.known[id]) {
      delete p.known[id];
    } else if (p.learning[id]) {
      delete p.learning[id];
      p.known[id] = true;
      p.xp += 5;
    } else {
      p.learning[id] = true;
    }
    touch();
    commit();
    document.getElementById('list-body').innerHTML = renderWordRows();
  }

  // ---------- main render ----------

  function render() {
    renderHeader();
    const main = document.getElementById('main');

    if (Store.online && !Store.user) {
      main.innerHTML = renderAuth();
      return;
    }
    if (state.loadError) {
      main.innerHTML = '<div class="alert error">' + esc(state.loadError) + '</div>';
      return;
    }
    if (!state.progress) {
      main.innerHTML = '<p class="muted">Loading…</p>';
      return;
    }

    let html = '';
    if (!Store.online) {
      html += '<div class="alert warning">Demo mode: your progress is saved on this device only. To turn on accounts, add your Supabase keys in <code>js/config.js</code> (see README).</div>';
    }
    html += '<nav class="tabs" role="tablist">' + TABS.map(function (t) {
      return '<button class="tab-button' + (state.tab === t.id ? ' active' : '') + '" role="tab" aria-selected="' + (state.tab === t.id) + '" data-action="tab" data-tab="' + t.id + '">' + t.label + '</button>';
    }).join('') + '</nav>';

    if (state.tab === 'overview') html += renderOverview();
    else if (state.tab === 'cards') html += renderCards();
    else if (state.tab === 'quiz') html += renderQuiz();
    else html += renderWords();

    main.innerHTML = html;
  }

  // ---------- events ----------

  const actions = {
    tab: function (el) {
      state.tab = el.dataset.tab;
      try { history.replaceState(null, '', '#' + state.tab); } catch (e) { /* ignore */ }
      if (state.tab === 'overview') loadBoard();
      render();
      window.scrollTo(0, 0);
    },
    'auth-mode': function (el) { state.auth.mode = el.dataset.mode; state.auth.msg = ''; render(); },
    signout: async function () {
      await Store.signOut();
      state.progress = null; state.quiz = null; state.board = null; state.cards.deck = []; state.cards.built = false;
      state.auth = { mode: 'signin', msg: '', msgType: 'error', busy: false };
      render();
    },
    'cards-flip': function () { state.cards.flipped = !state.cards.flipped; render(); },
    'cards-known': function () { cardAnswer(true); },
    'cards-learning': function () { cardAnswer(false); },
    'cards-restart': function () { buildDeck(); render(); },
    'quiz-start': startQuiz,
    'quiz-reset': function () { state.quiz = null; render(); },
    'quiz-pick': function (el) { quizPick(Number(el.dataset.idx)); },
    'quiz-next': quizNext,
    'word-cycle': function (el) { cycleWord(el.dataset.id); }
  };

  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
  });

  document.addEventListener('change', function (e) {
    const key = e.target.dataset.change;
    if (key === 'cards-topic') { state.cards.topic = e.target.value; buildDeck(); render(); }
    if (key === 'cards-hide') { state.cards.hideKnown = e.target.checked; buildDeck(); render(); }
    if (key === 'quiz-topic') { state.quizTopic = e.target.value; }
    if (key === 'list-topic') { state.list.topic = e.target.value; document.getElementById('list-body').innerHTML = renderWordRows(); }
  });

  document.addEventListener('input', function (e) {
    if (e.target.dataset.input === 'list-q') {
      state.list.q = e.target.value;
      document.getElementById('list-body').innerHTML = renderWordRows();
    }
  });

  document.addEventListener('submit', function (e) {
    if (e.target.id === 'auth-form') { e.preventDefault(); submitAuth(); }
  });

  Store.setSaveErrorHandler(function () {
    toast('Could not save your progress. Check your internet connection.', 'error');
  });

  // ---------- start ----------

  async function boot() {
    render();
    if (Store.online) {
      try { await Store.getSession(); } catch (e) { /* show sign-in */ }
      if (Store.user) { await afterLogin(); } else { render(); }
    } else {
      state.progress = await Store.load();
      render();
    }
  }

  boot();
})();
