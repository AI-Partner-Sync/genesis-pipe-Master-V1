// 振り返りステージ（共通部品）
// 記録1件を「場面 → 一呼吸 → 一言 → 意味 → 声に出す」の全画面で体験する。
// ミルトンモデル19技法・スレイト・オブ・マウス16技法を、自分の記録というエピソードに結びつけて覚えるための部品。
// Timeline_Viewer.html から使う。Synapse_Graph.html / Chat.html（想起エンジン）からも ApsReflection.open(entry) で呼べる。
// settings.js（apsGasGetUrl / apsLoadSettings / apsIsUnauthorized）を先に読み込んでおくこと。
(function () {
  const SESSION_URL = 'https://rikkis-room.com/ja/briefing';
  const PARTNER_NAME = '菅ちゃん';
  const LOG_KEY = 'aps_reflection_log';
  const REVIEW_DAYS = [1, 3, 7, 21]; // 声に出せた回数ごとの、次に思い出す日までの間隔

  // 35の技法。use=こんな時に使う、form=型（自分で一言をつくる時の骨組み）
  const TECHNIQUES = {
    MM01: ['マインドリード', '相手が緊張や不安で心を閉じている時。まず「分かってもらえた」と感じてもらう。', '〜しているのが伝わってきます'],
    MM02: ['主語落とし', '安心させたい、肯定したい時。「私は〜と思う」だと押し付けに響く場面で。', '〜は良いことです'],
    MM03: ['原因と影響', '一歩目を踏み出してほしい時。行動と良い結果のつながりを自然に描く。', '〜すると、〜になります'],
    MM04: ['複雑な等価', '自分を否定している時。悩みそのものを「前進の証」に結び直す。', '〜ということは、〜ということ'],
    MM05: ['前提', '成長や良い未来を、確かめずに当然のこととして手渡したい時。', '〜したあとで／今よりもっと〜'],
    MM06: ['凡庸修飾詞', '迷っている時に、「自分だけじゃない」と安心したい時。', '誰でも最初は〜'],
    MM07: ['叙法助動詞', '尻込みしている時に、条件なしで可能性の扉を開ける。自分に許可を出す時にも。', '〜することができる／〜してもいい'],
    MM08: ['名詞化', '漠然とした体験を、持ち帰れる「形」にしたい時。', 'この学び／この経験'],
    MM09: ['不特定の動詞', '答えを自分で見つけたい時。具体的すぎる指示が気づきを奪う場面で。', '何かに気づくかもしれない'],
    MM10: ['タッグクエスチョン', '言い切ると反論を呼びそうな時。自分で確かめて頷いてもらう。', '〜ですよね？'],
    MM11: ['曖昧な参照', '名指しせずに伝えたい時。角を立てずに状況を届ける。', '中には〜な人もいます'],
    MM12: ['不明確な比較', '具体的に比べると反論を呼ぶ時。前向きな方向だけを渡す。', 'もっと〜／より良く'],
    MM13: ['現体験の指摘', '深い話の前に「今ここ」に落ち着きたい時。緊張を鎮めたい時にも。', '今こうして〜している'],
    MM14: ['ダブルバインド', '行動を始めたいが、押し付けたくない時。「いつ、どちらで」を選ぶ。', 'AとB、どちらにする？'],
    MM15: ['会話中の要求', 'お願いを、命令ではなく柔らかく届けたい時。', '〜してもらえますか？'],
    MM16: ['引きのばされた引用', '直接言うと押し付けになる教訓を、角を立てずに伝えたい時。', '〜が、〜から聞いた話では'],
    MM17: ['擬人化', '無機質なものに関心を向けたい時。場を少し和ませたい時。', 'この〜が、〜と言っている'],
    MM18: ['曖昧言語', '一つの解釈に縛らず、心地よい意味を選んでほしい時。', '同音異義／区切りの揺らぎ'],
    MM19: ['利用', '予想外の出来事や反論が出た時。否定せず、変化の入口に変える。', 'その通り、〜。だからこそ〜'],
    SOM01: ['メタフレーム', '思い込みを断言している時。挑発に響きやすいので、自分への問いに。', 'それは本当に検証した上での結論？'],
    SOM02: ['リアリティストラテジー', '「〜に決まっている」という確信の根拠を、静かにほどきたい時。', 'どうやってそれが本当だと分かった？'],
    SOM03: ['世界観', '一つの見方に閉じこもっている時。他の人の目線を借りる。', '他の人から見たら、どう見える？'],
    SOM04: ['自分に当てはめる（原因）', '原因をすべて外に置いて、堂々巡りしている時。', '〜のせいというより、〜が〜を起こしていない？'],
    SOM05: ['自分に当てはめる（信念）', '「〜すべき」という信念そのものが苦しさを生んでいる時。', '〜と信じていること自体が〜'],
    SOM06: ['フレームサイズの変化', '問題が実際より大きく見えている時。時間軸や大きさを変える。', '10年後から見たら？'],
    SOM07: ['条件のヒエラルキー', '目の前のことにとらわれて、もっと大切なものを見失っている時。', '〜よりも大切なのは？'],
    SOM08: ['結果', '「このままでいい」と思っている時。その先の未来を想像する。', 'このまま続けたら、どうなる？'],
    SOM09: ['違う結果', '二択に追い込まれている時。三つ目の道を開く。', '〜より、〜の方が良い結果にならない？'],
    SOM10: ['メタファー', '正論では届かない時。物語やたとえで解決を手渡す。', 'まるで〜のように'],
    SOM11: ['再定義（原因）', '原因を「性格」など変えられないものだと思い込んでいる時。', '原因は〜ではなく、実は〜では？'],
    SOM12: ['再定義（信念）', '欠点だと思っていることを、強みの裏返しとして見直したい時。', 'それは〜の裏返しかもしれない'],
    SOM13: ['チャンクダウン', '漠然とした言葉で行き詰まっている時。具体化すると打ち手が見える。', '具体的には、いつ・何を・どれくらい？'],
    SOM14: ['チャンクアップ', '細かい事情に埋もれている時。本質に戻る。', 'それは結局、何のため？'],
    SOM15: ['逆説の例え（例外探し）', '「いつも」「誰も」「一度も」と言い切っている時。例外一つで壁が崩れる。', '一度も〜ではなかった？'],
    SOM16: ['意図', '行動や信念の裏に、守りたいものがありそうな時。責めずに本音へ近づく。', 'それで本当は何を守ろうとしている？'],
  };

  // AIの一言がまだない記録で使う技法。感情スコアの帯ごとに候補を持ち、日付で1つ選ぶ。
  const POOLS = [
    [0, ['SOM15', 'SOM16', 'SOM11', 'SOM12', 'SOM10', 'MM19']],
    [200, ['SOM14', 'SOM13', 'SOM09', 'SOM07', 'MM04']],
    [350, ['MM05', 'MM03', 'MM07', 'MM04']],
    [500, ['MM08', 'MM05', 'MM02', 'MM04']],
  ];
  const POOL_NO_SCORE = ['SOM14', 'MM08', 'MM05', 'SOM06'];

  // AIの一言がまだない日に見せる「たとえば」。{q} にはその日の記録に出てきた本人の言葉が入る。
  // [本人の言葉がある時, 見つからない時]
  const EXAMPLES = {
    MM19: ['その通り、「{q}」。だからこそ、ここから変えられる。', 'その通り、今日はうまくいかなかった。だからこそ、次の一手が見えてくる。'],
    SOM15: ['「{q}」。そう感じなかった瞬間は、この一週間に一度もなかった？', '「いつも」「誰も」と感じる時、例外は本当に一度もなかった？'],
    SOM16: ['「{q}」と感じる自分は、本当は何を守ろうとしている？', 'こう感じる自分は、本当は何を守ろうとしている？'],
    SOM11: ['「{q}」の原因は、自分の弱さではなく、今の仕組みの無理かもしれない。', '原因は自分の弱さではなく、今の仕組みの無理かもしれない。'],
    SOM12: ['「{q}」と言えるのは、それだけ本気で向き合ってきた証拠かもしれない。', 'ここまで苦しいのは、それだけ本気で向き合ってきた証拠かもしれない。'],
    SOM10: ['「{q}」。限界荷重を超えた機械なら、まず荷を下ろすところから始める。', '限界荷重を超えた機械なら、まず荷を下ろすところから始める。'],
    SOM14: ['「{q}」で、本当は何を手に入れたい？', 'この気持ちで、本当は何を手に入れたい？'],
    SOM13: ['「{q}」。具体的には、いつ、何が、どれくらい？', '具体的には、いつ、何が、どれくらい重かった？'],
    SOM09: ['「{q}」のままでいるより、仕組みを一つ変えたら、どんな結果になる？', 'このまま耐えるより、仕組みを一つ変えたら、どんな結果になる？'],
    SOM07: ['「{q}」よりも、今の自分にとって大切なことは何だろう？', '目の前のことよりも、今の自分にとって大切なことは何だろう？'],
    MM04: ['「{q}」と感じるということは、大事にしたい基準があるということ。', '心が動いたということは、大事にしたい基準があるということ。'],
    MM05: ['「{q}」。この流れの先で、次はどんな景色が見えるだろう。', 'この流れの先で、次はどんな景色が見えるだろう。'],
    MM03: ['「{q}」と言えたから、明日の一歩はもっと軽くなる。', '今日ここまで来られたから、明日の一歩はもっと軽くなる。'],
    MM07: ['「{q}」。この感覚は、いつでも思い出すことができる。', 'この感覚は、いつでも思い出すことができる。'],
    MM08: ['「{q}」。この気づきを、明日に持っていこう。', 'この日の気づきを、明日に持っていこう。'],
    MM02: ['「{q}」と言えるのは、良いことだ。', 'ここまで来られたのは、良いことだ。'],
    SOM06: ['「{q}」。10年後の自分から見たら、どんな一日に見える？', '10年後の自分から見たら、今日はどんな一日に見える？'],
  };

  let state = null; // { entry, step, content, aiStatus }
  let root = null;

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function br(s) { return esc(s).replace(/\n/g, '<br>'); }
  function keyOf(e) { return (e.level || '') + '|' + (e.date || ''); }
  function hash(str) { let h = 0; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

  // ===== 練習の記録（この端末のlocalStorage） =====
  function loadLog() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || '{}'); } catch (err) { return {}; }
  }
  function saveLog(log) {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch (err) { /* private mode等で保存できなくても致命的ではない */ }
  }
  function record(e, spoken) {
    const log = loadLog();
    const k = keyOf(e);
    const r = log[k] || { opened: 0, spoken: 0 };
    r.opened += 1;
    if (spoken) r.spoken += 1;
    r.lastAt = new Date().toISOString();
    const gap = REVIEW_DAYS[Math.min(r.spoken, REVIEW_DAYS.length) - 1];
    r.dueAt = spoken && gap ? new Date(Date.now() + gap * 86400000).toISOString() : (r.dueAt || null);
    log[k] = r;
    saveLog(log);
    pushRecord(e, spoken);
    return r;
  }

  // ===== 練習の記録をスプレッドシート（Reflection_Log）とそろえる =====
  // GASに ?page=reflection_record / reflection_log がある時だけ動く（無ければ端末の中だけで続ける）。
  // こうすると、どの端末で開いても同じ「思い出す時期」が出て、GASから毎朝の通知も送れる。
  function gasReady() { return typeof apsLoadSettings === 'function' && !!apsLoadSettings().gasUrl; }

  async function pushRecord(e, spoken) {
    if (!gasReady()) return;
    try {
      const res = await fetch(apsGasGetUrl(`page=reflection_record&level=${encodeURIComponent(e.level)}&date=${encodeURIComponent(e.date)}&spoken=${spoken ? 1 : 0}`));
      const data = await res.json();
      if (data && data.status === 'success' && data.record) mergeRows([data.record]);
    } catch (err) { /* 通信できなくても、端末の中の記録は残っている */ }
  }

  // 声に出せた回数が多い方を正とする（同じなら新しい方）。端末にしかない記録は消さない。
  function mergeRows(rows) {
    const log = loadLog();
    let changed = false;
    rows.forEach(row => {
      if (!row || !row.level || !row.date) return;
      const k = keyOf(row), local = log[k];
      const take = !local || row.spoken > (local.spoken || 0)
        || (row.spoken === (local.spoken || 0) && String(row.lastAt || '') > String(local.lastAt || ''));
      if (!take) return;
      log[k] = { opened: row.opened || 0, spoken: row.spoken || 0, lastAt: row.lastAt || null, dueAt: row.dueAt || null };
      changed = true;
    });
    if (changed) saveLog(log);
    return changed;
  }

  // Timeline Viewer を開いた時に呼ぶ。スプレッドシートの記録を取り込んだら true。
  async function syncLog() {
    if (!gasReady()) return false;
    try {
      const res = await fetch(apsGasGetUrl('page=reflection_log'));
      const data = await res.json();
      if (!data || data.status !== 'success' || !Array.isArray(data.log)) return false;
      return mergeRows(data.log);
    } catch (err) { return false; }
  }
  // 思い出す時期が来た記録のキー一覧（古い順）
  // 思い出す日は時刻ではなく日付で判断する（その日の朝から出す。GASの毎朝の通知と同じ考え方）
  function dueKeys() {
    const log = loadLog();
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    return Object.entries(log)
      .filter(([, r]) => r.dueAt && new Date(r.dueAt).getTime() <= endOfToday.getTime())
      .sort((a, b) => new Date(a[1].dueAt) - new Date(b[1].dueAt))
      .map(([k]) => k);
  }
  function wasReflected(e) { return !!loadLog()[keyOf(e)]; }

  // ===== 一言の中身 =====
  // GAS側 page=reflection（I_Reflection.js）を呼ぶ。
  // generate=false: 保存済みの一言を読むだけ（Gemini課金なし）。無ければ { status:'not_generated' }。
  // generate=true : 本人がボタンを押した時だけ。Geminiで作って保存する。
  // 通信エラーや、エンドポイントのない旧バージョンのGASでは null。
  async function fetchReflection(e, generate) {
    try {
      if (typeof apsLoadSettings !== 'function' || !apsLoadSettings().gasUrl) return null;
      const res = await fetch(apsGasGetUrl(`page=reflection&level=${encodeURIComponent(e.level)}&date=${encodeURIComponent(e.date)}${generate ? '&generate=1' : ''}`));
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.status === 'success' && data.reflection && data.reflection.said) return data;
      if (data && data.status === 'not_generated') return data;
      if (apsIsUnauthorized(data)) return data;
      return null;
    } catch (err) {
      return null;
    }
  }

  function splitLines(text, max) {
    return String(text || '').replace(/\s+/g, ' ').trim()
      .split(/(?<=[。！？])/).map(s => s.trim()).filter(Boolean).slice(0, max);
  }
  function sceneLines(e) { return splitLines(e.summary || e.keystone, 4); }

  // 記録の中の「」から、本人の言葉らしいものを1つ選ぶ。Keystoneの言葉（その日の核心の問い）を優先する。
  function pickQuote(e) {
    const grab = t => [...String(t || '').matchAll(/「([^「」]{6,24})」/g)].map(m => m[1]);
    const fromKeystone = grab(e.keystone);
    if (fromKeystone.length) return fromKeystone[0];
    const fromSummary = grab(e.summary);
    if (!fromSummary.length) return null;
    return (e.score && e.score < 350) ? fromSummary[fromSummary.length - 1] : fromSummary[0];
  }

  function slugOf(e) {
    const parts = [e.date, (e.level || '').toUpperCase()];
    if (e.emotion) parts.push(e.emotion + (e.score ? ' ' + e.score : ''));
    return parts.filter(Boolean).join(' ／ ');
  }

  function pickTechnique(e) {
    let pool = POOL_NO_SCORE;
    if (e.level === 'Daily' && e.score) {
      for (const [min, ids] of POOLS) if (e.score >= min) pool = ids;
    }
    return pool[hash(keyOf(e)) % pool.length];
  }

  // AIの一言がある時の中身
  function contentFromAi(e, r) {
    return {
      kind: 'ai',
      scene: Array.isArray(r.scene) && r.scene.length ? r.scene.slice(0, 5) : sceneLines(e),
      keystone: e.summary ? e.keystone || '' : '',
      ask: r.ask || 'この日の自分に、何と言う？',
      said: r.said,
      mean: r.mean || '',
      soft: r.soft || '',
      techniques: (r.techniques || []).filter(id => TECHNIQUES[id]),
    };
  }
  // AIの一言がない時は、技法の「型」で自分の一言をつくる練習にする
  function contentFromTechnique(e) {
    const id = pickTechnique(e);
    const [name, use, form] = TECHNIQUES[id];
    const quote = pickQuote(e);
    const ex = EXAMPLES[id] || ['', ''];
    return {
      kind: 'form',
      scene: sceneLines(e),
      keystone: e.summary ? e.keystone || '' : '',
      ask: 'この日の自分に、何と言う？',
      said: null,
      form, name, use, quote,
      example: quote ? ex[0].replace('{q}', quote) : ex[1],
      techniques: [id],
    };
  }

  // ===== 画面 =====
  const STEPS = ['scene', 'ask', 'said', 'mean', 'voice'];

  function injectStyle() {
    if (document.getElementById('aps-reflect-style')) return;
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&display=swap';
    document.head.appendChild(font);
    const st = document.createElement('style');
    st.id = 'aps-reflect-style';
    st.textContent = `
.aps-rf{--rf-bg:#0a0f1e;--rf-ink:#e7e3da;--rf-muted:#7c8597;--rf-faint:#1e293b;--rf-gold:#f59e0b;--rf-glow:rgba(245,158,11,.14);
  position:fixed;inset:0;z-index:1000;background:var(--rf-bg);color:var(--rf-ink);display:flex;flex-direction:column;
  padding:env(safe-area-inset-top,0px) max(20px,env(safe-area-inset-right,0px)) env(safe-area-inset-bottom,0px) max(20px,env(safe-area-inset-left,0px));
  font-family:'Segoe UI',system-ui,sans-serif}
.aps-rf button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}
.aps-rf button:focus-visible{outline:2px solid var(--rf-gold);outline-offset:4px;border-radius:4px}
.aps-rf .rf-bar{display:flex;align-items:center;gap:14px;height:52px;flex:0 0 auto;max-width:34em;width:100%;margin:0 auto}
.aps-rf .rf-x{font-size:22px;line-height:1;color:var(--rf-muted);width:32px;height:32px}
.aps-rf .rf-prog{flex:1;height:2px;background:var(--rf-faint);border-radius:2px;overflow:hidden}
.aps-rf .rf-prog i{display:block;height:100%;background:var(--rf-gold);transition:width .4s ease}
.aps-rf .rf-scene{flex:1;display:flex;flex-direction:column;justify-content:center;gap:18px;max-width:34em;width:100%;margin:0 auto;padding:12px 0 40px;cursor:pointer;overflow-y:auto;min-height:0}
.aps-rf .rf-scene.still{cursor:default}
.aps-rf .rf-slug{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.12em;color:var(--rf-gold)}
.aps-rf .rf-ep{font-family:'Shippori Mincho','Hiragino Mincho ProN','Yu Mincho',serif;font-weight:500;font-size:19px;line-height:2;margin:0}
.aps-rf .rf-ep span{display:block}
.aps-rf .rf-ask{font-family:'Shippori Mincho','Hiragino Mincho ProN','Yu Mincho',serif;font-weight:700;font-size:20px;text-align:center;margin:0}
.aps-rf .rf-breath{width:96px;height:96px;border-radius:50%;background:var(--rf-glow);margin:8px auto;display:grid;place-items:center;font-size:12px;color:var(--rf-muted)}
.aps-rf .rf-said{font-family:'Shippori Mincho','Hiragino Mincho ProN','Yu Mincho',serif;font-weight:700;font-size:25px;line-height:1.9;margin:0}
.aps-rf .rf-mean{font-size:16px;line-height:2;margin:0}
.aps-rf .rf-soft{color:var(--rf-muted);font-size:14px;line-height:1.8;margin:0}
.aps-rf .rf-tech{font-size:12px;color:var(--rf-muted);letter-spacing:.04em}
.aps-rf .rf-key{border-left:2px solid var(--rf-gold);padding-left:14px;margin:6px 0 0}
.aps-rf .rf-key small{display:block;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.14em;color:var(--rf-gold)}
.aps-rf .rf-key span{font-family:'Shippori Mincho','Hiragino Mincho ProN','Yu Mincho',serif;font-size:17px;line-height:1.9}
.aps-rf .rf-quote{font-size:13px;color:var(--rf-muted);margin:0}
.aps-rf .rf-quote b{color:var(--rf-ink);font-weight:600}
.aps-rf .rf-form{font-size:13px;color:var(--rf-muted);margin:0;line-height:1.8}
.aps-rf .rf-tech b{color:var(--rf-gold);font-weight:600}
.aps-rf .rf-choice{display:flex;flex-direction:column;gap:12px;align-items:center;margin-top:12px}
.aps-rf .rf-pill{border:1px solid var(--rf-muted);border-radius:999px;padding:10px 26px;font-size:15px}
.aps-rf .rf-pill.main{background:var(--rf-gold);border-color:var(--rf-gold);color:#0a0f1e;font-weight:700}
.aps-rf .rf-link{color:var(--rf-muted);font-size:13px;text-decoration:underline}
.aps-rf .rf-hint{text-align:center;color:var(--rf-muted);font-size:12px;padding-bottom:10px;flex:0 0 auto}
@media (prefers-reduced-motion:no-preference){
  .aps-rf .rf-fade{animation:rfFade .7s ease both}
  .aps-rf .rf-ep span{animation:rfFade .8s ease both}
  .aps-rf .rf-ep span:nth-child(2){animation-delay:.6s}.aps-rf .rf-ep span:nth-child(3){animation-delay:1.2s}
  .aps-rf .rf-ep span:nth-child(4){animation-delay:1.8s}.aps-rf .rf-ep span:nth-child(5){animation-delay:2.4s}
  .aps-rf .rf-breath{animation:rfBreathe 8s ease-in-out infinite}
}
@keyframes rfFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes rfBreathe{0%,100%{transform:scale(.8)}50%{transform:scale(1.15)}}`;
    document.head.appendChild(st);
  }

  // 「ミルトンモデル：利用」「反論対処：逆説の例え（例外探し）」のように、どの体系の技法かを添える
  function techLine(ids) {
    return ids.map(id => `${id.startsWith('SOM') ? '反論対処' : 'ミルトンモデル'}：<b>${esc(TECHNIQUES[id][0])}</b>`).join('　');
  }

  function bodyHtml() {
    const { entry: e, content: c, step, aiStatus } = state;
    const name = STEPS[step];
    if (name === 'scene') {
      return `<p class="rf-slug rf-fade">${esc(slugOf(e))}</p>
        <p class="rf-ep">${c.scene.map(l => `<span>${esc(l)}</span>`).join('')}</p>
        ${c.keystone ? `<p class="rf-key rf-fade" style="animation-delay:${0.6 * c.scene.length}s"><small>KEYSTONE ／ この日の核心</small><span>${esc(c.keystone)}</span></p>` : ''}`;
    }
    if (name === 'ask') {
      return `<div class="rf-breath" aria-hidden="true">一呼吸</div>
        <p class="rf-ask rf-fade">${esc(c.ask)}</p>
        <p class="rf-soft rf-fade" style="text-align:center">心の中で、自分の言葉を一度つくってから。</p>`;
    }
    if (name === 'said') {
      if (c.kind === 'ai') {
        return `<p class="rf-slug rf-fade">${esc(slugOf(e))}</p><p class="rf-said rf-fade">${br(c.said)}</p>`;
      }
      const canMake = aiStatus === 'not_generated';
      return `<p class="rf-tech rf-fade">今日の技法　${techLine(c.techniques)}</p>
        ${c.quote ? `<p class="rf-quote rf-fade">この日のあなたの言葉　<b>「${esc(c.quote)}」</b></p>` : ''}
        <p class="rf-said rf-fade">${esc(c.example || c.form)}</p>
        <p class="rf-form rf-fade">型：${esc(c.form)}<br>自分の言葉に言い換えても、このまま声に出してもいい。</p>
        ${canMake ? `<div class="rf-choice rf-fade">
          <button type="button" class="rf-pill" data-rf="make">この日の一言をAIと一緒につくる</button>
          <span class="rf-soft" style="font-size:12px">Geminiを1回使います。一度つくると保存され、次からは無料で開けます。</span></div>` : ''}
        ${aiStatus === 'making' ? `<p class="rf-soft rf-fade" style="text-align:center">つくっています…</p>` : ''}
        ${aiStatus === 'failed' ? `<p class="rf-soft rf-fade" style="text-align:center">つくれませんでした。今日は型で練習しましょう。</p>` : ''}`;
    }
    if (name === 'mean') {
      if (c.kind === 'ai') {
        return `<p class="rf-mean rf-fade">${esc(c.mean)}</p>
          ${c.soft ? `<p class="rf-soft rf-fade">${esc(c.soft)}</p>` : ''}
          ${c.techniques.length ? `<p class="rf-tech rf-fade">使った技法　${techLine(c.techniques)}</p>` : ''}`;
      }
      return `<p class="rf-tech rf-fade">${techLine(c.techniques)}　こんな時に</p>
        <p class="rf-mean rf-fade">${esc(c.use)}</p>`;
    }
    if (state.done) {
      const r = state.done;
      const next = r.dueAt ? new Date(r.dueAt) : null;
      const when = next ? `${next.getMonth() + 1}月${next.getDate()}日` : '';
      return `<p class="rf-slug rf-fade">${state.doneSpoken ? '記録しました' : '心の中で、受け取りました'}</p>
        <p class="rf-mean rf-fade">${state.doneSpoken
          ? `声に出せたのは、この日で${r.spoken}回目です。<br>${when}に、この日がもう一度「思い出す時期です」として一覧の上に戻ってきます。`
          : '声に出せた日から、思い出す時期の予定が始まります。'}</p>
        <p class="rf-soft rf-fade">一覧の「この日を振り返る」の丸が、金色になります。記録はスプレッドシートにも残るので、ほかの端末でも同じ日に戻ってきます。</p>
        <div class="rf-choice rf-fade"><button type="button" class="rf-pill" data-rf="close">閉じる</button></div>`;
    }
    // voice: 声に出す
    const heavy = e.heaviness === 'heavy';
    return `<p class="rf-slug rf-fade">声に出して、言ってみる</p>
      <p class="rf-said rf-fade">${c.kind === 'ai' ? br(c.said) : esc(c.example || c.form)}</p>
      <div class="rf-choice rf-fade">
        <button type="button" class="rf-pill main" data-rf="spoken">声に出せた</button>
        <button type="button" class="rf-link" data-rf="later">今日は心の中だけで</button>
      </div>
      ${heavy ? `<p class="rf-soft rf-fade" style="text-align:center;margin-top:16px">この日のテーマは重みがあります。一人で抱えきれない時は、
        <a href="${SESSION_URL}" target="_blank" rel="noopener" style="color:var(--rf-gold)">${PARTNER_NAME}とのセッション</a>で一緒にほどくこともできます。</p>` : ''}`;
  }

  function render() {
    const total = STEPS.length;
    const still = STEPS[state.step] === 'voice' || (STEPS[state.step] === 'said' && state.aiStatus === 'making');
    const hint = STEPS[state.step] === 'ask' ? '言葉ができたら、タップ' : STEPS[state.step] === 'voice' ? '' : 'タップで次へ';
    root.innerHTML = `
      <div class="rf-bar"><button type="button" class="rf-x" data-rf="close" aria-label="振り返りを閉じる">×</button>
        <div class="rf-prog" aria-hidden="true"><i style="width:${Math.round((state.step + 1) / total * 100)}%"></i></div></div>
      <div class="rf-scene${still ? ' still' : ''}" data-rf="stage">${bodyHtml()}</div>
      ${hint ? `<div class="rf-hint">${hint}　·　左端タップで戻る</div>` : ''}`;
  }

  function go(d) {
    const next = state.step + d;
    if (next < 0 || next >= STEPS.length) return;
    state.step = next;
    render();
  }

  async function makeWithAi() {
    const e = state.entry;
    state.aiStatus = 'making';
    render();
    const data = await fetchReflection(e, true);
    if (!state || state.entry !== e) return;
    if (data && data.status === 'success') {
      state.content = contentFromAi(e, data.reflection);
      state.aiStatus = 'success';
    } else {
      state.aiStatus = 'failed';
    }
    render();
  }

  function close() {
    if (!state) return;
    const done = state.onClose;
    state = null;
    if (root) { root.remove(); root = null; }
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
    if (done) done();
  }

  function onClick(ev) {
    const t = ev.target.closest('[data-rf]');
    if (!t || !state) return;
    const act = t.dataset.rf;
    if (act === 'close') return close();
    if (act === 'make') { ev.stopPropagation(); return makeWithAi(); }
    if (act === 'spoken' || act === 'later') {
      state.doneSpoken = act === 'spoken';
      state.done = record(state.entry, state.doneSpoken);
      return render();
    }
    if (act === 'stage') {
      if (ev.target.closest('a')) return;
      if (STEPS[state.step] === 'voice' || state.aiStatus === 'making') return;
      const r = t.getBoundingClientRect();
      go(ev.clientX < r.left + r.width * 0.25 ? -1 : 1);
    }
  }

  function onKey(ev) {
    if (!state) return;
    if (ev.key === 'Escape') close();
    else if (ev.key === 'ArrowLeft') go(-1);
    else if ((ev.key === 'ArrowRight' || ev.key === ' ') && STEPS[state.step] !== 'voice') { ev.preventDefault(); go(1); }
  }

  // 記録1件の振り返りを開く。onClose は閉じた後に呼ばれる（一覧の再描画用）。
  async function open(entry, opts) {
    if (!entry) return;
    injectStyle();
    if (root) close();
    state = { entry, step: 0, content: contentFromTechnique(entry), aiStatus: 'loading', onClose: opts && opts.onClose };
    root = document.createElement('div');
    root.className = 'aps-rf';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'この日を振り返る');
    root.addEventListener('click', onClick);
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    render();

    // 保存済みの一言を読むだけ（課金なし）。場面を読んでいる間に届けば差し替える。
    const data = await fetchReflection(entry, false);
    if (!state || state.entry !== entry) return;
    if (data && data.status === 'success') {
      state.content = contentFromAi(entry, data.reflection);
      state.aiStatus = 'success';
    } else {
      state.aiStatus = data && data.status === 'not_generated' ? 'not_generated' : 'unavailable';
    }
    if (STEPS[state.step] !== 'scene') render();
  }

  window.ApsReflection = { open, dueKeys, wasReflected, keyOf, syncLog, TECHNIQUES };
})();
