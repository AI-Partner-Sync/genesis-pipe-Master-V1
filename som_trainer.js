// 反論対処トレーニング（スレイト・オブ・マウス16技法）の部品。浮遊アバター（avatar_stage.js）の「反論対処モード」から使う。
// 仕様書（正本）: RIKKIS ROOM/Projects/反論対処トレーニング_設計仕様書.md（v0.3 第14章「教え方の3段」）
//
// この部品の仕事：
//   1. 16技法の定義（教材の正本「スレイト・オブ・マウス_SOM_口先の魔法」から）と、AI が無い時の型の見本
//   2. 山札：16枚をシャッフルし、1つの言葉につき3枚ずつ引く。一巡でどの技法もちょうど一度ずつ出る。
//      3枚は、できるだけ違う群（視点）になるよう、山札の中で入れ替える。前の巡の最後の札は、次の巡の最初に来ない。
//   3. 端末の記録（見た／試した／判定の回数）
// 画面とGASとの通信は avatar_stage.js が持つ。ここは状態を持たない計算と、端末の記録だけ。
(function () {
  const DECK_KEY = 'aps_som_deck';
  const STATS_KEY = 'aps_som_stats';
  const MODE_KEY = 'aps_som_mode';

  // 教材の5群（視点）。色は群ごと。
  const GROUPS = {
    1: { name: '前提を問う', hue: 205 },
    2: { name: '矛先を変える', hue: 330 },
    3: { name: '優先順位と結果', hue: 40 },
    4: { name: '物語と意味', hue: 150 },
    5: { name: '深さと例外', hue: 270 },
  };

  // [群, 名前, 剣, 考え方（1行）, 型の見本（{q}=本人の言葉）, 相手にはこう届く, 日常の型, こんな時に]
  const DEFS = {
    SOM01: [1, 'メタフレーム', '専門家の剣', '全体を見下ろす視点から、その言葉が立っている前提そのものを問い直す。',
      '「{q}」。それ、本当に全部を確かめた上で、言い切れることかな？',
      '決めつけを責められたのではなく、まだ確かめていない余白があると気づかせてもらえた',
      '〔その言い切り〕、本当に全部を確かめた上でのこと？', '思い込みを、事実のように断言された時'],
    SOM02: [1, 'リアリティストラテジー', '真実を問う剣', 'その信念を「どうやって真実だと知ったのか」、根拠を問う。',
      '「{q}」って、どうやってそう確信したの？そう決めた瞬間のこと、聞かせて。',
      '否定されずに、自分の確信がどこから来たのかを一緒にたどってもらえた',
      'どうやって〔それ〕だと分かったの？', '「〜に決まっている」と確信を語られた時'],
    SOM03: [1, '世界観', '視点変更の剣', 'それが本当に誰にとっても真実なのか、他の人の目線を借りて広げる。',
      '「{q}」。同じ場面を、あなたを大切に思っている人が見たら、どう見えるだろう？',
      '一人で閉じていた見方に、別の窓を開けてもらえた',
      '〔それ〕を、ほかの人の目から見たらどう見える？', '一つの見方に閉じこもっている時'],
    SOM04: [2, '自分に当てはめる（原因）', '原因の剣', '原因が外にあるという信念を、そっと自分の側へ折り返す。',
      '「{q}」。それを動かせるハンドルが、実は自分の側にも一本あるとしたら？',
      '責任を押し付けられたのではなく、自分にも変えられる力があると信じてもらえた',
      '〔外のせい〕のほかに、自分の側で動かせるハンドルは？', '原因をすべて外に置いて、堂々巡りしている時'],
    SOM05: [2, '自分に当てはめる（信念）', '信念の剣', 'その信念を持つこと自体が、苦しさを生んでいないかを問い返す。',
      '「{q}」。そう信じていること自体が、いちばん自分を縛っているとしたら？',
      '自分の考え方の癖に、責められずに気づかせてもらえた',
      '〔そう思っていること〕自体が、自分を縛っていない？', '「〜すべき」が苦しさを生んでいる時'],
    SOM06: [2, 'フレームサイズの変化', '誇張の剣', '視点の大きさを変え、信念を大きく、または小さく見せる。',
      '「{q}」。それが10年続いたら？逆に、10年後のあなたから見たら、どのくらいの大きさ？',
      '問題の大きさを、ちょうどいい大きさに戻してもらえた',
      '〔それ〕、10年後から見たらどのくらいの大きさ？', '問題が実際より大きく見えている時'],
    SOM07: [3, '条件のヒエラルキー', '価値観の剣', 'その信念よりも、もっと大切な価値観に焦点を移す。',
      '「{q}」。その気持ちよりも、今のあなたにとってもっと大事なものは何だろう？',
      '今の気持ちを否定されずに、本当に大切なものを思い出させてもらえた',
      '〔それ〕よりも、本当に大事なものは何？', '目の前のことにとらわれて、大切なものを見失っている時'],
    SOM08: [3, '結果', '未来を問う剣', 'このまま続けた先に、何が待っているかを想像してもらう。',
      '「{q}」。このまま1年続けた先と、今日選び直した先、どっちの自分を生きたい？',
      '脅されたのではなく、自分で未来を選べると信じてもらえた',
      'このまま〔続けた先〕と、選び直した先、どっちを生きたい？', '「このままでいい」と、今にとどまる理由を語られた時'],
    SOM09: [3, '違う結果', '新しい可能性の剣', 'その信念のほかに、もっと良い結果が得られる道を差し出す。',
      '「{q}」。それを抱えたまま進むより、一つだけ変えてみたら、どんな結果が待っていそう？',
      '二択に追い込まれていたところに、三つ目の道を開いてもらえた',
      '〔今のまま〕より、一つ変えたらどうなる？', '二択に追い込まれている時'],
    SOM10: [4, 'メタファー', '物語の剣', '解決を内包した物語やたとえで、正論では届かないところに手渡す。',
      '「{q}」。重い荷物を背負った登山家は、まず荷を一つ下ろすところから山を登り直すんだって。',
      '説教ではなく、物語として、そっと出口を見せてもらえた',
      'まるで〔たとえ〕のように、まず〔一つ〕から', '正論では届かない時'],
    SOM11: [4, '再定義（原因）', '原因の再定義の剣', '問題の「原因」の意味を、新しい視点から定義し直す。',
      '「{q}」。原因はあなたの弱さじゃなくて、今のやり方の無理の方かもしれないよ。',
      '自分を責めていた矢印を、変えられるものへ向け直してもらえた',
      '原因は〔あなた〕じゃなくて、〔仕組み〕の方かもしれない', '原因を性格など変えられないものだと思い込んでいる時'],
    SOM12: [4, '再定義（信念）', '信念の再定義の剣', '「問題」の意味そのものを、強みの裏返しとして定義し直す。',
      '「{q}」と言えるのは、それだけ本気で向き合ってきた証拠じゃないかな。',
      '欠点だと思っていたものを、力として見直してもらえた',
      'その〔弱さ〕は、〔強み〕の裏返しかもしれない', '欠点だと思っていることを語られた時'],
    SOM13: [5, 'チャンクダウン', '具体化の剣', '具体的に掘り下げ、曖昧な言葉の実態を浮かび上がらせる。',
      '「{q}」。具体的には、いつ、何が、どのくらい？一つだけ教えて。',
      '漠然とした重さを、手でつかめる大きさにしてもらえた',
      '具体的には、いつ・何が・どのくらい〔そう〕なの？', '漠然とした言葉で行き詰まっている時'],
    SOM14: [5, 'チャンクアップ', '抽象化の剣', '抽象化して、その奥の本質を問い直す。',
      '「{q}」。それで本当は、何を手に入れたいんだろう？',
      '細かい事情から引き上げて、本当の願いに目を向けさせてもらえた',
      '〔それ〕で、本当は何を手に入れたいの？', '細かい事情に埋もれている時'],
    SOM15: [5, '逆説の例え（例外探し）', '例外探しの剣', 'その信念が当てはまらない反例を探してもらう。',
      '「{q}」。そうじゃなかった日は、この一か月で一度もなかった？',
      '「いつも」という壁に、小さな抜け道を見つけさせてもらえた',
      '〔そう〕じゃなかった時は、一度もなかった？', '「いつも」「誰も」「どうせ」と言い切られた時'],
    SOM16: [5, '意図', '真意を問う剣', 'その言葉で、本当は何を守ろうとしているのか、肯定的な意図を問う。',
      '「{q}」。そう言うことで、本当は何を守ろうとしているんだろう？',
      '責められずに、自分の本音と守りたいものに近づかせてもらえた',
      'そう言うことで、本当は何を守ろうとしている？', '行動や信念の裏に、守りたいものがありそうな時'],
  };
  const IDS = Object.keys(DEFS);

  function def(id) {
    const d = DEFS[id];
    if (!d) return null;
    return { id, g: d[0], group: GROUPS[d[0]], name: d[1], sword: d[2], idea: d[3], tmpl: d[4], heart: d[5], pattern: d[6], when: d[7], no: IDS.indexOf(id) + 1 };
  }
  // lc：明度と彩度（省略時は黒い背景向けの '0.80 0.11'。明るい背景では '0.48 0.13' を使う）
  function colorOf(id, alpha, lc) {
    const d = DEFS[id];
    const hue = d ? GROUPS[d[0]].hue : 40;
    return `oklch(${lc || '0.80 0.11'} ${hue}${alpha != null ? ' / ' + alpha : ''})`;
  }

  // AI が無い時の見本。本人の言葉が長すぎる時は、最初の一文（最大40字）を使う。
  function templateFor(id, quote) {
    const d = def(id);
    let q = String(quote || '').split(/(?<=[。！？])/)[0].trim();
    if ([...q].length > 40) q = [...q].slice(0, 40).join('') + '…';
    const reply = d.tmpl.replace('{q}', q || 'その言葉');
    return { id, reply, used: q ? [q] : [], heart: d.heart, why: d.idea, pattern: d.pattern, when: d.when, template: true };
  }

  // ── 端末の記録 ──
  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* 覚えられなくても稽古は続ける */ } }

  function isOn() { try { return localStorage.getItem(MODE_KEY) === '1'; } catch (e) { return false; } }
  function setOn(on) { try { on ? localStorage.setItem(MODE_KEY, '1') : localStorage.removeItem(MODE_KEY); } catch (e) { /* noop */ } }

  // ── 山札 ──
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function newOrder(avoidFirst) {
    const o = shuffle(IDS);
    if (avoidFirst && o[0] === avoidFirst) { const j = 1 + Math.floor(Math.random() * (o.length - 1)); [o[0], o[j]] = [o[j], o[0]]; }
    return o;
  }
  function loadDeck() {
    const d = load(DECK_KEY, null);
    if (d && Array.isArray(d.order) && d.order.length === IDS.length && d.order.every(id => DEFS[id])) return d;
    return { order: newOrder(null), pos: 0, round: 1, last: null };
  }

  // 1つの言葉につき3枚。山札の中だけで入れ替えるので、一巡の均等は崩れない。
  function drawThree() {
    const deck = loadDeck();
    const picks = [];
    let roundDone = false;
    while (picks.length < 3) {
      if (deck.pos >= deck.order.length) {
        deck.order = newOrder(deck.last);
        deck.pos = 0;
        deck.round += 1;
        roundDone = true;
      }
      const usedGroups = picks.map(id => DEFS[id][0]);
      const ok = id => !picks.includes(id) && !usedGroups.includes(DEFS[id][0]);
      let at = deck.pos;
      if (!ok(deck.order[at])) {
        // 同じ群（または同じ札）に重なったら、この巡の後ろから、違う群の札を探して入れ替える
        for (let j = deck.pos + 1; j < deck.order.length; j++) {
          if (ok(deck.order[j])) { [deck.order[at], deck.order[j]] = [deck.order[j], deck.order[at]]; break; }
        }
        // 違う群が残っていなければ、同じ札でない限り受け入れる
        if (picks.includes(deck.order[at])) {
          for (let j = deck.pos + 1; j < deck.order.length; j++) {
            if (!picks.includes(deck.order[j])) { [deck.order[at], deck.order[j]] = [deck.order[j], deck.order[at]]; break; }
          }
        }
      }
      const id = deck.order[at];
      picks.push(id);
      deck.last = id;
      deck.pos += 1;
    }
    save(DECK_KEY, deck);
    return { ids: picks, round: deck.round, pos: deck.pos, roundDone };
  }

  // 一巡の中で、すでに見た札（剣の棚の灯り）
  function seenThisRound() {
    const d = loadDeck();
    return d.order.slice(0, d.pos);
  }

  // ── 進み具合 ──
  function bump(id, field) {
    const s = load(STATS_KEY, {});
    s[id] = s[id] || { shown: 0, tried: 0, strong: 0, close: 0, weak: 0 };
    s[id][field] = (s[id][field] || 0) + 1;
    save(STATS_KEY, s);
  }
  function stats() { return load(STATS_KEY, {}); }

  // ── 安全：反論ではなく、保護や専門家の支えが要る言葉（GAS 側にも同じ守りがある） ──
  const UNSAFE = /(死にたい|消えたい|自殺|自傷|リストカット|殺し|殺す|虐待|暴力を受|首を吊|飛び降り)/;
  function isUnsafe(text) { return UNSAFE.test(String(text || '')); }

  window.ApsSom = { IDS, GROUPS, def, colorOf, templateFor, drawThree, seenThisRound, bump, stats, isOn, setOn, isUnsafe, _loadDeck: loadDeck };
})();
