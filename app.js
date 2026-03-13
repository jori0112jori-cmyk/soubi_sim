// Auto-split from single-file build (v1.4)
// App logic
// --- マスタデータ ---






let previousAssignment = null;

// ===============================
// 🔁 乗り換え推奨度：色連動コピー（%で文言変化）
// ===============================

// === Shared helpers for squad-based transition/progress ===
function wpToPts(wp){
  wp = parseInt(wp, 10);
  if(!Number.isFinite(wp)) return 0;
  if(wp <= 0) return 50;
  wp = Math.max(0, Math.min(30, wp));
  let pts = 70;
  if (wp >= 30) pts += 360;
  else if (wp >= 20) pts += 190 + (wp - 20) * 8;
  else if (wp >= 10) pts += 90 + (wp - 10) * 5;
  else pts += 20 + wp * 3;
  return pts;
}

function normalizeWpInputFixed(wpRaw){
  if(wpRaw == null) return 0;
  const s = String(wpRaw).trim();
  if(!s || s === '-' || s.includes('未')) return 0;
  const v = parseInt(s, 10);
  return Number.isFinite(v) ? v : 0;
}

function toggleTransitionPanel(){
  const body = $id('power-transition-body');
  const btn = $id('power-transition-toggle');
  if(!body || !btn) return;
  const isOpen = window.getComputedStyle(body).display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '▼' : '▲';
  btn.setAttribute('aria-label', isOpen ? '兵種の育成目安を展開' : '兵種の育成目安を折りたたむ');
  if(!isOpen){
    try{ updateTransitionRecommendationUI(); }catch(e){}
  }
}


function getArmyTypeCounts(members){
  const counts = { tank:0, air:0, mis:0 };
  (members || []).forEach(m => {
    if(!m || !m.t) return;
    if(counts[m.t] !== undefined) counts[m.t]++;
  });
  return counts;
}


function getArmyBuffInfo(members){
  const counts = getArmyTypeCounts(members);
  const totalFilled = (members || []).filter(m => m && m.t && m.t !== 'none').length;
  const entries = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  const mainType = entries[0] ? entries[0][0] : 'tank';
  const maxCount = entries[0] ? entries[0][1] : 0;

  let buffRate = 0;
  if(maxCount >= 5) buffRate = 0.20;
  else if(maxCount === 4) buffRate = 0.15;
  else if(maxCount === 3){
    buffRate = (totalFilled >= 5) ? 0.10 : 0.05;
  }

  return { counts, mainType, maxCount, totalFilled, buffRate };
}



function applySelectiveTypeBuffToPts(members){
  const info = getArmyBuffInfo(members);
  const out = (members || []).map((m, idx) => {
    const basePts = wpToPts(m.wp);
    const memberKey = (m && m.id) ? `${m.id}__${idx}` : `idx__${idx}`;
    const buffedPts = (m.t === info.mainType) ? Math.round(basePts * (1 + info.buffRate)) : basePts;
    return Object.assign({}, m, { memberKey, basePts, buffedPts });
  });
  return Object.assign({ members: out }, info);
}


function collectArmyMembersForProgress(armyNo){
  const members = [];
  for(let p=1; p<=5; p++){
    const hidEl = $id(`h-${armyNo}-${p}`);
    const wpEl  = $id(`w-${armyNo}-${p}`);
    if(!hidEl || !wpEl) continue;
    const id = hidEl.value;
    if(!id || id === 'empty') continue;
    const h = HEROES[id];
    if(!h) continue;
    members.push({
      id,
      name: h.n,
      t: h.t,
      r: h.r,
      ur: h.ur,
      wp: normalizeWpInputFixed(wpEl.value)
    });
  }
  return members;
}



function computeDisplayedArmyProgress(armyNo){
  const members = collectArmyMembersForProgress(armyNo);
  if(!members.length){
    return { pct:0, maxCount:0, buffRate:0, detail:{attack:0, defense:0}, mainType:null };
  }

  const res = evaluateSquadRealCombat(members);

  const idealMembers = [
    { id:'i1', wp:30, t:'tank', r:'wall' },
    { id:'i2', wp:30, t:'tank', r:'wall' },
    { id:'i3', wp:30, t:'tank', r:'atk'  },
    { id:'i4', wp:30, t:'tank', r:'atk'  },
    { id:'i5', wp:30, t:'tank', r:'sup'  },
  ];
  const ideal = evaluateSquadRealCombat(idealMembers).score;

  const pct = Math.max(0, Math.min(100, Math.round((res.score / Math.max(ideal,1)) * 100)));

  return {
    pct: pct,
    maxCount: res.maxCount,
    buffRate: res.buffRate,
    mainType: res.mainType,
    detail:{ attack:res.attack, defense:res.defense }
  };
}



function updateSlotEvalsFromCurrentInputs(){
  const baseColors = { 1:"#10b981", 2:"#3b82f6", 3:"#8b5cf6" };

  for(let armyNo=1; armyNo<=3; armyNo++){
    const el = $id(`slot-eval-${armyNo}`);
    if(!el) continue;

    const prog = computeDisplayedArmyProgress(armyNo);
    const pct = prog.pct;
    const c = pct < 40 ? "#ef4444" : (pct < 60 ? "#f59e0b" : baseColors[armyNo]);

    const weak = (typeof detectArmyWeaknessFromDetail === 'function')
      ? detectArmyWeaknessFromDetail(prog.detail)
      : 'balance';

    const label = weak === "defense"
      ? "💬AI診断：耐久不足：大"
      : (weak === "attack"
          ? "💬AI診断：火力不足：大"
          : `💬AI診断：バランス：${pct>=80?'高':pct>=45?'中':'低'}`);

    let buff = "";
    if (prog.maxCount === 5) buff = "🏆20%バフ";
    else if (prog.maxCount === 4) buff = "🚜15%バフ";
    else if (prog.maxCount === 3) buff = (prog.buffRate >= 0.10 ? "⚠️10%バフ" : "⚠️5%バフ");

    const buffSpan = buff ? `<span class="buff-badge">${buff}</span>` : "";

    el.innerHTML =
      '<div class="row">' +
        '<div class="tag">' + label + '</div>' +
        '<div class="pct">進行度 <span style="color:' + c + ';">' + pct + '%</span></div>' +
      '</div>' +
      (buffSpan ? ('<div class="row sub">' + buffSpan + '</div>') : '') +
      '<div class="bar"><div style="width:' + pct + '%; background:' + c + ';"></div></div>';
  }
}

const TRANSITION_TEXT_TABLE = [
  { min: 85, label: "今すぐ乗り換え推奨", cls: "advice-now",  color: "#ef4444" },
  { min: 70, label: "乗り換えおすすめ",   cls: "advice-good", color: "#f59e0b" },
  { min: 55, label: "検討圏",           cls: "advice-soon", color: "#eab308" },
  // ここから下は「様子見」系（CSS既存クラスに寄せる）
  { min: 40, label: "様子見（中）",     cls: "advice-wait", color: "#64748b" },
  { min: 25, label: "様子見",           cls: "advice-wait", color: "#94a3b8" },
  { min: 0,  label: "まだ早い",         cls: "advice-wait", color: "#cbd5e1" }
];

function getTransitionAdvice(score){
  const sc = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  for(const row of TRANSITION_TEXT_TABLE){
    if(sc >= row.min) return { txt: row.label, cls: row.cls, color: row.color };
  }
  const last = TRANSITION_TEXT_TABLE[TRANSITION_TEXT_TABLE.length-1];
  return { txt: last.label, cls: last.cls, color: last.color };
}


// === 内部最適化ヘルパー（UI変更なし） ===
// getElementById をキャッシュ（初回 null の場合は再取得）
const $id = (() => {
  const cache = new Map();
  return (id) => {
    if (cache.has(id)) {
      const v = cache.get(id);
      // Re-rendered UI can replace nodes; cached elements may be detached.
      if (v && v.isConnected) return v;
      cache.delete(id);
    }
    const el = document.getElementById(id);
    if (el) cache.set(id, el);
    return el;
  };
})();

// AI計算をまとめて実行（連打・全軍更新時の多重計算を防止）
let __aiTimer = null;
function scheduleAi() {
  if (__aiTimer) clearTimeout(__aiTimer);
  __aiTimer = setTimeout(() => {
    __aiTimer = null;
    try { updateTransitionRecommendationUI(); } catch(e) {}
    try { updateGearPriorityUI(); } catch(e) {}
    generateAiSuggestion();
    try { updateSlotEvalsFromCurrentInputs(); } catch(e) {}
  }, 60);
}

const HOLD_PIN_STORAGE_KEY = 'lw_hold_pins_v1';
function loadHoldPins(){
  try{
    const raw = localStorage.getItem(HOLD_PIN_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  }catch(e){
    return new Set();
  }
}
function saveHoldPins(setObj){
  try{ localStorage.setItem(HOLD_PIN_STORAGE_KEY, JSON.stringify(Array.from(setObj || []))); }catch(e){}
}
function getHoldPinKey(item){
  const id = item && (item.id || item.heroId || item.key || '');
  const from = item && item.from != null ? item.from : '';
  const to = item && item.to != null ? item.to : '';
  return `${id}__${from}__${to}`;
}
function isHoldPinned(item){
  return loadHoldPins().has(getHoldPinKey(item));
}
function toggleHoldPinByKey(pinKey){
  const pins = loadHoldPins();
  if(pins.has(pinKey)) pins.delete(pinKey);
  else pins.add(pinKey);
  saveHoldPins(pins);
  try{ generateAiSuggestion(); }catch(e){}
}
function getHoldPinnedItems(items){
  const pins = loadHoldPins();
  return (items || []).filter(item => pins.has(getHoldPinKey(item)));
}
function holdPinChipHtml(item){
  const pinKey = getHoldPinKey(item);
  const pinned = isHoldPinned(item);
  const label = pinned ? '保留解除' : '保留';
  const cls = pinned ? ' is-active' : '';
  return `<button type="button" class="rankhero-pinbtn${cls}" onclick="toggleHoldPinByKey('${pinKey}')" aria-label="${label}" title="${label}">📌</button>`;
}
function holdPinnedSummaryHtml(items){
  const list = getHoldPinnedItems(items).slice(0, 4);
  if(!list.length) return '';
  const chips = list.map(item => {
    const pinKey = getHoldPinKey(item);
    return `<button type="button" class="hold-pin-chip" onclick="toggleHoldPinByKey('${pinKey}')">📌 ${item.name} Lv${item.from}→${item.to}</button>`;
  }).join('');
  return `<div class="hold-pin-summary"><div class="hold-pin-title">保留中の候補</div><div class="hold-pin-list">${chips}</div></div>`;
}


// === 戦力入力（任意）をAI判定に使う ===
function getUserPowers(){
  const t = parseFloat(($id('pow-tank') && $id('pow-tank').value) ? $id('pow-tank').value : 0) || 0;
  const a = parseFloat(($id('pow-air') && $id('pow-air').value) ? $id('pow-air').value : 0) || 0;
  const m = parseFloat(($id('pow-mis') && $id('pow-mis').value) ? $id('pow-mis').value : 0) || 0;
  if(t<=0 && a<=0 && m<=0) return null;
  return { tank:t, air:a, mis:m };
}

// 育成段階（初期/中盤/成熟）と移行先（航空寄り/ロケラン寄り）を汎用判定
function determineStageAndPreference(avgWp, powers){
  const stage = (avgWp < 12) ? 'early' : (avgWp < 22 ? 'mid' : 'mature'); // 武装Lvの体感に合わせる
  if(!powers){
    return { stage, pref: (stage === 'mature') ? 'mis' : 'air', scale: (stage === 'mid' ? 1.03 : (stage === 'early' ? 1.02 : 1.04)) };
  }
  const maxP = Math.max(powers.tank||0, powers.air||0, powers.mis||0, 1);
  const rel = { tank:(powers.tank||0)/maxP, air:(powers.air||0)/maxP, mis:(powers.mis||0)/maxP };

  // 初期/中盤：仕上がりが近い方（=戦力が高い方）へ寄せると移行が現実的
  // 成熟：ロケラン解禁を優先。ただし戦力差が大きいときはボーナスを控えめにする
  let pref = (stage === 'mature') ? 'mis' : (rel.air >= rel.mis ? 'air' : 'mis');

  // 移行先が弱いほど（ギャップが大きいほど）少しだけ背中を押す（上限+4%）
  const gap = Math.max(0, Math.min(1, 1 - (rel[pref]||0)));
  const extra = Math.min(0.04, gap * 0.05);
  const base = (stage === 'mid') ? 1.03 : (stage === 'early' ? 1.02 : 1.04);
  return { stage, pref, scale: base + extra };
}



// ================= 戦力差ベース：乗り換え推奨度（%） =================

function updateTransitionRecommendationUI(){
  const body = $id('power-transition-body') || $id('power-transition');
  if(!body) return;

  const labels = { tank:"戦車", air:"航空機", mis:"ロケラン" };
  const meta = ($id('current-meta')||{}).value || '';
  const pool = { tank:[], air:[], mis:[] };
  let totalPicked = 0;

  for(let s=1; s<=3; s++){
    for(let p=1; p<=5; p++){
      const hidEl = $id(`h-${s}-${p}`);
      const wpEl  = $id(`w-${s}-${p}`);
      if(!hidEl || !wpEl) continue;

      const id = hidEl.value;
      if(!id || id === 'empty') continue;

      const h = HEROES[id];
      if(!h || h.ur) continue;

      const wp = normalizeWpInputFixed(wpEl.value);
      pool[h.t].push({ id, name:h.n||id, wp, pts:wpToPts(wp) });
    }
  }

  const fivePower = {};
  const countByType = {};

  (["tank","air","mis"]).forEach(t=>{
    const list = (pool[t] || []).slice().sort((a,b)=>b.pts-a.pts);
    countByType[t] = list.length;
    const top5 = list.slice(0,5);
    const buffInfo = getArmyBuffInfo(top5);
    const sumBuffed = top5.reduce((s,o)=> s + (o.t === buffInfo.mainType ? Math.round(o.pts * (1 + buffInfo.buffRate)) : o.pts), 0);
    fivePower[t] = Math.round(sumBuffed);
    totalPicked += top5.length;
  });

  if(totalPicked < 5){
    const metaTxt = meta ? ` / 現在のメタ：<b class="text-meta">${labels[meta]||meta}</b>` : '';
    body.innerHTML = `
      <div class="section-title-spacer"></div>
      <div class="subtle-note">
        編成が少ないため計算できません（キャラを5人以上配置すると表示されます）。${metaTxt}
      </div>
    `;
    return;
  }

  const base = Object.keys(fivePower).sort((a,b)=>fivePower[b]-fivePower[a])[0];
  const baseP = Math.max(fivePower[base], 1);

  const targets = Object.keys(fivePower)
    .filter(t=>t!==base)
    .map(t=>{
      const ratio = baseP > 0 ? (fivePower[t] / baseP) : 0;
      let sc = Math.round(ratio * 100 + (meta && t === meta ? 10 : 0));
      sc = Math.max(0, Math.min(100, sc));
      return { t, sc };
    })
    .sort((a,b)=>b.sc-a.sc);

  const noteL = [];
  (["tank","air","mis"]).forEach(t=>{
    if(countByType[t] < 5) noteL.push(`${labels[t]}:${countByType[t]}/5`);
  });
  const note = noteL.length ? `（5人未満: ${noteL.join(" / ")}）` : "";
  const metaTxt = meta ? ` / 現在のメタ：<b class="text-meta">${labels[meta]||meta}</b>` : '';

  const line = (row)=>{
    const adv = getTransitionAdvice(row.sc);
    const color = adv.color;
    const w = Math.max(0, Math.min(100, row.sc));
    const shortage = Math.max(0, fivePower[base] - fivePower[row.t]);
    const shortagePct = Math.round((shortage / baseP) * 100);

    const tops = (pool[row.t] || [])
      .map(m=>{
        const nxt = m.wp < 10 ? 10 : (m.wp < 20 ? 20 : (m.wp < 30 ? 30 : null));
        if(nxt == null) return null;
        const gain = wpToPts(nxt) - wpToPts(m.wp);
        return { ...m, nxt, gain };
      })
      .filter(x=>x && x.gain > 0)
      .sort((a,b)=>(b.gain-a.gain)||(a.wp-b.wp))
      .slice(0,3);

    const topTxt = tops.length ? tops.map(x=>`${x.name} Lv${x.wp}→${x.nxt} (+${x.gain}pt)`).join('<br>') : '—';

    return `
      <div class="trans-row trans-row-top">
        <div class="trans-left">
          <div class="trans-title">${labels[base]} → ${labels[row.t]} <span class="trans-badge ${adv.cls}">${adv.txt}</span></div>
          <div class="trans-meta">不足：+${shortage}pt（${shortagePct}%）</div>
          <div class="trans-meta">推奨：${topTxt}</div>
        </div>
        <div class="trans-right trans-right-fixed">
          <div class="trans-pct" style="color:${color};">${row.sc}%</div>
          <div class="trans-bar trans-bar-fixed">
            <div style="width:${w}%; height:100%; background:${color};"></div>
          </div>
        </div>
      </div>
    `;
  };

  body.innerHTML = `
    <div class="section-title-spacer"></div>
    <div class="subtle-note subtle-note-gap">
      基準：5人同兵種の想定（${labels[base]}）${metaTxt} <span class="note-muted-strong">${note}</span>
    </div>
    ${targets.map(line).join('')}
    <div class="footnote-muted">
      ※ %は「移行先(上位5人+5バフ) / 主力(上位5人+5バフ)」の目安。メタ一致は+10%（目安）。不足pt/推奨は「次の節目(Lv10/20/30)」基準。
    </div>
  `;
}

function getPreciseCost(current, target) {
    if (current >= 30 || target <= current) return 0;
    let total = 0;
    for (let i = current + 1; i <= target; i++) {
        if (i === 1) total += 50;
        else if (i >= 2 && i <= 5) total += 20;
        else if (i >= 6 && i <= 10) total += 40;
        else if (i >= 11 && i <= 15) total += 60;
        else if (i >= 16 && i <= 20) total += 100;
        else if (i >= 21 && i <= 25) total += 150;
        else if (i >= 26 && i <= 30) total += 200;
    }
    return total;
}

function getNextMilestone(lv) {
    if (lv >= 30) return null;
    let target = lv < 10 ? 10 : (lv < 20 ? 20 : 30);
    return { target: target, cost: getPreciseCost(lv, target) };
}

window.onload = function() { 
    try{ let ref=document.getElementById('ref-panel'); if(ref) ref.style.display='none'; }catch(e){} 

    initSquadHTML(); 
    initGearHTML();
    // ⭐ 装備タブ：上部の「現在の装備」「目標の装備」入力を完全非表示（キャラ別入力に一本化）
    try{
        const hideGearTopBlock = (innerId) => {
            const inner = document.getElementById(innerId);
            if(!inner) return;
            // できるだけ大きいコンテナを隠す（見出しも含める）
            const host =
                inner.closest('.gear-card') ||
                inner.closest('.section') ||
                inner.closest('.card') ||
                inner.closest('.box') ||
                inner.closest('section') ||
                inner.parentElement?.parentElement ||
                inner.parentElement ||
                inner;
            if(host) host.style.display = 'none';
        };
        hideGearTopBlock('current-gear-rows');
        hideGearTopBlock('target-gear-rows');
    }catch(e){}
loadAllData(); 
    try { renderSlots(); } catch(e) {}
   
   // ★★★ これを追加（超重要）
    updateTransitionRecommendationUI();
    try{ updateSlotEvalsFromCurrentInputs(); }catch(e){}
};

function showTab(id, el) { 
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active')); 
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active')); 
    $id('tab-'+id).classList.add('active'); 
    if(el) el.classList.add('active'); 
    let footer = $id('footer-bar');
    let ref = document.getElementById('ref-panel');
    if(ref) ref.style.display = (id === 'guide') ? 'block' : 'none';
    if(footer) footer.style.display = 'none';
}


function makeDataSvg(svg){
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function getInitialLabel(heroId){
  try{
    const h = HEROES && HEROES[heroId];
    if(h && h.n && h.n !== '未設定') return h.n;
  }catch(e){}
  return heroId || '';
}

function getHeroImagePath(heroId){
  if(!heroId || heroId === 'empty') return '';
  return `img/${heroId}.webp`;
}


function heroImgOnError(img){
  try{
    img.style.opacity = '0';
  }catch(e){}
}

function makeCircleIcon(text, bg, fg){
  return makeDataSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="${bg}"/><text x="32" y="39" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" font-weight="700" fill="${fg}">${text}</text></svg>`);
}

function makeRoundedIcon(text, bg, fg){
  return makeDataSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="4" y="4" width="56" height="56" rx="14" fill="${bg}"/><text x="32" y="39" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="${fg}">${text}</text></svg>`);
}

function makeShardIcon(){
  return makeDataSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#f97316"/></linearGradient></defs><rect x="6" y="6" width="52" height="52" rx="14" fill="url(#g)"/><path d="M32 14l8 14-8 22-8-22z" fill="rgba(255,255,255,.92)"/></svg>`);
}

function showToast(msg) { 
    let x = $id("toast"); 
    x.innerText = msg; x.style.visibility = "visible"; x.style.bottom = "80px"; 
    setTimeout(() => { x.style.visibility = "hidden"; x.style.bottom = "30px"; }, 2500); 
}


/* === UIアイコン（兵種/役割） === */
const IMG = "img/";
const TYPE_ICON = { tank: IMG + "tank.png", air: IMG + "air.png", mis: IMG + "misile.png" };
const ROLE_ICON = { atk: IMG + "karyoku.png", wall: IMG + "tateyaku.png", sup: IMG + "support.png" };
const SHARD_ICON_SRC = IMG + "original.webp";
function uiIcon(src, alt){
  if(!src) return "";
  return `<img class="ui-ico" src="${src}" alt="${alt||''}">`;
}
function typeIcon(t){ return uiIcon(TYPE_ICON[t], t); }
function roleIcon(r){ return uiIcon(ROLE_ICON[r], r); }

/* 育成ランキング表示用：兵種アイコン - キャラ名 - 役割アイコン */
function effTitleLine(rank, item){
  const t = item.type || item.t;
  const r = item.roleKey || item.r;
  return `<div class="eff-title-line">${typeIcon(t)}<b>${rank}. ${item.name}</b>${roleIcon(r)}</div>`;
}

// ===============================
// 育成ランキング：カード用CSSを強制注入（styles.css をいじっても効かない問題対策）
// ===============================
(function(){
  try{
    if(document.getElementById('__eff_rank_css')) return;
    const st = document.createElement('style');
    st.id = '__eff_rank_css';
    st.textContent = `
      .eff-card{ padding:10px 10px; border-radius:12px; }
      .eff-card + .eff-card{ border-top:1px dashed #fbcfe8; margin-top:8px; padding-top:12px; }
      .eff-card-best{ background:#fff7ed; border:1px solid #fdba74; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
      .eff-row{ display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
      .eff-left{ line-height:1.4; min-width:0; }
      .eff-right{ display:flex; flex-direction:column; align-items:flex-end; text-align:right; gap:6px; flex-shrink:0; }
      .eff-sub{ display:flex; justify-content:flex-end; width:100%; }
      .eff-subline{ display:inline-flex; align-items:center; gap:6px; white-space:nowrap; color:#64748b; font-size:0.78rem; font-weight:900; }
      .eff-plus{ font-weight:900; }
      .gear-cost{ display:inline-flex; align-items:center; gap:4px; white-space:nowrap; }
      .gear-cost img{ width:36px; height:36px; flex-shrink:0; }
      .gear-num{ font-size:1.15em; font-weight:900; }
      .gear-cost .sep{ opacity:.65; margin-right:2px; }
      .rankhero-topbadge{ display:flex; align-items:flex-start; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
      .rankhero-pinbtn{ appearance:none; border:1px solid #d1d5db; background:#fff; color:#94a3b8; border-radius:999px; width:24px; height:24px; min-width:24px; padding:0; display:inline-flex; align-items:center; justify-content:center; font-size:.85rem; font-weight:900; line-height:1; cursor:pointer; transform:translateY(-3px); }
      .rankhero-pinbtn.is-active{ background:#fff7ed; border-color:#fdba74; color:#c2410c; border-radius:10px; width:auto; min-width:34px; padding:0 8px; }
      .hold-pin-summary{ margin:0 0 10px; padding:10px; border:1px dashed #fbcfe8; border-radius:10px; background:#fff; }
      .hold-pin-title{ font-size:.82rem; font-weight:900; color:#a21caf; margin-bottom:6px; }
      .hold-pin-list{ display:flex; flex-wrap:wrap; gap:6px; }
      .hold-pin-chip{ appearance:none; border:1px solid #fdba74; background:#fff7ed; color:#c2410c; border-radius:999px; padding:5px 10px; font-size:.74rem; font-weight:900; cursor:pointer; }
    `;
    document.head.appendChild(st);
  }catch(e){}
})();

function effCardHtml(rank, item, opts){
  opts = opts || {};
  const isBest = !!opts.isBest;
  const isTop = !!opts.isTop;
  const mode = opts.mode || 'normal'; // normal | unlock

  const safeItem = Object.assign({}, item || {});
  // フォールバック（データ差分吸収）
  safeItem.type = safeItem.type || safeItem.t;
  safeItem.roleKey = safeItem.roleKey || safeItem.r;
  safeItem.name = safeItem.name || safeItem.n;

  const lvLine = (safeItem.from !== undefined && safeItem.to !== undefined)
    ? `<span class="eff-lv">(Lv${safeItem.from}→${safeItem.to})</span>`
    : '';

  const badge = (mode === 'normal' && safeItem.growthType) ? growthBadge(safeItem.growthType) : (opts.rightBadge || '');

  let sub = '';
  if(mode === 'unlock'){
    const unlockLv = (safeItem.to !== undefined) ? ` <span class="eff-lv">(Lv${safeItem.from||0}→${safeItem.to})</span>` : '';
    sub = `<div class="eff-sub"><span class="eff-subline">解放時${unlockLv} <span class="eff-plus">+${safeItem.gain}</span></span></div>`;
  }else{
    const costPart = (safeItem.cost !== undefined && safeItem.cost !== null)
      ? `<span class="gear-cost"><span class="sep">/</span><img src="${SHARD_ICON_SRC}" alt="gear"> <span class="gear-num">${safeItem.cost}</span></span>`
      : '';
    sub = `<div class="eff-sub"><span class="eff-subline"><span class="eff-plus">+${safeItem.gain}</span>${costPart ? ' ' + costPart : ''}</span></div>`;
  }

  return `
    <div class="eff-card ${isTop?'eff-card-top':''} ${isBest?'eff-card-best':''}">
      <div class="eff-row">
        <div class="eff-left">
          ${effTitleLine(rank, safeItem)}
          ${isBest ? '<span class="eff-best">👑 最優先</span>' : ''}
          ${lvLine}
        </div>
        <div class="eff-right">
          ${badge}
          ${sub}
        </div>
      </div>
    </div>
  `;
}


function reinfCardHtml(rank, item){
  const safeItem = Object.assign({}, item || {});
  safeItem.type = safeItem.type || safeItem.t;
  safeItem.roleKey = safeItem.roleKey || safeItem.r;
  safeItem.name = safeItem.name || safeItem.n || '';
  safeItem.id = safeItem.id || safeItem.key || safeItem.heroId || '';

  // 育成ランキングと完全に同じ描画ルートを使う
  // （画像・名前行・右側メタの構造を揃える）
  return `<div class="reinf-card">${topRankCardHtml(rank, safeItem, { compact:true, showPin:false })}</div>`;
}

function topRankCardHtml(rank, item, opts){
  opts = opts || {};
  const compact = !!opts.compact;
  const safeItem = Object.assign({}, item || {});
  safeItem.type = safeItem.type || safeItem.t;
  safeItem.roleKey = safeItem.roleKey || safeItem.r;
  safeItem.name = safeItem.name || safeItem.n || '';

  const lvLine = (safeItem.from !== undefined && safeItem.to !== undefined)
    ? `<div class="rankhero-lv">(Lv${safeItem.from}→${safeItem.to})</div>`
    : '';

  const costPart = (safeItem.cost !== undefined && safeItem.cost !== null)
    ? `<span class="rankhero-cost"><span class="rankhero-cost-sep">/</span><img class="rankhero-cost-icon" src="${SHARD_ICON_SRC}" alt="gear"> <span class="rankhero-cost-num">${safeItem.cost}</span></span>`
    : '';

  const costTierLabel = safeItem.costTierLabel
    ? `<span class="rankhero-mini rankhero-mini--cost">${safeItem.costTierLabel}</span>`
    : '';
  const safeHintLabel = safeItem.safeHintLabel
    ? `<span class="rankhero-mini rankhero-mini--safe">${safeItem.safeHintLabel}</span>`
    : '';

  const badge = safeItem.growthType ? growthBadge(safeItem.growthType) : (opts.rightBadge || '');
  const pinBtn = (opts.showPin === false) ? '' : holdPinChipHtml(safeItem);
  const cardClass = compact ? 'rankhero-card rankhero-card--compact' : `rankhero-card ${rank>1?'rankhero-card--split':''}`;
  const rowClass = compact ? 'rankhero-row rankhero-row--compact' : 'rankhero-row';

  return `
    <div class="${cardClass}">
      <div class="${rowClass}">
        <div class="rankhero-visual">
          <div class="rankhero-chip-row">
            <span class="rankhero-chip">${typeIcon(safeItem.type)}</span>
            <span class="rankhero-chip">${roleIcon(safeItem.roleKey)}</span>
          </div>
          <span class="rankhero-avatar-wrap">
            <img class="rankhero-avatar-img" src="${getHeroImagePath(safeItem.id || safeItem.key || safeItem.heroId || '')}" alt="${safeItem.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <span class="rankhero-avatar-fallback" style="display:none;">${typeIcon(safeItem.type)}</span>
          </span>
          <div class="rankhero-name">${rank}. ${safeItem.name}</div>
        </div>

        <div class="rankhero-body">
          <div class="rankhero-topline">
            ${lvLine}
            <div class="rankhero-topbadge">${badge}${pinBtn}</div>
          </div>
          <div class="rankhero-bottomline">
            <div class="rankhero-leftline">
              <div class="rankhero-gain">+${safeItem.gain}</div>
              ${safeHintLabel}${costTierLabel}
            </div>
            <div class="rankhero-costwrap">${costPart}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 育成効率ランキング：Top3 + 「もっと見る」トグル
function toggleEffMore() {
    let more = $id('eff-more-list');
    let btn = $id('eff-more-btn');
    if(!more || !btn) return;
    let open = more.getAttribute('data-open') === '1';
    if(open) {
        more.style.display = 'none';
        more.setAttribute('data-open','0');
        btn.innerText = 'もっと見る（おすすめ）';
    } else {
        more.style.display = 'block';
        more.setAttribute('data-open','1');
        btn.innerText = '閉じる';
    }
}

function initSquadHTML() {
    let html = '';
    let opts = '<option value="empty">未設定</option>';
    let grps = { tank: '<optgroup label="戦車">', air: '<optgroup label="航空">', mis: '<optgroup label="ロケラン">' };
    for(let k in HEROES) {
        if(k==='empty') continue;
        grps[HEROES[k].t] += `<option value="${k}">${HEROES[k].n}${HEROES[k].ur?"(UR)":""}</option>`;
    }
    opts += grps.tank + '</optgroup>' + grps.air + '</optgroup>' + grps.mis + '</optgroup>';

    for(let s=1; s<=4; s++) {
        let isB = s===4;
        html += `<div class="squad-section"><div class="squad-header" onclick="toggleSquad(${s}, this)"><span>${isB?'控え室':'第'+s+'部隊'}</span><span>▶</span></div><div class="squad-body ${s===1?'open':''}" id="sq-body-${s}">`;
        
        if(!isB) { html += `<div id="adv-${s}" class="advice"></div>`; }
        
        html += `<div class="squad-grid">`;
        let slots = [];
        for(let p=1; p<=(isB?10:5); p++) {
            slots.push(`
            <div class="interactive-card" id="card-${s}-${p}">
                <div class="prio-badge" id="prio-${s}-${p}"></div>
                <div class="hero-portrait" id="img-${s}-${p}" style="display:none;"></div>
                <div class="card-icon-wrap">
                    <div class="icon-box" id="f-${s}-${p}" style="display:none;"></div>
                    <div class="icon-box" id="r-${s}-${p}" style="display:none;"></div>
                </div>
                <select class="card-select" id="h-${s}-${p}" onchange="updateSquad(${s})">${opts}</select>
                <div class="card-stepper" id="wp-box-${s}-${p}">
                    <button onclick="stepWp(${s},${p},-1)">-</button>
                    <input id="w-${s}-${p}" value="0" readonly>
                    <button onclick="stepWp(${s},${p},1)">+</button>
                </div>
                <div id="syn-${s}-${p}" class="shard-info"></div>
            </div>`);
        }
        
        if(isB) {
            html += `<div class="v-row bench">${slots.join('')}</div>`;
        } else {
            html += `<div class="v-row">${slots[0]}${slots[1]}</div><div class="v-row">${slots[2]}${slots[3]}${slots[4]}</div>`;
        }
        html += `</div></div></div>`;
    }
    $id('squad-container').innerHTML = html;
}

function toggleSquad(s, header) { let b = $id(`sq-body-${s}`); b.classList.toggle('open'); header.children[1].innerText = b.classList.contains('open') ? '▼' : '▶'; }
function stepWp(s, p, d) { let el = $id(`w-${s}-${p}`); if(el.value.includes("未"))return; el.value = Math.min(Math.max((parseInt(el.value)||0)+d, 0), 30); updateSquad(s); }
function updateAllSquads() { for(let i=1; i<=4; i++) updateSquad(i); try{ updateSlotEvalsFromCurrentInputs(); }catch(e){} try{ updateTransitionRecommendationUI(); }catch(e){} }

function lockDuplicateHeroes(s) {
    let selects = Array.from(document.querySelectorAll(`#sq-body-${s} .card-select`));
    let vals = selects.map(el => el.value).filter(v => v !== 'empty');
    selects.forEach(sel => {
        let prev = sel.getAttribute('data-prev') || 'empty';
        if (sel.value !== 'empty' && vals.filter(v => v === sel.value).length > 1) {
            showToast("⚠️ 同じ部隊内でキャラが重複しています");
            sel.value = prev; vals = selects.map(el => el.value).filter(v => v !== 'empty');
        } else { sel.setAttribute('data-prev', sel.value); }
        Array.from(sel.options).forEach(opt => {
            let isDup = opt.value !== 'empty' && vals.includes(opt.value) && opt.value !== sel.value;
            opt.disabled = isDup;
            if (isDup) { if (!opt.text.includes('済')) opt.text = opt.text + " (済)"; opt.style.color = "rgba(255,255,255,0.3)"; } 
            else { opt.text = opt.text.replace(" (済)", ""); opt.style.color = "#fff"; }
        });
    });
}

function updateSquad(s) {
    lockDuplicateHeroes(s);
    let actPool = []; let counts = {tank:0, air:0, mis:0, none:0};
    
    for(let p=1; p<=(s===4?10:5); p++) {
        let hid = $id(`h-${s}-${p}`).value, wpEl = $id(`w-${s}-${p}`);
        let h = HEROES[hid], v = parseInt(wpEl.value) || 0;
        let card = $id(`card-${s}-${p}`), fIcon = $id(`f-${s}-${p}`), rIcon = $id(`r-${s}-${p}`), imgEl = $id(`img-${s}-${p}`);
        card.className = 'interactive-card'; $id(`prio-${s}-${p}`).style.display = 'none';
        
        if(h.ur || hid === 'empty') { $id(`wp-box-${s}-${p}`).style.opacity = '0.3'; wpEl.value = h.ur ? "未実装" : "-"; v = 0; } 
        else { $id(`wp-box-${s}-${p}`).style.opacity = '1'; wpEl.value = v; }
        
        if (hid === 'empty') { 
            card.classList.add('card-empty'); counts.none++; card.style.backgroundImage = 'none'; if(imgEl){ imgEl.style.display = 'none'; imgEl.style.backgroundImage = 'none'; } fIcon.style.display = 'none'; rIcon.style.display = 'none'; $id(`syn-${s}-${p}`).innerHTML = '';
        } else {
            card.classList.add('card-'+(h.ur?'ur':h.t));
            card.style.backgroundImage = 'none';
            if(imgEl){ imgEl.style.display = 'block'; imgEl.style.backgroundImage = `url(${getHeroImagePath(hid)})`; }
            
            // 💡 兵種/役割アイコン（埋め込みSVG）
            fIcon.innerHTML = uiIcon(TYPE_ICON[h.t] || TYPE_ICON.tank, h.t || 'type');
            rIcon.innerHTML = uiIcon(ROLE_ICON[h.r] || ROLE_ICON.sup, h.r || 'role');
            
            if (v >= 30) {
                $id(`syn-${s}-${p}`).innerHTML = `<div class="awaken-badge">👑 覚醒</div>`;
            } else if (v === 0 && !h.ur) {
                $id(`syn-${s}-${p}`).innerHTML = `<span class="shard-info" style="color:#94a3b8; font-size:0.8rem;">未解放</span>`;
                actPool.push({ p:p, h:h, wp:v });
            } else if (v > 0) { 
                let ms = getNextMilestone(v);
                let iconHtml = `<img src="${SHARD_ICON_SRC}" class="shard-icon">`;
                $id(`syn-${s}-${p}`).innerHTML = ms ? `<div class="shard-info"><span style="font-size:0.7rem; margin-right:1px;">Lv${ms.target}迄</span>${iconHtml}<span style="font-size:0.95rem;">${ms.cost}</span></div>` : ''; 
                actPool.push({ p:p, h:h, wp:v }); 
            }
        }
    }
    
    // 💡 優先度バッジ（①②③）ロジックの完全復元
    if(s !== 4 && actPool.length > 0) { 
        let squadAtks = actPool.filter(m => m.h.r === 'atk').sort((a,b)=>b.h.pr - a.h.pr);
        let squadWalls = actPool.filter(m => m.h.r === 'wall').sort((a,b)=>b.h.pr - a.h.pr);
        
        actPool.forEach(m => {
            let score = 0;
            let isMainAtk = squadAtks[0] === m;
            let isMainWall = squadWalls[0] === m;
            let isSubWall = squadWalls.length > 1 && squadWalls.includes(m) && !isMainWall;
            let isSubAtk = squadAtks.length > 1 && squadAtks.includes(m) && !isMainAtk;
            let isSup = m.h.r === 'sup';
            
            if (isMainAtk && m.wp < 20) score = 10000 + m.h.pr;
            else if (isMainWall && m.wp < 10) score = 9000 + m.h.pr;
            else if (m.wp < 10) score = 8000 + m.h.pr;
            else if (isMainWall && m.wp < 20) score = 7000 + m.h.pr;
            else if (isSubAtk && m.wp < 20) score = 6000 + m.h.pr;
            else if (isSup && m.wp < 20) score = 5000 + m.h.pr;
            else if (isMainAtk && m.wp < 30) score = 4000 + m.h.pr;
            else if (isSubWall && m.wp < 20) score = 3000 + m.h.pr;
            else score = m.h.pr;
            
            m.dynamicPr = score;
        });

        actPool.sort((a,b) => b.dynamicPr - a.dynamicPr);
        actPool.forEach((m,i)=>{ 
            if(i<3){ 
                let el=$id(`prio-${s}-${m.p}`); 
                el.innerHTML=["①","②","③"][i]; 
                el.className=`prio-badge prio-${i+1}`; 
                el.style.display='flex'; 
            }
        }); 
    }
    
    if(s!==4) analyzeSquad(s, counts);
    saveData(); 
    
    // 💡 リアルタイム更新
    scheduleAi();
}

function analyzeSquad(s, c) {
    let div = $id(`adv-${s}`); 
    let max = Math.max(c.tank, c.air, c.mis);
    
    if(max === 0) { 
        div.style.display = 'block'; 
        div.className = "advice adv-ng"; 
        div.innerHTML = `⚠️ <b>編成未完了：</b> 5人配置してバフを発動させましょう。`;
        return; 
    }
    
    div.style.display = 'block';
    let status = max === 5 ? 'perfect' : (max === 4 || max === 3) ? 'ok' : 'ng';
    
    let msg = max === 5 ? `🏆 <b>同兵種5体編成：</b> 同兵種5体に兵種バフ(20%)が適用されます。` 
            : max === 4 ? `🚜 <b>同兵種4体編成：</b> 同兵種4体のみに兵種バフ(15%)が適用されます。` 
            : max === 3 ? (c.none === 2
                ? `⚠️ <b>同兵種3体編成：</b> 同兵種3体のみのため兵種バフは5%です。`
                : `⚠️ <b>同兵種3体+別兵種2体：</b> 同兵種3体のみに兵種バフ(10%)が適用されます。`) 
            : `⚠️ <b>兵種バフ不足：</b> 同兵種3体未満のため兵種バフは発生しません。`;
    
    if(max < 5 && max > 0 && c.none === 0) {
        msg += `<br><span style="display:inline-block; margin-top:6px; font-size:0.75rem; color:#b91c1c; background:#fef2f2; padding:6px 8px; border-radius:6px; border:1px solid #fecaca; line-height:1.4;">⚠️ <b>注意：</b> 出張キャラ（別兵種）はメイン兵種のスキルチップ恩恵を受けられないため、ステータスが大きく低下します。</span>`;
    }
    div.className = "advice adv-" + status; div.innerHTML = msg;
}

function combinations(arr, k) {
    let results = [];
    let backtrack = (start, combo) => {
        if(combo.length === k) { results.push([...combo]); return; }
        for(let i=start; i<arr.length; i++) {
            combo.push(arr[i]); backtrack(i+1, combo); combo.pop();
        }
    };
    backtrack(0, []);
    return results;
}


function evaluateSquadRealCombat(squadMembers) {
    if(squadMembers.length === 0) return {
        score: 0, maxCount: 0, buffRate: 0, mainType: null,
        attack: 0, defense: 0, totalPts: 0, buffedTotalPts: 0
    };

    squadMembers.forEach(m => {
        let pts = wpToPts(m.wp);
        if (m.ur) pts -= 20;
        m.basePts = Math.max(0, pts);
    });

    const buffInfo = getArmyBuffInfo(squadMembers);
    const mainType = buffInfo.mainType;
    const maxCount = buffInfo.maxCount;
    const buffRate = buffInfo.buffRate;

    let adjustedTotal = 0;
    let attackScore = 0;
    let defenseScore = 0;

    const roleCounts = { atk:0, wall:0, sup:0 };
    squadMembers.forEach(m => { if(roleCounts[m.r] !== undefined) roleCounts[m.r]++; });

    let compMult = 1.0;
    if(roleCounts.wall >= 2) compMult *= (roleCounts.wall === 2 ? 1.05 : 0.98);
    else if(roleCounts.wall === 1) compMult *= 0.92;
    else compMult *= 0.85;

    if(roleCounts.atk === 0) compMult *= 0.80;
    if(roleCounts.sup >= 2) compMult *= 0.97;

    squadMembers.forEach(m => {
        const isMainType = m.t === mainType;
        const buffedBase = isMainType ? (m.basePts * (1 + buffRate)) : m.basePts;

        let charScore = buffedBase;
        if (!isMainType) {
            let penalty = 0;
            if (m.r === 'atk') penalty = charScore * 0.40;
            else if (m.r === 'wall') penalty = m.wp >= 20 ? charScore * 0.15 : charScore * 0.30;
            else penalty = charScore * 0.25;
            charScore -= penalty;
        } else {
            charScore += charScore * 0.10;
        }

        let finalCharScore = Math.max(0, charScore);
        adjustedTotal += finalCharScore;

        if (m.r === 'atk') attackScore += finalCharScore;
        else if (m.r === 'wall') defenseScore += finalCharScore;
        else { attackScore += finalCharScore * 0.5; defenseScore += finalCharScore * 0.5; }
    });

    let currentMeta = $id('current-meta').value;
    let metaMult = (mainType === currentMeta) ? 1.12 : 1.0;

    const totalPts = Math.round(squadMembers.reduce((s,m)=>s + m.basePts, 0));
    const buffedTotalPts = Math.round(squadMembers.reduce((s,m)=>s + (m.t === mainType ? m.basePts * (1 + buffRate) : m.basePts), 0));

    return {
        score: Math.round(adjustedTotal * metaMult * compMult),
        maxCount: maxCount,
        buffRate: buffRate,
        mainType: mainType,
        attack: Math.round(attackScore * metaMult * compMult),
        defense: Math.round(defenseScore * metaMult * compMult),
        totalPts: totalPts,
        buffedTotalPts: buffedTotalPts
    };
}



function getMemberBasePts(member){
    if(!member) return 0;
    let pts = wpToPts(member.wp);
    if(member.ur) pts -= 20;
    return Math.max(0, pts);
}

function calcMultiArmyTotalScore(assignment){
    if(!assignment) return 0;

    const army1 = evaluateSquadRealCombat(assignment.army1 || []).score;
    const army2 = evaluateSquadRealCombat(assignment.army2 || []).score;
    const army3 = evaluateSquadRealCombat(assignment.army3 || []).score;

    const bench = (assignment.bench || []).reduce((s, m) => s + getMemberBasePts(m), 0);
    const benchScore = Math.round(bench * 0.25);

    return (
        Math.round(army1 * 1.00) +
        Math.round(army2 * 0.90) +
        Math.round(army3 * 0.85) +
        benchScore
    );
}

function optimizeMultiArmy(members, squadSize) {
    let pool = members;
    let combos1 = combinations(pool, squadSize);
    let best1 = null, best1Score = -1, maxC1 = 0, b1Details = {attack:0, defense:0};
    
    combos1.forEach(combo => {
        let res = evaluateSquadRealCombat(combo);
        if(res.score > best1Score) { 
            best1Score = res.score; 
            best1 = combo; 
            maxC1 = res.maxCount; 
            b1Details = {attack: res.attack, defense: res.defense}; 
        }
    });

    let rem1 = pool.filter(m => !best1.some(b => b.id === m.id));

    let best2 = [], best2Score = 0, maxC2 = 0, b2Details = {attack:0, defense:0};
    if(rem1.length >= squadSize) {
        let combos2 = combinations(rem1, squadSize);
        combos2.forEach(combo => {
            let res = evaluateSquadRealCombat(combo);
            if(res.score > best2Score) { 
                best2Score = res.score; 
                best2 = combo; 
                maxC2 = res.maxCount; 
                b2Details = {attack: res.attack, defense: res.defense}; 
            }
        });
    } else { 
        let res = evaluateSquadRealCombat(rem1);
        best2 = rem1; 
        best2Score = res.score; 
        maxC2 = res.maxCount;
        b2Details = {attack: res.attack, defense: res.defense}; 
    }

    let rem2 = rem1.filter(m => !best2.some(b => b.id === m.id));

    let best3 = [], best3Score = 0, maxC3 = 0, b3Details = {attack:0, defense:0};
    if(rem2.length >= squadSize) {
        let combos3 = combinations(rem2, squadSize);
        combos3.forEach(combo => {
            let res = evaluateSquadRealCombat(combo);
            if(res.score > best3Score) { 
                best3Score = res.score; 
                best3 = combo; 
                maxC3 = res.maxCount; 
                b3Details = {attack: res.attack, defense: res.defense}; 
            }
        });
    } else { 
        let res = evaluateSquadRealCombat(rem2);
        best3 = rem2; 
        best3Score = res.score; 
        maxC3 = res.maxCount;
        b3Details = {attack: res.attack, defense: res.defense}; 
    }

    let bench = rem2.filter(m => !best3.some(b => b.id === m.id));
    // 3軍までの総合力を重視（同盟/総合寄り）
    // 以前の「1軍偏重」(army2:0.75 / army3:0.5) を緩和し、2〜3軍の価値を引き上げる
    let benchScore = Math.round(bench.reduce((s, m) => s + m.basePts, 0) * 0.25);

    let wScores = {
        army1: best1Score,
        army2: Math.round(best2Score * 0.90),
        army3: Math.round(best3Score * 0.85),
        bench: benchScore
    };
    
    return {
        assignment: { army1: best1, army2: best2, army3: best3, bench: bench },
        weightedScores: wScores,
        rawScores: { army1: best1Score, army2: best2Score, army3: best3Score, bench: benchScore },
        totalScore: calcMultiArmyTotalScore({ army1: best1, army2: best2, army3: best3, bench: bench }),
        maxCounts: { army1: maxC1, army2: maxC2, army3: maxC3 },
        armyDetails: { army1: b1Details, army2: b2Details, army3: b3Details }
    };
}


function getGrowthType(atkGain, defGain, targetLv){
    // axis: atk / wall / bal
    const diff = atkGain - defGain;
    const absA = Math.abs(atkGain);
    const absD = Math.abs(defGain);

    // バランス寄り（差が小さい）なら bal 扱い
    const isBalanced = (absA + absD === 0) ? true : (Math.abs(diff) <= (absA + absD) * 0.18);
    if(isBalanced){
        // 伸びの大きさは「到達目標」で決める（体感：→10=中 / →20=大 / →30=超）
        let level = 2;
        if(targetLv >= 30) level = 4;
        else if(targetLv >= 20) level = 3;
        else level = 2;
        const label = (level===4 ? "バランス超UP" : level===3 ? "バランス大UP" : "バランス中UP");
        return { level, axis:"bal", label, strong: (level===4) };
    }

    const axis = (diff > 0) ? "atk" : "wall";

    // 伸びの大きさは「到達目標」で決める（体感：→10=中 / →20=大 / →30=超）
    // targetLv 未指定の互換用：従来どおり gain からざっくり推定
    let level = 2;
    if(typeof targetLv === "number"){
        if(targetLv >= 30) level = 4;
        else if(targetLv >= 20) level = 3;
        else level = 2;
    } else {
        // 旧：gain-based bucket
        const absB = Math.max(absA, absD);
        const T2 = 25, T3 = 55, T4 = 90;
        if(absB >= T4) level = 4;
        else if(absB >= T3) level = 3;
        else level = 2;
    }

    const label =
        (axis === "atk")
            ? (level===4 ? "火力:超UP" : level===3 ? "火力:大UP" : "火力:中UP")
            : (level===4 ? "耐久:超UP" : level===3 ? "耐久:大UP" : "耐久:中UP");

    return { level, axis, label, strong: (level===4) };
}


function growthBadge(g){
    // g: {level, axis, label, strong}
    if(!g || !g.label) g = { level: 1, axis: "bal", label: "バランス", strong:false };

    const axis = g.axis || "bal";
    const strong = !!g.strong;

    let cls = "bal";
    if(axis === "atk") cls = "atk" + (strong ? " strong" : "");
    else if(axis === "wall") cls = "wall" + (strong ? " strong" : "");

    // バッジは「impact-badge」スタイルを流用（既存CSSを活かす）
    const icoCls = (axis === "atk") ? "atk" : (axis === "wall") ? "wall" : "bal";
    return `<span class="impact-badge ${cls}"><span class="impact-ico ${icoCls}"></span>${g.label}</span>`;
}


function detectArmyWeaknessFromDetail(detail){
    if(!detail) return "balance";
    let total = detail.attack + detail.defense;
    if(total === 0) return "balance";

    let attackRatio = detail.attack / total;

    if(attackRatio > 0.60) return "defense";
    if(attackRatio < 0.45) return "attack";

    return "balance";
}


function __aiGetProfile(heroId){
  return (typeof HERO_ROLE_PROFILE === 'object' && HERO_ROLE_PROFILE[heroId])
    ? HERO_ROLE_PROFILE[heroId]
    : { role:'other', lane:'back', core:false };
}
function __aiGetLongterm(heroId){
  return (typeof HERO_LONGTERM_VALUE === 'object' && Number.isFinite(HERO_LONGTERM_VALUE[heroId]))
    ? HERO_LONGTERM_VALUE[heroId]
    : 0.55;
}
function __aiCounterMap(type){
  return (typeof TYPE_COUNTER_WEIGHT === 'object' && TYPE_COUNTER_WEIGHT[type])
    ? TYPE_COUNTER_WEIGHT[type]
    : { tank:0.5, air:0.5, mis:0.5 };
}
function __aiTopByType(roster, type, n=5){
  return roster.filter(h=>h.t===type).slice().sort((a,b)=>(b.wp-a.wp)||((HEROES[b.id]?.pr||0)-(HEROES[a.id]?.pr||0))).slice(0,n);
}
function __aiAvgWp(arr){ return arr.length ? arr.reduce((s,x)=>s+x.wp,0)/arr.length : 0; }
function __aiHasAny(arr, ids){ return arr.some(x=>ids.includes(x.id)); }
function __aiCostTierLabel(from, to){
  if(to >= 30) return '高コスト';
  if(to >= 20) return '中コスト';
  return '低コスト';
}
function __aiSafeHint(hero, to, context){
  const p = __aiGetProfile(hero.id);
  if(to === 20 && (p.role === 'front_tank' || p.role === 'support')) return '安定';
  if(to === 20 && hero.t === context.currentCombatType) return '安定';
  return '';
}
function __aiBuildContext(roster, base){
  const topTank = __aiTopByType(roster, 'tank');
  const topAir = __aiTopByType(roster, 'air');
  const topMis = __aiTopByType(roster, 'mis');
  const progress = {
    tank:{ top:topTank, avgWp:__aiAvgWp(topTank), count10:topTank.filter(x=>x.wp>=10).length, count20:topTank.filter(x=>x.wp>=20).length, count30:topTank.filter(x=>x.wp>=30).length, coreCount:topTank.filter(x=>['kimberly','murphy','williams','marshall','stetmann'].includes(x.id)).length },
    air:{ top:topAir, avgWp:__aiAvgWp(topAir), count10:topAir.filter(x=>x.wp>=10).length, count20:topAir.filter(x=>x.wp>=20).length, count30:topAir.filter(x=>x.wp>=30).length, coreCount:topAir.filter(x=>['dva','lucius','morrison','schuyler','carlie'].includes(x.id)).length },
    mis:{ top:topMis, avgWp:__aiAvgWp(topMis), count10:topMis.filter(x=>x.wp>=10).length, count20:topMis.filter(x=>x.wp>=20).length, count30:topMis.filter(x=>x.wp>=30).length, coreCount:topMis.filter(x=>['fiona','tesla','mcgregor','swift','adam'].includes(x.id)).length }
  };
  const typeScore = {
    tank: progress.tank.avgWp + progress.tank.count20*2 + progress.tank.count10 + progress.tank.count30*3 + progress.tank.coreCount*1.2,
    air: progress.air.avgWp + progress.air.count20*2 + progress.air.count10 + progress.air.count30*3 + progress.air.coreCount*1.2,
    mis: progress.mis.avgWp + progress.mis.count20*2 + progress.mis.count10 + progress.mis.count30*3 + progress.mis.coreCount*1.2,
  };
  const currentCombatType = Object.entries(typeScore).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'tank';
  const tankStable = progress.tank.avgWp >= 16 || progress.tank.count20 >= 3 || progress.tank.count30 >= 1;
  const airSeed = __aiHasAny(topAir, ['dva','lucius']);
  const airCoreReady = __aiHasAny(topAir, ['dva']) && __aiHasAny(topAir, ['lucius','schuyler','morrison']);
  const airEntryReady = topAir.length >= 4 && __aiAvgWp(topAir.slice(0,3)) >= 10;
  let investmentType = currentCombatType;
  let transitionState = `stay_${currentCombatType}`;
  if(currentCombatType === 'tank' && tankStable && (airCoreReady || airSeed)){
    investmentType = 'air';
    transitionState = airEntryReady ? 'shift_to_air' : 'seed_air';
  } else if(currentCombatType === 'air') {
    transitionState = 'stay_air';
  }
  const main = progress[currentCombatType];
  const mainTeamMaturity = (main.avgWp >= 20 || main.count20 >= 4 || main.count30 >= 1) ? 'high' : ((main.avgWp >= 12 || main.count10 >= 3) ? 'mid' : 'low');
  const mainArmyIds = new Set((base.assignment.army1||[]).map(h=>h.id));
  return { progress, currentCombatType, investmentType, transitionState, mainTeamMaturity, mainArmyIds };
}
function __aiTypePolicyMult(type, context, route='overall'){
  let mult = ((typeof META_SHIFT==='object' && META_SHIFT.weightBase && META_SHIFT.weightBase[type]) || 1.0);
  const current = context.currentCombatType;
  const invest = context.investmentType || current;
  if(route === 'cost'){
    if(type === current) mult *= 1.06; else mult *= 0.96;
    if(context.mainTeamMaturity === 'low' && type !== current) mult *= 0.95;
  } else if(route === 'coverage'){
    const cm = __aiCounterMap(current);
    mult *= (0.9 + (cm[type] || 0.5) * 0.2);
    if(type === invest) mult *= 1.03;
  } else if(route === 'future'){
    if(type === invest) mult *= 1.08; else mult *= 0.95;
    if(context.transitionState === 'seed_air' && type === 'air') mult *= 1.05;
    if(context.transitionState === 'shift_to_air' && type === 'air') mult *= 1.08;
    if(context.mainTeamMaturity === 'low' && type !== current) mult *= 0.92;
  }
  return Math.max(0.85, Math.min(1.20, mult));
}
function __aiHeroBias(heroId, route='overall', context=null){
  const p = __aiGetProfile(heroId);
  let mult = 1.0;
  if(p.role === 'main_dps') mult *= 1.10;
  else if(p.role === 'sub_dps') mult *= 1.04;
  else if(p.role === 'front_tank') mult *= 1.02;
  else if(p.role === 'control') mult *= 1.03;
  else if(p.role === 'support') mult *= 0.98;
  const meta = META_TIER[heroId] || {};
  if(meta.ew === 'SSS') mult *= 1.10;
  else if(meta.ew === 'SS') mult *= 1.06;
  else if(meta.ew === 'S') mult *= 1.03;
  if(route === 'future') mult *= __aiGetLongterm(heroId);
  if(context && context.investmentType === 'air' && heroId === 'dva') mult *= 1.02;
  if(context && context.investmentType === 'air' && heroId === 'lucius'){
    mult *= 1.12;
    if(route === 'cost') mult *= 1.08;
    else if(route === 'coverage') mult *= 1.05;
    else if(route === 'future') mult *= 1.03;
  }
  return mult;
}
function __aiMilestoneBias(heroId, targetLv, route='overall'){
  const p = __aiGetProfile(heroId);
  if(targetLv === 10) return route === 'cost' ? 1.05 : 1.00;
  if(targetLv === 20) return route === 'cost' ? 1.15 : 1.11;
  if(targetLv === 30){
    if(p.role === 'main_dps') return route === 'future' ? 1.10 : 1.02;
    if(p.role === 'front_tank') return route === 'cost' ? 0.94 : 1.00;
    if(p.role === 'support') return 0.90;
  }
  return 1.0;
}
function __aiSynergyBias(hero, roster, targetLv){
  const table = (typeof HERO_SYNERGY === 'object' && HERO_SYNERGY[hero.id]) ? HERO_SYNERGY[hero.id] : null;
  if(!table) return 1.0;

  const rosterMap = {};
  roster.forEach(x => {
    if(!x || !x.id) return;
    const lv = Number.isFinite(parseInt(x.wp, 10)) ? parseInt(x.wp, 10) : 0;
    rosterMap[x.id] = Math.max(rosterMap[x.id] || 0, lv);
  });

  let mult = 1.0;
  for(const [partnerId, bonus] of Object.entries(table)){
    const partnerLv = rosterMap[partnerId] || 0;
    if(partnerLv <= 0) continue;

    let pairMult = bonus.base || 1.0;
    if(partnerLv >= 30 && bonus.lv30) pairMult = bonus.lv30;
    else if(partnerLv >= 20 && bonus.lv20) pairMult = bonus.lv20;
    else if(partnerLv >= 10 && bonus.lv10) pairMult = bonus.lv10;

    // 無微課金寄り：20→30 のときはシナジー加点を少し弱める
    if(targetLv === 30){
      pairMult = 1 + (pairMult - 1) * 0.5;
    }

    mult *= pairMult;
  }

  return Math.min(mult, 1.10);
}


function __aiTankBranchBias(hero, targetLv, context){
  if(!hero || hero.t !== 'tank') return 1.0;
  const weaknesses = [context && context.weakness1, context && context.weakness2, context && context.weakness3].filter(Boolean);
  const defenseNeed = weaknesses.filter(x => x === 'defense').length;
  const attackNeed = weaknesses.filter(x => x === 'attack').length;
  const id = hero.id;
  let mult = 1.0;

  if(id === 'lucius'){
    mult *= 1.10;
    if(hero.wp < 10 && targetLv === 10) mult *= 1.24;
    if(targetLv === 20) mult *= 1.06;
    if(targetLv === 30) mult *= 0.96;
    if(defenseNeed > attackNeed) mult *= 1.05;
    if(attackNeed === defenseNeed && targetLv === 10) mult *= 1.03;
  }

  if(id === 'dva'){
    if(targetLv === 10) mult *= 0.98;
    if(targetLv === 20) mult *= 1.03;
    if(targetLv === 30) mult *= 1.06;
    if(attackNeed >= defenseNeed) mult *= 1.03;
  }

  if(id === 'williams'){
    if(defenseNeed > attackNeed) mult *= 1.10;
    else if(attackNeed > defenseNeed) mult *= 0.94;
    else mult *= 1.01;
  }

  if(id === 'murphy'){
    if(attackNeed > defenseNeed) mult *= 1.10;
    else if(defenseNeed > attackNeed) mult *= 0.95;
    else mult *= 1.01;
  }

  if(id === 'stetmann'){
    if(attackNeed > defenseNeed) mult *= 1.08;
    else if(defenseNeed > attackNeed) mult *= 0.97;
    else mult *= 1.01;
  }

  return Math.max(0.90, Math.min(mult, 1.20));
}

function __aiMatchesWeakness(roleKey, weaknesses){
  if(!Array.isArray(weaknesses) || !weaknesses.length) return false;
  const needDefense = weaknesses.includes('defense');
  const needAttack = weaknesses.includes('attack');
  if(needDefense && roleKey === 'wall') return true;
  if(needAttack && roleKey === 'atk') return true;
  return false;
}

function __aiReasonBadgeFromScores(meta){
  const { hero, ms, roleKey, context, weaknesses, scoreCost, scoreCoverage, scoreFuture } = meta || {};
  const entries = [
    { key:'cost', value:Number(scoreCost)||0 },
    { key:'coverage', value:Number(scoreCoverage)||0 },
    { key:'future', value:Number(scoreFuture)||0 }
  ].sort((a,b)=>b.value-a.value);

  const top = entries[0] || { key:'cost', value:0 };
  const second = entries[1] || { key:'coverage', value:0 };
  const close = top.value <= 0 ? false : second.value >= top.value * 0.965;
  const weaknessMatch = __aiMatchesWeakness(roleKey, weaknesses || []);
  const longterm = __aiGetLongterm(hero && hero.id);
  const sameInvest = !!(hero && context && hero.t === context.investmentType);
  const sameMain = !!(hero && context && hero.t === context.currentCombatType);
  const inMainArmy = !!(hero && context && context.mainArmyIds && context.mainArmyIds.has(hero.id));
  const safeQualified = !!(hero && ms && ms.target <= 20 && (sameMain || inMainArmy || hero.r === 'wall' || hero.r === 'sup'));

  let label = '安定';
  let axis = 'bal';
  let strong = false;

  if(top.key === 'coverage'){
    if(weaknessMatch && top.value >= second.value * 1.02){
      label = '弱点補強';
      axis = (weaknesses || []).includes('attack') ? 'atk' : 'wall';
      strong = true;
    }else if(weaknessMatch && !close){
      label = '弱点補強';
      axis = (weaknesses || []).includes('attack') ? 'atk' : 'wall';
    }
  } else if(top.key === 'future'){
    const futureQualified = (ms && ms.target >= 30) || sameInvest || longterm >= 0.72;
    if(futureQualified && top.value >= second.value * 1.03){
      label = '将来性';
      axis = 'atk';
      strong = !!(ms && ms.target >= 30);
    }else if(futureQualified && !close && (ms && ms.target >= 20)){
      label = '将来性';
      axis = 'atk';
    }
  } else if(top.key === 'cost'){
    if(top.value >= second.value * 1.05){
      label = '育成効率';
    }else if(safeQualified || close){
      label = '安全';
    }else if(top.value >= second.value * 1.02){
      label = '育成効率';
    }
  }

  const level = (ms && ms.target>=30) ? 4 : ((ms && ms.target>=20) ? 3 : 2);
  return { level, axis, label, strong };
}

function __aiDisplaySafeLabel(hero, ms, context, reasonBadge, scoreCost, scoreCoverage, scoreFuture){
  if(!hero || !ms || !context || !reasonBadge) return '';
  if(reasonBadge.label !== '育成効率') return '';
  if(ms.target > 20) return '';
  const sameMain = hero.t === context.currentCombatType;
  const inMainArmy = context.mainArmyIds && context.mainArmyIds.has(hero.id);
  const top = Math.max(Number(scoreCost)||0, Number(scoreCoverage)||0, Number(scoreFuture)||0, 0);
  if(top <= 0) return '';
  if((Number(scoreCost)||0) < top * 0.97) return '';
  if(hero.t === context.currentCombatType) return '安定';
  if((inMainArmy || hero.r === 'wall' || hero.r === 'sup') && ms.target === 20) return '安定';
  return '';
}

function calculateUpgradeEfficiencyFull(roster){
    if(roster.length < 10) return {normal:[], unlock:[], weakness1:"balance", weakness2:"balance", weakness3:"balance", reinforceList:[]};

    let base = optimizeMultiArmy(roster,5);
    let baseScore = calcMultiArmyTotalScore(base.assignment);
    if(baseScore === 0) return {normal:[], unlock:[], weakness1:"balance", weakness2:"balance", weakness3:"balance", reinforceList:[]};

    let weakness1 = detectArmyWeaknessFromDetail(base.armyDetails.army1);
    let weakness2 = detectArmyWeaknessFromDetail(base.armyDetails.army2);
    let weakness3 = detectArmyWeaknessFromDetail(base.armyDetails.army3);

    const context = __aiBuildContext(roster, base);
    const weights = (typeof ROUTE_WEIGHT_PRESET === 'object' && ROUTE_WEIGHT_PRESET.safe) ? ROUTE_WEIGHT_PRESET.safe : { cost:0.55, coverage:0.25, future:0.20 };

    let normalResults = [];
    let unlockResults = [];

    roster.forEach((hero,index)=>{
        if(hero.ur) return;
        const profile = __aiGetProfile(hero.id);
        const roleKey = hero.r || (profile.role === 'front_tank' ? 'wall' : (profile.role === 'support' ? 'sup' : 'atk'));
        const roleBadge = getRoleBadge(roleKey);
        const simulated = roster.map(h => ({...h}));

        if(hero.wp === 0){
            const ewTarget = (META_TIER[hero.id] && META_TIER[hero.id].ewTarget) ? META_TIER[hero.id].ewTarget : 10;
            simulated[index].wp = ewTarget;
            const newResult = optimizeMultiArmy(simulated, 5);
            let gain = calcMultiArmyTotalScore(newResult.assignment) - baseScore;
            if(gain <= 0) gain = Math.max(1, Math.round(__aiGetLongterm(hero.id) * 18 - 6));
            gain = Math.round(gain * __aiTypePolicyMult(hero.t, context, 'future') * __aiHeroBias(hero.id, 'future', context) * __aiSynergyBias(hero, roster, ewTarget));
            if(gain > 0){
              unlockResults.push({ id:hero.id, name:hero.name, type:hero.t, gain, roleKey, roleBadge, from:0, to:ewTarget, growthType:{ level:2, axis:'atk', label:'将来性', strong:false }, costTierLabel:__aiCostTierLabel(0, ewTarget), safeHintLabel:'' });
            }
            return;
        }

        const ms = getNextMilestone(hero.wp);
        if(!ms) return;
        simulated[index].wp = ms.target;
        const newResult = optimizeMultiArmy(simulated, 5);
        let gain = Math.round(calcMultiArmyTotalScore(newResult.assignment) - baseScore);
        if(gain <= 0){
            const delta = Math.max(1, Math.round((wpToPts(ms.target) - wpToPts(hero.wp)) * (((META_TIER[hero.id]||{}).ew === 'SSS') ? 1.15 : 1.0)));
            gain = delta;
        }
        if(gain <= 0) return;

        const cost = ms.cost;
        const basePerCost = gain / Math.max(1, Math.pow(cost || 1, 0.52));
        const sameMain = hero.t === context.currentCombatType;
        const sameInvest = hero.t === context.investmentType;
        const inMainArmy = context.mainArmyIds.has(hero.id);
        const synergy = __aiSynergyBias(hero, roster, ms.target);
        const tankBranchBias = __aiTankBranchBias(hero, ms.target, { weakness1, weakness2, weakness3, currentCombatType: context.currentCombatType, investmentType: context.investmentType });

        const scoreCost = basePerCost * __aiTypePolicyMult(hero.t, context, 'cost') * __aiHeroBias(hero.id, 'cost', context) * __aiMilestoneBias(hero.id, ms.target, 'cost') * synergy * tankBranchBias * (sameMain ? 1.08 : 0.96) * (inMainArmy ? 1.06 : 1.00);
        const scoreCoverage = basePerCost * __aiTypePolicyMult(hero.t, context, 'coverage') * __aiHeroBias(hero.id, 'coverage', context) * __aiMilestoneBias(hero.id, ms.target, 'coverage') * synergy * tankBranchBias * (sameMain ? 0.96 : 1.06) * (sameInvest ? 1.04 : 1.00);
        const scoreFuture = basePerCost * __aiTypePolicyMult(hero.t, context, 'future') * __aiHeroBias(hero.id, 'future', context) * __aiMilestoneBias(hero.id, ms.target, 'future') * synergy * tankBranchBias * (sameInvest ? 1.10 : 0.96);
        const efficiency = (scoreCost * weights.cost) + (scoreCoverage * weights.coverage) + (scoreFuture * weights.future);

        const weaknesses = [weakness1, weakness2, weakness3].filter(Boolean);
        const growthType = __aiReasonBadgeFromScores({
            hero, ms, roleKey, context, weaknesses,
            scoreCost, scoreCoverage, scoreFuture
        });
        const safeHintLabel = __aiDisplaySafeLabel(hero, ms, context, growthType, scoreCost, scoreCoverage, scoreFuture);

        const reinforceMain = 30 * (sameMain ? 1 : 0) + 20 * (inMainArmy ? 1 : 0.4) + 20 * (((weakness1 === 'defense' || weakness2 === 'defense') && roleKey === 'wall') || ((weakness1 === 'attack' || weakness2 === 'attack') && roleKey === 'atk') ? 1 : 0.45) + 15 * (ms.target === 20 ? 1 : (ms.target === 10 ? 0.8 : 0.55)) + 10 * ((sameMain && context.mainTeamMaturity !== 'high') ? 1 : 0.5) + 5 * (sameMain ? 1 : 0.2);
        const reinforceCoverage = 30 * ((__aiCounterMap(context.currentCombatType)[hero.t]) || 0.5) + 25 * (profile.core ? 1 : 0.25) + 20 * Math.min(1.1, synergy) + 15 * (!sameMain ? 1 : 0.45) + 10 * (ms.target <= 20 ? 1 : 0.55);
        const reinforceFuture = 30 * (sameInvest ? 1 : 0.2) + 25 * (profile.core ? 1 : 0.3) + 20 * __aiGetLongterm(hero.id) + 15 * (context.mainTeamMaturity === 'high' ? 1 : (context.mainTeamMaturity === 'mid' ? 0.7 : 0.35)) + 10 * (ms.target === 30 ? 1 : (ms.target === 20 ? 0.8 : 0.5));

        normalResults.push({
            id: hero.id, name: hero.name, type: hero.t,
            from: hero.wp, to: ms.target,
            gain, cost, efficiency,
            roleKey, roleBadge,
            strength: (ms.target>=30 ? 'mega' : (ms.target>=20 ? 'high' : 'mid')),
            growthType,
            costTierLabel: __aiCostTierLabel(hero.wp, ms.target),
            safeHintLabel,
            scoreCost, scoreCoverage, scoreFuture,
            reinforceMain, reinforceCoverage, reinforceFuture
        });
    });

    normalResults.sort((a,b)=> (b.efficiency-a.efficiency) || (b.gain-a.gain));
    unlockResults.sort((a,b)=> b.gain-a.gain);

    const used = new Set();
    const pickTop = (key, label, axis='bal') => {
      const arr = [...normalResults].sort((a,b)=> (b[key]-a[key]) || (b.efficiency-a.efficiency));
      for(const item of arr){
        if(!used.has(item.id)){
          used.add(item.id);
          return { ...item, growthType:{ level:2, axis, label, strong:false } };
        }
      }
      return null;
    };
    const reinforceList = [];
    const mainPick = pickTop('reinforceMain', '主力強化', 'bal');
    const coveragePick = pickTop('reinforceCoverage', '弱点補強', 'wall');
    const futurePick = pickTop('reinforceFuture', '将来性', 'atk');
    if(mainPick) reinforceList.push(mainPick);
    if(coveragePick) reinforceList.push(coveragePick);
    if(futurePick) reinforceList.push(futurePick);

    return { normal: normalResults, unlock: unlockResults, weakness1, weakness2, weakness3, reinforceList };
}


// ================= 要約バー =================
function updateSummaryBar(result, effData){
    const el = $id('summary-bar');
    if(!el) return;

    // 10人未満の時
    if(!result || !effData){
        el.innerHTML = "まだデータが足りません（10人以上配置すると要約が表示されます）。";
        return;
    }

    // 最優先候補（効率ランキングの1位）
    const top = (effData.normal && effData.normal.length) ? effData.normal[0] : null;
    const weak1 = effData.weakness1 || "balance";

    const needText = (w) => {
        // 1軍の傾向（AIコメント風）
        return getWeaknessBadge(w);
    };

    const army1 = result.weightedScores ? (result.weightedScores.army1 || 0) : 0;
    const army2 = result.weightedScores ? (result.weightedScores.army2 || 0) : 0;
    const army3 = result.weightedScores ? (result.weightedScores.army3 || 0) : 0;

    const powerLine = `📊 軍別戦力：🥇${army1}  🥈${army2}  🥉${army3}`;

    if(!top){
        el.innerHTML = `
            <div class="summary-grid">
                <div style="flex:1; min-width:220px;">
                    <div class="summary-title">現在の優先傾向</div>
                    <div class="summary-main">${needText(weak1)}</div>
                    <div class="summary-sub">（育成優先ランキングが出ない状態です）</div>
                    <div class="summary-sub" style="margin-top:6px;">${powerLine}</div>
                </div>
            </div>`;
        return;
    }

    // バッジ文言（数値は見せない）
    let badge = "効果あり";
    if(top.strength === "mega") badge = "超効果大";
    else if(top.strength === "high") badge = "効果大";
    else if(top.strength === "mid") badge = "効果中";
    else if(top.strength === "low") badge = "効果小";

    const roleLabel = (top.roleKey === "atk") ? "攻撃" : (top.roleKey === "wall") ? "防御" : "支援";

    el.innerHTML = `
        <div class="summary-grid">
            <div style="flex:1; min-width:220px;">
                <div class="summary-title">⭐ 今のおすすめ育成</div>
                <div class="summary-main">${top.name}：${roleLabel}を優先強化（${badge}）</div>
                <div class="summary-sub">おすすめ強化：Lv${top.from} → Lv${top.to}（次の到達目標） / 1軍傾向：${needText(weak1)}</div>
                <div class="summary-sub" style="margin-top:6px;">${powerLine}</div>
            </div>
        </div>`;
}


function getArmyRole(score, total, isBench) {
    if(isBench) return "メタ対策/温存";
    if(total === 0) return "";
    let ratio = (score / total) * 100;
    if(ratio > 35) return "主力級";
    if(ratio > 20) return "準主力";
    return "補助/育成枠";
}

function getPriorityLabel(p, minPercent){
    return "";
}

function getColor(percent, base){
    if(percent < 40) return "#ef4444";
    if(percent < 60) return "#f59e0b";
    return base;
}

function renderProgress(percent, baseColor){
    const color = getColor(percent, baseColor);
    return `
    <div class="progress-wrap">
        <div class="progress-bar">
            <div class="progress-fill" style="width:${percent}%; background:${color};"></div>
        </div>
        <div class="progress-label">
            進行度 <span class="progress-label-value" style="color:${color};">${percent}%</span>
        </div>
    </div>`;
}

function armyCard(title, content, baseColor, roleTag, progressPercent, minPercent, buffCount) {
    let buffText = "";
    if (buffCount === 5) buffText = `<span class="buff-pill buff-pill-5">🏆20%バフ</span>`;
    else if (buffCount === 4) buffText = `<span class="buff-pill buff-pill-4">🚜15%バフ</span>`;
    else if (buffCount === 3) buffText = `<span class="buff-pill buff-pill-3">⚠️5%バフ</span>`;

    return `
    <div class="army-card" style="border-left-color:${baseColor};">
        <div class="army-card-title">
            ${title} ${buffText} ${getPriorityLabel(progressPercent, minPercent)}
        </div>
        ${renderProgress(progressPercent, baseColor)}
        <div class="army-card-role">
            ${roleTag}
        </div>
        <div class="army-card-body">
            ${content}
        </div>
    </div>`;
}

function generateAiSuggestion() {
    let roster = []; 
    for(let s=1; s<=4; s++) for(let p=1; p<=(s===4?10:5); p++) {
        let id = $id(`h-${s}-${p}`).value; if(id==='empty') continue;
        let wp = parseInt($id(`w-${s}-${p}`).value)||0;
        let h = HEROES[id];
        roster.push({ id, s, p, wp, t: h.t, r: h.r, ur: h.ur, name: h.n, pr: h.pr });
    }
    
    let pool = roster.filter(h => h.id !== 'empty');
    if(pool.length < 10) {
        $id('ai-result').innerHTML = "<div style='font-size:0.85rem; color:#475569;'>最低10人以上配置すると、自動的に全軍の最適化結果が表示されます。</div>"; 
        $id('eff-result').innerHTML = "<div style='font-size:0.85rem; color:#475569;'>最低10人以上配置してください。</div>";
        updateSummaryBar(null, null);
        return;
    }

    let result = optimizeMultiArmy(pool, 5);
    previousAssignment = result.assignment;

    let effData = calculateUpgradeEfficiencyFull(pool);

    // 🥇 要約バー更新
    updateSummaryBar(result, effData);
    // 進行度バー＆兵種バフ（画像の見た目に合わせる）
    try{
        const s1 = result.weightedScores.army1 || 0;
        const s2 = result.weightedScores.army2 || 0;
        const s3 = result.weightedScores.army3 || 0;
        const maxScore = Math.max(s1, s2, s3, 1);
        const p1 = Math.round((s1 / maxScore) * 100);
        const p2 = Math.round((s2 / maxScore) * 100);
        const p3 = Math.round((s3 / maxScore) * 100);
        const minPercent = Math.min(p1, p2, p3);

        const weakText = (w) => {
            // 進行度タグ用：不足時だけ強めに目立つ
            return getWeaknessBadge(w);
        };

        const colorOf = (pct, base) => {
            if(pct < 40) return "#ef4444";
            if(pct < 60) return "#f59e0b";
            return base;
        };

        
        const detailedDiag = (armyArr, fallbackWeak) => {
            const list = (armyArr || []).filter(h => h && h.id && h.id !== 'empty' && !h.ur);
            const avg = (arr) => arr.length ? (arr.reduce((a,x)=>a + (parseInt(x.wp)||0), 0) / arr.length) : 0;

            const atk = list.filter(h => h.r === 'atk');
            const wall = list.filter(h => h.r === 'wall');
            const avgAll = avg(list);
            const avgAtk = avg(atk);
            const avgWall = avg(wall);

            let key = fallbackWeak || 'balance';
            let level = '中';

            // 役割の欠損は最優先で「大」
            if(wall.length === 0){
                key = 'defense'; level = '大';
            }else if(atk.length === 0){
                key = 'attack'; level = '大';
            }else{
                const diff = avgAtk - avgWall; // +なら盾が遅れてる（耐久不足）
                if(diff >= 6){
                    key = 'defense';
                    level = (diff >= 12) ? '大' : (diff >= 8) ? '中' : '小';
                }else if(diff <= -6){
                    key = 'attack';
                    level = (diff <= -12) ? '大' : (diff <= -8) ? '中' : '小';
                }else{
                    key = 'balance';
                    level = (avgAll >= 20) ? '高' : (avgAll >= 12) ? '中' : '低';
                }

                // 絶対値が低い場合は段階を引き上げ
                if(key === 'defense'){
                    if(avgWall < 8) level = '大';
                    else if(avgWall < 12 && level === '小') level = '中';
                }
                if(key === 'attack'){
                    if(avgAtk < 8) level = '大';
                    else if(avgAtk < 12 && level === '小') level = '中';
                }
            }

            const label = (key === 'defense') ? `耐久不足：${level}`
                        : (key === 'attack') ? `火力不足：${level}`
                        : `バランス：${level}`;
            return { key, level, label };
        };

        const setEval = (armyNo, pct, baseColor, tagHtml, buffCount) => {
            const el = document.getElementById(`slot-eval-${armyNo}`);
            if(!el) return;

            let buff = "";
            if (buffCount === 5) buff = "🏆20%バフ";
            else if (buffCount === 4) buff = "🚜15%バフ";
            else if (buffCount === 3) buff = "⚠️5%バフ";

            const c = colorOf(pct, baseColor);

            const buffSpan = buff ? `<span class="buff-badge">${buff}</span>` : "";

            el.innerHTML =
              '<div class="row">' +
                '<div class="tag">' + tagHtml + '</div>' +
                '<div class="pct">進行度 <span style="color:' + c + ';">' + pct + '%</span></div>' +
              '</div>' +
              (buffSpan ? ('<div class="row sub">' + buffSpan + '</div>') : '') +
              '<div class="bar"><div style="width:' + pct + '%; background:' + c + ';"></div></div>';
        };

        const d1 = detailedDiag(result.assignment.army1, effData.weakness1);
        const d2 = detailedDiag(result.assignment.army2, effData.weakness2);
        const d3 = detailedDiag(result.assignment.army3, effData.weakness3 || 'balance');

        setEval(1, p1, "#10b981", '💬AI診断：' + d1.label, result.maxCounts.army1);
        setEval(2, p2, "#3b82f6", '💬AI診断：' + d2.label, result.maxCounts.army2);
        // 3軍も不足傾向を表示（総合寄り）
        setEval(3, p3, "#8b5cf6", '💬AI診断：' + d3.label, result.maxCounts.army3);
    }catch(e){}


    // ✅ 3軍総合最適化結果カードは表示しない（入力UI=slotタイルを主役にする）
    $id('ai-result').innerHTML = `
      <div style="font-size:0.85rem; color:#475569; line-height:1.6;">
        上の <b>編成（タップで編集）</b> がそのまま評価画面です。<br>
        最適化案を反映したい場合は、下のボタンで <b>自動反映</b> できます。
      </div>
      <button class="apply-btn" onclick="applyMultiArmy()">この最強編成を自動反映する</button>
    `;


    let effOut = "";

    
if(effData.normal.length > 0){
        const TOP_N = 3;
        const MORE_MAX = 10;

        effOut += `
        <div style="background:#fdf4ff; border:1px solid #fbcfe8; padding:12px; border-radius:10px;">
            <div style="font-weight:900; color:#a21caf; margin-bottom:8px; font-size:0.95rem;"></div>
            ${holdPinnedSummaryHtml(effData.normal)}`;

        // Top3（おすすめ）
        effData.normal.slice(0, TOP_N).forEach((item,i)=>{
            effOut += topRankCardHtml(i+1, item, { isBest:(i===0) });
        });

        // もっと見る（任意）
        if(effData.normal.length > TOP_N){
            let moreList = "";
            effData.normal.slice(TOP_N, Math.min(effData.normal.length, MORE_MAX)).forEach((item,idx)=>{
                let rank = TOP_N + idx + 1;
                moreList += topRankCardHtml(rank, item, { compact:true });
            });

            effOut += `
            <div id="eff-more-list" data-open="0" style="display:none; margin-top:6px;">
                ${moreList}
            </div>
            <button id="eff-more-btn" onclick="toggleEffMore()" style="margin-top:10px; width:100%; background:#fff; border:1px solid #fbcfe8; color:#a21caf; font-weight:900; padding:10px; border-radius:10px; cursor:pointer;">
                もっと見る（おすすめ）
            </button>`;
        }

        effOut += "</div>";
    }

    if(effData.reinforceList && effData.reinforceList.length > 0){
        effOut += `
        <div style="margin-top:12px; background:#fff7ed; border:1px solid #fdba74; padding:12px; border-radius:10px;">
            <div style="font-weight:900; color:#ea580c; margin-bottom:8px; font-size:0.9rem;">
                🛡️ 補強候補ランキング
            </div>`;

        effData.reinforceList.forEach((r,i)=>{
            effOut += reinfCardHtml(i+1, r);
        });
        effOut += `</div>`;
    }

    if(effData.unlock.length > 0){
        effOut += `
        <div style="margin-top:12px; background:#eff6ff; border:1px solid #bfdbfe; padding:12px; border-radius:10px;">
            <div style="font-weight:900; color:#1e3a8a; margin-bottom:8px; font-size:0.9rem;">
                🔓 専用武装育成候補
            </div>`;

        effData.unlock.slice(0,3).forEach((item,i)=>{
            effOut += `
            <div style="font-size:0.8rem; margin-bottom:4px;">
                ${i+1}. <b>${item.name}</b> ${item.roleBadge} <span style="color:#64748b; margin-left:4px;">解放時 +${item.gain}</span>
            </div>`;
        });
        effOut += "</div>";
    }

    $id('eff-result').innerHTML = effOut || "<div style='color:#64748b; font-size:0.85rem;'>強化可能なキャラがいません。</div>";
}

function applyMultiArmy() {
    let data = previousAssignment;
    let setSquad = (s, squadArray) => {
        let walls = squadArray.filter(h => HEROES[h.id].r === 'wall').sort((a,b) => b.wp - a.wp);
        let others = squadArray.filter(h => HEROES[h.id].r !== 'wall').sort((a,b) => b.wp - a.wp);
        let ordered = [...walls, ...others];
        
        for(let i=1; i<=5; i++) {
            let h = ordered[i-1];
            if(h) {
                $id(`h-${s}-${i}`).value = h.id;
                $id(`w-${s}-${i}`).value = h.wp;
            } else {
                $id(`h-${s}-${i}`).value = 'empty';
                $id(`w-${s}-${i}`).value = 0;
            }
        }
    };

    setSquad(1, data.army1);
    setSquad(2, data.army2);
    setSquad(3, data.army3);

    for(let i=1; i<=10; i++) {
        let h = data.bench[i-1];
        if(h) {
            $id(`h-4-${i}`).value = h.id;
            $id(`w-4-${i}`).value = h.wp;
        } else {
            $id(`h-4-${i}`).value = 'empty';
            $id(`w-4-${i}`).value = 0;
        }
    }

    updateAllSquads();
    showToast("🔄 最強の編成を反映しました！");
}

// ================= 装備シミュレーターロジック =================
function initGearHTML() {
    const makeRow = (prefix) => GEAR_TYPES.map(g => `
        <div class="g-row">
            <span class="g-label">${GEAR_NAMES[g]}</span>
            <div class="g-input-group">
                <div class="stepper stepper-lv"><button onclick="gearStep('${prefix}${g}Lv', -1)">-</button><input id="${prefix}${g}Lv" value="40" readonly><button onclick="gearStep('${prefix}${g}Lv', 1)">+</button></div>
                <div class="stepper stepper-star"><button onclick="gearStep('${prefix}${g}Star', -1)">-</button><input id="${prefix}${g}Star" data-val="0" value="☆☆☆☆☆" readonly><button onclick="gearStep('${prefix}${g}Star', 1)">+</button></div>
            </div>
        </div>`).join('');
    $id('current-gear-rows').innerHTML = makeRow('c');
    $id('target-gear-rows').innerHTML = makeRow('t');
}

function gearStep(id, d) {
    let el = $id(id);
    let isStar = id.includes('Star');
    let v = isStar ? parseInt(el.getAttribute('data-val')) : parseInt(el.value);
    let max = isStar ? 5 : (id.includes('Weapon') ? 30 : 40); 
    let newVal = Math.min(Math.max(v + d, 0), max);
    
    if(isStar) {
        el.setAttribute('data-val', newVal);
        let s = ""; for(let i=0; i<5; i++) s += i<newVal ? "★":"☆";
        el.value = s;
        el.style.color = newVal===5 ? "#ef4444" : newVal>0 ? "#f59e0b" : "#cbd5e1";
    } else { el.value = newVal; }
    calculateGear(); saveData();
}

function calculateGear() {
    ['c', 't'].forEach(p => {
        GEAR_TYPES.forEach(g => {
            let lvEl = $id(`${p}${g}Lv`), starEl = $id(`${p}${g}Star`), wrap = starEl.closest('.stepper');
            if (parseInt(lvEl.value) < 40) {
                starEl.setAttribute('data-val', 0); starEl.value = "☆☆☆☆☆"; starEl.style.color = "#cbd5e1"; wrap.classList.add('disabled');
            } else { wrap.classList.remove('disabled'); }
        });
    });

    const urReq = [0, 5, 15, 30, 50, 50], mrReq = [0, 0, 0, 0, 0, 10];
    let costUr = 0, costMr = 0, listHtml = "";
    
    GEAR_TYPES.forEach(g => {
        let cS = parseInt($id(`c${g}Star`).getAttribute('data-val'));
        let tS = parseInt($id(`t${g}Star`).getAttribute('data-val'));
        if(tS > cS) {
            let u = urReq[tS] - urReq[cS], m = mrReq[tS] - mrReq[cS];
            costUr += u; costMr += m;
            let txt = [];
            if(u>0) txt.push(`<span style="color:#f59e0b">UR${u}</span>`);
            if(m>0) txt.push(`<span style="color:#b91c1c">MR${m}</span>`);
            listHtml += `<div class="cost-row"><span>${GEAR_NAMES[g]} ★${cS}→${tS}</span><span>${txt.join('+')}</span></div>`;
        }
    });
    
	// NOTE: 旧UIでは cost-list が存在しない場合があるためガード
	const costListEl = $id('cost-list');
	if (costListEl) {
		costListEl.innerHTML = listHtml || "<span style='color:#94a3b8;'>追加コストなし</span>";
	}
	const ftUrEl = $id('ft-ur');
	const ftMrEl = $id('ft-mr');
	if (ftUrEl) ftUrEl.innerText = costUr;
	if (ftMrEl) ftMrEl.innerText = costMr;

    const calcP = (p) => {
        let wp = parseInt($id(`${p}Weapon`).value), m = 1.0, myth = [];
        GEAR_TYPES.forEach(g => {
            let lv = parseInt($id(`${p}${g}Lv`).value), st = parseInt($id(`${p}${g}Star`).getAttribute('data-val'));
            let base = 1 + (lv * 0.005) + (st * 0.05); 
            if(st===5) { base += 0.1; myth.push(GEAR_NAMES[g].replace(/[\u231a-\u26ff]/g, '')); }
            m *= base;
        });
        return { val: (m * (1 + wp * 0.02)).toFixed(2), myth };
    };

    let resC = calcP('c'), resT = calcP('t');
	const grEl = $id('growth-rate');
	if (grEl) grEl.innerText = (resC.val > 0) ? (resT.val / resC.val).toFixed(2) : "1.00";
    
    let dBuff = (id, arr) => {
        let el = $id(id);
        if(arr.length === 0) { el.innerHTML = ""; el.classList.remove('active'); } 
        else { el.innerHTML = "<b>発動中:</b> " + arr.join(" / "); el.classList.add('active'); }
    };
    dBuff('detail-curr', resC.myth); dBuff('detail-tgt', resT.myth);
}

function resetGear() {
    ['c','t'].forEach(p => {
        $id(`${p}Weapon`).value = 20;
        GEAR_TYPES.forEach(g => {
            $id(`${p}${g}Lv`).value = 40;
            let el = $id(`${p}${g}Star`);
            el.setAttribute('data-val', 0); el.value = "☆☆☆☆☆"; el.style.color = "#cbd5e1";
        });
    });
    calculateGear(); saveData();
}

function saveData() {
    let d = {}; 
    for(let s=1; s<=4; s++) {
        for(let p=1; p<=(s===4?10:5); p++) { 
            d[`h-${s}-${p}`] = $id(`h-${s}-${p}`).value; 
            d[`w-${s}-${p}`] = $id(`w-${s}-${p}`).value; 
        }
    }
    ['c','t'].forEach(p => {
        d[`${p}Weapon`] = $id(`${p}Weapon`).value;
        GEAR_TYPES.forEach(g => {
            d[`${p}${g}Lv`] = $id(`${p}${g}Lv`).value;
            d[`${p}${g}Star`] = $id(`${p}${g}Star`).getAttribute('data-val');
        });
    });
    d['current-meta'] = $id('current-meta').value;
    d['pow-tank'] = ($id('pow-tank') && $id('pow-tank').value) ? $id('pow-tank').value : '';
    d['pow-air']  = ($id('pow-air') && $id('pow-air').value) ? $id('pow-air').value : '';
    d['pow-mis']  = ($id('pow-mis') && $id('pow-mis').value) ? $id('pow-mis').value : '';
    localStorage.setItem('lw_sim_v24_final', JSON.stringify(d));
}

function loadAllData() {
  let sv = localStorage.getItem('lw_sim_v24_final') || localStorage.getItem('lw_sim_v23_final'); 
  let d = {};
  if(sv){
    try { d = JSON.parse(sv) || {}; } catch(e){ d = {}; }
  }

  // （ここから下は今の処理をそのまま）
  for(let s=1; s<=4; s++) {
    for(let p=1; p<=(s===4?10:5); p++) { 
      if(d[`h-${s}-${p}`]) $id(`h-${s}-${p}`).value = d[`h-${s}-${p}`]; 
      if(d[`w-${s}-${p}`]) $id(`w-${s}-${p}`).value = d[`w-${s}-${p}`]; 
    }
  }

  ['c','t'].forEach(p => {
    if(d[`${p}Weapon`]) $id(`${p}Weapon`).value = d[`${p}Weapon`];
    GEAR_TYPES.forEach(g => {
      if(d[`${p}${g}Lv`]) $id(`${p}${g}Lv`).value = d[`${p}${g}Lv`];
      if(d[`${p}${g}Star`] !== undefined) {
        let starVal = parseInt(d[`${p}${g}Star`]);
        let el = $id(`${p}${g}Star`);
        el.setAttribute('data-val', starVal);
        let stStr = ""; for(let i=0; i<5; i++) stStr += i < starVal ? "★" : "☆";
        el.value = stStr;
        el.style.color = starVal === 5 ? "#ef4444" : starVal > 0 ? "#f59e0b" : "#cbd5e1";
      }
    });
  });

  if(d['current-meta']) $id('current-meta').value = d['current-meta'];
  if(d['pow-tank'] !== undefined && $id('pow-tank')) $id('pow-tank').value = d['pow-tank'];
  if(d['pow-air'] !== undefined && $id('pow-air')) $id('pow-air').value = d['pow-air'];
  if(d['pow-mis'] !== undefined && $id('pow-mis')) $id('pow-mis').value = d['pow-mis'];

  // ✅ ここは必ず実行される
  updateAllSquads();
  calculateGear();  try { updateGearPriorityUI(); } catch(e) {}
}


// ================= 統合スロットUI =================
let __slotModalState = { s:1, p:1, lv:0 };

function buildSlotHeroOptions(){
    const sel = document.getElementById('slot-modal-hero');
    if(!sel || sel.options.length>0) return;
    let opts = '';
    // 未設定
    opts += '<option value="empty">未設定</option>';
    // 兵種別
    const groups = { tank: [], air: [], mis: [] };
    Object.keys(HEROES).forEach(k=>{
        if(k==='empty') return;
        const h=HEROES[k];
        const label = h.n + (h.ur ? '(UR)' : '');
        groups[h.t].push(`<option value="${k}">${label}</option>`);
    });
    const mk = (title, arr)=> `<optgroup label="${title}">${arr.join('')}</optgroup>`;
    opts += mk('戦車', groups.tank) + mk('航空', groups.air) + mk('ロケラン', groups.mis);
    sel.innerHTML = opts;
}

function renderSlots(){
    // 1〜3軍は5枠、控えは10枠
    const configs = [
        {s:1, n:5, el:'slot-tiles-1'},
        {s:2, n:5, el:'slot-tiles-2'},
        {s:3, n:5, el:'slot-tiles-3'},
        {s:4, n:10, el:'slot-tiles-4'}
    ];
    configs.forEach(cfg=>{
        const wrap = document.getElementById(cfg.el);
        if(!wrap) return;
        let html = '';
        for(let p=1; p<=cfg.n; p++){
            const hEl = document.getElementById(`h-${cfg.s}-${p}`);
            const wEl = document.getElementById(`w-${cfg.s}-${p}`);
            if(!hEl || !wEl){
                // まだ初期化前
                continue;
            }
            const id = hEl.value || 'empty';
            const h = HEROES[id] || HEROES.empty;
            const lvRaw = wEl.value;
            const lv = (typeof lvRaw === 'string' && (lvRaw.includes('未') || lvRaw === '-' )) ? 0 : (parseInt(lvRaw)||0);
            const isEmpty = (id === 'empty');
            const shortName = (h.n || '未設定').substring(0,3);

            if(isEmpty){
                html += `
                <div class="slot-tile slot-empty" onclick="openSlotModal(${cfg.s},${p});">
                    <div class="slot-avatar">
                        <div class="slot-fallback" style="display:flex;">+</div>
                    </div>
                    <div class="slot-lv">Lv.-</div>
                    <div class="slot-name">追加</div>
                </div>`;
            } else {
                html += `
                <div class="slot-tile" onclick="openSlotModal(${cfg.s},${p});">
                    <div class="slot-avatar">
                        <img src="${getHeroImagePath(id)}" alt="${h.n}" onerror="this.style.display='none'; this.parentNode.querySelector('.slot-fallback').style.display='flex';">
                        <div class="slot-fallback" style="display:none;">${shortName}</div>
                    </div>
                    <div class="slot-lv">Lv.${lv}</div>
                    <div class="slot-name">${h.n}</div>
                </div>`;
            }
        }
        wrap.innerHTML = html;
    });
}

function openSlotModal(s,p){
    buildSlotHeroOptions();
    __slotModalState.s = s; __slotModalState.p = p;

    const hEl = document.getElementById(`h-${s}-${p}`);
    const wEl = document.getElementById(`w-${s}-${p}`);
    const heroSel = document.getElementById('slot-modal-hero');

    const id = hEl ? (hEl.value || 'empty') : 'empty';
    heroSel.value = id;

    const lvRaw = wEl ? wEl.value : 0;
    const lv = (typeof lvRaw === 'string' && (lvRaw.includes('未') || lvRaw === '-' )) ? 0 : (parseInt(lvRaw)||0);
    __slotModalState.lv = lv;
    document.getElementById('slot-modal-lv').innerText = lv;

    document.getElementById('slot-modal').classList.add('open');
}

function closeSlotModal(){
    document.getElementById('slot-modal').classList.remove('open');
}

function slotModalStep(d){
    __slotModalState.lv = Math.min(30, Math.max(0, (__slotModalState.lv||0) + d));
    document.getElementById('slot-modal-lv').innerText = __slotModalState.lv;
}
function slotModalSet(v){
    __slotModalState.lv = Math.min(30, Math.max(0, v));
    document.getElementById('slot-modal-lv').innerText = __slotModalState.lv;
}
function slotModalClear(){
    document.getElementById('slot-modal-hero').value = 'empty';
    slotModalSet(0);
}
function slotModalApply(){
    const s = __slotModalState.s, p = __slotModalState.p;
    const id = document.getElementById('slot-modal-hero').value;
    const lv = __slotModalState.lv;

    const hEl = document.getElementById(`h-${s}-${p}`);
    const wEl = document.getElementById(`w-${s}-${p}`);
    if(hEl) hEl.value = id;
    if(wEl) wEl.value = (id==='empty') ? 0 : lv;

    // 再評価
    try { updateSquad(s); } catch(e) {}
    try { renderSlots(); } catch(e) {}
    closeSlotModal();
}

// updateAllSquads の後にタイルも更新する
const __origUpdateAllSquads = updateAllSquads;
updateAllSquads = function(){
    __origUpdateAllSquads();
    try { renderSlots(); } catch(e) {}
};

function exportAsImage() { showToast("📸 生成中..."); html2canvas($id('squad-container')).then(c => { let l = document.createElement('a'); l.download = `配置_${Date.now()}.png`; l.href = c.toDataURL(); l.click(); showToast("✨ 保存完了"); }); }
function resetSquads() { if(confirm("リセット？")) { localStorage.clear(); location.reload(); } }
function jumpToArmy(n){
    // どのタブからでも「部隊編成」へ戻してジャンプできるようにする
    try{
        const firstTab = document.querySelectorAll('.tab-btn')[0];
        showTab('squad', firstTab);
    }catch(e){}

    // 統合スロットUI（slot-army）を優先してスクロール
    const target = $id(`slot-army-${n}`) || $id("sq-body-"+n);
    if(!target) return;

    // 旧UI（アコーディオン）が存在する場合は開く
    if(target.id && target.id.startsWith("sq-body-")){
        const header = target.previousElementSibling;
        if(!target.classList.contains("open")){
            target.classList.add("open");
            if(header && header.children[1]) header.children[1].innerText = "▼";
        }
    }

    setTimeout(()=>{
        target.scrollIntoView({behavior:"smooth", block:"start"});
    }, 60);
}

// === Role Color Unified (UI polish) ===
function getRoleBadge(role){
    if(!role) return "";
    let cls = (role === 'atk') ? 'atk' : (role === 'wall' ? 'wall' : 'sup');
    return `<span class="role-badge ${cls}"><span class="role-ico ${cls}"></span></span>`;
}

// 弱点ラベル（不足時だけ強めに目立たせる）
function getWeaknessBadge(w){
    const role = (w === "attack") ? "atk" : (w === "defense") ? "wall" : "sup";
    const cls  = (w === "attack") ? "atk" : (w === "defense") ? "wall" : "bal";

    const txt =
        (w === "attack") ? "AI診断：火力不足" :
        (w === "defense") ? "AI診断：耐久不足" :
        "AI診断：バランス良好";

    return `<span class="weak-badge ${cls}">${getRoleBadge(role)}<span class="t">${txt}</span></span>`;
}



// 🛠️ 装備強化優先度（役割ごと2装備 / 編成へは影響しない）
// ===============================
const GEAR_PRIORITY_STORAGE_KEY = "lw_sim_gear_prio_v1";

// 役割ごとの「見る装備」2つ（安全運用：編成最適化には一切反映しない）
const GEAR_ROLE_MAP = {
  atk: ["Gun", "Data"],     // 火力：レールガン + チップ
  wall:["Radar","Armor"],   // 盾　：装甲 + レーダー
  sup: ["Radar","Data"]     // 支援：レーダー + チップ（暫定）
};

// === ★上げ判定（UR/MRレシピの誤爆防止：費用対効果の簡易モデル） ===
// ※ゲーム内の正確な必要数はサーバー/仕様で変わり得るため、ここは「無・微課金向けの意思決定用ヒューリスティック」。
// 　必要数/重みはいつでも調整できるよう定数化している。
const GEAR_RECIPE_COST_BY_TARGET_STAR = {
  // targetStar: { mr: number, ur: number }
  // ランク(★) 0→1,1→2,2→3,3→4,4→5 の必要数（ユーザー提示の正規テーブル）
  1: { mr: 0,  ur: 5  },  // ★0→★1
  2: { mr: 0,  ur: 10 },  // ★1→★2
  3: { mr: 0,  ur: 15 },  // ★2→★3
  4: { mr: 0,  ur: 20 },  // ★3→★4
  5: { mr: 10, ur: 0  }   // ★4→★5
};
// 無・微課金の「重さ」：MRの方が入手難と仮定（必要ならここを調整）
const GEAR_RECIPE_WEIGHT = { ur: 1.0, mr: 3.0 };

// ★の段階ごとの「伸び」を大雑把に表現（高★ほど価値が高い想定）
const GEAR_MARGINAL_VALUE_BY_TARGET_STAR = {
  1: 0.6,
  2: 0.9,
  3: 1.2,
  4: 1.5,
  5: 1.8
};

// 役割×装備の重要度（同一役割内の相対）
const GEAR_IMPORTANCE = {
  atk:  { Gun: 1.20, Data: 1.00 },
  wall: { Radar: 1.20, Armor: 1.00 },
  sup:  { Radar: 1.10, Data: 1.00 }
};

// 比較UIの状態
let __gearCompare = { a: "", b: "" };

function recipeCostWeight(targetStar){
  const c = GEAR_RECIPE_COST_BY_TARGET_STAR[targetStar] || { mr:0, ur:0 };
  const w = (c.mr||0)*GEAR_RECIPE_WEIGHT.mr + (c.ur||0)*GEAR_RECIPE_WEIGHT.ur;
  // 0割り防止（低★の微コストを少しだけ効かせる）
  return Math.max(0.35, w);
}

function computeUpgradeCandidate(hero, gearKey, currentStar, role){
  const cur = Math.max(0, Math.min(5, parseInt(currentStar)||0));
  if(cur >= 5) return null;

  const targetStar = cur + 1;
  const lv = Math.max(0, Math.min(30, parseInt(hero.wp)||0));
  const lvW = 1 + (lv/30); // 1.0〜2.0（既存の考え方に合わせる） fileciteturn5file0L8-L12

  const impMap = (GEAR_IMPORTANCE[role] || {});
  const imp = (impMap[gearKey] !== undefined) ? impMap[gearKey] : 1.0;

  const marginal = (GEAR_MARGINAL_VALUE_BY_TARGET_STAR[targetStar] || 1.0);
  const costW = recipeCostWeight(targetStar);

  const score = (marginal * imp * lvW) / costW;

  const cost = (GEAR_RECIPE_COST_BY_TARGET_STAR[targetStar] || {mr:0, ur:0});
  return {
    heroId: hero.id,
    heroName: hero.name || hero.id,
    gearKey,
    currentStar: cur,
    targetStar,
    wp: lv,
    imp,
    marginal,
    cost,
    score
  };
}

function formatRecipeCost(cost){
  const mr = cost && cost.mr ? cost.mr : 0;
  const ur = cost && cost.ur ? cost.ur : 0;
  const parts = [];
  if(mr>0) parts.push(`MR×${mr}`);
  if(ur>0) parts.push(`UR×${ur}`);
  return parts.length ? parts.join(" + ") : "（軽）";
}

function renderGearCompareResult(a, b, g1, g2, role){
  const store = loadGearPrioData();
  const stA = store[a.id] || {};
  const stB = store[b.id] || {};
  const a1 = Math.max(0, Math.min(5, parseInt(stA[g1])||0));
  const a2 = Math.max(0, Math.min(5, parseInt(stA[g2])||0));
  const b1 = Math.max(0, Math.min(5, parseInt(stB[g1])||0));
  const b2 = Math.max(0, Math.min(5, parseInt(stB[g2])||0));

  const badgeHtml = (mode)=>{
    if(mode === "both"){
      return `<span class="no-wrap" style="display:inline-flex; align-items:center; gap:6px; background:#f1f5f9; border:1px solid #cbd5e1; color:#334155; padding:2px 10px; border-radius:999px; font-weight:900; font-size:0.74rem;">PvP/PvE</span>`;
    }
    return (mode === "pve")
      ? `<span class="no-wrap" style="display:inline-flex; align-items:center; gap:6px; background:#ecfeff; border:1px solid #a5f3fc; color:#0e7490; padding:2px 10px; border-radius:999px; font-weight:900; font-size:0.74rem;">PvE</span>`
      : `<span class="no-wrap" style="display:inline-flex; align-items:center; gap:6px; background:#fff1f2; border:1px solid #fecdd3; color:#be123c; padding:2px 10px; border-radius:999px; font-weight:900; font-size:0.74rem;">PvP</span>`;
  };

  const build = (mode)=>{
    const cand = [
      computeUpgradeCandidate(a, g1, a1, role, mode),
      computeUpgradeCandidate(a, g2, a2, role, mode),
      computeUpgradeCandidate(b, g1, b1, role, mode),
      computeUpgradeCandidate(b, g2, b2, role, mode)
    ].filter(Boolean);

    if(cand.length === 0){
      return { sig:"", top:null, html:`<div style="font-weight:900; color:#15803d;">両者とも ★5 で完成しています。</div>` };
    }

    cand.sort((x,y)=> (y.score - x.score) || (y.wp - x.wp));
    const top = cand[0];
    const gearLabel = gearName(top.gearKey);
    const costTxt = formatRecipeCost(top.cost);

    // ⚠ 武装Lv警告（無微課金向け）
    const wpWarn = (top.wp < 10)
      ? `<div class="gcmp-warn">⚠ 武装Lvが低め（Lv${top.wp}）→ 投資効率は控えめ</div>`
      : "";

    // ⚠ ★4以降の崖警告
    const cliffWarn = (top.targetStar >= 4)
      ? `<div class="gcmp-warn">⚠ ★${top.targetStar}は素材消費が急増（UR/MR）</div>`
      : "";

    const warnHtml = (wpWarn || cliffWarn)
      ? `<div class="gcmp-warns">${wpWarn}${cliffWarn}</div>`
      : "";

    const metaLine = `<div class="gcmp-meta">係数：${top.marginal.toFixed(1)}×${top.imp.toFixed(2)}×${(1+(top.wp/30)).toFixed(2)} ÷重み</div>`;

    const html = `
      <div class="gcmp-panel">
        <div class="gcmp-panel-head">
          <div class="gcmp-panel-title">✅ 次に★+1</div>
          ${badgeHtml(mode)}
        </div>

        <div class="gcmp-reco gcmp-reco-block">
          <div class="gcmp-line0">
            <span class="gcmp-name">${top.heroName}</span><span class="no-wrap">/</span><span class="gcmp-gear">${gearLabel}</span>
            <span class="gcmp-arrow no-wrap">→★${top.targetStar}</span>
            <span class="gcmp-cost no-wrap">${costTxt}</span>
          </div>
        </div>

        ${warnHtml}

        <div class="gcmp-desc">
          <div><b>${top.heroName}</b>：<b>${gearLabel}</b> → <span class="no-wrap"><b>★${top.targetStar}</b></span>（<span class="no-wrap"><b>${costTxt}</b></span>）</div>
          ${metaLine}
        </div>

        <div class="gcmp-alt">
          ${cand.slice(1,3).map(x=>{
            return `<div class="alt-line">次：${x.heroName} ${gearName(x.gearKey)} → <span class="no-wrap">★${x.targetStar}</span>（<span class="no-wrap">${formatRecipeCost(x.cost)}</span>）</div>`;
          }).join("")}
        </div>
      </div>
    `;
    const sig = `${top.heroId||top.heroName}|${top.gearKey}|${top.targetStar}|${JSON.stringify(top.cost||{})}`;
    return { sig, top, html };
  };

  // PvP/PvE の結果を作る
  const pvp = build("pvp");
  const pve = build("pve");

  // 🔥 同一結果なら統合して表示（スクロール量削減）
  if(pvp.sig && pvp.sig === pve.sig){
    const t1 = pvp.top, t2 = pve.top;
    const metaBoth = (t1 && t2)
      ? `<div class="gcmp-meta">係数：PvP ${t1.marginal.toFixed(1)}×${t1.imp.toFixed(2)} / PvE ${t2.marginal.toFixed(1)}×${t2.imp.toFixed(2)}</div>`
      : "";

    let merged = pvp.html;
    // バッジを PvP/PvE に差し替え（色も中立に）
    merged = merged.replace(/>PvP<\/span>/, '>PvP/PvE</span>');
    merged = merged.replace(/background:#fff1f2; border:1px solid #fecdd3; color:#be123c;/, 'background:#f1f5f9; border:1px solid #cbd5e1; color:#334155;');

    // 係数行を差し替え
    if(metaBoth){
      merged = merged.replace(/<div class="gcmp-meta">[\s\S]*?<\/div>/, metaBoth);
    }
    return merged;
  }

  // 2種類並べて表示（PvP / PvE）
  return `${pvp.html}${pve.html}`;
}

function setGearCompare(which, heroId){
  if(which === "a") __gearCompare.a = heroId || "";
  if(which === "b") __gearCompare.b = heroId || "";
  try{ updateGearPriorityUI(); }catch(e){}
}
window.setGearCompare = setGearCompare;

function loadGearPrioData(){
  try{
    const raw = localStorage.getItem(GEAR_PRIORITY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  }catch(e){ return {}; }
}
function saveGearPrioData(d){
  try{ localStorage.setItem(GEAR_PRIORITY_STORAGE_KEY, JSON.stringify(d||{})); }catch(e){}
}

// 編成タブの入力（キャラ + 武装Lv）を流用して、装備タブで一覧にする
function getRosterFromSquadsUnique(){
  const map = new Map(); // id -> {id, wp, role, type, name}
  for(let s=1; s<=4; s++){
    const n = (s===4)?10:5;
    for(let p=1; p<=n; p++){
      const hEl = document.getElementById(`h-${s}-${p}`);
      const wEl = document.getElementById(`w-${s}-${p}`);
      if(!hEl || !wEl) continue;
      const id = (hEl.value || "empty");
      if(id==="empty") continue;
      const h = HEROES[id];
      if(!h || h.ur) continue;
      const wpRaw = wEl.value;
      const wp = (typeof wpRaw === "string" && (wpRaw.includes("未") || wpRaw === "-")) ? 0 : (parseInt(wpRaw)||0);
      const prev = map.get(id);
      if(!prev || wp > (prev.wp||0)){
        map.set(id, { id, wp, role: h.r, type: h.t, name: h.n });
      }
    }
  }
  return Array.from(map.values());
}

function ensureGearPriorityToolDOM(){
  const tab = document.getElementById("tab-gear");
  if(!tab) return null;


  // --- Mobile typography / wrapping fixes for compare UI (smartphone portrait) ---
  try{
    if(!document.getElementById("gear-mobile-style")){
      const st = document.createElement("style");
      st.id = "gear-mobile-style";
      st.textContent = `
        /* Gear tab mobile layout */
        .gear-tool-card{ background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:12px; }
        .gear-tool-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:8px; flex-wrap:wrap; }
        .gear-tool-title{ font-weight:900; color:#0f172a; }
        .gear-tool-note{ font-size:0.74rem; color:#64748b; font-weight:800; }
        .gear-tool-tabs{ display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:6px; margin-top:10px; }
        .gear-tool-tab{ min-width:0; padding:10px 0; font-size:0.92rem; }
        .gear-tool-sub{ margin-top:10px; font-size:0.80rem; line-height:1.5; color:#475569; font-weight:800; }
        .gear-tool-list{ margin-top:8px; }
        .gear-list-empty{ font-size:0.82rem; color:#64748b; font-weight:800; padding:8px 2px; }
        .gear-list-card{ cursor:pointer; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:10px; display:grid; grid-template-columns:42px minmax(0,1fr) auto; gap:10px; align-items:center; margin-bottom:8px; }
        .gear-list-avatar-wrap{ width:42px; height:42px; flex-shrink:0; position:relative; }
        .gear-list-avatar-img{ width:42px; height:42px; border-radius:10px; object-fit:cover; background:#0b1220; display:block; }
        .gear-list-avatar-fb{ width:42px; height:42px; border-radius:10px; background:#0b1220; color:#fff; align-items:center; justify-content:center; font-weight:900; }
        .gear-list-main{ min-width:0; }
        .gear-list-title-row{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .gear-list-name{ min-width:0; max-width:100%; font-weight:900; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .gear-status{ font-size:0.68rem; font-weight:900; padding:2px 6px; border-radius:999px; white-space:nowrap; }
        .gear-status-done{ color:#15803d; background:#f0fdf4; border:1px solid #bbf7d0; }
        .gear-status-pending{ color:#475569; background:#fff; border:1px solid #e2e8f0; }
        .gear-list-edit{ flex-shrink:0; font-size:0.72rem; color:#64748b; font-weight:900; }
        .gear-list-wp{ margin-top:4px; font-size:0.80rem; color:#475569; font-weight:800; }
        .gear-list-gears{ margin-top:4px; display:flex; flex-direction:column; gap:5px; }
        .gear-list-gear{ font-size:0.82rem; color:#475569; font-weight:800; min-width:0; display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .gear-list-label{ color:#475569; flex:1 1 auto; min-width:0; }
        .gear-list-stars{ color:#334155; white-space:nowrap; flex:0 0 7.2em; min-width:7.2em; text-align:right; font-size:0.92rem; letter-spacing:0.02em; }

        /* Compare UI: prevent awkward wraps on mobile */
        .gear-compare-box{ margin-top:12px; }
        .gear-compare-title{ font-weight:900; color:#0f172a; margin-bottom:8px; }
        .gear-compare-row{ display:flex; gap:8px; flex-wrap:wrap; margin-top:6px; }
        .gear-compare-row select{ flex:1 1 220px; min-width:0; width:100%; padding:10px 12px; border-radius:12px; border:1px solid #e2e8f0; font-weight:800; font-size:16px; background:#fff; }
        .gear-compare-result{ margin-top:10px; }
        .gear-compare-footnote, .gear-tool-footnote{ margin-top:10px; font-size:0.72rem; line-height:1.55; color:#64748b; font-weight:800; }

        .no-wrap{ white-space:nowrap; }
        .gcmp-reco{ margin-top:6px; font-weight:900; color:#a21caf; background:#fdf4ff; border:1px solid #fbcfe8; padding:10px 10px; border-radius:12px; }
        .gcmp-line1{ display:flex; gap:6px; align-items:baseline; min-width:0; }
        .gcmp-line1 .gcmp-name{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .gcmp-line1 .gcmp-gear{ white-space:nowrap; }
        .gcmp-line2{ margin-top:6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .gcmp-cost{ font-size:0.80rem; font-weight:900; color:#475569; background:#fff; border:1px solid #e2e8f0; padding:2px 8px; border-radius:999px; }
        .gcmp-desc{ margin-top:8px; font-size:0.74rem; color:#475569; font-weight:800; line-height:1.55; }
        .gcmp-desc .gcmp-meta{ color:#64748b; }
        .gcmp-alt{ margin-top:8px; }
        .gcmp-alt .alt-line{ font-size:0.72rem; color:#64748b; font-weight:800; line-height:1.5; }
        .recipe-line{ font-size:12px; white-space:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; }
        .gcmp-line0{ display:flex; gap:6px; align-items:baseline; min-width:0; flex-wrap:nowrap; overflow:hidden; font-size:0.86rem; }
        .gcmp-line0 .gcmp-name{ flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .gcmp-line0 .gcmp-gear, .gcmp-line0 .gcmp-arrow, .gcmp-line0 .gcmp-cost{ flex:0 0 auto; white-space:nowrap; }

        @media (max-width: 480px){
          .gear-tool-card{ padding:10px; }
          .gear-tool-tabs{ gap:5px; }
          .gear-tool-tab{ font-size:0.86rem; padding:9px 0; }
          .gear-list-card{ grid-template-columns:42px minmax(0,1fr); align-items:flex-start; }
          .gear-list-edit{ grid-column:2; justify-self:end; margin-top:4px; font-size:0.80rem; }
          .gear-list-title-row{ align-items:flex-start; }
          .gear-list-name{ white-space:normal; line-height:1.25; font-size:1.02rem; }
          .gear-list-wp{ font-size:0.86rem; }
          .gear-list-gears{ gap:6px; }
          .gear-list-gear{ font-size:0.88rem; gap:12px; }
          .gear-list-stars{ flex-basis:7.8em; min-width:7.8em; font-size:1.00rem; }
          .gear-compare-row{ flex-direction:column; }
          .gear-compare-row select{ flex:1 1 auto; }
        }
        @media (max-width: 360px){ .gcmp-line0{ font-size:0.82rem; } .gcmp-reco{ padding:9px 10px; } }

      `;
      document.head.appendChild(st);
    }
  }catch(e){}

  let wrap = document.getElementById("gear-prio-tool");
  if(wrap) return wrap;

  wrap = document.createElement("div");
  wrap.id = "gear-prio-tool";
  wrap.style.marginTop = "14px";

  wrap.innerHTML = `
    <div class="gear-tool-card">
      <div class="gear-tool-head">
        <div class="gear-tool-title"></div>
        <div class="gear-tool-note">※編成の評価には反映しません</div>
      </div>

      <div class="gear-tool-tabs">
        <button class="tab-btn gear-tool-tab" id="gear-prio-btn-atk" onclick="setGearPrioRole('atk')">火力役</button>
        <button class="tab-btn gear-tool-tab" id="gear-prio-btn-wall" onclick="setGearPrioRole('wall')">盾役</button>
        <button class="tab-btn gear-tool-tab" id="gear-prio-btn-sup" onclick="setGearPrioRole('sup')">支援役</button>
      </div>

      <div id="gear-prio-sub" class="gear-tool-sub"></div>
      <div id="gear-prio-list" class="gear-tool-list"></div>

      <!-- ★上げ判定（2キャラ比較） -->
      <div id="gear-compare-box" class="gear-compare-box">
        <div class="gear-compare-title">🔍 ★上げ判定（2キャラ比較）</div>
        <div class="gear-compare-row">
          <select id="gear-compare-a" onchange="setGearCompare('a', this.value)"></select>
          <select id="gear-compare-b" onchange="setGearCompare('b', this.value)"></select>
        </div>
        <div id="gear-compare-result" class="gear-compare-result"></div>
        <div class="gear-compare-footnote">
          ※この判定は「(次の★+1の伸び) ÷ (UR/MR入手難易度の重み) × (武装Lv補正)」の簡易モデルです。<br>
          ※役割ボタン（火力/盾/支援）で対象装備が変わります。
        </div>
      </div>

      <div class="gear-tool-footnote">
        ・役割ごとに「見る装備」を2つに固定（例：火力＝レールガン&チップ）。<br>
        ・★入力はこのタブだけで管理（UR/MRレシピの誤爆防止用）。<br>
        ・優先度は「未完成★の多さ」×「武装Lv（育成済みほど優先）」で並び替え。
      </div>
    </div>
  `;

  tab.appendChild(wrap);
  return wrap;
}

let __gearPrioRole = "atk";
function setGearPrioRole(role){
  __gearPrioRole = role;
  try{ updateGearPriorityUI(); }catch(e){}
}
window.setGearPrioRole = setGearPrioRole;

function gearName(key){
  try{
    // data.js の GEAR_NAMES を利用
    return (typeof GEAR_NAMES !== "undefined" && GEAR_NAMES[key]) ? GEAR_NAMES[key] : key;
  }catch(e){ return key; }
}

function renderStars(n){
  const v = Math.max(0, Math.min(5, parseInt(n)||0));
  let s = "";
  for(let i=0;i<5;i++) s += (i<v) ? "★" : "☆";
  return s;
}

function updateGearPriorityUI(){
  const wrap = ensureGearPriorityToolDOM();
  if(!wrap) return;

  // ボタン状態
  ["atk","wall","sup"].forEach(r=>{
    const b = document.getElementById(`gear-prio-btn-${r}`);
    if(!b) return;
    if(r===__gearPrioRole) b.classList.add("active");
    else b.classList.remove("active");
  });

  const roster = getRosterFromSquadsUnique();
  const listEl = document.getElementById("gear-prio-list");
  const subEl  = document.getElementById("gear-prio-sub");
  if(!listEl || !subEl) return;

  const gears = GEAR_ROLE_MAP[__gearPrioRole] || GEAR_ROLE_MAP.atk;
  const g1 = gears[0], g2 = gears[1];

  const roleLabel = (__gearPrioRole==="atk") ? "火力役" : (__gearPrioRole==="wall") ? "盾役" : "支援役";
  subEl.innerHTML = `対象：<b>${roleLabel}</b>（${gearName(g1)} / ${gearName(g2)} の★を入力して比較）`;

  const store = loadGearPrioData();
  const rows = roster
    .filter(h => h.role === __gearPrioRole)
    .map(h=>{
      const st = store[h.id] || {};
      const s1 = Math.max(0, Math.min(5, parseInt(st[g1])||0));
      const s2 = Math.max(0, Math.min(5, parseInt(st[g2])||0));
      const need = (5 - s1) + (5 - s2); // 未完成★の多さ
      const lvW = 1 + (Math.max(0, Math.min(30, h.wp||0)) / 30); // 育成済みほど優先（1.0〜2.0）
      const score = need * lvW;
      return { ...h, g1, g2, s1, s2, need, score };
    })
    .sort((a,b)=> (b.score - a.score) || (b.wp - a.wp));

  if(rows.length === 0){
    listEl.innerHTML = `<div class="gear-list-empty">該当キャラがいません（編成タブに配置するとここに出ます）。</div>`;
    return;
  }

  // --- 2キャラ比較UI（次に★+1するならどれが良い？） ---
  const selA = document.getElementById("gear-compare-a");
  const selB = document.getElementById("gear-compare-b");
  const resEl = document.getElementById("gear-compare-result");
  if(selA && selB && resEl){
    const optHtml = rows.map(r=>{
      const label = `${r.name} Lv${r.wp} / ${gearName(g1)}★${r.s1} ${gearName(g2)}★${r.s2}`;
      return `<option value="${r.id}">${label}</option>`;
    }).join("");

    // optionsは毎回更新（役割切替で候補が変わるため）
    selA.innerHTML = optHtml;
    selB.innerHTML = optHtml;

    const ids = rows.map(r=>r.id);
    const defA = ids[0] || "";
    const defB = ids[1] || ids[0] || "";

    if(!__gearCompare.a || !ids.includes(__gearCompare.a)) __gearCompare.a = defA;
    if(!__gearCompare.b || !ids.includes(__gearCompare.b)) __gearCompare.b = defB;

    selA.value = __gearCompare.a;
    selB.value = __gearCompare.b;

    const heroA = rows.find(r=>r.id===__gearCompare.a) || rows[0];
    const heroB = rows.find(r=>r.id===__gearCompare.b) || rows[1] || rows[0];

    resEl.innerHTML = (heroA && heroB) ? renderGearCompareResult(heroA, heroB, g1, g2, __gearPrioRole) : "";
  }
  listEl.innerHTML = rows.map((r, idx)=>{
    const nextHint = (r.need<=0)
      ? `<span class="gear-status gear-status-done">完成</span>`
      : `<span class="gear-status gear-status-pending">未完成★ ${r.need}</span>`;

    const avatar = `<img class="gear-list-avatar-img" src="${getHeroImagePath(r.id)}" alt="${r.name}" onerror="this.style.display='none'; this.parentNode.querySelector('.gear-list-avatar-fb').style.display='flex';">`;
    const fb = `<div class="gear-list-avatar-fb" style="display:none;">${(r.name||"").substring(0,2)}</div>`;

    return `
      <div onclick="openGearStarModal('${r.id}')" class="gear-list-card">
        <div class="gear-list-avatar-wrap">${avatar}${fb}</div>
        <div class="gear-list-main">
          <div class="gear-list-title-row">
            <div class="gear-list-name">${idx+1}. ${r.name}</div>
            ${nextHint}
          </div>
          <div class="gear-list-wp">武装Lv<b>${r.wp}</b></div>
          <div class="gear-list-gears">
            <div class="gear-list-gear">
              <span class="gear-list-label">${gearName(r.g1)}：</span>
              <span class="gear-list-stars"><b>${renderStars(r.s1)}</b></span>
            </div>
            <div class="gear-list-gear">
              <span class="gear-list-label">${gearName(r.g2)}：</span>
              <span class="gear-list-stars"><b>${renderStars(r.s2)}</b></span>
            </div>
          </div>
        </div>
        <div class="gear-list-edit">編集</div>
      </div>
    `;
  }).join("");
}

// 初期化（装備タブ生成後に呼ばれる）
function initGearPriorityTool(){
  ensureGearPriorityToolDOM();
  // 初回は火力役
  __gearPrioRole = __gearPrioRole || "atk";
  updateGearPriorityUI();
}

let __gearModal = { id:null, role:"atk", g1:"Gun", g2:"Data", s1:0, s2:0 };

function ensureGearStarModalDOM(){
  if(document.getElementById("gear-star-modal")) return;

  const modal = document.createElement("div");
  modal.id = "gear-star-modal";
  modal.style.position = "fixed";
  modal.style.left = "0";
  modal.style.top = "0";
  modal.style.right = "0";
  modal.style.bottom = "0";
  modal.style.background = "rgba(0,0,0,0.45)";
  modal.style.display = "none";
  modal.style.alignItems = "flex-end";
  modal.style.justifyContent = "center";
  modal.style.zIndex = "9999";

  modal.innerHTML = `
    <div style="width:min(520px, 100%); background:#fff; border-radius:16px 16px 0 0; padding:14px; box-shadow:0 -10px 30px rgba(0,0,0,0.18);">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="font-weight:900; color:#0f172a;" id="gear-star-title">装備★入力</div>
        <button onclick="closeGearStarModal()" style="border:none; background:#f1f5f9; border-radius:10px; padding:8px 10px; font-weight:900; color:#0f172a; cursor:pointer;">閉じる</button>
      </div>

      <div style="margin-top:10px; display:flex; gap:12px; align-items:center;">
        <div id="gear-star-avatar" style="width:44px;height:44px;border-radius:12px;background:#0b1220; overflow:hidden; flex-shrink:0;"></div>
        <div style="min-width:0;">
          <div id="gear-star-name" style="font-weight:900; color:#0f172a; font-size:1.02rem;"></div>
          <div id="gear-star-sub" style="font-size:0.76rem; color:#64748b; font-weight:900;"></div>
        </div>
      </div>

      <div style="margin-top:12px; display:grid; grid-template-columns:1fr; gap:10px;">
        <div style="border:1px solid #e2e8f0; border-radius:12px; padding:10px;">
          <div style="font-weight:900; color:#0f172a; margin-bottom:6px;" id="gear-star-g1-name"></div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <button onclick="gearStarStep(1,-1)" style="width:44px; height:40px; border-radius:12px; border:1px solid #e2e8f0; background:#fff; font-weight:900; cursor:pointer;">-</button>
            <div style="font-weight:900; color:#0f172a; font-size:1.05rem;" id="gear-star-g1-stars">☆☆☆☆☆</div>
            <button onclick="gearStarStep(1,1)" style="width:44px; height:40px; border-radius:12px; border:1px solid #e2e8f0; background:#fff; font-weight:900; cursor:pointer;">+</button>
          </div>
        </div>

        <div style="border:1px solid #e2e8f0; border-radius:12px; padding:10px;">
          <div style="font-weight:900; color:#0f172a; margin-bottom:6px;" id="gear-star-g2-name"></div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <button onclick="gearStarStep(2,-1)" style="width:44px; height:40px; border-radius:12px; border:1px solid #e2e8f0; background:#fff; font-weight:900; cursor:pointer;">-</button>
            <div style="font-weight:900; color:#0f172a; font-size:1.05rem;" id="gear-star-g2-stars">☆☆☆☆☆</div>
            <button onclick="gearStarStep(2,1)" style="width:44px; height:40px; border-radius:12px; border:1px solid #e2e8f0; background:#fff; font-weight:900; cursor:pointer;">+</button>
          </div>
        </div>
      </div>

      <div style="margin-top:12px; display:flex; gap:10px;">
        <button onclick="gearStarClear()" style="flex:1; border:none; background:#f1f5f9; border-radius:12px; padding:12px; font-weight:900; color:#0f172a; cursor:pointer;">クリア</button>
        <button onclick="gearStarApply()" style="flex:2; border:none; background:#0f172a; border-radius:12px; padding:12px; font-weight:900; color:#fff; cursor:pointer;">保存</button>
      </div>

      <div style="margin-top:10px; font-size:0.72rem; color:#94a3b8; font-weight:800; line-height:1.45;">
        ※ここで入力した★は「装備タブの優先度表示」だけに使います。編成の最適化やスコア計算には影響しません。
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // 背景タップで閉じる
  modal.addEventListener("click", (e)=>{
    if(e.target === modal) closeGearStarModal();
  });
}

function openGearStarModal(heroId){
  ensureGearStarModalDOM();

  const roster = getRosterFromSquadsUnique();
  const hero = roster.find(x=>x.id===heroId);
  if(!hero) return;

  const store = loadGearPrioData();
  const gears = GEAR_ROLE_MAP[hero.role] || GEAR_ROLE_MAP.atk;
  const g1 = gears[0], g2 = gears[1];

  const st = store[heroId] || {};
  __gearModal = {
    id: heroId,
    role: hero.role,
    g1, g2,
    s1: Math.max(0, Math.min(5, parseInt(st[g1])||0)),
    s2: Math.max(0, Math.min(5, parseInt(st[g2])||0)),
    wp: hero.wp || 0,
    name: hero.name || ""
  };

  const modal = document.getElementById("gear-star-modal");
  modal.style.display = "flex";

  const title = document.getElementById("gear-star-title");
  const name  = document.getElementById("gear-star-name");
  const sub   = document.getElementById("gear-star-sub");
  const av    = document.getElementById("gear-star-avatar");

  const roleLabel = (hero.role==="atk") ? "火力役" : (hero.role==="wall") ? "盾役" : "支援役";
  title.innerText = "装備★入力（" + roleLabel + "）";
  name.innerText = hero.name || heroId;
  sub.innerText  = "武装Lv " + (hero.wp||0);

  av.innerHTML = `<img src="${getHeroImagePath(heroId)}" alt="${hero.name||heroId}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';">`;

  document.getElementById("gear-star-g1-name").innerText = gearName(g1);
  document.getElementById("gear-star-g2-name").innerText = gearName(g2);

  refreshGearStarModalStars();
}
window.openGearStarModal = openGearStarModal;

function closeGearStarModal(){
  const modal = document.getElementById("gear-star-modal");
  if(modal) modal.style.display = "none";
}
window.closeGearStarModal = closeGearStarModal;

function refreshGearStarModalStars(){
  const e1 = document.getElementById("gear-star-g1-stars");
  const e2 = document.getElementById("gear-star-g2-stars");
  if(e1) e1.innerText = renderStars(__gearModal.s1);
  if(e2) e2.innerText = renderStars(__gearModal.s2);
}

function gearStarStep(which, d){
  if(which===1){
    __gearModal.s1 = Math.max(0, Math.min(5, (__gearModal.s1||0) + d));
  }else{
    __gearModal.s2 = Math.max(0, Math.min(5, (__gearModal.s2||0) + d));
  }
  refreshGearStarModalStars();
}
window.gearStarStep = gearStarStep;

function gearStarClear(){
  __gearModal.s1 = 0; __gearModal.s2 = 0;
  refreshGearStarModalStars();
}
window.gearStarClear = gearStarClear;

function gearStarApply(){
  if(!__gearModal || !__gearModal.id) { closeGearStarModal(); return; }
  const store = loadGearPrioData();
  if(!store[__gearModal.id]) store[__gearModal.id] = {};
  store[__gearModal.id][__gearModal.g1] = __gearModal.s1;
  store[__gearModal.id][__gearModal.g2] = __gearModal.s2;
  saveGearPrioData(store);
  closeGearStarModal();
  // 反映
  try{ updateGearPriorityUI(); }catch(e){}
}

// inline handler / 外部から呼べるように window に公開
window.saveData = saveData;
window.scheduleAi = scheduleAi;
window.updateTransitionRecommendationUI = updateTransitionRecommendationUI;


// ================= スロット: 折りたたみ =================
const SLOT_COLLAPSE_KEY_PREFIX = "slot-collapse-";
const SLOT_KEEP_EVAL_KEY = "slot-keep-eval-on-collapse";

function applyKeepEvalPref(keep){
  try{
    document.body.classList.toggle('keep-eval-collapse', !!keep);
  }catch(e){}
}

function initKeepEvalPref(){
  // default: 現状の見た目に合わせて「折りたたみ時は評価を消す」
  let keep = false;
  try{ keep = (localStorage.getItem(SLOT_KEEP_EVAL_KEY) === '1'); }catch(e){}
  applyKeepEvalPref(keep);

  const cb = document.getElementById('slot-keep-eval');
  if(cb){
    cb.checked = keep;
    cb.addEventListener('change', ()=>{
      const v = !!cb.checked;
      applyKeepEvalPref(v);
      try{ localStorage.setItem(SLOT_KEEP_EVAL_KEY, v ? '1' : '0'); }catch(e){}
    });
  }
}

function setSlotToggleState(n, isExpanded){
  const army = document.getElementById(`slot-army-${n}`);
  const btn = army ? (army.querySelector('.slot-toggle-btn') || army.querySelector('.slot-toggle')) : null;
  if(!army || !btn) return;

  // isExpanded: true = 展開（タイル表示）
  army.classList.toggle('slot-collapsed', !isExpanded);
  // Icon button (▼/▶)
  if(btn.classList.contains('slot-toggle-btn')){
    btn.textContent = isExpanded ? '▼' : '▶';
  }else{
    // legacy switch
    btn.setAttribute('aria-checked', String(!!isExpanded));
  }
  const label = (n===4) ? '控え' : `${n}軍`;
  btn.setAttribute('aria-label', isExpanded ? `${label}を折りたたむ` : `${label}を展開する`);
}

function toggleSlotArmy(n){
  const army = document.getElementById(`slot-army-${n}`);
  if(!army) return;
  const isExpanded = army.classList.contains('slot-collapsed'); // collapsed -> will expand
  setSlotToggleState(n, isExpanded);
  try{ localStorage.setItem(SLOT_COLLAPSE_KEY_PREFIX + n, isExpanded ? "0" : "1"); }catch(e){}
}
window.toggleSlotArmy = toggleSlotArmy;


// === トグルボタンだけで開閉（ヘッダー全体タップは無効） ===
// DOM再描画でボタンが差し替わっても効くように「イベント委譲」にする（PCでも安定）
(function(){
  function armyNoFromBtn(btn){
    const p = btn.closest("[id^='slot-army-']");
    if(p && p.id){
      const m = p.id.match(/slot-army-(\d+)/);
      if(m) return Number(m[1]);
    }
    const oc = btn.getAttribute('onclick') || '';
    const mm = oc.match(/toggleSlotArmy\((\d+)\)/);
    if(mm) return Number(mm[1]);
    return null;
  }
  function handler(e){
    const btn = e.target && e.target.closest ? e.target.closest('.slot-toggle-btn, .slot-toggle') : null;
    if(!btn) return;
    try{ e.preventDefault(); }catch(_){}
    try{ e.stopPropagation(); }catch(_){}
    if(e.stopImmediatePropagation){ try{ e.stopImmediatePropagation(); }catch(_){ } }
    const n = armyNoFromBtn(btn);
    if(!n) return;
    if(typeof window.toggleSlotArmy === 'function') window.toggleSlotArmy(n);
  }
  document.addEventListener('click', handler, true);
  document.addEventListener('touchend', handler, { capture:true, passive:false });
})();



function initSlotToggles(){
  for(let n=1; n<=4; n++){
    const army = document.getElementById(`slot-army-${n}`);
    if(!army) continue;
    const btn = army.querySelector('.slot-toggle-btn') || army.querySelector('.slot-toggle');
    if(!btn) continue;

    let collapsed = false;
    try{ collapsed = (localStorage.getItem(SLOT_COLLAPSE_KEY_PREFIX + n) === "1"); }catch(e){}
    setSlotToggleState(n, !collapsed);
  }
}

// index.html はスクリプトが末尾なので、基本は即時でOK
try{ initSlotToggles(); }catch(e){}
try{ initKeepEvalPref(); }catch(e){}




function toggleTransitionPanel(){
  var body = document.getElementById('power-transition-body') || document.getElementById('power-transition');
  var btn = document.getElementById('power-transition-toggle');
  if(!body) return;
  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if(btn) btn.textContent = isOpen ? '▼' : '▲';
}
try{ window.toggleTransitionPanel = toggleTransitionPanel; }catch(e){}

try{ window.getArmyTypeCounts = getArmyTypeCounts; window.getArmyBuffInfo = getArmyBuffInfo; }catch(e){}
