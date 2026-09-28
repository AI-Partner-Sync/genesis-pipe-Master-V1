// AI Partner Sync Master — 共通設定（index.html / Timeline_Viewer.html / Chat.html で共有）
const APS_STORAGE_KEY = 'aps_master_v1';
const APS_DEFAULTS = {
  gasUrl: '',
  // アプリ連携キー（鍵）。各ユーザーのGASがスプレッドシートのメニュー「📱 アプリ連携リンクを発行」で
  // 自動生成し、連携リンクをタップするとgasUrlと一緒にここへ保存される。手で入力するものではない。
  appKey: '',
  userName: 'Rikki',
  aiName: 'Titan',
  ttsEnabled: false,
  ttsVoice: 'ja-JP-Neural2-C',
  ttsRate: 0.93,
  ttsPitch: 0.0,
  ttsVolume: 1.0,
};

function apsLoadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(APS_STORAGE_KEY) || '{}');
    return Object.assign({}, APS_DEFAULTS, saved);
  } catch (e) {
    return Object.assign({}, APS_DEFAULTS);
  }
}

function apsSaveSettings(partial) {
  const current = apsLoadSettings();
  // GAS URLを手で別のものに変えたら、前のGAS用の鍵は使えないので捨てる
  if (partial.gasUrl !== undefined && partial.gasUrl !== current.gasUrl && partial.appKey === undefined) {
    partial = Object.assign({}, partial, { appKey: '' });
  }
  const merged = Object.assign({}, current, partial);
  localStorage.setItem(APS_STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

// GASへのGETリクエストURL（鍵付き）。query例: 'page=timeline_data'
function apsGasGetUrl(query) {
  const s = apsLoadSettings();
  const sep = s.gasUrl.includes('?') ? '&' : '?';
  return s.gasUrl + sep + query + (s.appKey ? '&key=' + encodeURIComponent(s.appKey) : '');
}

// GASへのPOST本文（鍵付き）
function apsGasPostBody(obj) {
  const s = apsLoadSettings();
  return JSON.stringify(s.appKey ? Object.assign({}, obj, { key: s.appKey }) : obj);
}

// GASが「鍵がない／違う」と返した時の判定と案内文
function apsIsUnauthorized(data) {
  return !!data && data.code === 'unauthorized';
}
const APS_UNAUTHORIZED_MESSAGE =
  'このアプリはまだあなたのスプレッドシートと連携されていません。スプレッドシートのメニュー「📱 アプリ連携リンクを発行」で出てくるリンクを、この端末で1回タップしてください。';

// GAS側のスクリプトプロパティ（PARTNER_USER_NAME/PARTNER_AI_NAME）へも反映する。
// スプレッドシート側を正データ源とするため、フロントから変更したら都度push。
function apsPushPartnerNamesToGas(gasUrl, userName, aiName) {
  return fetch(gasUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: apsGasPostBody({ type: 'save_partner_names', userName, aiName })
  }).then(r => r.json()).catch(() => null);
}

// アプリ連携リンク（…/index.html#aps_setup&gas=<GAS URL>&key=<鍵>）を開いた時の処理。
// gasUrlと鍵を保存し、鍵がアドレスバーや履歴に残らないようにハッシュを消してから知らせる。
(function apsHandleSetupLink() {
  const hash = location.hash || '';
  if (!hash.startsWith('#aps_setup')) return;
  const params = new URLSearchParams(hash.replace(/^#aps_setup&?/, ''));
  const gas = params.get('gas');
  const key = params.get('key');
  history.replaceState(null, '', location.pathname + location.search);
  if (!gas || !/^https:\/\/script\.google\.com\//.test(gas) || !key) return;
  apsSaveSettings({ gasUrl: gas, appKey: key });
  const show = () => {
    const el = document.createElement('div');
    el.textContent = '🔐 スプレッドシートとの連携が完了しました';
    el.style.cssText = 'position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:9999;' +
      'background:#0f172a;color:#fbbf24;border:1px solid #f59e0b;border-radius:12px;padding:12px 18px;' +
      'font-size:14px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,0.4);white-space:nowrap;';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  };
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
})();
