// Auto-split from single-file build (v1.4).
// Master data / constants
const HEROES = {
    empty: {n:"未設定", t:"none", r:"none", ur:false, pr:0},
    kimberly: {n:"キンバリー", t:"tank", r:"atk", ur:false, pr:100, carry:true}, dva: {n:"DVA", t:"air", r:"atk", ur:false, pr:100, carry:true}, tesla: {n:"テスラ", t:"mis", r:"atk", ur:false, pr:100, carry:true}, murphy: {n:"マーフィ", t:"tank", r:"wall", ur:false, pr:90}, lucius: {n:"ルシウス", t:"air", r:"wall", ur:false, pr:90}, mcgregor: {n:"マクレガー", t:"mis", r:"wall", ur:false, pr:90}, stetmann: {n:"ステッドマン", t:"tank", r:"atk", ur:false, pr:80}, schuyler: {n:"スカイラー", t:"air", r:"atk", ur:false, pr:80}, fiona: {n:"フィオナ", t:"mis", r:"atk", ur:false, pr:80}, morrison: {n:"モリソン", t:"air", r:"atk", ur:false, pr:75}, swift: {n:"スウィフト", t:"mis", r:"atk", ur:false, pr:75}, mason: {n:"メイソン", t:"tank", r:"atk", ur:true, pr:70}, sarah: {n:"サラ", t:"air", r:"atk", ur:true, pr:70}, venom: {n:"ベノム", t:"mis", r:"atk", ur:true, pr:70}, williams: {n:"ウィリアムズ", t:"tank", r:"wall", ur:false, pr:60}, carlie: {n:"カーリー", t:"air", r:"wall", ur:false, pr:60}, adam: {n:"アダム", t:"mis", r:"wall", ur:false, pr:60}, scarlett: {n:"スカーレット", t:"tank", r:"wall", ur:true, pr:55}, violet: {n:"ヴィオラ", t:"tank", r:"wall", ur:true, pr:55}, marshall: {n:"マーシャル", t:"tank", r:"sup", ur:false, pr:50}
};
const GEAR_TYPES = ['Gun', 'Data', 'Armor', 'Radar'];
const GEAR_NAMES = { 'Gun':'🔫レールガン', 'Data':'💾チップ', 'Armor':'🛡️装甲', 'Radar':'📡レーダー' };
const SHARD_ICON = 'original.webp';


// ===============================
// ⭐ メタ育成優先（兵種コア / tier）
// ===============================
const META_TIER = {
  // 🚜 戦車
  kimberly:{ tier:'atk1', ew:'SSS', ewTarget:30 },
  williams:{ tier:'tank1', ew:'S',  ewTarget:20 },
  stetmann:{ tier:'atk2', ew:'S',  ewTarget:20 },
  marshall:{ tier:'sup',  ew:'B',  ewTarget:0  },
  murphy:{   tier:'tank2',ew:'C',  ewTarget:0  },

  // ✈️ 航空
  lucius:{   tier:'tank1',ew:'SSS',ewTarget:30 },
  dva:{      tier:'atk1', ew:'SSS',ewTarget:30 },
  morrison:{ tier:'atk2', ew:'S',  ewTarget:20 },
  schuyler:{ tier:'atk2', ew:'A',  ewTarget:10 },
  carlie:{   tier:'tank2',ew:'A',  ewTarget:10 },

  // 🚀 ミサイル（ロケラン）
  fiona:{    tier:'atk1', ew:'SSS',ewTarget:30 },
  tesla:{    tier:'atk1', ew:'SS', ewTarget:20 },
  mcgregor:{ tier:'tank1',ew:'S',  ewTarget:20 },
  swift:{    tier:'atk2', ew:'A',  ewTarget:10 },
  adam:{     tier:'tank2',ew:'B',  ewTarget:10 }
};


// ===============================
// ⭐ 兵種シフト（完全自動推定）用の設定
// ※閾値は app.js 側で毎回推定（ここは係数とコア定義だけ）
// ===============================
const META_SHIFT = {
  core: {
    tank:   { ids:['kimberly','williams','stetmann'], targets:[30,20,20] },
    air:    { ids:['lucius','dva'],                   targets:[30,30] },
    missile:{ ids:['fiona','tesla','mcgregor'],        targets:[30,20,20] }
  },
  mult: {
    boostNext: 1.08,   // 次兵種を押し上げ（控えめ）
    dampPrev:  0.98    // 前兵種を少し抑える（抑えすぎ防止）
  },
  progress: {
    maxWp: 30,
    minMult: 0.92,     // wp=0
    maxMult: 1.08      // wp=max
  }
};
