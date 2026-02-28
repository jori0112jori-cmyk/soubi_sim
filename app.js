// Auto-split from single-file build (v1.4)
// App logic
// --- マスタデータ ---






let previousAssignment = null;


// ===============================
// 🔁 乗り換え推奨度：色連動コピー（%で文言変化）
// ===============================
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
      if (v) return v;
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
    generateAiSuggestion();
  }, 60);
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
  const box = $id('power-transition');
  if(!box) return;

  const pt = parseFloat(($id('pow-tank')||{}).value) || 0;
  const pa = parseFloat(($id('pow-air')||{}).value) || 0;
  const pm = parseFloat(($id('pow-mis')||{}).value) || 0;

  if(pt<=0 && pa<=0 && pm<=0){
    box.innerHTML = `
      <div style="font-weight:900; color:#0f172a; margin-bottom:6px;">🔁 乗り換え推奨度（戦力差ベース）</div>
      <div style="font-size:0.82rem; color:#64748b; font-weight:bold;">戦力を入力すると表示されます（目安：対象が主力の60%以上で「検討圏」）。</div>
    `;
    return;
  }

  const powers = { tank: pt, air: pa, mis: pm };
  const labels = { tank: "戦車", air: "航空機", mis: "ロケラン" };

  const base = Object.keys(powers).sort((a,b)=>powers[b]-powers[a])[0];
  const baseP = Math.max(powers[base], 0.0001);

  // 60%未満は「ほぼ乗り換え圏外」扱い（0%）
  const scoreFromRatio = (ratio)=>{
    const raw = (ratio - 0.60) / 0.40; // 0.60→0%, 1.00→100%
    return Math.max(0, Math.min(1, raw)) * 100;
  };

  const meta = ($id('current-meta')||{}).value || '';
  const metaBoost = (t)=>{
    if(!meta) return 0;
    if(t === meta) return 10;
    if(base === meta) return -5;
    return 0;
  };

  const targets = Object.keys(powers).filter(t=>t!==base).map(t=>{
    const ratio = powers[t] / baseP;
    let sc = scoreFromRatio(ratio) + metaBoost(t);
    sc = Math.max(0, Math.min(100, sc));
    return { t, ratio, sc: Math.round(sc) };
  }).sort((a,b)=>b.sc-a.sc);

  

// === 推奨度カラー ===
function colorByScore(sc){
  if(sc>=85) return "#ef4444";
  if(sc>=70) return "#f59e0b";
  if(sc>=55) return "#eab308";
  if(sc>=40) return "#64748b";
  if(sc>=25) return "#94a3b8";
  return "#cbd5e1";
}

const line = (t)=> {
  const adv = getTransitionAdvice(t.sc);
  const color = adv.color;
  const w = Number.isFinite(t.sc) ? Math.max(0, Math.min(100, t.sc)) : 0;

  return `
    <div class="trans-row" style="align-items:flex-start;">
      <div class="trans-left">
        ${labels[base]} → ${labels[t.t]}
        <span class="trans-badge ${adv.cls}">${adv.txt}</span>
      </div>

      <div class="trans-right" style="min-width:84px; text-align:right;">
        <div style="color:${color}; font-weight:900;">${t.sc}%</div>
        <div style="margin-top:4px; width:84px; height:8px; background:#e5e7eb; border-radius:999px; overflow:hidden;">
          <div style="width:${w}%; height:100%; background:${color};"></div>
        </div>
      </div>
    </div>
  `;
};

const metaTxt = meta ? ` / 現在のメタ：<b style="color:#1d4ed8;">${labels[meta]||meta}</b>` : '';
  box.innerHTML = `
    <div style="font-weight:900; color:#0f172a; margin-bottom:6px;">🎯 兵種シフト目安</div>
    <div style="font-size:0.78rem; color:#64748b; font-weight:bold; margin-bottom:6px;">
      基準：いま一番強い兵種（${labels[base]}）${metaTxt}
    </div>
    ${targets.map(line).join('')}
    <div style="font-size:0.72rem; color:#94a3b8; font-weight:bold; margin-top:6px;">
      ※ 60%未満は0%扱い。メタ一致は+10%、主力がメタ一致のときは-5%（目安）。
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
    loadAllData(); 
    try { renderSlots(); } catch(e) {}
   
   // ★★★ これを追加（超重要）
    updateTransitionRecommendationUI();
};

function showTab(id, el) { 
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active')); 
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active')); 
    $id('tab-'+id).classList.add('active'); 
    if(el) el.classList.add('active'); 
    let footer = $id('footer-bar');
    let ref = document.getElementById('ref-panel');
    if(ref) ref.style.display = (id === 'guide') ? 'block' : 'none';
    if(footer) footer.style.display = (id === 'gear') ? 'flex' : 'none';
}

function showToast(msg) { 
    let x = $id("toast"); 
    x.innerText = msg; x.style.visibility = "visible"; x.style.bottom = "80px"; 
    setTimeout(() => { x.style.visibility = "hidden"; x.style.bottom = "30px"; }, 2500); 
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
function updateAllSquads() { for(let i=1; i<=4; i++) updateSquad(i); }

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
        let card = $id(`card-${s}-${p}`), fIcon = $id(`f-${s}-${p}`), rIcon = $id(`r-${s}-${p}`);
        card.className = 'interactive-card'; $id(`prio-${s}-${p}`).style.display = 'none';
        
        if(h.ur || hid === 'empty') { $id(`wp-box-${s}-${p}`).style.opacity = '0.3'; wpEl.value = h.ur ? "未実装" : "-"; v = 0; } 
        else { $id(`wp-box-${s}-${p}`).style.opacity = '1'; wpEl.value = v; }
        
        if (hid === 'empty') { 
            card.classList.add('card-empty'); counts.none++; fIcon.style.display = 'none'; rIcon.style.display = 'none'; $id(`syn-${s}-${p}`).innerHTML = '';
        } else {
            card.classList.add('card-'+(h.ur?'ur':h.t)); counts[h.t]++;
            if(v >= 30) card.classList.add('card-awakened');
            fIcon.style.display = 'flex'; rIcon.style.display = 'flex';
            
            // 💡 アイコン画像表示の復元
            fIcon.innerHTML = `<img src="${h.t==='tank'?'tank.png':h.t==='air'?'air.png':'misile.png'}" style="width:100%;height:100%;object-fit:contain;border-radius:50%;">`;
            rIcon.innerHTML = `<img src="${h.r==='wall'?'tateyaku.png':h.r==='atk'?'karyoku.png':'support.png'}" style="width:100%;height:100%;object-fit:contain;border-radius:50%;">`;
            
            if (v >= 30) {
                $id(`syn-${s}-${p}`).innerHTML = `<div class="awaken-badge">👑 覚醒</div>`;
            } else if (v === 0 && !h.ur) {
                $id(`syn-${s}-${p}`).innerHTML = `<span class="shard-info" style="color:#94a3b8; font-size:0.8rem;">未解放</span>`;
                actPool.push({ p:p, h:h, wp:v });
            } else if (v > 0) { 
                let ms = getNextMilestone(v);
                let iconHtml = `<img src="${SHARD_ICON}" class="shard-icon">`;
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
    let status = max === 5 ? 'perfect' : max === 4 ? 'ok' : 'ng';
    
    let msg = max === 5 ? `🏆 <b>同兵種5体編成：</b> 兵種バフ(20%)とメイン兵種のスキルチップ恩恵を最大限に受けます。` 
            : max === 4 ? `🚜 <b>同兵種4体編成：</b> 兵種バフは15%になります。` 
            : `⚠️ <b>兵種バフ不足：</b> バフが低すぎます。極力5体染めを推奨します。`;
    
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
    if(squadMembers.length === 0) return { score: 0, maxCount: 0, attack: 0, defense: 0 };
    let counts = { tank: 0, air: 0, mis: 0 };

    squadMembers.forEach(m => {
        // ✅ 推奨スコアカーブ（無微リアル / 体感寄せ）
        // 0→10: 解放〜実戦投入の立ち上がり
        // 10→20: 伸びを実感（現実的な到達）
        // 20→30: 伸びが大きい（重課金帯）
        let pts = 70;
        if (m.wp >= 30) pts += 360;
        else if (m.wp >= 20) pts += 190 + (m.wp - 20) * 8;
        else if (m.wp >= 10) pts += 90 + (m.wp - 10) * 5;
        else if (m.wp > 0) pts += 20 + (m.wp) * 3;

        if (m.ur) pts -= 20;
        m.basePts = pts;
        counts[m.t]++;
    });

    let maxType = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    let maxCount = counts[maxType];
    let buffMult = maxCount === 5 ? 1.20 : maxCount === 4 ? 1.15 : maxCount === 3 ? 1.05 : 1.0;
    let adjustedTotal = 0;

    let attackScore = 0;
    let defenseScore = 0;

    // 役割バランス（前衛不足を強めにペナルティ / 過剰耐久も微減）
    const roleCounts = { atk:0, wall:0, sup:0 };
    squadMembers.forEach(m => { if(roleCounts[m.r] !== undefined) roleCounts[m.r]++; });

    let compMult = 1.0;
    if(roleCounts.wall >= 2) compMult *= (roleCounts.wall === 2 ? 1.05 : 0.98);
    else if(roleCounts.wall === 1) compMult *= 0.92;
    else compMult *= 0.85;

    if(roleCounts.atk === 0) compMult *= 0.80;
    if(roleCounts.sup >= 2) compMult *= 0.97;

    squadMembers.forEach(m => {
        let isOutsider = m.t !== maxType;
        let charScore = m.basePts;
        if (isOutsider) {
            let penalty = 0;
            if (m.r === 'atk') { penalty = charScore * 0.40; } 
            else if (m.r === 'wall') { penalty = m.wp >= 20 ? charScore * 0.15 : charScore * 0.30; } 
            else { penalty = charScore * 0.25; }
            charScore -= penalty;
        } else { charScore += charScore * 0.10; }

        let finalCharScore = Math.max(0, charScore);
        adjustedTotal += finalCharScore;

        if (m.r === 'atk') attackScore += finalCharScore;
        else if (m.r === 'wall') defenseScore += finalCharScore;
        else { attackScore += finalCharScore * 0.5; defenseScore += finalCharScore * 0.5; }
    });

    let currentMeta = $id('current-meta').value;
    let metaMult = (maxType === currentMeta) ? 1.12 : 1.0;

    return { 
        score: Math.round(adjustedTotal * buffMult * metaMult * compMult), 
        maxCount: maxCount,
        attack: Math.round(attackScore * buffMult * metaMult * compMult),
        defense: Math.round(defenseScore * buffMult * metaMult * compMult)
    };
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
        totalScore: Object.values(wScores).reduce((a, b) => a + b, 0),
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

function calculateUpgradeEfficiencyFull(roster){
    if(roster.length < 10) return {normal:[], unlock:[], weakness1: "balance", weakness2: "balance", weakness3: "balance", reinforceList: []};

    let base = optimizeMultiArmy(roster,5);
    let baseScore = base.totalScore;
    if(baseScore === 0) return {normal:[], unlock:[], weakness1: "balance", weakness2: "balance", weakness3: "balance", reinforceList: []};

    let weakness1 = detectArmyWeaknessFromDetail(base.armyDetails.army1);
    let weakness2 = detectArmyWeaknessFromDetail(base.armyDetails.army2);
    let weakness3 = detectArmyWeaknessFromDetail(base.armyDetails.army3);
// === 環境適応型AI：メタ×育成段階による価値補正 ===
const currentMeta = ($id && $id('current-meta')) ? $id('current-meta').value : 'tank';
const wpNums = roster.filter(h=>!h.ur).map(h=>Math.max(0, parseInt(h.wp)||0));
const avgWp = wpNums.reduce((a,b)=>a+b,0) / Math.max(1, wpNums.length);
// 初期帯: 航空寄り / 中盤帯: 航空やや優勢 / 成熟帯: ロケラン解禁（ロケラン寄り）
const powers = getUserPowers();
const stPref = determineStageAndPreference(avgWp, powers);
const stage = stPref.stage;
const stagePref = stPref.pref;
const stageScale = stPref.scale;

function metaTypeWeight(type, roleKey){
    let mult = 1.0;

    // 現在の環境（サーバーメタ）に適応
    if(type === currentMeta) mult *= 1.05;

    // 育成段階（移行先）を後押し：初期〜中盤は航空、成熟帯はロケラン
    if(type === stagePref) mult *= stageScale;

    // 役割価値（ざっくり）
    if(currentMeta === 'mis'){
        if(roleKey === 'wall') mult *= 1.03;
        else if(roleKey === 'atk') mult *= 1.01;
    } else if(currentMeta === 'air'){
        if(roleKey === 'atk') mult *= 1.03;
    } else if(currentMeta === 'tank'){
        if(roleKey === 'wall') mult *= 1.02;
    }

    // どちらにも当たらない場合は微減（過剰な分散を抑える）
    if(type !== currentMeta && type !== stagePref) mult *= 0.98;

    // 上限/下限のガード
    mult = Math.max(0.85, Math.min(1.20, mult));
    return mult;
}

    let army1Ratio = (base.weightedScores.army1 / baseScore) * 100;
    let army1Ids = base.assignment.army1.map(h => h.id);
    let army2Ids = base.assignment.army2.map(h => h.id);

    let normalResults = [];
    let unlockResults = [];

    roster.forEach((hero,index)=>{
        if(hero.ur) return;

        let roleKey = hero.r; let roleBadge = getRoleBadge(roleKey);
        let simulated = roster.map(h => ({...h}));

        if(hero.wp === 0){
            simulated[index].wp = 10;
            let newResult = optimizeMultiArmy(simulated, 5);
            let gain = newResult.totalScore - baseScore;
            // 環境適応型AI：タイプ/段階補正
            gain = Math.round(gain * metaTypeWeight(hero.t, roleKey));
            if(gain <= 0) return;
            unlockResults.push({ id: hero.id, name: hero.name, gain: gain, roleKey: roleKey, roleBadge: roleBadge });
            return;
        }

        let ms = getNextMilestone(hero.wp);
        if(!ms) return;

        simulated[index].wp = ms.target;
        let newResult = optimizeMultiArmy(simulated, 5);
        let gain = newResult.totalScore - baseScore;
        // 環境適応型AI：タイプ/段階補正（表示gainもこれに合わせる）
        gain = Math.round(gain * metaTypeWeight(hero.t, roleKey));

        if(gain <= 0) return;
        let efficiency = (gain / ms.cost);

        // ✅ 軍別の重要度（B:3軍総合寄り）＋進行度の底上げ
        let armyOfHero = 'bench';
        try {
            const armyWeightMap = { army1:1.0, army2:1.15, army3:1.05, bench:0.60 };
            armyOfHero = (base && base.assignment) ? (
                (base.assignment.army2||[]).some(x=>x.id===hero.id) ? 'army2' :
                (base.assignment.army1||[]).some(x=>x.id===hero.id) ? 'army1' :
                (base.assignment.army3||[]).some(x=>x.id===hero.id) ? 'army3' : 'bench'
            ) : 'bench';
            efficiency *= (armyWeightMap[armyOfHero] || 1);

            // 進行度（相対）で遅れている軍を底上げ
            const s1 = (base.weightedScores && base.weightedScores.army1) ? base.weightedScores.army1 : 0;
            const s2 = (base.weightedScores && base.weightedScores.army2) ? base.weightedScores.army2 : 0;
            const s3 = (base.weightedScores && base.weightedScores.army3) ? base.weightedScores.army3 : 0;
            const maxS = Math.max(s1, s2, s3, 1);
            const pMap = {
                army1: Math.round((s1 / maxS) * 100),
                army2: Math.round((s2 / maxS) * 100),
                army3: Math.round((s3 / maxS) * 100)
            };
            const minP = Math.min(pMap.army1, pMap.army2, pMap.army3);
            const getArmyBoost = (p) => {
                if(p === minP) return 1.12;  // 最低軍：強めに底上げ
                if(p < 80) return 1.06;      // 育成途上：少し底上げ
                return 1.0;
            };
            if(armyOfHero !== 'bench'){
                efficiency *= getArmyBoost(pMap[armyOfHero] || 0);
            }
        } catch(e) {}

        // ✅ 「不足補強」：弱点と一致する伸びを優先（加点ではなく倍率）
        let newDetail1 = newResult.armyDetails.army1;
        let newDetail2 = newResult.armyDetails.army2;
        if(newDetail1 && newDetail2){
            let atkGain1 = newDetail1.attack - base.armyDetails.army1.attack;
            let defGain1 = newDetail1.defense - base.armyDetails.army1.defense;

            let atkGain2 = newDetail2.attack - base.armyDetails.army2.attack;
            let defGain2 = newDetail2.defense - base.armyDetails.army2.defense;

            let weakMult = 1.0;
            // 1軍弱点
            if(weakness1 === "attack" && atkGain1 > defGain1) weakMult *= 1.05;
            if(weakness1 === "defense" && defGain1 > atkGain1) weakMult *= 1.05;
            // 2軍弱点（少し強め）
            if(weakness2 === "attack" && atkGain2 > defGain2) weakMult *= 1.07;
            if(weakness2 === "defense" && defGain2 > atkGain2) weakMult *= 1.07;
            efficiency *= weakMult;
        }

        // 1軍偏重の抑制（同盟/総合寄りでは弱めに）
        if(army1Ratio > 55 && army1Ids.includes(hero.id)){
            efficiency *= 0.9;
        }

        // 成長タイプは「1〜3軍の総和」で判定（同盟/総合寄り）
        let newDetail3 = newResult.armyDetails.army3;
        let baseD3 = base.armyDetails.army3;
        let strength = (ms && ms.target>=30) ? 'mega' : (ms && ms.target>=20) ? 'high' : 'mid';
        let growthType = getGrowthType(
            (newDetail1.attack + newDetail2.attack + (newDetail3?newDetail3.attack:0)) - (base.armyDetails.army1.attack + base.armyDetails.army2.attack + (baseD3?baseD3.attack:0)),
            (newDetail1.defense + newDetail2.defense + (newDetail3?newDetail3.defense:0)) - (base.armyDetails.army1.defense + base.armyDetails.army2.defense + (baseD3?baseD3.defense:0)),
            (ms ? ms.target : 10)
        );

        normalResults.push({
            id: hero.id,
            name: hero.name,
            from: hero.wp,
            to: ms.target,
            gain: gain,
            cost: ms.cost,
            efficiency: efficiency,
            roleKey: roleKey, roleBadge: roleBadge,
            strength: strength,
            growthType: growthType
        });
    });

    normalResults.sort((a,b)=>b.efficiency - a.efficiency);
    unlockResults.sort((a,b)=>b.gain - a.gain);

    let reinforceList = [];
    normalResults.forEach(r => {
        let isNeeded = false;
        if(weakness1 === "defense" && r.roleKey === "wall") isNeeded = true;
        if(weakness1 === "attack" && r.roleKey === "atk") isNeeded = true;
        if(weakness2 === "defense" && r.roleKey === "wall") isNeeded = true;
        if(weakness2 === "attack" && r.roleKey === "atk") isNeeded = true;
        
        if (isNeeded) reinforceList.push(r);
    });

    reinforceList = reinforceList.sort((a,b)=>b.efficiency - a.efficiency).slice(0,3);

    return { normal: normalResults, unlock: unlockResults, weakness1: weakness1, weakness2: weakness2, weakness3: weakness3, reinforceList: reinforceList };
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
    <div style="margin-top:8px;">
        <div style="background:#e5e7eb; height:8px; border-radius:6px; overflow:hidden;">
            <div style="width:${percent}%; height:100%; background:${color};"></div>
        </div>
        <div style="font-size:0.75rem; color:#64748b; margin-top:4px; text-align:right;">
            進行度 <span style="font-weight:900; color:${color};">${percent}%</span>
        </div>
    </div>`;
}

function armyCard(title, content, baseColor, roleTag, progressPercent, minPercent, buffCount) {
    let buffText = "";
    if (buffCount === 5) buffText = `<span style="font-size:0.65rem; color:#15803d; background:#f0fdf4; padding:2px 6px; border-radius:4px; border:1px solid #bbf7d0; margin-left:6px; vertical-align:middle;">🏆20%バフ</span>`;
    else if (buffCount === 4) buffText = `<span style="font-size:0.65rem; color:#d97706; background:#fffbeb; padding:2px 6px; border-radius:4px; border:1px solid #fde68a; margin-left:6px; vertical-align:middle;">🚜15%バフ</span>`;
    else if (buffCount === 3) buffText = `<span style="font-size:0.65rem; color:#b91c1c; background:#fef2f2; padding:2px 6px; border-radius:4px; border:1px solid #fecaca; margin-left:6px; vertical-align:middle;">⚠️5%バフ</span>`;

    return `
    <div style="background:#f8fafc; padding:12px; border-radius:10px; margin-bottom:12px; border:1px solid #e2e8f0; border-left:5px solid ${baseColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        <div style="font-weight:900; color:#1e293b; display:flex; align-items:center;">
            ${title} ${buffText} ${getPriorityLabel(progressPercent, minPercent)}
        </div>
        ${renderProgress(progressPercent, baseColor)}
        <div style="font-size:0.75rem; color:#475569; font-weight:bold; margin-top:6px;">
            ${roleTag}
        </div>
        <div style="margin-top:8px;">
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

        const setEval = (armyNo, pct, baseColor, tagHtml, buffCount) => {
            const el = document.getElementById(`slot-eval-${armyNo}`);
            if(!el) return;

            let buff = "";
            if (buffCount === 5) buff = "🏆20%バフ";
            else if (buffCount === 4) buff = "🚜15%バフ";
            else if (buffCount === 3) buff = "⚠️5%バフ";

            const c = colorOf(pct, baseColor);

            const buffSpan = buff
              ? '<span style="font-size:0.65rem; color:#475569; background:#fff; border:1px solid #e2e8f0; padding:2px 6px; border-radius:8px; font-weight:900;">' + buff + '</span>'
              : "";

            el.innerHTML =
              '<div class="row">' +
                '<div class="tag">' + tagHtml + ' ' + buffSpan + '</div>' +
                '<div class="pct">進行度 <span style="color:' + c + ';">' + pct + '%</span></div>' +
              '</div>' +
              '<div class="bar"><div style="width:' + pct + '%; background:' + c + ';"></div></div>';
        };

        setEval(1, p1, "#10b981", weakText(effData.weakness1), result.maxCounts.army1);
        setEval(2, p2, "#3b82f6", weakText(effData.weakness2), result.maxCounts.army2);
        // 3軍も不足傾向を表示（総合寄り）
        setEval(3, p3, "#8b5cf6", weakText(effData.weakness3 || 'balance'), result.maxCounts.army3);
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
        const MORE_MAX = 10; // 「もっと見る」で最大表示（必要なら調整）
        effOut += `
        <div style="background:#fdf4ff; border:1px solid #fbcfe8; padding:12px; border-radius:10px;">
            <div style="font-weight:900; color:#a21caf; margin-bottom:8px; font-size:0.95rem;">
                
            </div>`;

        // Top3（おすすめ）
        effData.normal.slice(0, TOP_N).forEach((item,i)=>{
            effOut += `
            <div style="${i===0
                ? 'display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:0.82rem; background:#fff7ed; border:1px solid #fdba74; padding:10px 10px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06);'
                : 'display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:0.8rem; border-bottom:1px dashed #fbcfe8; padding-bottom:4px;'}">
                <div style="line-height:1.4;">
                    <b>${i+1}. ${item.name}</b>
                    ${i===0 ? '<span style="margin-left:8px; font-size:0.72rem; font-weight:900; color:#7c2d12; background:#ffedd5; border:1px solid #fdba74; padding:2px 8px; border-radius:999px; vertical-align:middle;">👑 最優先</span>' : ''}
                    ${item.roleBadge} (Lv${item.from}→${item.to})<br>
                    <span style="color:#64748b; font-size:0.75rem;">+${item.gain} / 武装のかけら${item.cost}個</span>
                </div>
                <div style="font-weight:900; color:#7e22ce; font-size:0.85rem; flex-shrink:0; margin-left:8px;">
                    ${growthBadge(item.growthType)}
                </div>
            </div>`;
        });

        // もっと見る（任意）
        if(effData.normal.length > TOP_N){
            let moreList = "";
            effData.normal.slice(TOP_N, Math.min(effData.normal.length, MORE_MAX)).forEach((item,idx)=>{
                let rank = TOP_N + idx + 1;
                moreList += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:0.8rem; border-bottom:1px dashed #fbcfe8; padding-bottom:4px;">
                    <div style="line-height:1.4;">
                        <b>${rank}. ${item.name}</b> ${item.roleBadge} (Lv${item.from}→${item.to})<br>
                        <span style="color:#64748b; font-size:0.75rem;">+${item.gain} / 武装のかけら${item.cost}個</span>
                    </div>
                    <div style="font-weight:900; color:#7e22ce; font-size:0.85rem; flex-shrink:0; margin-left:8px;">
                        ${growthBadge(item.growthType)}
                    </div>
                </div>`;
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
                🛡️ 軍師提案：不足補強候補
            </div>`;

        effData.reinforceList.forEach((r,i)=>{
            effOut += `
            <div style="font-size:0.8rem; margin-bottom:4px;">
                ${i+1}. <b>${r.name}</b> ${r.roleBadge} <span style="color:#64748b; font-size:0.75rem;">(Lv${r.from}→${r.to})</span>
            </div>`;
        });
        effOut += `</div>`;
    }

    if(effData.unlock.length > 0){
        effOut += `
        <div style="margin-top:12px; background:#eff6ff; border:1px solid #bfdbfe; padding:12px; border-radius:10px;">
            <div style="font-weight:900; color:#1e3a8a; margin-bottom:8px; font-size:0.9rem;">
                🔓 専用武装解放候補（長期投資）
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
    
    $id('cost-list').innerHTML = listHtml || "<span style='color:#94a3b8;'>追加コストなし</span>";
    $id('ft-ur').innerText = costUr; $id('ft-mr').innerText = costMr;

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
    $id('growth-rate').innerText = (resC.val > 0) ? (resT.val / resC.val).toFixed(2) : "1.00";
    
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
  calculateGear();
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
                        <img src="${id}.webp" alt="${h.n}" onerror="this.style.display='none'; this.parentNode.querySelector('.slot-fallback').style.display='flex';">
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

// inline handler / 外部から呼べるように window に公開
window.saveData = saveData;
window.scheduleAi = scheduleAi;
window.updateTransitionRecommendationUI = updateTransitionRecommendationUI;