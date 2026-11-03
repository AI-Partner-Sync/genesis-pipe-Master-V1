// 浮遊AIアバター（試作 / prototype）
// 理念：「過去の自分が最高の味方だった」という気づきが、自らを信じる力になる。
// この部品の仕事は1つだけ：過去の自分の言葉を1件差し出し、今の自分が返事をする対話の入口を作る。
// 表示は端末ごとのフラグ制（Timeline Viewer の #reflect=on と同じ流儀）。
//   オン: Timeline_Viewer.html#avatar=on を一度開く ／ オフ: #avatar=off
// フラグが無い端末では、DOM自体を作らない（完全無表示）。
// 前提: settings.js（apsLoadSettings / apsGasGetUrl / apsGasPostBody / apsIsUnauthorized）が読み込み済みであること。
// v1.1 (2026-11-03): 対話パネルをiOS風ガラス（すりガラス）表現に。返事入力にマイク音声入力を追加
//   （Chat.html の toggleRecording と同じ Web Speech API 方式。体験フロー・文案は v1 のまま）。
// v1.2 (2026-11-03): 「この対話を保存」ボタンを追加（オーナー決定：A案）。
//   保存は Chat.html の save プロトコルをそのまま流用し、チャット保存として残す。
//   Reflection_Log には書かない（「この日を振り返る」＝稽古の記録との役割分担を維持するため）。
(function () {
  const FLAG_KEY = 'aps_avatar_enabled';

  // ── フラグ判定（reflection_stage の REFLECT_ON と同じ書き方） ──
  let AVATAR_ON = false;
  try {
    const m = location.hash.match(/avatar=(on|off)/);
    if (m) {
      if (m[1] === 'on') localStorage.setItem(FLAG_KEY, '1');
      else localStorage.removeItem(FLAG_KEY);
      history.replaceState(null, '', location.pathname + location.search);
    }
    AVATAR_ON = localStorage.getItem(FLAG_KEY) === '1';
  } catch (err) { AVATAR_ON = false; }
  window.addEventListener('hashchange', () => {
    if (/avatar=(on|off)/.test(location.hash)) location.reload();
  });
  if (!AVATAR_ON) { window.ApsAvatar = { enabled: false }; return; }
  if (typeof apsLoadSettings !== 'function') return;

  // ── 小物 ──
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function settings() { try { return apsLoadSettings(); } catch (e) { return {}; } }
  function aiName() { return settings().aiName || 'Titan'; }
  function userName() { return settings().userName || 'Rikki'; }

  // 記録の中の「」から、本人の言葉らしいものを1つ選ぶ（reflection_stage.js の pickQuote と同じ流儀。
  // keystone を優先し、スコアが低い日は summary の最後の引用＝文末に残った重い言葉を選ぶ）
  function pickQuote(e) {
    const grab = t => [...String(t || '').matchAll(/「([^「」]{4,60})」/g)].map(x => x[1]);
    const fromKeystone = grab(e.keystone);
    if (fromKeystone.length) return fromKeystone[0];
    const fromSummary = grab(e.summary);
    if (!fromSummary.length) return null;
    return (e.score && e.score < 350) ? fromSummary[fromSummary.length - 1] : fromSummary[0];
  }

  function wasReflected(e) {
    try { return !!(window.ApsReflection && ApsReflection.wasReflected(e)); } catch (err) { return false; }
  }
  function dateOf(e) { const d = new Date(e.date); return isNaN(d) ? null : d; }

  // 候補リストを作る。優先順位: 直近の重い言葉 → 繰り返される言葉 → 直近の言葉 → 最新の記録。
  // まだ振り返っていない日を先に並べ、出会いの重複を避ける。
  function buildCandidates(entries) {
    const dailies = entries.filter(e => e && e.level === 'Daily' && (e.summary || e.keystone));
    if (!dailies.length) return [];
    const byNew = arr => [...arr].sort((a, b) => (dateOf(b) || 0) - (dateOf(a) || 0));
    const fresh = arr => [...arr.filter(e => !wasReflected(e)), ...arr.filter(e => wasReflected(e))];
    const out = [];
    const push = (entry, kind, extra) => {
      if (entry && !out.some(o => o.entry === entry)) out.push(Object.assign({ entry, kind }, extra || {}));
    };
    // 1) 直近30日・スコア<350・引用あり
    const since = Date.now() - 30 * 86400000;
    const heavy = dailies.filter(e => e.score && e.score < 350 && pickQuote(e) && dateOf(e) && dateOf(e).getTime() >= since);
    fresh(byNew(heavy)).forEach(e => push(e, 'heavy'));
    // 2) キーワードが3件以上に繰り返される
    const counts = {};
    dailies.forEach(e => String(e.keywords || '').split(/[,\s　]+/).filter(Boolean)
      .forEach(k => { counts[k] = (counts[k] || 0) + 1; }));
    const hot = Object.keys(counts).filter(k => counts[k] >= 3).sort((a, b) => counts[b] - counts[a]);
    hot.forEach(kw => {
      const withKw = dailies.filter(e => String(e.keywords || '').includes(kw) && pickQuote(e));
      fresh(byNew(withKw)).slice(0, 2).forEach(e => push(e, 'repeat', { keyword: kw, count: counts[kw] }));
    });
    // 3) 引用が取れる直近の Daily
    fresh(byNew(dailies.filter(e => pickQuote(e)))).slice(0, 3).forEach(e => push(e, 'recent'));
    // 4) 最新の Daily（引用なしでも記録として）
    byNew(dailies).slice(0, 1).forEach(e => push(e, 'fallback'));
    return out;
  }

  // 第一声を組み立てる。本人の言葉を、そのまま引用する。解釈は言わない。
  function openingFor(cand) {
    const e = cand.entry;
    const q = pickQuote(e);
    const dateLabel = e.date || '';
    let lead;
    if (cand.kind === 'heavy' || cand.kind === 'recent') {
      lead = `${dateLabel}のあなたは、こう書いていました。`;
    } else if (cand.kind === 'repeat') {
      lead = `このところ、「${cand.keyword}」という言葉が、あなたの記録に${cand.count}回出てきました。いちばん最近は${dateLabel}。あなたはこう書いていました。`;
    } else {
      lead = `${dateLabel}の、あなたの記録です。`;
    }
    const quote = q || String(e.summary || '').split(/(?<=[。！？])/)[0] || '';
    let ask;
    if (cand.kind === 'repeat') ask = `その「${cand.keyword}」は、今のあなたにはどう見えますか。`;
    else if (cand.kind === 'heavy') ask = 'あの日のあなたに、今のあなたなら何と返しますか。';
    else ask = '今読み返すと、どう響きますか。';
    return { lead, quote, ask, entry: e };
  }

  // ── データ取得：ホスト（Timeline Viewer）の取得済みを優先し、無ければ自分で取る ──
  let entriesCache = null;
  function hostEntries() {
    try {
      if (entriesCache && entriesCache.length) return entriesCache;
      // Timeline_Viewer.html の allEntries（同一グローバルスコープの let）を参照する
      if (typeof allEntries !== 'undefined' && Array.isArray(allEntries) && allEntries.length) return allEntries;
    } catch (err) { /* 未初期化の間は null */ }
    return null;
  }
  async function loadEntries() {
    const host = hostEntries();
    if (host) return host;
    const s = settings();
    if (!s.gasUrl) return [];
    try {
      const res = await fetch(apsGasGetUrl('page=timeline_data'));
      const data = await res.json();
      if (apsIsUnauthorized(data) || !Array.isArray(data)) return [];
      entriesCache = data;
      return data;
    } catch (err) { return []; }
  }

  // ── 見た目 ──
  function injectStyle() {
    if (document.getElementById('aps-avatar-style')) return;
    const st = document.createElement('style');
    st.id = 'aps-avatar-style';
    st.textContent = `
.aps-av{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:900;
  width:56px;height:56px;border-radius:50%;border:1.5px solid rgba(245,158,11,.85);cursor:pointer;padding:0;
  background:radial-gradient(circle at 32% 28%,rgba(245,158,11,.20),rgba(15,23,42,.92) 62%);
  color:#ffd97a;font-weight:700;letter-spacing:.02em;display:grid;place-items:center;
  box-shadow:0 0 18px rgba(245,158,11,.35),0 6px 18px rgba(0,0,0,.5);
  -webkit-tap-highlight-color:transparent;font-family:'Segoe UI',system-ui,sans-serif}
.aps-av:focus-visible{outline:2px solid #f59e0b;outline-offset:3px}
@media (prefers-reduced-motion:no-preference){
  .aps-av{animation:apsAvDrift 7s ease-in-out infinite,apsAvGlow 7s ease-in-out infinite}
}
@keyframes apsAvDrift{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes apsAvGlow{0%,100%{box-shadow:0 0 12px rgba(245,158,11,.25),0 6px 18px rgba(0,0,0,.5)}50%{box-shadow:0 0 24px rgba(245,158,11,.5),0 6px 18px rgba(0,0,0,.5)}}
.aps-av-panel{position:fixed;inset:0;z-index:950;display:flex;align-items:flex-end;justify-content:center;background:rgba(2,8,23,.55);
  font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0}
.aps-av-sheet{background:#0f172a;border:1px solid #334155;border-bottom:0;border-radius:24px 24px 0 0;width:100%;max-width:560px;
  max-height:82vh;display:flex;flex-direction:column;padding:10px 18px calc(14px + env(safe-area-inset-bottom,0px));
  box-shadow:0 -12px 40px rgba(0,0,0,.55)}
@media (min-width:640px){.aps-av-panel{justify-content:flex-end;padding-right:24px}.aps-av-sheet{border-radius:24px;border-bottom:1px solid #334155;margin-bottom:24px}}
.aps-av-head{display:flex;align-items:center;gap:10px;padding:6px 0 10px;border-bottom:1px solid rgba(51,65,85,.6)}
.aps-av-dot{width:30px;height:30px;border-radius:50%;border:1.5px solid rgba(245,158,11,.85);color:#ffd97a;display:grid;place-items:center;font-weight:700;flex:0 0 auto;
  background:radial-gradient(circle at 32% 28%,rgba(245,158,11,.20),rgba(15,23,42,.92) 62%)}
.aps-av-title{font-size:13px;color:#e2e8f0;font-weight:700}
.aps-av-sub{font-size:11px;color:#64748b}
.aps-av-x{margin-left:auto;background:none;border:0;color:#94a3b8;font-size:22px;cursor:pointer;line-height:1;padding:4px}
.aps-av-msgs{overflow-y:auto;padding:14px 2px;display:flex;flex-direction:column;gap:12px;min-height:120px}
.aps-av-msg{max-width:88%;font-size:14px;line-height:1.75;padding:10px 14px;border-radius:14px;white-space:pre-wrap;word-break:break-word}
.aps-av-msg.ai{align-self:flex-start;background:rgba(30,41,59,.9);border:1px solid rgba(51,65,85,.7);border-bottom-left-radius:4px}
.aps-av-msg.user{align-self:flex-end;background:rgba(245,158,11,.16);border:1px solid rgba(245,158,11,.35);border-bottom-right-radius:4px}
.aps-av-msg.sys{align-self:center;background:none;border:0;color:#94a3b8;font-size:12px;text-align:center}
.aps-av-quote{font-family:'Shippori Mincho','Hiragino Mincho ProN','Yu Mincho',serif;font-size:16px;line-height:1.9;color:#f1e9d2;
  border-left:2px solid #f59e0b;padding:2px 0 2px 12px;margin:8px 0 2px}
.aps-av-choices{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:2px 0 6px}
.aps-av-pill{border:1px solid #f59e0b;background:#f59e0b;color:#0a0f1e;font-weight:700;border-radius:999px;padding:9px 20px;font-size:13px;cursor:pointer}
.aps-av-link{background:none;border:0;color:#94a3b8;font-size:12px;text-decoration:underline;cursor:pointer;padding:4px}
.aps-av-input{display:flex;gap:8px;border-top:1px solid rgba(51,65,85,.6);padding-top:12px}
.aps-av-input textarea{flex:1;resize:none;background:#1e293b;border:1px solid #334155;border-radius:10px;color:#e2e8f0;
  font:inherit;font-size:14px;padding:10px 12px;max-height:96px;outline:none}
.aps-av-input textarea:focus{border-color:#f59e0b}
.aps-av-send{background:#f59e0b;border:0;color:#0a0f1e;font-weight:700;border-radius:10px;padding:0 18px;font-size:13px;cursor:pointer}
.aps-av-send[disabled]{opacity:.5;cursor:default}
.aps-av-note{font-size:11px;color:#64748b;line-height:1.7;padding-top:8px}
.aps-av-saverow{display:none;align-items:center;gap:10px;padding-top:10px}
.aps-av-saverow.show{display:flex}
.aps-av-save{border:1px solid rgba(245,158,11,.55);background:rgba(245,158,11,.08);color:#ffd97a;border-radius:999px;
  padding:7px 18px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
.aps-av-save[disabled]{opacity:.45;cursor:default}
.aps-av-savestate{font-size:11px;color:#94a3b8}
.aps-av-mic{flex:0 0 auto;width:42px;height:42px;border-radius:50%;background:#1e293b;border:1px solid #334155;color:#f59e0b;
  cursor:pointer;display:grid;place-items:center;padding:0;-webkit-tap-highlight-color:transparent}
.aps-av-mic .material-icons{font-size:20px;line-height:1}
.aps-av-mic.recording{background:rgba(239,68,68,.85);color:#fff;border-color:transparent;animation:apsAvPulseRed 1.4s infinite}
.aps-av-mic.disabled-mic{opacity:.3;cursor:not-allowed}
@keyframes apsAvPulseRed{0%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}70%{box-shadow:0 0 0 12px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
@supports ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .aps-av-panel{background:rgba(2,8,23,.32);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
  .aps-av-sheet{background:rgba(148,178,255,.13);-webkit-backdrop-filter:blur(24px) saturate(170%);backdrop-filter:blur(24px) saturate(170%);
    border-color:rgba(255,255,255,.22);box-shadow:0 -12px 44px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.18)}
  .aps-av-head{border-bottom-color:rgba(255,255,255,.14)}
  .aps-av-input{border-top-color:rgba(255,255,255,.14)}
  .aps-av-msg.ai{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.14)}
  .aps-av-msg.user{background:rgba(245,158,11,.20);border-color:rgba(245,158,11,.40)}
  .aps-av-input textarea{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18)}
  .aps-av-input textarea:focus{border-color:#f59e0b}
  .aps-av-mic{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18)}
  .aps-av-mic.recording{background:rgba(239,68,68,.85);border-color:transparent}
  .aps-av-save{background:rgba(255,255,255,.08);border-color:rgba(245,158,11,.45)}
  .aps-av{background:radial-gradient(circle at 32% 28%,rgba(245,158,11,.28),rgba(21,32,58,.55) 62%);
    -webkit-backdrop-filter:blur(10px) saturate(160%);backdrop-filter:blur(10px) saturate(160%)}
  .aps-av-dot{background:radial-gradient(circle at 32% 28%,rgba(245,158,11,.28),rgba(21,32,58,.55) 62%);
    -webkit-backdrop-filter:blur(8px) saturate(160%);backdrop-filter:blur(8px) saturate(160%)}
}`;
    document.head.appendChild(st);
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&display=swap';
    document.head.appendChild(font);
  }

  // ── 状態 ──
  const state = {
    open: false, candidates: [], candIdx: 0, started: false, history: '', recallUsed: false, busy: false,
    // 保存（A案）用：ctx=文脈ヘッダの材料、turns=完了した往復数、savedTurns/savedLen=保存済みの境界、saving=送信中
    ctx: null, turns: 0, savedTurns: 0, savedLen: 0, saving: false,
  };
  let circleEl = null, panelEl = null;

  function nameFontSize(name) {
    const n = [...String(name)].length;
    return n <= 2 ? '15px' : n <= 4 ? '12px' : '10px';
  }

  function buildCircle() {
    injectStyle();
    circleEl = document.createElement('button');
    circleEl.type = 'button';
    circleEl.className = 'aps-av';
    circleEl.style.fontSize = nameFontSize(aiName());
    circleEl.textContent = aiName();
    circleEl.setAttribute('aria-label', `${aiName()}と、過去の言葉を振り返る`);
    circleEl.addEventListener('click', openPanel);
    document.body.appendChild(circleEl);
  }

  function msgEl(kind, html) {
    const d = document.createElement('div');
    d.className = 'aps-av-msg ' + kind;
    d.innerHTML = html;
    return d;
  }
  function addMsg(kind, html) {
    const box = panelEl.querySelector('.aps-av-msgs');
    const el = msgEl(kind, html);
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    return el;
  }

  function renderOpening() {
    const box = panelEl.querySelector('.aps-av-msgs');
    box.innerHTML = '';
    const choices = panelEl.querySelector('.aps-av-choices');
    choices.innerHTML = '';
    state.started = false;
    const cand = state.candidates[state.candIdx];
    if (!cand) {
      addMsg('ai', settings().gasUrl
        ? '記録が貯まってきたら、ここで過去のあなたの言葉に会えます。'
        : 'スプレッドシートと連携すると、ここで過去のあなたの言葉を一緒に見直せます。');
      return;
    }
    const o = openingFor(cand);
    const html = `${esc(o.lead)}<div class="aps-av-quote">${esc(o.quote)}</div>${esc(o.ask)}`;
    addMsg('ai', html);
    state.history = `[${aiName()}]: ${o.lead}「${o.quote}」${o.ask}\n`;
    // 新しい出会いごとに保存状態も仕切り直す（前回分の二重保存を防ぐ）
    state.ctx = { date: cand.entry.date || '', quote: o.quote, ask: o.ask };
    state.turns = 0; state.savedTurns = 0; state.savedLen = 0; state.saving = false;
    refreshSaveBtn();
    // 招きの選択肢（常時見える場所に、断る自由と一緒に）
    const start = document.createElement('button');
    start.type = 'button'; start.className = 'aps-av-pill'; start.textContent = '言葉を返してみる';
    start.addEventListener('click', () => {
      state.started = true;
      choices.innerHTML = '';
      const ta = panelEl.querySelector('textarea');
      if (ta) ta.focus();
    });
    choices.appendChild(start);
    const later = document.createElement('button');
    later.type = 'button'; later.className = 'aps-av-link'; later.textContent = '今日はここまで';
    later.addEventListener('click', closePanel);
    choices.appendChild(later);
    if (state.candidates.length > 1) {
      const other = document.createElement('button');
      other.type = 'button'; other.className = 'aps-av-link'; other.textContent = 'ほかの言葉も見る';
      other.addEventListener('click', () => {
        state.candIdx = (state.candIdx + 1) % state.candidates.length;
        renderOpening();
      });
      choices.appendChild(other);
    }
  }

  // ── 保存ボタン（A案：Chat.html と同じ save プロトコルで、チャット保存として残す） ──
  function saveRow() { return panelEl ? panelEl.querySelector('.aps-av-saverow') : null; }
  function saveBtn() { return panelEl ? panelEl.querySelector('.aps-av-save') : null; }
  function saveStateEl() { return panelEl ? panelEl.querySelector('.aps-av-savestate') : null; }

  // 状態遷移：往復ゼロ→行ごと隠す／未保存の往復あり→押せる／保存中→無効／全部保存済み→「保存済み」で無効
  function refreshSaveBtn() {
    const row = saveRow(), btn = saveBtn(), st = saveStateEl();
    if (!row || !btn) return;
    if (state.turns === 0) { row.classList.remove('show'); return; }
    row.classList.add('show');
    if (state.saving) {
      btn.disabled = true; btn.textContent = '保存しています…';
      if (st) st.textContent = '';
    } else if (state.turns > state.savedTurns) {
      btn.disabled = !!state.busy;
      btn.textContent = state.savedTurns === 0 ? 'この対話を保存' : '続きを保存';
      if (st) st.textContent = '';
    } else {
      btn.disabled = true; btn.textContent = '保存済み';
      if (st) st.textContent = 'いつものチャットの記録に残っています';
    }
  }

  // 保存内容：先頭に文脈（いつの記録か／引用した本人の言葉／最初の問い）を付け、
  // 続けて未保存分の対話全文を、チャットと同じ [話者]: 形式で並べる。
  function buildSaveText() {
    const ctx = state.ctx || {};
    const head = [
      '【浮遊アバターでの対話】',
      '対象の記録：' + (ctx.date || ''),
      'あの日の言葉：「' + (ctx.quote || '') + '」',
      '最初の問い：' + (ctx.ask || ''),
      '───',
      '',
    ].join('\n');
    return head + state.history.slice(state.savedLen);
  }

  async function onSaveConversation() {
    if (state.saving || state.turns <= state.savedTurns) return;
    const s = settings();
    if (!s.gasUrl) {
      // 未連携では保存できない。成功したふりはしない。
      addMsg('sys', '保存にはいつもの連携（スプレッドシート連携）が必要です。連携した状態で、もう一度お試しください。');
      return;
    }
    state.saving = true;
    refreshSaveBtn();
    const snapshotLen = state.history.length;
    try {
      // Chat.html の saveConversationLog と同一の送信方法・ペイロード
      const res = await fetch(s.gasUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: apsGasPostBody({ type: 'save', fullText: buildSaveText(), aiName: aiName() }),
      });
      const data = await res.json();
      if (apsIsUnauthorized(data)) {
        addMsg('sys', APS_UNAUTHORIZED_MESSAGE);
      } else if (data && data.status === 'success') {
        state.savedLen = snapshotLen;
        state.savedTurns = state.turns;
        addMsg('sys', '保存しました');
        if (data.oracle) addMsg('ai', esc(data.oracle));
      } else {
        addMsg('sys', '保存に失敗しました：' + (data && data.message ? data.message : '不明なエラー'));
      }
    } catch (err) {
      addMsg('sys', '通信エラーが発生しました。接続を確認してください。');
    } finally {
      state.saving = false;
      refreshSaveBtn();
    }
  }

  async function openPanel() {
    if (state.open) return;
    state.open = true;
    injectStyle();
    panelEl = document.createElement('div');
    panelEl.className = 'aps-av-panel';
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', `${aiName()}との振り返り`);
    const name = aiName();
    panelEl.innerHTML = `
      <div class="aps-av-sheet">
        <div class="aps-av-head">
          <div class="aps-av-dot" style="font-size:${nameFontSize(name)}">${esc(name)}</div>
          <div><div class="aps-av-title">${esc(name)}</div><div class="aps-av-sub">過去のあなたの言葉から</div></div>
          <button type="button" class="aps-av-x" aria-label="閉じる">×</button>
        </div>
        <div class="aps-av-msgs"></div>
        <div class="aps-av-choices"></div>
        <div class="aps-av-input">
          <button type="button" class="aps-av-mic" aria-label="音声で入力"><span class="material-icons">mic</span></button>
          <textarea rows="2" placeholder="あの日の自分へ、言葉を返す" aria-label="返事を書く"></textarea>
          <button type="button" class="aps-av-send">送る</button>
        </div>
        <div class="aps-av-saverow">
          <button type="button" class="aps-av-save">この対話を保存</button>
          <span class="aps-av-savestate"></span>
        </div>
        <div class="aps-av-note">ここでの対話は、あなたの記録をもとに${esc(name)}が応えます。送信した内容は、いつものチャットと同じように扱われます。</div>
      </div>`;
    document.body.appendChild(panelEl);
    panelEl.querySelector('.aps-av-x').addEventListener('click', closePanel);
    panelEl.addEventListener('click', e => { if (e.target === panelEl) closePanel(); });
    panelEl.querySelector('.aps-av-send').addEventListener('click', onSend);
    panelEl.querySelector('.aps-av-save').addEventListener('click', onSaveConversation);
    panelEl.querySelector('.aps-av-mic').addEventListener('click', toggleAvatarRecording);
    setupAvatarMic();
    panelEl.querySelector('textarea').addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSend();
    });
    addMsg('sys', '読み込んでいます…');
    const entries = await loadEntries();
    state.candidates = buildCandidates(entries);
    state.candIdx = 0;
    if (state.open) renderOpening();
  }

  function closePanel() {
    stopAvatarRecording();
    state.open = false;
    if (panelEl) { panelEl.remove(); panelEl = null; }
  }

  // 既存チャット（Chat.html の handleSend）と同じ ai_chat プロトコルで送る
  async function onSend() {
    if (state.busy) return;
    stopAvatarRecording();
    const ta = panelEl.querySelector('textarea');
    const text = ta.value.trim();
    if (!text) return;
    const s = settings();
    if (!s.gasUrl) {
      addMsg('sys', 'まだスプレッドシートと連携されていないため、ここでは対話できません。連携すると、ここで' + aiName() + 'と対話できます。');
      return;
    }
    state.started = true;
    panelEl.querySelector('.aps-av-choices').innerHTML = '';
    ta.value = '';
    addMsg('user', esc(text));
    state.history += `[${userName()}]: ${text}\n`;
    state.busy = true;
    const sendBtn = panelEl.querySelector('.aps-av-send');
    sendBtn.disabled = true;
    const typing = addMsg('ai', '…');
    try {
      const res = await fetch(s.gasUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: apsGasPostBody({
          type: 'ai_chat',
          fullText: text,
          history: state.history,
          userName: userName(),
          aiName: aiName(),
          recallUsed: state.recallUsed,
        }),
      });
      const data = await res.json();
      typing.remove();
      if (apsIsUnauthorized(data)) { addMsg('sys', APS_UNAUTHORIZED_MESSAGE); return; }
      const reply = (data && data.reply) ? data.reply : '（返答を受信できませんでした）';
      if (data && data.recalled) state.recallUsed = true;
      addMsg('ai', esc(reply));
      state.history += `[${aiName()}]: ${reply}\n`;
      state.turns += 1; // 1往復が完了したので、保存できるようになる
    } catch (err) {
      typing.remove();
      addMsg('sys', '通信エラーが発生しました。接続を確認してください。');
    } finally {
      state.busy = false;
      if (sendBtn) sendBtn.disabled = false;
      refreshSaveBtn();
    }
  }

  // ── 音声入力（Chat.html の音声入力と同じ流儀：Web Speech API、ja-JP、確定結果だけを入力欄へ追記。
  //    「送信」と言うとそのまま送る／無音が続くと改行する、もチャット側に合わせた） ──
  const AvatarSpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  let avatarRec = null, avatarRecording = false, avatarSilenceTimer = null;
  const AVATAR_SILENCE_DELAY = 800;
  function micBtn() { return panelEl ? panelEl.querySelector('.aps-av-mic') : null; }
  function panelTextarea() { return panelEl ? panelEl.querySelector('textarea') : null; }

  function setupAvatarMic() {
    const btn = micBtn();
    if (!btn) return;
    if (!AvatarSpeechAPI) {
      btn.classList.add('disabled-mic');
      btn.title = 'このブラウザは音声入力に対応していません';
      return;
    }
    if (avatarRec) return;
    avatarRec = new AvatarSpeechAPI();
    avatarRec.lang = 'ja-JP';
    avatarRec.continuous = true;
    avatarRec.interimResults = false;
    avatarRec.onstart = () => {
      avatarRecording = true;
      const b = micBtn(); if (b) b.classList.add('recording');
      const ta = panelTextarea(); if (ta) ta.placeholder = '音声認識中…';
    };
    avatarRec.onend = () => {
      avatarRecording = false;
      const b = micBtn(); if (b) b.classList.remove('recording');
      const ta = panelTextarea(); if (ta) ta.placeholder = 'あの日の自分へ、言葉を返す';
      clearTimeout(avatarSilenceTimer);
    };
    avatarRec.onresult = (e) => {
      const ta = panelTextarea();
      if (!ta) return;
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; ++i)
        if (e.results[i].isFinal) transcript += e.results[i][0].transcript;
      if (!transcript) return;
      clearTimeout(avatarSilenceTimer);
      const keyword = transcript.trim().replace(/[。、！!？?\s…　]+$/, '');
      if (keyword === '送信') { stopAvatarRecording(); onSend(); return; }
      ta.value += transcript;
      avatarSilenceTimer = setTimeout(() => {
        if (avatarRecording && ta.value && !ta.value.endsWith('\n')) ta.value += '\n';
      }, AVATAR_SILENCE_DELAY);
    };
    avatarRec.onerror = (e) => { if (state.open) addMsg('sys', 'マイクエラー: ' + e.error); };
  }

  function stopAvatarRecording() {
    if (avatarRec && avatarRecording) { try { avatarRec.stop(); } catch (err) { /* 既に止まっている */ } }
  }

  function toggleAvatarRecording() {
    if (!AvatarSpeechAPI || !avatarRec) { addMsg('sys', 'このブラウザは音声入力に対応していません'); return; }
    if (avatarRecording) stopAvatarRecording();
    else { try { avatarRec.start(); } catch (err) { /* 二重起動の防止 */ } }
  }

  function boot() {
    if (document.body) buildCircle();
    else document.addEventListener('DOMContentLoaded', buildCircle);
  }
  boot();

  window.ApsAvatar = {
    enabled: true,
    setEntries(list) { if (Array.isArray(list)) entriesCache = list; },
  };
})();
