// AI Partner Sync Master — 共通設定（index.html / Timeline_Viewer.html / Chat.html で共有）
const APS_STORAGE_KEY = 'aps_master_v1';
const APS_DEFAULTS = {
  gasUrl: '',
  userName: 'Rikki',
  aiName: 'Titan',
  ttsEnabled: false,
  ttsVoice: 'ja-JP-Neural2-C',
  ttsRate: 0.93,
  ttsPitch: 0.0,
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
  const merged = Object.assign({}, apsLoadSettings(), partial);
  localStorage.setItem(APS_STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

// GAS側のスクリプトプロパティ（PARTNER_USER_NAME/PARTNER_AI_NAME）へも反映する。
// スプレッドシート側を正データ源とするため、フロントから変更したら都度push。
function apsPushPartnerNamesToGas(gasUrl, userName, aiName) {
  return fetch(gasUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ type: 'save_partner_names', userName, aiName })
  }).then(r => r.json()).catch(() => null);
}
