// Auto-split from single-file build (v1.4).
// Master data / constants
const HEROES = {
    empty: {n:"未設定", t:"none", r:"none", ur:false, pr:0},
    kimberly: {n:"キンバリー", t:"tank", r:"atk", ur:false, pr:100, carry:true}, dva: {n:"DVA", t:"air", r:"atk", ur:false, pr:100, carry:true}, tesla: {n:"テスラ", t:"mis", r:"atk", ur:false, pr:100, carry:true}, murphy: {n:"マーフィ", t:"tank", r:"wall", ur:false, pr:90}, lucius: {n:"ルシウス", t:"air", r:"wall", ur:false, pr:90}, mcgregor: {n:"マクレガー", t:"mis", r:"wall", ur:false, pr:90}, stetmann: {n:"ステッドマン", t:"tank", r:"atk", ur:false, pr:80}, schuyler: {n:"スカイラー", t:"air", r:"atk", ur:false, pr:80}, fiona: {n:"フィオナ", t:"mis", r:"atk", ur:false, pr:80}, morrison: {n:"モリソン", t:"air", r:"atk", ur:false, pr:75}, swift: {n:"スウィフト", t:"mis", r:"atk", ur:false, pr:75}, mason: {n:"メイソン", t:"tank", r:"atk", ur:true, pr:70}, sarah: {n:"サラ", t:"air", r:"atk", ur:true, pr:70}, venom: {n:"ベノム", t:"mis", r:"atk", ur:true, pr:70}, williams: {n:"ウィリアムズ", t:"tank", r:"wall", ur:false, pr:60}, carlie: {n:"カーリー", t:"air", r:"wall", ur:false, pr:60}, adam: {n:"アダム", t:"mis", r:"wall", ur:false, pr:60}, scarlett: {n:"スカーレット", t:"tank", r:"wall", ur:true, pr:55}, violet: {n:"ヴィオラ", t:"tank", r:"wall", ur:true, pr:55}, marshall: {n:"マーシャル", t:"tank", r:"sup", ur:false, pr:50}
};
const GEAR_TYPES = ['Gun', 'Data', 'Armor', 'Radar'];
const GEAR_NAMES = { 'Gun':'🔫レールガン', 'Data':'💾チップ', 'Armor':'🛡️装甲', 'Radar':'📡レーダー' };
const SHARD_ICON = 'img/original.webp';


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


// ===============================
// ⭐ 汎用化ロジック用マスタ
// ===============================
const HERO_ROLE_PROFILE = {
  kimberly:{ role:'main_dps', lane:'back', core:true },
  murphy:{ role:'front_tank', lane:'front', core:true },
  williams:{ role:'front_tank', lane:'front', core:false },
  marshall:{ role:'support', lane:'back', core:true },
  stetmann:{ role:'sub_dps', lane:'back', core:true },

  dva:{ role:'main_dps', lane:'back', core:true },
  lucius:{ role:'front_tank', lane:'front', core:true },
  carlie:{ role:'front_tank', lane:'front', core:false },
  schuyler:{ role:'control', lane:'back', core:true },
  morrison:{ role:'sub_dps', lane:'back', core:true },

  fiona:{ role:'main_dps', lane:'back', core:true },
  tesla:{ role:'sub_dps', lane:'back', core:true },
  mcgregor:{ role:'front_tank', lane:'front', core:true },
  swift:{ role:'sub_dps', lane:'back', core:true },
  adam:{ role:'support', lane:'back', core:false }
};

const HERO_LONGTERM_VALUE = {
  kimberly:1.00, dva:1.00, fiona:0.96,
  lucius:0.90, murphy:0.88, stetmann:0.86,
  morrison:0.84, schuyler:0.82, tesla:0.82, mcgregor:0.80,
  marshall:0.72, swift:0.70, williams:0.62, carlie:0.58, adam:0.56
};

const HERO_SYNERGY = {
  // Air
  dva: {
    lucius:   { base: 1.03, lv10: 1.04, lv20: 1.06, lv30: 1.07 },
    morrison: { base: 1.02, lv10: 1.03, lv20: 1.04, lv30: 1.05 }
  },
  lucius: {
    dva:      { base: 1.04, lv10: 1.05, lv20: 1.07, lv30: 1.08 }
  },
  morrison: {
    dva:      { base: 1.02, lv10: 1.03, lv20: 1.04, lv30: 1.05 }
  },

  // Tank
  kimberly: {
    stetmann: { base: 1.03, lv10: 1.04, lv20: 1.05, lv30: 1.06 },
    williams: { base: 1.02, lv10: 1.03, lv20: 1.04, lv30: 1.04 }
  },
  stetmann: {
    kimberly: { base: 1.04, lv10: 1.05, lv20: 1.06, lv30: 1.07 }
  },
  murphy: {
    williams: { base: 1.03, lv10: 1.04, lv20: 1.05, lv30: 1.05 }
  },
  williams: {
    murphy:   { base: 1.03, lv10: 1.04, lv20: 1.05, lv30: 1.05 },
    kimberly: { base: 1.02, lv10: 1.03, lv20: 1.04, lv30: 1.04 }
  },

  // Missile
  fiona: {
    tesla:    { base: 1.02, lv10: 1.03, lv20: 1.04, lv30: 1.05 },
    mcgregor: { base: 1.02, lv10: 1.03, lv20: 1.04, lv30: 1.05 }
  },
  tesla: {
    fiona:    { base: 1.02, lv10: 1.03, lv20: 1.04, lv30: 1.05 }
  },
  mcgregor: {
    fiona:    { base: 1.02, lv10: 1.03, lv20: 1.04, lv30: 1.05 }
  }
};

const TYPE_COUNTER_WEIGHT = {
  tank:{ tank:0.30, air:1.00, mis:0.50 },
  air:{ tank:0.50, air:0.30, mis:1.00 },
  mis:{ tank:1.00, air:0.50, mis:0.30 },
  none:{ tank:0.50, air:0.50, mis:0.50 }
};

const ROUTE_WEIGHT_PRESET = {
  overall:{ cost:0.45, coverage:0.30, future:0.25 },
  safe:{ cost:0.60, coverage:0.25, future:0.15 }
};


// ===============================
// ⭐ 専用武装タグ（簡易判定用）
// ===============================
const HERO_WEAPON_TAGS = {
  murphy: ['shield_like_protect','frontline_protect','low_hp_protect','team_guard','damage_mitigation'],
  kimberly: ['single_burst','energy_damage','stack_scaling','skill_multi_hit','aoe_bonus_30'],
  marshall: ['atk_buff','crit_buff','focus_fire_support','target_mark','cooldown_reset_30'],
  williams: ['interrupt','frontline_control','backline_control','team_def_buff','energy_vuln'],
  stetmann: ['anti_shield','backline_hit','energy_bonus_hit','charge_scaling','cc_guard_30'],

  dva: ['opening_burst','attack_speed','air_synergy','instant_opening_30','tempo_accel'],
  carlie: ['anti_energy','enemy_atk_down','enemy_energy_down','frontline_stability','death_effect_30'],
  schuyler: ['cc_stun','disrupt','backline_hit','anti_backline','guaranteed_cc_30'],
  lucius: ['shield','energy_resist','low_hp_protect','team_barrier','atk_speed_on_break_30'],
  morrison: ['hp_percent_damage','anti_tank','high_hp_target','def_down','finisher'],

  tesla: ['dot','energy_dot','stack_dot','backline_pressure_30','dot_scaling'],
  mcgregor: ['taunt','dot_amp','enemy_atk_down','frontline_stability','iron_wall_30'],
  adam: ['counter','team_counter','frontline_protect','counter_amp','armor_break_counter_30'],
  fiona: ['dot','physical_dot','aoe','dispel','anti_buff'],
  swift: ['burn_dot','physical_dot','dot_synergy','sustained_damage']
};
