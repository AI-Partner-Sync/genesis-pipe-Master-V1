// 浮遊AIアバター（試作 / prototype）
// 理念：「過去の自分が最高の味方だった」という気づきが、自らを信じる力になる。
// この部品の仕事は1つだけ：過去の自分の言葉を1件差し出し、今の自分が返事をする対話の入口を作る。
// 表示は端末ごとのフラグ制。有効化キーは振り返り機能と共通（aps_reflection_enabled）。
//   オン・オフは設定画面（index.html）の振り返りトグル1つで両方を切り替える（v1.5〜、オーナー決定）。
//   Timeline_Viewer.html#avatar=on / #avatar=off も、同じキーに書き込む経路として残す。
// フラグが無い端末では、DOM自体を作らない（完全無表示）。
// 前提: settings.js（apsLoadSettings / apsGasGetUrl / apsGasPostBody / apsIsUnauthorized）が読み込み済みであること。
// v1.1 (2026-11-03): 対話パネルをiOS風ガラス（すりガラス）表現に。返事入力にマイク音声入力を追加
//   （Chat.html の toggleRecording と同じ Web Speech API 方式。体験フロー・文案は v1 のまま）。
// v1.2 (2026-11-03): 「この対話を保存」ボタンを追加（オーナー決定：A案）。
//   保存は Chat.html の save プロトコルをそのまま流用し、チャット保存として残す。
//   Reflection_Log には書かない（「この日を振り返る」＝稽古の記録との役割分担を維持するため）。
// v1.3 (2026-11-03): 開くたびの出会いを新しく保ち、相棒の存在を静かに主張する。
//   候補は上位プール（最大10件）から重み付き抽選（heavy/repeat を当たりやすく、振り返り済みは当たりにくく、
//   直前に見せた記録は次の抽選から外す）。第一声には「文脈の一文」（本人の記録の事実のみ）を引用と問いの間に足し、
//   問いの言い回しを種類ごとに複数用意して抽選する。データ読み込み完了時、その日はじめての1回だけ、
//   パネルがふわっと自動で開く（閉じたらその日は二度と勝手に開かない。候補が無い静かな日は開かない）。
//   AI名は円いっぱいに大きく（長い名前は二行）、サークルは名前の長さで最大68pxまで広げる。
// v1.4 (2026-11-03): 選出の主軸を「感情の動き」に変える（オーナー実機フィードバック：差し出される記録が思い出せない）。
//   感情ピーク（頂点＝score>=500／谷＝score<350、既存コードのスコア帯に準拠）を主軸候補にし、
//   最後に差し出した極性を端末に覚えて、次回は反対の極性を当たりやすくする（ネガとポジの交互）。
//   第一声には、その日の感情を本人の記録のラベルそのままで事実として添える。
// v1.5 (2026-11-03): 有効化方式を振り返り機能と統合（オーナー決定）。
//   専用キー aps_avatar_enabled は廃止し、振り返りキー aps_reflection_enabled を正とする。
//   設定画面の振り返りトグル1つで「この日を振り返る」と浮遊アバターの両方が切り替わる。
//   #avatar=on/off のハッシュ経路も同じキーへ収束させる（旧案内・旧プレビューリンクの互換）。
// v1.6 (2026-11-04): 対話シート（テキストのウィンドウ）だけを不透過に変更（オーナー実機フィードバック：透けた背景で文字が読みにくい）。
//   背景のぼかし（パネル全体）と浮遊ボタンのガラス表現はそのまま維持し、シートの背景だけを単色に固定して可読性を確保する。
// v1.7 (2026-11-05): 二層構造に変更（オーナー実機フィードバック：不透過はテキストの枠だけでよい）。
//   シート全体（後ろの枠）は v1.5 のすりガラスに戻し、テキストが載るメッセージ欄（.aps-av-msgs）だけを不透過の内窓として固定する。
(function () {
  const FLAG_KEY = 'aps_reflection_enabled'; // 振り返り機能と共通の有効化キー（v1.5で統合）
  const AUTO_OPEN_KEY = 'aps_avatar_auto_open_date'; // 1日1回だけ自動で開くための実施日
  const POLARITY_KEY = 'aps_avatar_last_polarity'; // 最後に差し出した候補の極性（'pos'/'neg'。交互ルール用）
  const POOL_MAX = 10; // 抽選プールの上限（候補リストの上位から）

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

  // ── 感情の極性（v1.4） ──
  // 閾値は新しく作らず、既存コードのスコア帯に寄せる：
  //   頂点（pos）= score >= 500 … Timeline の感情ピル最上位帯／アークの色分け／reflection の技法プール最上位と同じ境界。
  //   谷（neg）  = score < 350  … pickQuote が「スコアが低い日」に使う境界であり、v1 の heavy の定義そのもの。
  //              スコアで決まらない日は、reflection が「重みのある日」の印に使う heaviness === 'heavy' も谷とみなす。
  //   中立（neu）= 350〜499、または判定材料が無い日。交互の流れには関与しない。
  function polarityOf(e) {
    if (!e) return 'neu';
    const s = e.score;
    if (s && s >= 500) return 'pos';
    if (s && s < 350) return 'neg';
    if (e.heaviness === 'heavy') return 'neg';
    return 'neu';
  }
  // 最後に差し出した極性を端末に覚える（セッションをまたいで交互を続けるため）。
  function lastPolarity() {
    try {
      const v = localStorage.getItem(POLARITY_KEY);
      return (v === 'pos' || v === 'neg') ? v : null;
    } catch (err) { return null; }
  }
  function rememberPolarity(p) {
    if (p !== 'pos' && p !== 'neg') return; // 中立は流れを壊さない（覚えない）
    try { localStorage.setItem(POLARITY_KEY, p); } catch (err) { /* 覚えられなくても出会いは成立させる */ }
  }

  // 候補リストを作る。主軸は「感情ピーク」（頂点と谷の両極）、補助に繰り返される言葉 → 直近の言葉 → 最新の記録。
  // すべての候補に、その日の極性（polarityOf）を持たせる（交互ルールと抽選の重み付けに使う）。
  function buildCandidates(entries) {
    const dailies = entries.filter(e => e && e.level === 'Daily' && (e.summary || e.keystone));
    if (!dailies.length) return [];
    const byNew = arr => [...arr].sort((a, b) => (dateOf(b) || 0) - (dateOf(a) || 0));
    const fresh = arr => [...arr.filter(e => !wasReflected(e)), ...arr.filter(e => wasReflected(e))];
    const out = [];
    const push = (entry, kind, extra) => {
      if (entry && !out.some(o => o.entry === entry))
        out.push(Object.assign({ entry, kind, polarity: polarityOf(entry) }, extra || {}));
    };
    // 1) 感情ピーク（v1.4 の主軸）：引用が取れる Daily のうち、感情が大きく動いた日。
    //    谷はスコアの低い順（いちばん深い谷から）、頂点は高い順（いちばん高い頂点から）に並べ、
    //    両極を交互に並べる（プールの上限で片方の極性だけが残る事故を防ぐ）。
    //    並びの先頭は、前回と反対の極性から（交互の流れをプールの形からも作る）。
    //    v1 の heavy（直近30日・score<350）は、谷側としてこのピークに統合した（期限は設けない。
    //    感情が動いた日は、古くても「思い出せる日」であり、出会いの材料として鮮度より深さを取る）。
    const peaksPos = [], peaksNeg = [];
    dailies.filter(e => pickQuote(e)).forEach(e => {
      const p = polarityOf(e);
      if (p === 'pos') peaksPos.push(e);
      else if (p === 'neg') peaksNeg.push(e);
    });
    peaksPos.sort((a, b) => ((b.score || 0) - (a.score || 0)) || ((dateOf(b) || 0) - (dateOf(a) || 0)));
    peaksNeg.sort((a, b) => ((a.score || 999) - (b.score || 999)) || ((dateOf(b) || 0) - (dateOf(a) || 0)));
    const startNeg = lastPolarity() !== 'neg'; // 前回が谷なら頂点から、それ以外は谷から
    const sideA = startNeg ? peaksNeg : peaksPos;
    const sideB = startNeg ? peaksPos : peaksNeg;
    let peakCount = 0;
    for (let i = 0; peakCount < 8 && (i < sideA.length || i < sideB.length); i++) {
      if (i < sideA.length) { push(sideA[i], 'peak'); peakCount++; }
      if (peakCount >= 8) break;
      if (i < sideB.length) { push(sideB[i], 'peak'); peakCount++; }
    }
    // 2) キーワードが3件以上に繰り返される（補助）
    const counts = {};
    dailies.forEach(e => String(e.keywords || '').split(/[,\s　]+/).filter(Boolean)
      .forEach(k => { counts[k] = (counts[k] || 0) + 1; }));
    const hot = Object.keys(counts).filter(k => counts[k] >= 3).sort((a, b) => counts[b] - counts[a]);
    hot.forEach(kw => {
      const withKw = dailies.filter(e => String(e.keywords || '').includes(kw) && pickQuote(e));
      fresh(byNew(withKw)).slice(0, 2).forEach(e => push(e, 'repeat', { keyword: kw, count: counts[kw] }));
    });
    // 3) 引用が取れる直近の Daily（補助）
    fresh(byNew(dailies.filter(e => pickQuote(e)))).slice(0, 3).forEach(e => push(e, 'recent'));
    // 4) 最新の Daily（引用なしでも記録として）
    byNew(dailies).slice(0, 1).forEach(e => push(e, 'fallback'));
    return out;
  }

  // ── 候補の抽選（v1.3 → v1.4） ──
  // 開くたびに同じ顔が出るのをやめ、プールから1件を重み付きで引く。
  // 重み：感情ピーク（peak）を最も当たりやすくし、補助（repeat / recent / fallback）は下げる。
  // すでに「この日を振り返る」を済ませた日は当たりにくくする。
  // 直前に見せた記録は次の抽選から外し、連続して同じ出会いにならないようにする。
  // 交互ルール（v1.4）：最後に差し出した極性と反対の極性の候補は、重みを2倍にして明確に当たりやすくする。
  // 中立の候補は重みを変えず、流れにも関与しない。
  function candWeight(c, lp) {
    let w = c.kind === 'peak' ? 4 : c.kind === 'repeat' ? 2 : c.kind === 'recent' ? 1.2 : 1;
    if (lp && (c.polarity === 'pos' || c.polarity === 'neg') && c.polarity !== lp) w *= 2;
    if (wasReflected(c.entry)) w *= 0.35;
    return w;
  }
  function drawCandidateIdx(list, excludeEntry) {
    if (!list.length) return 0;
    const lp = lastPolarity();
    let pool = list.map((c, i) => i).filter(i => list[i].entry !== excludeEntry);
    if (!pool.length) pool = list.map((c, i) => i);
    const total = pool.reduce((s, i) => s + candWeight(list[i], lp), 0);
    let r = Math.random() * total;
    for (const i of pool) { r -= candWeight(list[i], lp); if (r <= 0) return i; }
    return pool[pool.length - 1];
  }
  // 「ほかの言葉も見る」の巡回：いま表示している記録は飛ばし、
  // 前回と反対の極性の候補を先に回す（交互の流れを巡回でも保つ）。無ければ従来どおり次の記録へ。
  function nextCandidateIdx() {
    const list = state.candidates;
    if (list.length <= 1) return state.candIdx;
    const cur = list[state.candIdx];
    const lp = lastPolarity();
    if (lp) {
      for (let step = 1; step <= list.length; step++) {
        const i = (state.candIdx + step) % list.length;
        if (list[i].entry !== cur.entry && (list[i].polarity === 'pos' || list[i].polarity === 'neg') && list[i].polarity !== lp) return i;
      }
    }
    for (let step = 1; step <= list.length; step++) {
      const i = (state.candIdx + step) % list.length;
      if (list[i].entry !== cur.entry) return i;
    }
    return state.candIdx;
  }

  // ── 文脈の一文（v1.3） ──
  // 引用と問いの間に、その日の事実を一文だけ添える。材料は本人の記録（insight / summary / keystone）のみで、
  // 引用と重なる文は使わない。解釈や励ましは足さない。材料が無ければ null（無理に作らない）。
  function contextFor(e, quote) {
    const sentences = t => String(t || '').split(/(?<=[。！？])/).map(s => s.trim()).filter(Boolean);
    const clean = s => s.replace(/[「」]/g, '').trim();
    const usable = s => {
      const c = clean(s);
      // 引用そのものを含む文は「重なり」として避ける。短すぎる断片も、事実として読めないので避ける。
      return c.length >= 12 && !(quote && c.includes(quote));
    };
    // 1) insight（その日の気づき）の一文
    for (const s of sentences(e.insight)) if (usable(s)) return clean(s);
    // 2) summary の一文（引用を含まないもの）
    for (const s of sentences(e.summary)) if (usable(s)) return clean(s);
    // 3) keystone から引用を除いた残り（書いた日の核が地の文で残っている場合）
    const keyRest = clean(String(e.keystone || '').replace(/「[^「」]*」/g, ''));
    if (keyRest.length >= 12 && !(quote && keyRest.includes(quote))) return keyRest;
    // 4) summary の文から引用符を落とした形（引用そのものではない事実文として読める場合）
    for (const s of sentences(e.summary)) {
      const c = clean(s);
      if (c.length >= 12 && !(quote && c.includes(quote))) return c;
    }
    return null;
  }

  // 問いの言い回し（種類ごとに複数。いずれも「問うだけ・診断しない・招き」の文面に限る）
  // v1.4：感情ピークには、極性ごとに「感情に触れる問い」を用意する。感情名は本人の記録のラベルを
  // そのまま差し込むだけ（相棒が感情を名付けるのではない）。ラベルが無い日は、ラベルに触れない形に落とす。
  const ASKS = {
    peakNeg: [
      em => em ? `あの日、「${em}」の只中にいたあなたに、今のあなたなら何と返しますか。` : 'あの日のあなたに、今のあなたなら何と返しますか。',
      em => em ? `「${em}」を抱えていた日のあなたへ、今ならどんな言葉を届けますか。` : 'あの日のあなたへ、今の言葉で伝えるとしたら、何と言いますか。',
      em => em ? `あの日、その気持ちの中で言えなかったことがあるとしたら、今なら何と言いますか。` : 'あの日、口に出せなかったことがあるとしたら、今なら何と言いますか。',
      em => em ? `その気持ちの只中にいた日のあなたは、今のあなたのどんな言葉を待っていたのでしょう。` : 'あの日のあなたは、今のあなたのどんな言葉を待っていたのでしょう。',
    ],
    peakPos: [
      em => em ? `あの日、「${em}」でいっぱいだったあなたに、今のあなたなら何と伝えますか。` : 'あの日のあなたに、今のあなたなら何と伝えますか。',
      em => em ? `その「${em}」を味わっていた日のあなたへ、今ならどんな言葉を贈りますか。` : 'あの日を生きたあなたへ、今のあなたから一言贈るとしたら、何と言いますか。',
      () => 'あの日の気持ちは、今のあなたのどこに残っていますか。',
      () => 'その日を生きたあなたに、今のあなたなら何と返しますか。',
    ],
    repeat: [
      kw => `その「${kw}」は、今のあなたにはどう見えますか。`,
      kw => `繰り返し現れる「${kw}」は、あなたの中で何を守ってきたのでしょう。`,
      kw => `「${kw}」という言葉に、今のあなたなら何と返しますか。`,
      kw => `その「${kw}」と付き合ってきた時間を、今のあなたはどう眺めますか。`,
    ],
    recent: [
      '今読み返すと、どう響きますか。',
      'この言葉を書いた日のあなたに、今のあなたなら何と伝えますか。',
      '読み返してみて、最初に心に浮かんだのは、どんな言葉ですか。',
      'この言葉は、今のあなたのどこに届きましたか。',
    ],
  };
  const pickAsk = arr => arr[Math.floor(Math.random() * arr.length)];

  // 第一声を組み立てる。本人の言葉を、そのまま引用する。解釈は言わない。
  // v1.4：その日の感情を、本人の記録のラベルそのままで事実として添える（ラベルが無い日は付けない）。
  function openingFor(cand) {
    const e = cand.entry;
    const q = pickQuote(e);
    const dateLabel = e.date || '';
    let lead;
    if (cand.kind === 'peak' || cand.kind === 'recent') {
      lead = `${dateLabel}のあなたは、こう書いていました。`;
    } else if (cand.kind === 'repeat') {
      lead = `このところ、「${cand.keyword}」という言葉が、あなたの記録に${cand.count}回出てきました。いちばん最近は${dateLabel}。あなたはこう書いていました。`;
    } else {
      lead = `${dateLabel}の、あなたの記録です。`;
    }
    const quote = q || String(e.summary || '').split(/(?<=[。！？])/)[0] || '';
    const context = contextFor(e, q);
    const emLabel = String(e.emotion || '').trim();
    const emotion = emLabel ? `その日の感情は「${emLabel}」でした。` : '';
    let ask;
    if (cand.kind === 'repeat') ask = pickAsk(ASKS.repeat)(cand.keyword);
    else if (cand.kind === 'peak' && cand.polarity === 'pos') ask = pickAsk(ASKS.peakPos)(emLabel);
    else if (cand.kind === 'peak') ask = pickAsk(ASKS.peakNeg)(emLabel);
    else ask = pickAsk(ASKS.recent);
    return { lead, quote, context, emotion, ask, entry: e };
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
  box-shadow:0 0 22px rgba(245,158,11,.42),0 0 44px rgba(245,158,11,.16),0 6px 18px rgba(0,0,0,.5);
  -webkit-tap-highlight-color:transparent;font-family:'Segoe UI',system-ui,sans-serif}
.aps-av:focus-visible{outline:2px solid #f59e0b;outline-offset:3px}
@media (prefers-reduced-motion:no-preference){
  .aps-av{animation:apsAvDrift 5s ease-in-out infinite,apsAvGlow 5s ease-in-out infinite}
}
@keyframes apsAvDrift{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes apsAvGlow{0%,100%{box-shadow:0 0 16px rgba(245,158,11,.35),0 0 36px rgba(245,158,11,.12),0 6px 18px rgba(0,0,0,.5);border-color:rgba(245,158,11,.6);filter:brightness(1)}50%{box-shadow:0 0 32px rgba(245,158,11,.7),0 0 64px rgba(245,158,11,.30),0 6px 18px rgba(0,0,0,.5);border-color:rgba(255,208,96,1);filter:brightness(1.1)}}
.aps-av-name{line-height:1.18;text-align:center}
.aps-av-name span{display:block}
@media (prefers-reduced-motion:no-preference){
  .aps-av-panel.aps-av-auto{animation:apsAvFadeIn .6s ease}
  .aps-av-panel.aps-av-auto .aps-av-sheet{animation:apsAvRise .75s cubic-bezier(.22,.8,.3,1)}
}
@keyframes apsAvFadeIn{from{opacity:0}to{opacity:1}}
@keyframes apsAvRise{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
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
.aps-av-msgs{overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:12px;min-height:120px;
  background:#0d1526;border:1px solid rgba(255,255,255,.10);border-radius:16px}
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
    lastEntry: null, // 直前に差し出した記録（次の抽選から外し、連続した同じ出会いを避ける）
    // 保存（A案）用：ctx=文脈ヘッダの材料、turns=完了した往復数、savedTurns/savedLen=保存済みの境界、saving=送信中
    ctx: null, turns: 0, savedTurns: 0, savedLen: 0, saving: false,
  };
  let circleEl = null, panelEl = null;

  function nameFontSize(name) {
    const n = [...String(name)].length;
    return n <= 2 ? '15px' : n <= 4 ? '12px' : '10px';
  }

  // サークルの大きさと名前の組み方（v1.3：名前は円いっぱいに大きく。相棒の存在を静かに主張する）
  // 短い名前ほど大きく1行で、長い名前は自動で二行・中央揃え。サークル径も名前の長さで少しだけ広げる（最大68px）。
  // 名前を切り捨てることはしない（名前は同一性そのもの）。
  function circleMetrics(name) {
    const chars = [...String(name)];
    const n = chars.length;
    if (n <= 2) return { size: 62, font: '25px', lines: [name] };
    if (n <= 4) return { size: 64, font: '19px', lines: [name] };
    if (n <= 6) return { size: 66, font: '15.5px', lines: [name] };
    const mid = Math.ceil(n / 2);
    return { size: 68, font: '13.5px', lines: [chars.slice(0, mid).join(''), chars.slice(mid).join('')] };
  }

  function buildCircle() {
    injectStyle();
    circleEl = document.createElement('button');
    circleEl.type = 'button';
    circleEl.className = 'aps-av';
    const m = circleMetrics(aiName());
    circleEl.style.width = m.size + 'px';
    circleEl.style.height = m.size + 'px';
    circleEl.style.fontSize = m.font;
    const wrap = document.createElement('span');
    wrap.className = 'aps-av-name';
    wrap.innerHTML = m.lines.map(l => `<span>${esc(l)}</span>`).join('');
    circleEl.appendChild(wrap);
    circleEl.setAttribute('aria-label', `${aiName()}と、過去の言葉を振り返る`);
    circleEl.addEventListener('click', () => openPanel(false));
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
    state.lastEntry = cand.entry; // 次に開いた時の抽選から外すため、差し出した記録を覚える
    rememberPolarity(cand.polarity); // 交互ルール：差し出した極性を端末に残す（中立は残さない）
    const contextHtml = o.context ? `<div>${esc(o.context)}</div>` : '';
    const emotionHtml = o.emotion ? `<div>${esc(o.emotion)}</div>` : '';
    const html = `${esc(o.lead)}<div class="aps-av-quote">${esc(o.quote)}</div>${contextHtml}${emotionHtml}${esc(o.ask)}`;
    addMsg('ai', html);
    state.history = `[${aiName()}]: ${o.lead}「${o.quote}」${o.context ? o.context : ''}${o.emotion ? o.emotion : ''}${o.ask}\n`;
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
        state.candIdx = nextCandidateIdx();
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

  async function openPanel(isAuto) {
    if (state.open) return;
    state.open = true;
    injectStyle();
    panelEl = document.createElement('div');
    panelEl.className = 'aps-av-panel' + (isAuto ? ' aps-av-auto' : '');
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
    // 候補は上位プールに絞り、開くたびに抽選で1件と出会う（直前に見せた記録は外す）
    state.candidates = buildCandidates(entries).slice(0, POOL_MAX);
    state.candIdx = drawCandidateIdx(state.candidates, state.lastEntry);
    if (state.open) renderOpening();
  }

  // ── 1日1回の自動オープン（v1.3） ──
  // 右下で待つだけでは、いつか存在を忘れられる。だから Timeline の読み込みが済んだら、
  // その日はじめての1回だけ、相棒のほうから静かに開いて招く。
  // 開いた時点で実施日を残すので、利用者が閉じたら、その日は二度と勝手に開かない。
  // 候補が1件も無い日（静かな日・未連携）は、開かないことが正しい。
  function localToday() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function tryAutoOpen(entries) {
    let done = null;
    try { done = localStorage.getItem(AUTO_OPEN_KEY); } catch (err) { return; }
    if (done === localToday()) return; // 今日はもう招いた
    if (!buildCandidates(entries).length) return; // 静かな日は開かない
    try { localStorage.setItem(AUTO_OPEN_KEY, localToday()); } catch (err) { return; }
    openPanel(true);
  }
  // ホスト（Timeline Viewer）の読み込み完了を見守る：allEntries が入り、候補が作れる状態になったら一度だけ判定する。
  // 手動で先に開かれた場合や、一定時間データが来ない場合は、見守りを終える。
  function watchAutoOpen() {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (state.open) { clearInterval(timer); return; }
      const entries = hostEntries();
      if (entries && entries.length) {
        clearInterval(timer);
        tryAutoOpen(entries);
      } else if (tries >= 75) { // 約60秒
        clearInterval(timer);
      }
    }, 800);
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
    watchAutoOpen();
  }
  boot();

  window.ApsAvatar = {
    enabled: true,
    setEntries(list) { if (Array.isArray(list)) entriesCache = list; },
  };
})();
