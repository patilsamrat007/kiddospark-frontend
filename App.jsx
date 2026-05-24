import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────
//  ✅ SECURE: API calls go to YOUR server, not Claude directly
//  Your API key is NEVER visible in this frontend code
// ─────────────────────────────────────────────────────────────

// 👇 Change this to your deployed backend URL when live
// Local dev:  http://localhost:3001
// Production: https://kiddospark-backend.railway.app
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";

// ── SECURE API CALL ───────────────────────────────────────────
async function generateContent(prompt, type, paidToken = null) {
  const headers = { "Content-Type": "application/json" };

  // If user is paid, send their token so server gives more generations
  if (paidToken) headers["Authorization"] = `Bearer ${paidToken}`;

  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt, type }),
  });

  const data = await res.json();

  if (!res.ok) {
    // Daily limit reached
    if (res.status === 429 && data.upgrade) {
      throw { type: "LIMIT_REACHED", message: data.message };
    }
    throw new Error(data.error || "Generation failed");
  }

  return data; // { result, usage: { used, limit, remaining } }
}

// Check usage without generating
async function checkUsage(paidToken = null) {
  const headers = {};
  if (paidToken) headers["Authorization"] = `Bearer ${paidToken}`;
  try {
    const res  = await fetch(`${API_BASE}/api/usage`, { headers });
    return await res.json();
  } catch { return { remaining: 2, limit: 2, used: 0 }; }
}

// ── STEP VISUAL ENGINE ────────────────────────────────────────
function getStepVisual(stepText) {
  const t = stepText.toLowerCase();
  const rules = [
    [["bubble wrap","wrap"],       { bg:"linear-gradient(135deg,#FFE0F0,#FFC0E0)", icon:"🫧", label:"Bubble Wrap", accent:"#E91E8C" }],
    [["paint","painting","brush"], { bg:"linear-gradient(135deg,#FFE57F,#FFCA28,#FF8A65)", icon:"🖌️", label:"Painting!", accent:"#F57F17" }],
    [["mix","mixing","stir"],      { bg:"linear-gradient(135deg,#80DEEA,#4DD0E1)", icon:"🌀", label:"Mix It!", accent:"#00838F" }],
    [["pour","spoon","blob"],      { bg:"linear-gradient(135deg,#FFCC80,#FFA726)", icon:"🥄", label:"Pour & Spoon", accent:"#E65100" }],
    [["press","push","firmly"],    { bg:"linear-gradient(135deg,#B2EBF2,#80DEEA)", icon:"🤲", label:"Press Down", accent:"#006064" }],
    [["peel","lift","pull away"],  { bg:"linear-gradient(135deg,#F8BBD9,#F48FB1)", icon:"✋", label:"Peel & Reveal", accent:"#C2185B" }],
    [["fold","crease"],            { bg:"linear-gradient(135deg,#E3F2FD,#BBDEFB)", icon:"📄", label:"Fold It", accent:"#1565C0" }],
    [["cut","scissors"],           { bg:"linear-gradient(135deg,#FCE4EC,#F8BBD9)", icon:"✂️", label:"Cut It", accent:"#AD1457" }],
    [["glue","stick","paste"],     { bg:"linear-gradient(135deg,#FFF9C4,#FFF176)", icon:"🔧", label:"Glue It", accent:"#F9A825" }],
    [["draw","sketch"],            { bg:"linear-gradient(135deg,#FFF3E0,#FFE0B2)", icon:"✏️", label:"Draw!", accent:"#E65100" }],
    [["color","colour","crayon"],  { bg:"linear-gradient(135deg,#F3E5F5,#E1BEE7)", icon:"🖍️", label:"Colour In", accent:"#6A1B9A" }],
    [["build","construct"],        { bg:"linear-gradient(135deg,#DCEDC8,#C5E1A5)", icon:"🏗️", label:"Build It!", accent:"#558B2F" }],
    [["jump","hop"],               { bg:"linear-gradient(135deg,#DCEDC8,#AED581)", icon:"🦘", label:"Jump!", accent:"#558B2F" }],
    [["dance","move"],             { bg:"linear-gradient(135deg,#F8BBD9,#CE93D8)", icon:"💃", label:"Dance!", accent:"#AD1457" }],
    [["sing","song","hum"],        { bg:"linear-gradient(135deg,#E1BEE7,#CE93D8)", icon:"🎵", label:"Sing!", accent:"#6A1B9A" }],
    [["water","fill"],             { bg:"linear-gradient(135deg,#B3E5FC,#81D4FA)", icon:"💧", label:"Water Play", accent:"#0277BD" }],
    [["cook","bake","knead"],      { bg:"linear-gradient(135deg,#FFE0B2,#FFCC80)", icon:"🍪", label:"Cook!", accent:"#E65100" }],
    [["plant","seed","garden"],    { bg:"linear-gradient(135deg,#C8E6C9,#A5D6A7)", icon:"🌱", label:"Plant It", accent:"#2E7D32" }],
    [["wait","dry"],               { bg:"linear-gradient(135deg,#E8F5E9,#C8E6C9)", icon:"⏳", label:"Wait...", accent:"#2E7D32" }],
    [["show","display"],           { bg:"linear-gradient(135deg,#FFF9C4,#FFF176)", icon:"🌟", label:"Show Off!", accent:"#F9A825" }],
  ];
  for (const [kws, v] of rules) {
    if (kws.some(k => t.includes(k))) return v;
  }
  return { bg:"linear-gradient(135deg,#FFE57F,#FFCA28)", icon:"⭐", label:"Let's Go!", accent:"#F57F17" };
}

// ── PARSE ACTIVITIES ──────────────────────────────────────────
function parseActivities(text) {
  const blocks = text.split(/(?=ACTIVITY\s*\d)/i).filter(b => b.trim().length > 60);
  if (blocks.length >= 2) return blocks.slice(0, 3).map(b => b.trim());
  const third = Math.floor(text.length / 3);
  return [text.slice(0, third), text.slice(third, third*2), text.slice(third*2)].filter(b => b.trim().length > 40);
}
function extractTitle(block) {
  const line = block.split("\n").find(l => l.trim().length > 3) || "";
  return line.replace(/^(ACTIVITY\s*\d+\s*[:.-]?\s*)/i,"").replace(/\*\*/g,"").trim().slice(0,70);
}
function extractSteps(block) {
  const steps = [];
  for (const line of block.split("\n")) {
    const t = line.trim();
    if (/^(step\s*)?\d+[.):\s]/i.test(t) && t.length > 10) {
      const text = t.replace(/^(step\s*)?\d+[.):\s]+/i,"").trim();
      if (text.length > 5) steps.push(text);
    }
  }
  return steps;
}
function extractMeta(block) {
  const meta = { why:"", needs:"", builds:"", twist:"" };
  for (const line of block.split("\n")) {
    const l = line.toLowerCase();
    if (l.includes("why")||l.includes("perfect")) meta.why  = line.replace(/^.*?:\s*/,"").trim();
    if (l.includes("need")||l.includes("material")) meta.needs = line.replace(/^.*?:\s*/,"").trim();
    if (l.includes("build")||l.includes("skill"))   meta.builds = line.replace(/^.*?:\s*/,"").trim();
    if (l.includes("twist")||l.includes("variation")) meta.twist = line.replace(/^.*?:\s*/,"").trim();
  }
  return meta;
}

// ── DATA ──────────────────────────────────────────────────────
const MOODS = [
  { id:"energetic", label:"Hyper & Energetic", emoji:"⚡", color:"#FF8C42" },
  { id:"bored",     label:"Bored & Whiny",     emoji:"😒", color:"#A855F7" },
  { id:"calm",      label:"Calm & Quiet",       emoji:"😌", color:"#4ECDC4" },
  { id:"creative",  label:"Creative & Curious", emoji:"🎨", color:"#F59E0B" },
  { id:"sad",       label:"Sad / Upset",        emoji:"😢", color:"#3B82F6" },
  { id:"social",    label:"Wants to Play",      emoji:"🤝", color:"#EC4899" },
];
const SETTINGS = [
  { id:"indoor",   label:"Indoors",    emoji:"🏠" },
  { id:"outdoor",  label:"Outdoors",   emoji:"🌳" },
  { id:"travel",   label:"In the Car", emoji:"🚗" },
  { id:"anywhere", label:"Anywhere",   emoji:"✨" },
];
const TIMES   = ["15 mins","30 mins","1 hour","2+ hours"];
const ACCENTS = ["#FF8C42","#A855F7","#4ECDC4"];
const ACCENT_LIGHTS = ["#FFF0E5","#F5EDFF","#E5F8F7"];
const COIN_LESSONS = [
  "Saving coins today means a bigger reward tomorrow! 🌟",
  "Every coin earned is a step toward your dream reward! 🎯",
  "Champions save first and celebrate after! 🏆",
  "You're building great habits — one coin at a time! 💪",
  "Patience + effort = amazing rewards! 🌈",
];
const DEFAULT_REWARDS = [
  { id:1, name:"Extra Screen Time", emoji:"📱", cost:30 },
  { id:2, name:"Ice Cream Treat",   emoji:"🍦", cost:50 },
  { id:3, name:"Choose Dinner",     emoji:"🍕", cost:40 },
  { id:4, name:"Stay Up 1hr Late",  emoji:"🌙", cost:60 },
  { id:5, name:"New Sticker Pack",  emoji:"⭐", cost:80 },
  { id:6, name:"Trip to Park",      emoji:"🌳", cost:70 },
];

// ── STYLES ────────────────────────────────────────────────────
const S = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@500;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#FFF8F0;}
.fun{font-family:'Fredoka One',cursive;}
.sans{font-family:'Nunito',sans-serif;}
.card{background:#fff;border-radius:22px;box-shadow:0 4px 20px rgba(0,0,0,.07);}
.pill{border:2.5px solid #F0E4D8;border-radius:100px;background:#fff;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s;padding:9px 18px;display:inline-flex;align-items:center;gap:6px;color:#5A4030;}
.pill:hover{transform:translateY(-2px);}
.pill.on{border-color:transparent;color:#fff;transform:translateY(-2px);}
.bigbtn{border:none;border-radius:18px;font-family:'Nunito',sans-serif;font-weight:800;cursor:pointer;transition:all .2s;font-size:17px;padding:16px 0;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;}
.bigbtn:hover{transform:translateY(-3px);}
.smBtn{border:none;border-radius:12px;font-family:'Nunito',sans-serif;font-weight:700;cursor:pointer;transition:all .18s;font-size:13px;padding:10px 18px;display:inline-flex;align-items:center;gap:6px;}
.tab{border:none;background:transparent;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;cursor:pointer;transition:all .2s;color:#A09080;padding:9px 14px;border-radius:12px;}
.tab.on{background:#fff;color:#FF8C42;box-shadow:0 2px 10px rgba(0,0,0,.08);}
.inp{background:#FFF8F0;border:2px solid #F0E4D8;border-radius:12px;padding:10px 14px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;color:#3A2010;outline:none;transition:border-color .2s;width:100%;}
.inp:focus{border-color:#FF8C42;}
.inp::placeholder{color:#C8B8A8;font-weight:600;}
.rng{-webkit-appearance:none;width:100%;height:6px;border-radius:3px;background:#F0E4D8;outline:none;}
.rng::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#FF8C42;cursor:pointer;}
.done-btn{width:100%;border:none;border-radius:16px;padding:16px;font-family:'Nunito',sans-serif;font-weight:900;font-size:17px;cursor:pointer;transition:all .25s;background:linear-gradient(135deg,#22C55E,#16A34A);color:#fff;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 6px 20px rgba(34,197,94,.35);}
.done-btn:hover{transform:translateY(-3px);}
.done-btn.done{background:#E0D8D0;color:#A09080;box-shadow:none;cursor:default;transform:none;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px;backdrop-filter:blur(6px);}
.modal{background:#fff;border-radius:28px;max-width:420px;width:100%;overflow:hidden;}
.coin-badge{display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,#FFD700,#FFA500);border-radius:100px;padding:5px 14px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:900;color:#7A3800;}
.progress-bar{height:14px;border-radius:100px;background:#F0E4D8;overflow:hidden;}
.progress-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,#FFD700,#FF8C42);transition:width 1s ease;}
.reward-card{background:#fff;border:2px solid #F0E4D8;border-radius:16px;padding:16px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:14px;}
.reward-card:hover{border-color:#FFD700;transform:translateY(-2px);}
.reward-card.goal{border-color:#FFD700;background:linear-gradient(135deg,#FFFBEB,#FFF8E1);}
.limit-banner{background:linear-gradient(135deg,#FFF0E5,#FFE4CC);border:2px solid #FFD4A8;border-radius:16px;padding:16px 20px;display:flex;gap:12px;align-items:center;margin-bottom:20px;}
.security-badge{display:inline-flex;align-items:center;gap:6px;background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:8px;padding:4px 12px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:700;color:#16A34A;}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes bob{0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);}}
@keyframes coinRain{0%{transform:translateY(-20px);opacity:1;}100%{transform:translateY(120px);opacity:0;}}
@keyframes pop{0%{transform:scale(0);}70%{transform:scale(1.15);}100%{transform:scale(1);}}
`;

// ── STORAGE ───────────────────────────────────────────────────
async function saveData(key, value) {
  try { await window.storage.set(key, JSON.stringify(value)); } catch {}
}
async function loadData(key, fallback) {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : fallback;
  } catch { return fallback; }
}

// ── STEP CARD ─────────────────────────────────────────────────
function StepCard({ step, si }) {
  const v = getStepVisual(step);
  return (
    <div style={{ borderRadius:14, overflow:"hidden", border:"1.5px solid #F0E8E0" }}>
      <div style={{ background:v.bg, padding:"16px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:110, position:"relative" }}>
        <div style={{ position:"absolute", top:8, left:10, width:24, height:24, borderRadius:"50%", background:v.accent, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, fontFamily:"'Nunito',sans-serif" }}>{si+1}</div>
        <div style={{ fontSize:44 }}>{v.icon}</div>
        <div style={{ background:"rgba(255,255,255,.85)", borderRadius:100, padding:"3px 12px", fontSize:11, fontWeight:800, color:v.accent, fontFamily:"'Nunito',sans-serif", marginTop:8 }}>{v.label}</div>
      </div>
      <div style={{ padding:"10px 14px", background:"#FAFAFA" }}>
        <div className="sans" style={{ fontSize:13, color:"#3A2010", fontWeight:700, lineHeight:1.6 }}>{step}</div>
      </div>
    </div>
  );
}

// ── CELEBRATION MODAL ─────────────────────────────────────────
function CelebrationModal({ earned, totalCoins, goalReward, onClose }) {
  const [coins2] = useState(() => Array.from({length:10},(_,i)=>({id:i,left:`${Math.random()*90}%`,delay:`${Math.random()*.5}s`})));
  const lesson = COIN_LESSONS[Math.floor(Math.random()*COIN_LESSONS.length)];
  const pct = goalReward ? Math.min(100,Math.round((totalCoins/goalReward.cost)*100)) : 0;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ animation:"pop .4s ease" }} onClick={e=>e.stopPropagation()}>
        <div style={{ background:"linear-gradient(135deg,#FFD700,#FF8C42)", padding:"32px 28px", textAlign:"center", position:"relative", overflow:"hidden" }}>
          {coins2.map(c=><div key={c.id} style={{ position:"absolute", left:c.left, top:0, fontSize:22, animation:`coinRain 1.2s ease-out forwards`, animationDelay:c.delay, pointerEvents:"none" }}>🪙</div>)}
          <div style={{ fontSize:56, marginBottom:8 }}>🎉</div>
          <div className="fun" style={{ fontSize:26, color:"#fff", marginBottom:4 }}>Activity Complete!</div>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,.25)", borderRadius:100, padding:"8px 24px", margin:"10px 0" }}>
            <span style={{ fontSize:26 }}>🪙</span>
            <span className="fun" style={{ fontSize:32, color:"#fff" }}>+{earned} KiddoCoins!</span>
          </div>
        </div>
        <div style={{ padding:"24px 28px" }}>
          <div style={{ background:"#FFF8E1", border:"2px solid #FFD700", borderRadius:14, padding:"14px 16px", marginBottom:20 }}>
            <div className="sans" style={{ fontSize:13, color:"#7A5000", fontWeight:700, lineHeight:1.5 }}>{lesson}</div>
          </div>
          {goalReward && (
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <div className="sans" style={{ fontSize:12, color:"#A09080", fontWeight:700 }}>Goal: {goalReward.emoji} {goalReward.name}</div>
                <div className="sans" style={{ fontSize:12, color:"#FF8C42", fontWeight:800 }}>{pct}% saved!</div>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width:`${pct}%` }}/></div>
              <div className="sans" style={{ fontSize:12, color:"#A09080", fontWeight:700, marginTop:5, textAlign:"center" }}>
                {totalCoins >= goalReward.cost ? "🎊 Goal reached! Tell a parent!" : `${goalReward.cost-totalCoins} more coins to go!`}
              </div>
            </div>
          )}
          <button className="bigbtn" style={{ background:"linear-gradient(135deg,#FF8C42,#FF5F00)", color:"#fff", borderRadius:16, fontFamily:"'Nunito',sans-serif" }} onClick={onClose}>Keep Going! 🚀</button>
        </div>
      </div>
    </div>
  );
}

// ── LIMIT MODAL ───────────────────────────────────────────────
function LimitModal({ onClose }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ animation:"pop .4s ease" }} onClick={e=>e.stopPropagation()}>
        <div style={{ background:"linear-gradient(135deg,#FF8C42,#FF5F00)", padding:"28px", textAlign:"center" }}>
          <div style={{ fontSize:52, marginBottom:10 }}>⭐</div>
          <div className="fun" style={{ fontSize:24, color:"#fff" }}>You've used today's free generations!</div>
        </div>
        <div style={{ padding:"24px 28px" }}>
          <div className="sans" style={{ fontSize:15, color:"#3A2010", fontWeight:700, lineHeight:1.7, marginBottom:20 }}>
            Free plan = 2 activities/day. Upgrade to premium for unlimited activities, stories and games!
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
            {["♾ Unlimited activities daily","📖 Unlimited bedtime stories","🎮 Unlimited quick games","🪙 Unlimited KiddoCoin earning"].map(f=>(
              <div key={f} className="sans" style={{ fontSize:13, color:"#5A4030", fontWeight:700 }}>✅ {f}</div>
            ))}
          </div>
          <div className="fun" style={{ fontSize:24, color:"#FF8C42", textAlign:"center", marginBottom:16 }}>₹149/month</div>
          <button className="bigbtn" style={{ background:"linear-gradient(135deg,#FF8C42,#FF5F00)", color:"#fff", borderRadius:16, fontFamily:"'Nunito',sans-serif", marginBottom:10 }}>
            Upgrade Now →
          </button>
          <button className="smBtn" style={{ width:"100%", justifyContent:"center", background:"#F0E4D8", color:"#7A6050", borderRadius:12, padding:"12px 0" }} onClick={onClose}>
            Come back tomorrow (free resets at midnight)
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ACTIVITY CARD ─────────────────────────────────────────────
function ActivityCard({ block, index, onComplete, completed }) {
  const [open, setOpen] = useState(true);
  const title  = extractTitle(block);
  const steps  = extractSteps(block);
  const meta   = extractMeta(block);
  const accent = ACCENTS[index%3];
  const accentLight = ACCENT_LIGHTS[index%3];
  const coinsEarned = 10 + steps.length;

  return (
    <div style={{ background:"#fff", borderRadius:22, boxShadow:"0 6px 28px rgba(0,0,0,.08)", overflow:"hidden", border:`2px solid ${accentLight}`, animation:`fadeUp .4s ease forwards`, animationDelay:`${index*.15}s`, opacity:0 }}>
      <div style={{ background:`linear-gradient(135deg,${accentLight},#fff)`, padding:"16px 20px", borderBottom:`2px solid ${accentLight}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap" }}>
              <span style={{ background:accent, color:"#fff", borderRadius:100, padding:"3px 12px", fontSize:11, fontWeight:800, fontFamily:"'Nunito',sans-serif" }}>ACTIVITY {index+1}</span>
              <span style={{ background:"linear-gradient(135deg,#FFD700,#FFA500)", color:"#7A3800", borderRadius:100, padding:"3px 12px", fontSize:11, fontWeight:900, fontFamily:"'Nunito',sans-serif" }}>🪙 +{coinsEarned} coins</span>
            </div>
            <div className="fun" style={{ fontSize:20, color:"#2A1A08", lineHeight:1.2 }}>{title}</div>
            {meta.why && <div className="sans" style={{ fontSize:13, color:"#7A6050", fontWeight:600, marginTop:4 }}>💡 {meta.why}</div>}
          </div>
          <button onClick={()=>setOpen(o=>!o)} style={{ background:accentLight, border:"none", borderRadius:8, width:30, height:30, cursor:"pointer", color:accent, fontWeight:900, fontSize:14, flexShrink:0, marginLeft:8 }}>{open?"▲":"▼"}</button>
        </div>
        {meta.needs && <div className="sans" style={{ fontSize:12, fontWeight:700, marginTop:8 }}><span style={{ color:"#A09080" }}>🧺 Need: </span><span style={{ color:"#5A4030" }}>{meta.needs}</span></div>}
      </div>
      {open && (
        <div style={{ padding:"18px 20px" }}>
          {steps.length > 0 ? (
            <>
              <div className="sans" style={{ fontSize:10, fontWeight:800, color:"#A09080", marginBottom:12, letterSpacing:.8 }}>📋 STEP-BY-STEP</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:18 }}>
                {steps.map((step,si) => <StepCard key={si} step={step} si={si}/>)}
              </div>
            </>
          ) : (
            <div className="sans" style={{ fontSize:14, color:"#3A2010", fontWeight:600, lineHeight:1.85, whiteSpace:"pre-wrap", marginBottom:18 }}>{block}</div>
          )}
          {(meta.builds||meta.twist) && (
            <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" }}>
              {meta.builds && <div style={{ flex:1, minWidth:140, background:accentLight, borderRadius:12, padding:"10px 14px" }}><div className="sans" style={{ fontSize:10, fontWeight:800, color:accent, marginBottom:3 }}>🌱 BUILDS</div><div className="sans" style={{ fontSize:13, color:"#5A4030", fontWeight:700 }}>{meta.builds}</div></div>}
              {meta.twist && <div style={{ flex:1, minWidth:140, background:"#F0FDF4", borderRadius:12, padding:"10px 14px" }}><div className="sans" style={{ fontSize:10, fontWeight:800, color:"#16A34A", marginBottom:3 }}>🔀 FUN TWIST</div><div className="sans" style={{ fontSize:13, color:"#5A4030", fontWeight:700 }}>{meta.twist}</div></div>}
            </div>
          )}
          <button className={`done-btn ${completed?"done":""}`} onClick={()=>!completed&&onComplete(index,coinsEarned)}>
            {completed ? <>✅ Done! +{coinsEarned} coins earned</> : <>🎯 I Did It! Earn 🪙 {coinsEarned} KiddoCoins</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── PIGGY BANK ────────────────────────────────────────────────
function PiggyBankTab({ coins, completed, streak, rewards, goalId, onSetGoal, onClaimReward }) {
  const goal = rewards.find(r=>r.id===goalId);
  const pct  = goal ? Math.min(100,Math.round((coins/goal.cost)*100)) : 0;
  return (
    <div style={{ animation:"fadeUp .4s ease" }}>
      <div className="card" style={{ padding:"28px 24px", marginBottom:18, textAlign:"center", background:"linear-gradient(135deg,#FFF8E1,#FFF0CC)" }}>
        <div style={{ fontSize:72, marginBottom:8, animation:"bob 3s ease-in-out infinite" }}>🐷</div>
        <div className="fun" style={{ fontSize:36, color:"#FF8C42", marginBottom:4 }}>{coins} KiddoCoins</div>
        <div className="coin-badge">🏆 {completed} done · 🔥 {streak} streak</div>
        {goal && (
          <div style={{ marginTop:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <div className="sans" style={{ fontSize:13, fontWeight:800, color:"#7A5000" }}>Saving for: {goal.emoji} {goal.name}</div>
              <div className="sans" style={{ fontSize:13, fontWeight:800, color:"#FF8C42" }}>{coins}/{goal.cost} 🪙</div>
            </div>
            <div className="progress-bar" style={{ marginBottom:8 }}><div className="progress-fill" style={{ width:`${pct}%` }}/></div>
            {coins >= goal.cost && <button className="bigbtn" style={{ marginTop:14, background:"linear-gradient(135deg,#FFD700,#FF8C42)", color:"#7A3800", borderRadius:16, fontFamily:"'Nunito',sans-serif" }} onClick={()=>onClaimReward(goal)}>🎁 Claim My Reward!</button>}
          </div>
        )}
      </div>
      <div className="card" style={{ padding:"18px 20px", marginBottom:18, background:"linear-gradient(135deg,#F0FDF4,#DCFCE7)", border:"2px solid #BBF7D0" }}>
        <div className="fun" style={{ fontSize:18, color:"#16A34A", marginBottom:8 }}>💰 Today's Money Lesson</div>
        <div className="sans" style={{ fontSize:14, color:"#166534", fontWeight:700, lineHeight:1.6 }}>Saving is a superpower! When you save your KiddoCoins instead of spending them right away, they add up to something AMAZING. That's exactly how real savings work! 🌟</div>
      </div>
      <div className="sans" style={{ fontSize:12, fontWeight:800, color:"#A09080", marginBottom:12, letterSpacing:.8 }}>🎯 PICK YOUR SAVINGS GOAL</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {rewards.map(r=>(
          <div key={r.id} className={`reward-card ${goalId===r.id?"goal":""}`} onClick={()=>onSetGoal(r.id)}>
            <div style={{ fontSize:32 }}>{r.emoji}</div>
            <div style={{ flex:1 }}>
              <div className="sans" style={{ fontSize:15, fontWeight:800, color:"#3A2010" }}>{r.name}</div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                <div className="progress-bar" style={{ flex:1, height:8 }}><div className="progress-fill" style={{ width:`${Math.min(100,(coins/r.cost)*100)}%` }}/></div>
                <div className="sans" style={{ fontSize:12, fontWeight:800, color:"#FF8C42" }}>🪙 {r.cost}</div>
              </div>
            </div>
            {goalId===r.id && <span style={{ fontSize:20 }}>🎯</span>}
            {coins >= r.cost && <span style={{ fontSize:20 }}>✅</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function KiddoSpark() {
  const [tab, setTab]           = useState("activities");
  const [kidName, setKidName]   = useState("");
  const [age, setAge]           = useState(7);
  const [mood, setMood]         = useState("");
  const [setting, setSetting]   = useState("");
  const [time, setTime]         = useState("30 mins");
  const [loading, setLoading]   = useState(false);
  const [activities, setActivities] = useState([]);
  const [rawResult, setRawResult]   = useState("");
  const [completedActs, setCompletedActs] = useState({});
  const [celebration, setCelebration] = useState(null);
  const [showLimit, setShowLimit]     = useState(false);
  const [usage, setUsage]             = useState({ remaining:2, limit:2, used:0 });
  const [coins, setCoins]             = useState(0);
  const [totalDone, setTotalDone]     = useState(0);
  const [streak, setStreak]           = useState(0);
  const [goalId, setGoalId]           = useState(1);
  const [rewards]                     = useState(DEFAULT_REWARDS);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [claimReward, setClaimReward] = useState(null);

  const name = kidName.trim() || "your child";

  // Load saved data + check usage on mount
  useEffect(() => {
    (async () => {
      const saved = await loadData("kiddospark_data", null);
      if (saved) {
        setCoins(saved.coins || 0);
        setTotalDone(saved.totalDone || 0);
        setStreak(saved.streak || 0);
        setGoalId(saved.goalId || 1);
      }
      const u = await checkUsage();
      setUsage(u);
      setStorageLoaded(true);
    })();
  }, []);

  // Persist data
  useEffect(() => {
    if (!storageLoaded) return;
    saveData("kiddospark_data", { coins, totalDone, streak, goalId });
  }, [coins, totalDone, streak, goalId, storageLoaded]);

  const reset = () => { setActivities([]); setRawResult(""); setCompletedActs({}); };

  const handleComplete = (index, earned) => {
    const newCoins = coins + earned;
    setCoins(newCoins);
    setTotalDone(d => d+1);
    setStreak(s => s+1);
    setCompletedActs(p => ({...p,[index]:true}));
    setCelebration({ earned, totalCoins:newCoins });
  };

  const doGenerate = async (prompt, type) => {
    setLoading(true); reset();
    try {
      const data = await generateContent(prompt, type);
      // Update usage display
      if (data.usage) setUsage(data.usage);

      if (type === "activities") {
        const parsed = parseActivities(data.result);
        if (parsed.length === 0) setRawResult(data.result);
        else setActivities(parsed);
      } else {
        setRawResult(data.result);
      }
    } catch(e) {
      if (e.type === "LIMIT_REACHED") {
        setShowLimit(true);
      } else {
        setRawResult("Something went wrong: " + e.message);
      }
    }
    setLoading(false);
  };

  const doActivities = () => {
    if (!mood)    { alert("Pick a mood! 😊"); return; }
    if (!setting) { alert("Pick a setting! 🏠"); return; }
    doGenerate(`Generate exactly 3 fun activities for a child.
Child: Name=${name}, Age=${age}, Mood=${mood}, Setting=${setting}, Time=${time}

Use this EXACT format:

ACTIVITY 1: [Name]
Why perfect: [One sentence]
You need: [Materials or "Nothing needed!"]
Steps:
1. [Visual step]
2. [Visual step]
3. [Visual step]
4. [Visual step]
Builds: [skills]
Fun twist: [variation]

ACTIVITY 2: [Name]
Why perfect: [One sentence]
You need: [Materials or "Nothing needed!"]
Steps:
1. [Visual step]
2. [Visual step]
3. [Visual step]
4. [Visual step]
Builds: [skills]
Fun twist: [variation]

ACTIVITY 3: [Name]
Why perfect: [One sentence]
You need: [Materials or "Nothing needed!"]
Steps:
1. [Visual step]
2. [Visual step]
3. [Visual step]
4. [Visual step]
Builds: [skills]
Fun twist: [variation]`, "activities");
  };

  const goalReward = rewards.find(r => r.id===goalId);
  const hasResult  = activities.length > 0 || rawResult.length > 0;

  return (
    <div style={{ minHeight:"100vh", background:"#FFF8F0" }}>
      <style>{S}</style>

      {celebration && <CelebrationModal earned={celebration.earned} totalCoins={celebration.totalCoins} goalReward={goalReward} onClose={()=>setCelebration(null)}/>}
      {showLimit    && <LimitModal onClose={()=>setShowLimit(false)}/>}
      {claimReward  && (
        <div className="modal-bg" onClick={()=>setClaimReward(null)}>
          <div className="modal" style={{ animation:"pop .4s ease", padding:"40px 32px", textAlign:"center" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:64, marginBottom:16 }}>{claimReward.emoji}</div>
            <div className="fun" style={{ fontSize:28, color:"#FF8C42", marginBottom:8 }}>You earned it!</div>
            <div className="sans" style={{ fontSize:16, color:"#5A4030", fontWeight:700, marginBottom:20 }}>{claimReward.name}</div>
            <div className="sans" style={{ fontSize:13, color:"#7A6050", fontWeight:600, lineHeight:1.6, marginBottom:24, background:"#F0FDF4", borderRadius:12, padding:"14px" }}>🌟 You saved your KiddoCoins and reached your goal! Show this to a parent to claim your reward!</div>
            <button className="bigbtn" style={{ background:"linear-gradient(135deg,#22C55E,#16A34A)", color:"#fff", borderRadius:16, fontFamily:"'Nunito',sans-serif" }} onClick={()=>{ setCoins(c=>Math.max(0,c-claimReward.cost)); setClaimReward(null); }}>🎁 Claim with a Parent!</button>
          </div>
        </div>
      )}

      {/* NAV */}
      <div style={{ background:"#fff", borderBottom:"2.5px solid #F0E4D8", padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:99 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:34, height:34, background:"linear-gradient(135deg,#FF8C42,#FF5F00)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>🎈</div>
          <div>
            <div className="fun" style={{ fontSize:18, color:"#FF8C42", lineHeight:1 }}>KiddoSpark</div>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <div className="security-badge">🔐 Secure</div>
            </div>
          </div>
        </div>
        <div style={{ background:"#F0E4D8", borderRadius:10, padding:"3px 4px", display:"flex", gap:1 }}>
          {[["activities","🎯 Play"],["piggybank","🐷 Savings"]].map(([t,l])=>(
            <button key={t} className={`tab ${tab===t?"on":""}`} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div className="sans" style={{ fontSize:11, color:"#A09080", fontWeight:700 }}>{usage.remaining} left today</div>
          <div className="coin-badge" style={{ cursor:"pointer" }} onClick={()=>setTab("piggybank")}>🪙 {coins}</div>
        </div>
      </div>

      <div style={{ maxWidth:740, margin:"0 auto", padding:"20px 16px 60px" }}>

        {/* Usage warning */}
        {usage.remaining <= 1 && usage.remaining > 0 && (
          <div className="limit-banner">
            <span style={{ fontSize:24 }}>⚠️</span>
            <div>
              <div className="sans" style={{ fontSize:14, fontWeight:800, color:"#7A3800" }}>Last free generation today!</div>
              <div className="sans" style={{ fontSize:12, color:"#A07000", fontWeight:600 }}>Upgrade for unlimited. Resets at midnight.</div>
            </div>
          </div>
        )}

        {/* KID BAR */}
        <div className="card" style={{ padding:"14px 18px", marginBottom:16, display:"flex", flexWrap:"wrap", gap:14, alignItems:"center" }}>
          <div>
            <div className="sans" style={{ fontSize:10, fontWeight:800, color:"#A09080", marginBottom:4, letterSpacing:.8 }}>NAME</div>
            <input className="inp" style={{ width:120 }} placeholder="Optional 🙂" value={kidName} onChange={e=>setKidName(e.target.value)}/>
          </div>
          <div style={{ flex:1, minWidth:180 }}>
            <div className="sans" style={{ fontSize:10, fontWeight:800, color:"#A09080", marginBottom:4, letterSpacing:.8 }}>AGE: <span style={{ color:"#FF8C42", fontSize:14 }}>{age} yrs</span></div>
            <input type="range" className="rng" min={2} max={17} value={age} onChange={e=>setAge(Number(e.target.value))}/>
          </div>
        </div>

        {/* ACTIVITIES TAB */}
        {tab==="activities" && !loading && !hasResult && (
          <div style={{ animation:"fadeUp .4s ease" }}>
            <div className="fun" style={{ fontSize:24, color:"#3A2010", marginBottom:3 }}>What's the vibe? 🤔</div>
            <div className="sans" style={{ fontSize:13, color:"#8A7060", fontWeight:600, marginBottom:16 }}>Complete activities to earn 🪙 KiddoCoins!</div>

            <div className="card" style={{ padding:"16px 18px", marginBottom:12 }}>
              <div className="sans" style={{ fontSize:10, fontWeight:800, color:"#A09080", marginBottom:10, letterSpacing:.8 }}>MOOD</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {MOODS.map(m=><button key={m.id} className={`pill ${mood===m.id?"on":""}`} style={{ background:mood===m.id?m.color:"#fff", borderColor:mood===m.id?m.color:"#F0E4D8" }} onClick={()=>setMood(m.id)}>{m.emoji} {m.label}</button>)}
              </div>
            </div>
            <div className="card" style={{ padding:"16px 18px", marginBottom:12 }}>
              <div className="sans" style={{ fontSize:10, fontWeight:800, color:"#A09080", marginBottom:10, letterSpacing:.8 }}>WHERE?</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
                {SETTINGS.map(s=><button key={s.id} className={`pill ${setting===s.id?"on":""}`} style={{ background:setting===s.id?"#4ECDC4":"#fff", borderColor:setting===s.id?"#4ECDC4":"#F0E4D8", color:setting===s.id?"#fff":"#5A4030" }} onClick={()=>setSetting(s.id)}>{s.emoji} {s.label}</button>)}
              </div>
              <div className="sans" style={{ fontSize:10, fontWeight:800, color:"#A09080", marginBottom:10, letterSpacing:.8 }}>TIME</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {TIMES.map(t=><button key={t} className={`pill ${time===t?"on":""}`} style={{ background:time===t?"#A855F7":"#fff", borderColor:time===t?"#A855F7":"#F0E4D8", color:time===t?"#fff":"#5A4030" }} onClick={()=>setTime(t)}>⏱ {t}</button>)}
              </div>
            </div>
            <button className="bigbtn" style={{ background:"linear-gradient(135deg,#FF8C42,#FF5F00)", color:"#fff", boxShadow:"0 8px 28px rgba(255,140,66,.38)" }} onClick={doActivities}>
              🎯 Generate Activities & Earn KiddoCoins!
            </button>
          </div>
        )}

        {/* LOADER */}
        {loading && (
          <div style={{ textAlign:"center", padding:"72px 0" }}>
            <div style={{ fontSize:58, marginBottom:18, animation:"bob 2s ease-in-out infinite" }}>🎯</div>
            <div style={{ width:50, height:50, border:"4px solid #FFE4CC", borderTopColor:"#FF8C42", borderRadius:"50%", animation:"spin .75s linear infinite", margin:"0 auto 18px" }}/>
            <div className="fun" style={{ fontSize:22, color:"#FF8C42", marginBottom:8 }}>Creating activities...</div>
            <div className="sans" style={{ fontSize:13, color:"#A09080", fontWeight:600 }}>~20 seconds ✨</div>
          </div>
        )}

        {/* RESULTS */}
        {!loading && activities.length > 0 && (
          <div style={{ animation:"fadeUp .4s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <div className="fun" style={{ fontSize:21, color:"#3A2010" }}>Activities for {name}! 🎉</div>
                <div className="sans" style={{ fontSize:12, color:"#A09080", fontWeight:600, marginTop:2 }}>Complete each one to earn 🪙 KiddoCoins!</div>
              </div>
              <button className="smBtn" style={{ background:"#F0E4D8", color:"#7A6050" }} onClick={reset}>← New</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
              {activities.map((block,i)=><ActivityCard key={i} block={block} index={i} onComplete={handleComplete} completed={!!completedActs[i]}/>)}
            </div>
            <button className="smBtn" style={{ width:"100%", marginTop:14, background:"linear-gradient(135deg,#FF8C42,#FF5F00)", color:"#fff", borderRadius:14, padding:"13px 0", fontSize:14, justifyContent:"center" }} onClick={doActivities}>🔄 Generate New Activities</button>
          </div>
        )}

        {/* RAW FALLBACK */}
        {!loading && rawResult && (
          <div style={{ animation:"fadeUp .4s ease" }}>
            <div className="card" style={{ padding:"24px 28px", marginBottom:16 }}>
              <div className="sans" style={{ fontSize:14, color:"#3A2010", fontWeight:600, lineHeight:1.85, whiteSpace:"pre-wrap" }}>{rawResult}</div>
            </div>
            <button className="smBtn" style={{ background:"#F0E4D8", color:"#7A6050" }} onClick={reset}>← Try Again</button>
          </div>
        )}

        {/* PIGGY BANK TAB */}
        {tab==="piggybank" && (
          <PiggyBankTab coins={coins} completed={totalDone} streak={streak} rewards={rewards} goalId={goalId} onSetGoal={setGoalId} onClaimReward={setClaimReward}/>
        )}
      </div>
    </div>
  );
}
