// AI Partner Sync Master — 共通設定（index.html / Timeline_Viewer.html / Chat.html で共有）
const APS_STORAGE_KEY = 'aps_master_v1';
const APS_DEFAULTS = {
  gasUrl: 'https://script.google.com/macros/s/AKfycby45pWuHOr7mmtoFTX0Vj5DTkmXYPXHixUxZckXhwqsk5cD7wfYwA6D9ShNxOutdhNu/exec',
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
