// Auto-split from single-file build (v1.4).
// Master data / constants
const HEROES = {
    empty: {n:"未設定", t:"none", r:"none", ur:false, pr:0},
    kimberly: {n:"キンバリー", t:"tank", r:"atk", ur:false, pr:100, carry:true}, dva: {n:"DVA", t:"air", r:"atk", ur:false, pr:100, carry:true}, tesla: {n:"テスラ", t:"mis", r:"atk", ur:false, pr:100, carry:true}, murphy: {n:"マーフィ", t:"tank", r:"wall", ur:false, pr:90}, lucius: {n:"ルシウス", t:"air", r:"wall", ur:false, pr:90}, mcgregor: {n:"マクレガー", t:"mis", r:"wall", ur:false, pr:90}, stetmann: {n:"ステッドマン", t:"tank", r:"atk", ur:false, pr:80}, schuyler: {n:"スカイラー", t:"air", r:"atk", ur:false, pr:80}, fiona: {n:"フィオナ", t:"mis", r:"atk", ur:false, pr:80}, morrison: {n:"モリソン", t:"air", r:"atk", ur:false, pr:75}, swift: {n:"スウィフト", t:"mis", r:"atk", ur:false, pr:75}, mason: {n:"メイソン", t:"tank", r:"atk", ur:true, pr:70}, sarah: {n:"サラ", t:"air", r:"atk", ur:true, pr:70}, venom: {n:"ベノム", t:"mis", r:"atk", ur:true, pr:70}, williams: {n:"ウィリアムズ", t:"tank", r:"wall", ur:false, pr:60}, carlie: {n:"カーリー", t:"air", r:"wall", ur:false, pr:60}, adam: {n:"アダム", t:"mis", r:"wall", ur:false, pr:60}, scarlett: {n:"スカーレット", t:"tank", r:"wall", ur:true, pr:55}, violet: {n:"ヴィオラ", t:"tank", r:"wall", ur:true, pr:55}, marshall: {n:"マーシャル", t:"tank", r:"sup", ur:false, pr:50}
};
const GEAR_TYPES = ['Gun', 'Data', 'Armor', 'Radar'];
const GEAR_NAMES = { 'Gun':'🔫レールガン', 'Data':'💾チップ', 'Armor':'🛡️装甲', 'Radar':'📡レーダー' };
const SHARD_ICON = 'original.webp';
