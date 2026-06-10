// src/App.jsx — Skincare Dashboard v3.0
// Design language: Apothecary minimal · light + dark mode · terracotta accent · Cormorant serif

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  auth, db,
  signInWithGoogle, signOutUser, onAuthStateChanged,
  loadUserData, saveUserData, loadProfile, saveProfile,
} from "./firebase";

// ── Google Fonts (same as Fragrance Vault) ────────────────────────────────
if (!document.getElementById("sc-fonts")) {
  const l = document.createElement("link");
  l.id   = "sc-fonts";
  l.rel  = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;600&display=swap";
  document.head.appendChild(l);
}

// ── Design tokens — identical pattern to Fragrance Vault ─────────────────
const makeTokens = (dark) => ({
  bg:          dark ? "#141210" : "#F7F4EF",
  bgCard:      dark ? "#1E1B18" : "#FFFFFF",
  bgSubtle:    dark ? "#2A2520" : "#F0EDE8",
  bgHero:      dark ? "#231F1A" : "#FFFFFF",
  border:      dark ? "#2E2926" : "#E8E3DA",
  borderDark:  dark ? "#3D3732" : "#D5CEC3",
  ink:         dark ? "#F2EDE6" : "#1C1917",
  inkMid:      dark ? "#A89F96" : "#57534E",
  inkLight:    dark ? "#6B6460" : "#A8A29E",
  accent:      "#C2622D",
  accentLight: dark ? "rgba(194,98,45,0.15)" : "#F5E6DC",
  accentMid:   "#E8956A",
  gold:        "#B5862A",
  goldLight:   dark ? "rgba(181,134,42,0.18)" : "#FBF0D9",
  green:       "#4A7C59",
  greenLight:  dark ? "rgba(74,124,89,0.18)" : "#E8F2EC",
  red:         "#C0392B",
  redLight:    dark ? "rgba(192,57,43,0.15)" : "#FDECEA",
  blue:        "#3b82f6",
  blueLight:   dark ? "rgba(59,130,246,0.15)" : "#eff6ff",
  purple:      "#a855f7",
  purpleLight: dark ? "rgba(168,85,247,0.15)" : "#faf5ff",
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontBody:    "'DM Sans', -apple-system, sans-serif",
  fontMono:    "'DM Mono', 'Courier New', monospace",
  radius:   "12px",
  radiusLg: "18px",
  radiusSm: "8px",
});

// ── Constants ─────────────────────────────────────────────────────────────
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TODAY_IDX = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
const TODAY = DAYS[TODAY_IDX];
const TODAY_DATE = new Date().toLocaleDateString("en-CA");

// ── Skin type templates ───────────────────────────────────────────────────
const SKIN_TEMPLATES = {
  Oily: {
    emoji: "💧", label: "Oily / Acne-prone",
    desc: "Focus on sebum control, pore care, lightweight hydration",
    am: [
      { id: "am1", step: "Cleanse",  product: "CeraVe Foaming Facial Cleanser",         note: "Gel cleanser — removes excess oil" },
      { id: "am2", step: "Tone",     product: "Klairs Supple Preparation Toner",        note: "Lightweight — no alcohol" },
      { id: "am3", step: "Protect",  product: "Skin Aqua UV Super Moisture Gel SPF50+", note: "FINAL step — gel formula, non-greasy" },
    ],
    daily: buildDailyForSkinType("oily"),
  },
  Dry: {
    emoji: "🌸", label: "Dry / Sensitive",
    desc: "Focus on barrier repair, deep hydration, gentle actives",
    am: [
      { id: "am1", step: "Cleanse",  product: "La Roche-Posay Toleriane Hydrating Cleanser", note: "Cream cleanser — does not strip" },
      { id: "am2", step: "Prep",     product: "Hada Labo Gokujyun Hyaluronic Lotion",        note: "Pat into damp skin" },
      { id: "am3", step: "Protect",  product: "Altruist SPF50 Face Fluid",                   note: "FINAL step — hydrating finish" },
    ],
    daily: buildDailyForSkinType("dry"),
  },
  Combo: {
    emoji: "⚖️", label: "Combination",
    desc: "Balance T-zone oil while hydrating dry cheeks",
    am: [
      { id: "am1", step: "Cleanse",  product: "Cetaphil Gentle Skin Cleanser",    note: "Works for both zones" },
      { id: "am2", step: "Prep",     product: "Rose Water Mist",                  note: "Optional light mist" },
      { id: "am3", step: "Protect",  product: "Hyphen All I Need SPF 50 PA++++", note: "FINAL step — nothing after this" },
    ],
    daily: buildDailyForSkinType("combo"),
  },
  Sensitive: {
    emoji: "🤍", label: "Sensitive / Redness-prone",
    desc: "Minimal routine, fragrance-free, barrier-first approach",
    am: [
      { id: "am1", step: "Cleanse",  product: "Avène Extremely Gentle Cleanser Lotion", note: "No-rinse — ultra gentle" },
      { id: "am2", step: "Calm",     product: "Avène Thermal Spring Water Spray",       note: "Soothe before moisturizer" },
      { id: "am3", step: "Protect",  product: "Avène Mineral SPF50 Tinted",             note: "FINAL step — mineral, fragrance-free" },
    ],
    daily: buildDailyForSkinType("sensitive"),
  },
};

function buildDailyForSkinType() {
  return {
    Mon: { label: "Barrier Night", color: "#3b82f6", bg: "#eff6ff", emoji: "🟦", goal: "Repair + strengthen barrier", active: { step: "Target", product: "Ceramide Capsules or Repair Serum", note: "Barrier restoration" }, footnotes: ["⚠ No actives tonight — barrier nights only."], weeklyAddon: null },
    Tue: { label: "Hydration Night", color: "#22c55e", bg: "#f0fdf4", emoji: "🟩", goal: "Deep hydration reset", active: { step: "Target", product: "Hyaluronic Acid Serum", note: "Full face — apply to damp skin" }, footnotes: ["💧 HA works best on slightly damp skin."], weeklyAddon: null },
    Wed: { label: "Treatment Night", color: "#8b5cf6", bg: "#faf5ff", emoji: "🟪", goal: "Targeted treatment", active: { step: "Target", product: "Niacinamide 10% + Zinc", note: "T-zone focus" }, footnotes: ["⚠ One active only tonight."], weeklyAddon: null },
    Thu: { label: "Pigment Night", color: "#eab308", bg: "#fefce8", emoji: "🟨", goal: "Fade dark spots + even tone", active: { step: "Target", product: "Vitamin C Serum or Brightening Serum", note: "PIH fading — full face" }, footnotes: ["⚠ Use brightening serum only tonight."], weeklyAddon: null },
    Fri: { label: "Barrier Night", color: "#3b82f6", bg: "#eff6ff", emoji: "🟦", goal: "Recovery + hydration rebuild", active: { step: "Target", product: "Ceramide Capsules or Repair Serum", note: "Barrier restoration" }, footnotes: ["⚠ No actives tonight — barrier nights only."], weeklyAddon: null },
    Sat: { label: "Reset Night", color: "#a855f7", bg: "#faf5ff", emoji: "🟪", goal: "Hydration reset + deep pore clean", active: { step: "Target", product: "Hyaluronic Acid 2% + B5", note: "Hydration reset — full face" }, footnotes: ["⚠ HA only tonight.", "🗓 Clay mask add-on every 10–14 days."], weeklyAddon: { label: "Clay Cleanse (every 10–14 days)", product: "Clay Mask of choice", note: "T-zone only" } },
    Sun: { label: "Pigment Night", color: "#eab308", bg: "#fefce8", emoji: "🟨", goal: "Consistent pigmentation fading", active: { step: "Target", product: "Vitamin C Serum or Brightening Serum", note: "PIH fading — full face" }, footnotes: ["⚠ Brightening serum only tonight."], weeklyAddon: null },
  };
}

// ── My personal defaults ──────────────────────────────────────────────────
const MY_AM_DEFAULT = [
  { id: "am1", step: "Cleanse", product: "Neutrogena Hydro Boost Cleanser", note: "" },
  { id: "am2", step: "Prep",    product: "Rose Water Mist",                 note: "Optional light mist" },
  { id: "am3", step: "Protect", product: "Hyphen All I Need SPF 50 PA++++", note: "FINAL step — nothing after this" },
];
const PM_BASE_PREFIX = [
  { id: "pmb1", step: "Cleanse", product: "Neutrogena Hydro Boost Cleanser", note: "" },
  { id: "pmb2", step: "Prep",    product: "Rose Water Mist",                 note: "" },
];
const PM_BASE_SUFFIX = [
  { id: "pmb4", step: "Seal", product: "TO Natural Moisturizing Factors + Rice Lipids", note: "Cheeks/jaw: regular layer. T-zone: fingertip residue only." },
];
const MY_DAILY_DEFAULT = {
  Mon: { label: "Barrier Night", color: "#3b82f6", bg: "#eff6ff", emoji: "🟦", goal: "Repair + strengthen barrier", active: { step: "Target", product: "Elizabeth Arden Ceramide Capsules (Gold or Silver)", note: "Barrier restoration" }, footnotes: ["⚠ No actives tonight — barrier nights only.", "🧴 Moisturizer on cheeks/jaw only. T-zone gets fingertip residue only."], weeklyAddon: null },
  Tue: { label: "Oil Control Night", color: "#22c55e", bg: "#f0fdf4", emoji: "🟩", goal: "Reduce sebum + control pores", active: { step: "Target", product: "The Ordinary Niacinamide 10% + Zinc 1%", note: "T-zone focus only" }, footnotes: ["⚠ Niacinamide only tonight — do not combine with Double Shot.", "🧴 Moisturizer on cheeks/jaw only."], weeklyAddon: null },
  Wed: { label: "Oil Control + Pore Reset", color: "#22c55e", bg: "#f0fdf4", emoji: "🟩", goal: "Decongest + refine pores", active: { step: "Target", product: "The Ordinary Niacinamide 10% + Zinc 1%", note: "T-zone focus" }, footnotes: ["🗓 Weekly add-on: Rice Water Pads MUST go BEFORE Niacinamide.", "📍 Pads are T-zone only.", "🧴 Moisturizer on cheeks/jaw only."], weeklyAddon: { label: "Pore Reset", product: "Hyphen Rice Water Brightening Pads", note: "T-zone only — apply BEFORE Niacinamide" } },
  Thu: { label: "Pigment Night", color: "#eab308", bg: "#fefce8", emoji: "🟨", goal: "Fade PIH + even skin tone", active: { step: "Target", product: "Hyphen Double Shot Radiance Lift Serum", note: "PIH fading — full face" }, footnotes: ["⚠ Double Shot ONLY tonight — no Niacinamide alongside.", "🧴 Moisturizer on cheeks/jaw only."], weeklyAddon: null },
  Fri: { label: "Barrier Night", color: "#3b82f6", bg: "#eff6ff", emoji: "🟦", goal: "Recovery + hydration rebuild", active: { step: "Target", product: "Elizabeth Arden Ceramide Capsules (Gold or Silver)", note: "Barrier restoration" }, footnotes: ["⚠ No actives tonight — barrier nights only.", "🧴 Moisturizer on cheeks/jaw only."], weeklyAddon: null },
  Sat: { label: "Reset Night", color: "#a855f7", bg: "#faf5ff", emoji: "🟪", goal: "Hydration reset + deep pore clean", active: { step: "Target", product: "The Ordinary Hyaluronic Acid 2% + B5", note: "Hydration reset — full face" }, footnotes: ["⚠ HA only tonight.", "🗓 Clay Mask add-on (T-zone only) every 10–14 days."], weeklyAddon: { label: "Clay Cleanse (every 10–14 days)", product: "Innisfree Volcanic Clay Mask", note: "T-zone only" } },
  Sun: { label: "Pigment Night", color: "#eab308", bg: "#fefce8", emoji: "🟨", goal: "Consistent pigmentation fading", active: { step: "Target", product: "Hyphen Double Shot Radiance Lift Serum", note: "PIH fading — full face" }, footnotes: ["⚠ Double Shot ONLY tonight — no Niacinamide alongside.", "🧴 Moisturizer on cheeks/jaw only."], weeklyAddon: null },
};
const MY_INVENTORY_DEFAULT = [
  { id: 1,  name: "Neutrogena Hydro Boost Cleanser",               category: "Cleanser",    status: "In Use",    level: 90,  notes: "Brand new", expiry: "" },
  { id: 2,  name: "Rose Water Mist",                               category: "Prep",        status: "In Use",    level: 60,  notes: "", expiry: "" },
  { id: 3,  name: "Hyphen Rice Water Brightening Pads",            category: "Prep",        status: "In Use",    level: 70,  notes: "1 almost full + 2 unopened packs", expiry: "" },
  { id: 6,  name: "Hyphen Double Shot Radiance Lift Serum",        category: "Serum",       status: "In Use",    level: 55,  notes: "1 almost full + 1 unopened backup", expiry: "" },
  { id: 7,  name: "The Ordinary Niacinamide 10% + Zinc 1%",        category: "Serum",       status: "In Use",    level: 45,  notes: "", expiry: "" },
  { id: 9,  name: "Elizabeth Arden Ceramide Capsules (Gold)",      category: "Serum",       status: "In Use",    level: 55,  notes: "More than half left", expiry: "" },
  { id: 13, name: "TO Natural Moisturizing Factors + Rice Lipids", category: "Moisturizer", status: "In Use",    level: 65,  notes: "Rich texture", expiry: "" },
  { id: 17, name: "Innisfree Volcanic Clay Mask",                  category: "Mask",        status: "In Use",    level: 30,  notes: "Almost full", expiry: "" },
  { id: 18, name: "Suroskie Rose Collagen Sheet Mask",             category: "Mask",        status: "Low Stock", level: 5,   notes: "Only 1 sheet left!", expiry: "" },
  { id: 19, name: "Hyphen All I Need SPF 50 PA++++",               category: "Sunscreen",   status: "In Use",    level: 50,  notes: "1 almost full + 1 unopened", expiry: "" },
  { id: 20, name: "Hyphen Advanced De-Pigmentation Serum",         category: "To Buy",      status: "Wishlist",  level: 0,   notes: "India window — fills Alpha Arbutin gap", expiry: "" },
];

// ── Helpers ───────────────────────────────────────────────────────────────
const daysUntilExpiry = (expiry) => {
  if (!expiry) return null;
  return Math.floor((new Date(expiry) - new Date()) / 86400000);
};
const expiryStatus = (expiry) => {
  const d = daysUntilExpiry(expiry);
  if (d === null) return null;
  if (d < 0) return "expired";
  if (d <= 90) return "soon";
  return "ok";
};
const productInToday = (invName, todayProds) => {
  const n = invName.toLowerCase();
  return todayProds.some(tp => n.split(/\s+/).filter(w => w.length > 3).some(w => tp.includes(w)));
};

const STATUS_COLORS = {
  "In Use":        { bg: "#d4f4e2", text: "#166534" },
  "Sealed/Backup": { bg: "#dbeafe", text: "#1e3a8a" },
  "Paused":        { bg: "#fef3c7", text: "#92400e" },
  "Low Stock":     { bg: "#fee2e2", text: "#991b1b" },
  "Empty":         { bg: "#f1f5f9", text: "#64748b" },
  "Wishlist":      { bg: "#f3e8ff", text: "#6b21a8" },
};
const CAT_COLORS = {
  Cleanser: "#f0abfc", Prep: "#93c5fd", Serum: "#fcd34d",
  Moisturizer: "#6ee7b7", Mask: "#fca5a5", Sunscreen: "#fdba74", "To Buy": "#c4b5fd",
};

// ── Shared primitives ─────────────────────────────────────────────────────
function LevelBar({ level, T }) {
  const c = level > 60 ? T.green : level > 25 ? T.gold : T.red;
  return (
    <div style={{ background: T.bgSubtle, borderRadius: 99, height: 5, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, level)}%`, background: c, height: "100%", borderRadius: 99, transition: "width 0.4s" }} />
    </div>
  );
}

function Modal({ title, onClose, children, T }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,12,10,0.72)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div style={{ background: T.bgCard, borderRadius: "20px 20px 0 0", padding: "22px 22px 32px", width: "100%", maxWidth: 540, maxHeight: "88vh", overflowY: "auto", paddingBottom: "max(32px, env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(0,0,0,0.25)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: T.border, borderRadius: 99, margin: "0 auto 18px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 600, color: T.ink }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: T.inkLight, padding: "4px 8px" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", options, placeholder, T }) {
  const s = { width: "100%", padding: "10px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontFamily: T.fontBody, fontSize: 16, background: T.bgSubtle, outline: "none", boxSizing: "border-box", color: T.ink, WebkitAppearance: "none" };
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: T.inkLight, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: T.fontBody }}>{label}</label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={s}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...s, minHeight: 72, resize: "vertical" }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s} />
      )}
    </div>
  );
}

function Divider({ label, color, action, T }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 0 12px" }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 10, color, fontWeight: 700, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
      {action && (
        <button onClick={action.onClick} style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 600, color: action.color || color, background: (action.color || color) + "18", border: `1px solid ${(action.color || color)}44`, borderRadius: 99, padding: "3px 10px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

function Toast({ msg, T, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)", background: T.bgCard, color: T.ink, fontFamily: T.fontBody, fontSize: 13, fontWeight: 500, padding: "10px 20px", borderRadius: 99, zIndex: 200, pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", border: `1px solid ${T.border}` }}>
      {msg}
    </div>
  );
}

// ── Dark mode toggle (identical to Fragrance Vault) ───────────────────────
function DarkToggle({ dark, toggle }) {
  return (
    <button onClick={toggle} style={{ width: 44, height: 26, borderRadius: 13, border: "none", background: dark ? "#C2622D" : "#E0D9D0", cursor: "pointer", position: "relative", transition: "background 0.3s", flexShrink: 0, padding: 0 }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: dark ? 21 : 3, transition: "left 0.25s", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
        {dark ? "🌙" : "☀️"}
      </div>
    </button>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────
function Onboarding({ user, onComplete, dark, toggleDark }) {
  const T = makeTokens(dark);
  const [chosen, setChosen] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    if (!chosen) return;
    setSaving(true);
    const template = SKIN_TEMPLATES[chosen];
    const profile = { displayName: user.displayName, photoURL: user.photoURL, skinType: chosen, createdAt: new Date().toISOString(), streakCount: 0, lastCompletedDate: null };
    await saveProfile(user.uid, profile);
    await saveUserData(user.uid, "amSteps",   template.am);
    await saveUserData(user.uid, "daily",     template.daily);
    await saveUserData(user.uid, "inventory", []);
    await saveUserData(user.uid, "skinLog",   []);
    await saveUserData(user.uid, "checked",   { date: TODAY_DATE, steps: {} });
    onComplete(profile, template.am, template.daily);
  };

  return (
    <div style={{ minHeight: "100svh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, transition: "background 0.3s" }}>
      <div style={{ position: "absolute", top: 20, right: 20 }}><DarkToggle dark={dark} toggle={toggleDark} /></div>
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.inkLight, letterSpacing: "0.16em", marginBottom: 8, textAlign: "center" }}>WELCOME, {(user.displayName || "").split(" ")[0].toUpperCase()}</div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 30, fontWeight: 600, color: T.ink, fontStyle: "italic", textAlign: "center", marginBottom: 6 }}>What's your skin type?</div>
        <div style={{ fontFamily: T.fontBody, fontSize: 13, color: T.inkLight, textAlign: "center", marginBottom: 28, lineHeight: 1.7 }}>We'll build your starter routine — you can customise everything later.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {Object.entries(SKIN_TEMPLATES).map(([key, tmpl]) => (
            <button key={key} onClick={() => setChosen(key)} style={{ background: chosen === key ? T.accentLight : T.bgCard, border: `2px solid ${chosen === key ? T.accent : T.border}`, borderRadius: T.radiusLg, padding: "14px 18px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{tmpl.emoji}</span>
                <div>
                  <div style={{ fontFamily: T.fontBody, fontSize: 14, fontWeight: 600, color: chosen === key ? T.accent : T.ink, marginBottom: 2 }}>{tmpl.label}</div>
                  <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkLight }}>{tmpl.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <button onClick={handleStart} disabled={!chosen || saving} style={{ width: "100%", padding: "14px", borderRadius: T.radius, border: "none", cursor: chosen ? "pointer" : "not-allowed", background: chosen ? T.accent : T.bgSubtle, color: chosen ? "#fff" : T.inkLight, fontFamily: T.fontDisplay, fontSize: 17, fontWeight: 600, fontStyle: "italic", transition: "all 0.15s" }}>
          {saving ? "Building your routine…" : "Start my routine →"}
        </button>
      </div>
    </div>
  );
}

// ── Sign-in screen ────────────────────────────────────────────────────────
function SignIn({ dark, toggleDark }) {
  const T = makeTokens(dark);
  const [loading, setLoading] = useState(false);
  const handleSignIn = async () => {
    setLoading(true);
    try { await signInWithGoogle(); }
    catch (e) { console.error(e); setLoading(false); }
  };
  return (
    <div style={{ minHeight: "100svh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, transition: "background 0.3s" }}>
      <div style={{ position: "absolute", top: 20, right: 20 }}><DarkToggle dark={dark} toggle={toggleDark} /></div>
      <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", border: `1px solid ${T.borderDark}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", background: T.bgCard, fontSize: 30, boxShadow: "0 4px 24px rgba(28,25,23,0.08)" }}>🌿</div>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.inkLight, letterSpacing: "0.18em", marginBottom: 12 }}>SUMMER 2026</div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 34, fontWeight: 600, color: T.ink, fontStyle: "italic", marginBottom: 8, lineHeight: 1.2 }}>Your personal<br />skin dashboard</div>
        <div style={{ fontFamily: T.fontBody, fontSize: 13, color: T.inkLight, marginBottom: 40, lineHeight: 1.7, maxWidth: 280, margin: "0 auto 40px" }}>Track your routine, inventory, and skin — privately. Share the app with friends; everyone gets their own space.</div>
        <button onClick={handleSignIn} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: T.radius, border: `1.5px solid ${T.border}`, cursor: "pointer", background: T.bgCard, color: T.ink, fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 2px 12px rgba(28,25,23,0.08)" }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.3z"/><path fill="#34A853" d="M24 48c6.6 0 12.2-2.2 16.2-6l-7.9-6c-2.2 1.5-5 2.3-8.3 2.3-6.4 0-11.8-4.3-13.7-10.1H2.2v6.2C6.2 42.6 14.5 48 24 48z"/><path fill="#FBBC05" d="M10.3 28.2c-.5-1.5-.8-3-.8-4.6s.3-3.2.8-4.6v-6.2H2.2C.8 16.1 0 19.9 0 23.6s.8 7.5 2.2 10.8l8.1-6.2z"/><path fill="#EA4335" d="M24 9.5c3.6 0 6.8 1.2 9.3 3.6l7-7C36.2 2.2 30.6 0 24 0 14.5 0 6.2 5.4 2.2 13.4l8.1 6.2C12.2 13.8 17.6 9.5 24 9.5z"/></svg>
          {loading ? "Signing in…" : "Continue with Google"}
        </button>
        <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkLight, marginTop: 18, lineHeight: 1.6 }}>Your data is private. Friends get their own separate space.</div>
      </div>
    </div>
  );
}

// ── Weekly Report ─────────────────────────────────────────────────────────
function WeeklyReport({ skinLog, inventory, T }) {
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekLogs = skinLog.filter(e => new Date(e.date) >= weekAgo);
  if (weekLogs.length === 0) return null;
  const moodMap = { "😊": 5, "😐": 3, "😞": 1, "🥵": 2, "😴": 2 };
  const avgMood = weekLogs.reduce((s, e) => s + (moodMap[e.mood] || 3), 0) / weekLogs.length;
  const oilinessMap = { "Very Oily": 5, "Oily": 4, "Normal": 3, "Balanced": 2, "Dry": 1 };
  const avgOil = weekLogs.reduce((s, e) => s + (oilinessMap[e.oiliness] || 3), 0) / weekLogs.length;
  const moodEmoji = avgMood >= 4 ? "😊" : avgMood >= 2.5 ? "😐" : "😞";
  const oilText = avgOil >= 4 ? "Oily week" : avgOil <= 2 ? "Dry week" : "Balanced";
  const lowStock = inventory.filter(i => i.level > 0 && i.level <= 20 && i.status !== "Wishlist");
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: "16px 18px", marginBottom: 18, boxShadow: "0 2px 12px rgba(28,25,23,0.06)" }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.accent, fontWeight: 700, letterSpacing: "0.14em", marginBottom: 12 }}>THIS WEEK'S REPORT</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { label: "ENTRIES",  value: weekLogs.length, sub: "days logged" },
          { label: "MOOD",     value: moodEmoji, sub: avgMood >= 4 ? "Great week" : avgMood >= 2.5 ? "So-so" : "Rough week" },
          { label: "OILINESS", value: oilText.split(" ")[0], sub: "avg trend" },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ background: T.bgSubtle, borderRadius: T.radiusSm, padding: "10px 12px" }}>
            <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.inkLight, marginBottom: 4, letterSpacing: "0.08em" }}>{label}</div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.ink }}>{value}</div>
            <div style={{ fontFamily: T.fontBody, fontSize: 10, color: T.inkLight }}>{sub}</div>
          </div>
        ))}
      </div>
      {lowStock.length > 0 && (
        <div style={{ marginTop: 10, background: T.redLight, border: `1px solid ${T.red}44`, borderRadius: T.radiusSm, padding: "8px 12px" }}>
          <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.red, fontWeight: 600 }}>
            🛒 Restock soon: {lowStock.map(i => i.name.split(" ").slice(0, 2).join(" ")).join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Streak badge ──────────────────────────────────────────────────────────
function StreakBadge({ streak, T }) {
  if (!streak || streak < 2) return null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: streak >= 7 ? T.accentLight : T.goldLight, border: `1px solid ${streak >= 7 ? T.accent : T.gold}`, borderRadius: 99, padding: "5px 14px", marginBottom: 16 }}>
      <span style={{ fontSize: 14 }}>{streak >= 7 ? "🔥" : "⚡"}</span>
      <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 700, color: streak >= 7 ? T.accent : T.gold }}>{streak} day streak</span>
    </div>
  );
}

// ── AI Advisor ────────────────────────────────────────────────────────────
function AIAdvisor({ amSteps, daily, inventory, skinLog, profile, T }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const systemPrompt = `You are a knowledgeable, friendly skincare advisor. You have full context about this user's routine, inventory, and skin log.

USER PROFILE: Skin type: ${profile?.skinType || "Not specified"}, Name: ${profile?.displayName || "User"}, Streak: ${profile?.streakCount || 0} days

AM ROUTINE: ${JSON.stringify(amSteps?.map(s => s.product))}
PM SCHEDULE: ${JSON.stringify(Object.entries(daily || {}).map(([day, d]) => ({ day, active: d.active?.product })))}
INVENTORY: ${JSON.stringify(inventory?.map(i => ({ name: i.name, status: i.status, level: i.level + "%" })))}
RECENT LOG: ${JSON.stringify(skinLog?.slice(0, 5).map(e => ({ date: e.date, mood: e.mood, oiliness: e.oiliness })))}

Give concise, personalised advice. Keep responses short and mobile-friendly. Be warm, not clinical.`;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const historyPayload = updatedMessages.slice(-12);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemPrompt,
          messages: historyPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages(prev => [...prev, { role: "assistant", content: "Error: " + (data.error || "Unknown error") }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.text }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Network error: " + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = ["What's causing my oily T-zone?", "Can I add Vitamin C to my routine?", "Is my routine good for PIH?", "What should I restock first?"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100svh - 180px)" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        {messages.length === 0 && (
          <div>
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: "18px 20px", marginBottom: 18 }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.accent, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>AI SKIN ADVISOR</div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 600, color: T.ink, marginBottom: 4, fontStyle: "italic" }}>Hi {(profile?.displayName || "").split(" ")[0]}! I know your routine inside out.</div>
              <div style={{ fontFamily: T.fontBody, fontSize: 13, color: T.inkMid, lineHeight: 1.7 }}>Ask me about ingredient conflicts, routine tweaks, product recs, or why your skin is doing that thing it's doing.</div>
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkLight, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>QUICK QUESTIONS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => setInput(s)} style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.accent, background: T.accentLight, border: `1px solid ${T.accent}44`, borderRadius: 99, padding: "6px 13px", cursor: "pointer" }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "82%", padding: "11px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? T.accent : T.bgCard, border: m.role === "assistant" ? `1px solid ${T.border}` : "none", fontFamily: T.fontBody, fontSize: 13, color: m.role === "user" ? "#fff" : T.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 5, padding: "10px 14px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: "16px 16px 16px 4px", width: "fit-content", marginBottom: 12 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent, opacity: 0.5, animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask anything about your skin…" style={{ flex: 1, padding: "11px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontFamily: T.fontBody, fontSize: 16, outline: "none", background: T.bgSubtle, color: T.ink }} />
        <button onClick={send} disabled={!input.trim() || loading} style={{ background: input.trim() ? T.accent : T.bgSubtle, color: input.trim() ? "#fff" : T.inkLight, border: "none", borderRadius: T.radiusSm, padding: "11px 16px", cursor: "pointer", fontFamily: T.fontBody, fontSize: 13, fontWeight: 600, transition: "all 0.15s" }}>Send</button>
      </div>
      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Main App ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Dark mode (exact pattern from Fragrance Vault) ──
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("sc_dark") === "1"; }
    catch { return false; }
  });
  const toggleDark = () => {
    setDark(d => {
      const next = !d;
      try { localStorage.setItem("sc_dark", next ? "1" : "0"); } catch {}
      return next;
    });
  };
  const T = makeTokens(dark);

  // ── Auth state ──
  const [authUser,     setAuthUser]     = useState(undefined);
  const [profile,      setProfile]      = useState(null);
  const [needsOnboard, setNeedsOnboard] = useState(false);

  // ── App data ──
  const [amSteps,   setAmSteps]   = useState(MY_AM_DEFAULT);
  const [daily,     setDaily]     = useState(MY_DAILY_DEFAULT);
  const [inventory, setInventory] = useState([]);
  const [skinLog,   setSkinLog]   = useState([]);
  const [checked,   setChecked]   = useState({ date: TODAY_DATE, steps: {} });

  // ── UI state ──
  const [tab,           setTab]           = useState("today");
  const [filterCat,     setFilterCat]     = useState("All");
  const [toast,         setToast]         = useState(null);
  const [editAmStep,    setEditAmStep]    = useState(null);
  const [editDay,       setEditDay]       = useState(null);
  const [editItem,      setEditItem]      = useState(null);
  const [addingItem,    setAddingItem]    = useState(false);
  const [newItem,       setNewItem]       = useState({ name: "", category: "Serum", status: "In Use", level: 100, notes: "", expiry: "" });
  const [logForm,       setLogForm]       = useState({ mood: "😊", oiliness: "Normal", notes: "" });
  const [showLog,       setShowLog]       = useState(false);
  const [addingAmStep,  setAddingAmStep]  = useState(false);
  const [newAmStep,     setNewAmStep]     = useState({ step: "", product: "", note: "" });
  const [addingPmStep,  setAddingPmStep]  = useState(null);
  const [newPmStep,     setNewPmStep]     = useState({ type: "prefix", step: "", product: "", note: "" });

  const showToast = useCallback((msg) => setToast(msg), []);

  // ── Auth listener ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user || null);
      if (!user) { setNeedsOnboard(false); return; }
      const prof = await loadProfile(user.uid);
      if (!prof) { setNeedsOnboard(true); }
      else { setProfile(prof); setNeedsOnboard(false); await loadAllData(user.uid); }
    });
    return unsub;
  }, []);

  const loadAllData = async (uid) => {
    const [am, dy, inv, log, chk] = await Promise.all([
      loadUserData(uid, "amSteps"), loadUserData(uid, "daily"),
      loadUserData(uid, "inventory"), loadUserData(uid, "skinLog"), loadUserData(uid, "checked"),
    ]);
    if (am)  setAmSteps(am);
    if (dy)  setDaily(dy);
    if (inv) setInventory(inv);
    if (log) setSkinLog(log);
    if (chk) setChecked(chk.date === TODAY_DATE ? chk : { date: TODAY_DATE, steps: {} });
  };

  const saveDebounced = useCallback((field, value) => {
    if (!authUser) return;
    saveUserData(authUser.uid, field, value).catch(console.error);
  }, [authUser]);

  useEffect(() => { if (authUser) saveDebounced("amSteps",   amSteps);   }, [amSteps]);
  useEffect(() => { if (authUser) saveDebounced("daily",     daily);     }, [daily]);
  useEffect(() => { if (authUser) saveDebounced("inventory", inventory); }, [inventory]);
  useEffect(() => { if (authUser) saveDebounced("skinLog",   skinLog);   }, [skinLog]);
  useEffect(() => { if (authUser) saveDebounced("checked",   checked);   }, [checked]);

  // ── Streak ──
  const updateStreak = useCallback(async () => {
    if (!authUser || !profile) return;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const ys = yesterday.toLocaleDateString("en-CA");
    let n = profile.streakCount || 0;
    if (profile.lastCompletedDate === ys) n += 1;
    else if (profile.lastCompletedDate !== TODAY_DATE) n = 1;
    const updated = { ...profile, streakCount: n, lastCompletedDate: TODAY_DATE };
    setProfile(updated);
    await saveProfile(authUser.uid, updated);
  }, [authUser, profile]);

  // ── Today schedule ──
  const todaySched = daily[TODAY] || MY_DAILY_DEFAULT[TODAY];
  const todayPMSteps = useMemo(() => {
    const steps = [...PM_BASE_PREFIX];
    if (todaySched.weeklyAddon) steps.push({ id: "addon", step: "Weekly Add-on 🗓", product: todaySched.weeklyAddon.product, note: todaySched.weeklyAddon.note, isAddon: true });
    steps.push({ id: "target", step: todaySched.active.step, product: todaySched.active.product, note: todaySched.active.note });
    steps.push(...PM_BASE_SUFFIX);
    if (todaySched.extraSuffix) steps.push(...todaySched.extraSuffix);
    return steps;
  }, [todaySched]);

  const allTodayStepIds = [...amSteps.map(s => s.id), ...todayPMSteps.map(s => s.id)];
  const checkedSteps    = checked.steps || {};
  const completedCount  = allTodayStepIds.filter(id => checkedSteps[id]).length;
  const allDone         = completedCount === allTodayStepIds.length && allTodayStepIds.length > 0;

  useEffect(() => {
    if (allDone && profile && profile.lastCompletedDate !== TODAY_DATE) {
      updateStreak();
      showToast("🔥 Routine complete! Streak updated.");
    }
  }, [allDone]);

  const toggleCheck = (id) => setChecked(prev => ({ ...prev, steps: { ...prev.steps, [id]: !prev.steps?.[id] } }));

  const todayProducts = useMemo(() =>
    [...amSteps.map(s => s.product), ...todayPMSteps.map(s => s.product)].map(p => p.toLowerCase()),
  [amSteps, todayPMSteps]);

  // Alerts
  const lowStockAlerts = inventory.filter(i => i.status === "Low Stock" || (i.level > 0 && i.level <= 20 && i.status !== "Wishlist"));
  const wishlistAlerts = inventory.filter(i => i.status === "Wishlist");
  const expiryAlerts   = inventory.filter(i => { const es = expiryStatus(i.expiry); return es && es !== "ok"; });

  // ── Reusable card style ──
  const card = {
    background: T.bgCard,
    borderRadius: T.radiusLg,
    border: `1px solid ${T.border}`,
    padding: "15px 17px",
    marginBottom: 10,
    boxShadow: dark ? "none" : "0 1px 4px rgba(28,25,23,0.05)",
    transition: "background 0.3s, border-color 0.3s",
  };

  const btnBase = {
    fontFamily: T.fontBody, fontWeight: 600, cursor: "pointer",
    border: "none", borderRadius: T.radiusSm, padding: "12px 16px", fontSize: 14,
    transition: "all 0.15s",
  };

  // ── Step card ──
  function StepCard({ s, isAm }) {
    const isChecked = checkedSteps[s.id];
    return (
      <div style={{ ...card, display: "flex", gap: 12, alignItems: "flex-start", opacity: isChecked ? 0.4 : 1, background: s.isAddon ? T.greenLight : T.bgCard, border: s.isAddon ? `1.5px solid ${T.green}44` : `1px solid ${T.border}` }}>
        <button onClick={() => toggleCheck(s.id)} style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, marginTop: 1, cursor: "pointer", border: `2px solid ${isChecked ? T.green : T.border}`, background: isChecked ? T.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
          {isChecked && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1 }}>✓</span>}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3, color: isAm ? T.gold : (s.isAddon ? T.green : T.accent) }}>{s.step}</div>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: s.note ? 3 : 0 }}>{s.product}</div>
          {s.note && <div style={{ fontFamily: T.fontBody, fontSize: 12, color: s.isAddon ? T.green : T.inkMid, lineHeight: 1.5 }}>{s.note}</div>}
        </div>
      </div>
    );
  }

  // ── Day routine card ──
  function DayRoutineCard({ day }) {
    const sc = daily[day] || MY_DAILY_DEFAULT[day];
    const isToday = day === TODAY;
    const [expanded, setExpanded] = useState(isToday);
    const allPmSteps = [
      ...PM_BASE_PREFIX,
      ...(sc.extraPrefix || []),
      ...(sc.weeklyAddon ? [{ id: "addon_" + day, step: "Weekly Add-on 🗓", product: sc.weeklyAddon.product, note: sc.weeklyAddon.note, isAddon: true }] : []),
      { id: "target_" + day, step: sc.active.step, product: sc.active.product, note: sc.active.note },
      ...PM_BASE_SUFFIX,
      ...(sc.extraSuffix || []),
    ];
    const deletePmStep = (stepId, type) => {
      setDaily(prev => { const d = prev[day]; const field = type === "prefix" ? "extraPrefix" : "extraSuffix"; return { ...prev, [day]: { ...d, [field]: (d[field] || []).filter(s => s.id !== stepId) } }; });
      showToast("Step removed");
    };
    return (
      <div style={{ ...card, padding: 0, overflow: "hidden", background: isToday ? T.bgCard : T.bgCard, border: isToday ? `1.5px solid ${T.accent}55` : `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "15px 17px", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 700, color: isToday ? T.accent : T.inkMid, minWidth: 30 }}>{day}</span>
              <span style={{ background: sc.color + "22", color: sc.color, fontFamily: T.fontBody, fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 99 }}>{sc.emoji} {sc.label}</span>
              {isToday && <span style={{ background: T.accent, color: "#fff", fontFamily: T.fontMono, fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 99, letterSpacing: "0.09em" }}>TODAY</span>}
            </div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 2 }}>{sc.active.product}</div>
            <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkMid }}>{sc.goal}</div>
            {sc.weeklyAddon && <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.green, marginTop: 4 }}>＋ {sc.weeklyAddon.label || sc.weeklyAddon.product}</div>}
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
            <button onClick={e => { e.stopPropagation(); setEditDay({ _day: day, label: sc.label, goal: sc.goal, activeProduct: sc.active.product, activeNote: sc.active.note, footnoteText: (sc.footnotes || []).join("\n"), addonProduct: sc.weeklyAddon?.product || "", addonNote: sc.weeklyAddon?.note || "", addonLabel: sc.weeklyAddon?.label || "" }); }} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkLight, fontSize: 16, padding: "0 4px" }}>✏</button>
            <span style={{ color: T.inkLight, fontSize: 12, padding: "0 4px" }}>{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
        {expanded && (
          <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 17px 15px" }}>
            <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkLight, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>FULL STEP ORDER</div>
            {allPmSteps.map((s, idx) => {
              const isExtra = s.id?.startsWith("pm_extra_");
              const extraType = isExtra ? ((sc.extraPrefix || []).find(x => x.id === s.id) ? "prefix" : "suffix") : null;
              return (
                <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 11px", background: s.isAddon ? T.greenLight : isExtra ? T.purpleLight : T.bgSubtle, borderRadius: T.radiusSm, marginBottom: 5, border: isExtra ? `1px solid ${T.purple}33` : "1px solid transparent" }}>
                  <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.inkLight, minWidth: 18, marginTop: 1 }}>{idx + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: T.fontMono, fontSize: 9, color: s.isAddon ? T.green : isExtra ? T.purple : T.accent, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 2 }}>{s.step || "Step"}</div>
                    <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 600, color: T.ink }}>{s.product}</div>
                    {s.note && <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkMid, marginTop: 1 }}>{s.note}</div>}
                  </div>
                  {isExtra && (
                    <button onClick={() => deletePmStep(s.id, extraType)} style={{ background: T.redLight, border: "none", borderRadius: 7, padding: "3px 8px", cursor: "pointer", fontFamily: T.fontBody, fontSize: 11, color: T.red, fontWeight: 700, flexShrink: 0 }}>✕</button>
                  )}
                </div>
              );
            })}
            <button onClick={() => { setNewPmStep({ type: "prefix", step: "", product: "", note: "" }); setAddingPmStep(day); }} style={{ marginTop: 8, width: "100%", padding: "9px", borderRadius: T.radiusSm, border: `1.5px dashed ${T.accent}55`, background: T.accentLight, fontFamily: T.fontBody, fontSize: 12, fontWeight: 600, color: T.accent, cursor: "pointer" }}>
              + Add Step to {day} Routine
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Save helpers ──
  const saveAmStep   = () => { setAmSteps(s => s.map(x => x.id === editAmStep.id ? editAmStep : x)); setEditAmStep(null); showToast("AM step saved ✓"); };
  const deleteAmStep = () => { setAmSteps(s => s.filter(x => x.id !== editAmStep.id)); setEditAmStep(null); showToast("Step removed"); };
  const doAddAmStep  = () => { if (!newAmStep.product.trim()) return; setAmSteps(s => [...s, { ...newAmStep, id: "am_" + Date.now() }]); setNewAmStep({ step: "", product: "", note: "" }); setAddingAmStep(false); showToast("AM step added ✓"); };
  const saveDay = () => { setDaily(prev => ({ ...prev, [editDay._day]: { ...prev[editDay._day], label: editDay.label, goal: editDay.goal, active: { step: "Target", product: editDay.activeProduct, note: editDay.activeNote }, footnotes: (editDay.footnoteText || "").split("\n").filter(f => f.trim()), weeklyAddon: editDay.addonProduct ? { label: editDay.addonLabel, product: editDay.addonProduct, note: editDay.addonNote } : null } })); setEditDay(null); showToast("Day updated ✓"); };
  const doAddPmStep  = (dayKey) => { if (!newPmStep.product.trim()) return; const newId = "pm_extra_" + Date.now(); setDaily(prev => { const d = prev[dayKey]; const field = newPmStep.type === "prefix" ? "extraPrefix" : "extraSuffix"; return { ...prev, [dayKey]: { ...d, [field]: [...(d[field] || []), { ...newPmStep, id: newId }] } }; }); setNewPmStep({ type: "prefix", step: "", product: "", note: "" }); setAddingPmStep(null); showToast("PM step added ✓"); };
  const saveItem   = () => { setInventory(inv => inv.map(i => i.id === editItem.id ? editItem : i)); setEditItem(null); showToast("Product saved ✓"); };
  const deleteItem = () => { setInventory(inv => inv.filter(i => i.id !== editItem.id)); setEditItem(null); showToast("Product removed"); };
  const doAddItem  = () => { if (!newItem.name.trim()) return; setInventory(inv => [...inv, { ...newItem, id: Date.now() }]); setAddingItem(false); showToast("Product added ✓"); };
  const saveLog    = () => { setSkinLog(p => [{ ...logForm, date: TODAY_DATE, id: Date.now() }, ...p]); setLogForm({ mood: "😊", oiliness: "Normal", notes: "" }); setShowLog(false); showToast("Skin entry logged ✓"); };

  const cats = ["All", ...Array.from(new Set(inventory.map(i => i.category)))];
  const filteredInv = filterCat === "All" ? inventory : inventory.filter(i => i.category === filterCat);
  const isSunday = new Date().getDay() === 0;

  // ── Loading / auth gates ──
  if (authUser === undefined) {
    return (
      <div style={{ minHeight: "100svh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.3s" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${T.border}`, borderTopColor: T.accent, animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }
  if (!authUser) return <SignIn dark={dark} toggleDark={toggleDark} />;
  if (needsOnboard) return <Onboarding user={authUser} onComplete={(prof, am, dy) => { setProfile(prof); setAmSteps(am); setDaily(dy); setInventory([]); setSkinLog([]); setNeedsOnboard(false); }} dark={dark} toggleDark={toggleDark} />;

  // ═══════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: T.fontBody, background: T.bg, minHeight: "100svh", color: T.ink, transition: "background 0.3s, color 0.3s" }}>

      {/* ── HEADER ── */}
      <div style={{ background: T.bgCard, borderBottom: `1px solid ${T.border}`, paddingTop: `calc(14px + env(safe-area-inset-top))`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, position: "sticky", top: 0, zIndex: 50, transition: "background 0.3s" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkLight, letterSpacing: "0.14em", marginBottom: 2 }}>SUMMER 2026 · SKIN DASHBOARD</div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.ink, fontStyle: "italic", lineHeight: 1 }}>
                {profile?.displayName?.split(" ")[0]}'s Routine
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <DarkToggle dark={dark} toggle={toggleDark} />
              {profile?.photoURL && <img src={profile.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: "50%", border: `1.5px solid ${T.border}` }} />}
              <button onClick={signOutUser} style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkLight, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.08em" }}>OUT</button>
            </div>
          </div>

          {/* Alerts */}
          {(lowStockAlerts.length > 0 || expiryAlerts.length > 0 || wishlistAlerts.length > 0) && (
            <div style={{ marginTop: 9, display: "flex", gap: 5, flexWrap: "wrap" }}>
              {lowStockAlerts.slice(0, 2).map(i => (
                <span key={i.id} style={{ background: T.redLight, border: `1px solid ${T.red}88`, borderRadius: 7, padding: "2px 8px", fontFamily: T.fontBody, fontSize: 10, color: T.red, fontWeight: 600 }}>⚠ Low: {i.name.split(" ").slice(0, 3).join(" ")}</span>
              ))}
              {expiryAlerts.slice(0, 1).map(i => {
                const d = daysUntilExpiry(i.expiry);
                return <span key={i.id} style={{ background: T.goldLight, border: `1px solid ${T.gold}88`, borderRadius: 7, padding: "2px 8px", fontFamily: T.fontBody, fontSize: 10, color: T.gold, fontWeight: 600 }}>{d < 0 ? "❌ Expired: " : "⏰ Exp soon: "}{i.name.split(" ").slice(0, 3).join(" ")}</span>;
              })}
              {wishlistAlerts.slice(0, 1).map(i => (
                <span key={i.id} style={{ background: T.accentLight, border: `1px solid ${T.accent}55`, borderRadius: 7, padding: "2px 8px", fontFamily: T.fontBody, fontSize: 10, color: T.accent, fontWeight: 600 }}>🛒 {i.name.split(" ").slice(0, 4).join(" ")}</span>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, marginTop: 12, background: T.bgSubtle, borderRadius: 99, padding: 3, overflowX: "auto" }}>
            {[["today", "Today"], ["routine", "Routine"], ["inventory", "Inventory"], ["log", "Log"], ["advisor", "✨ Advisor"]].map(([id, lbl]) => (
              <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 12px", borderRadius: 99, border: "none", cursor: "pointer", fontFamily: T.fontBody, fontSize: 12, fontWeight: 600, background: tab === id ? T.bgCard : "transparent", color: tab === id ? T.ink : T.inkLight, transition: "all 0.18s", whiteSpace: "nowrap", flexShrink: 0, boxShadow: tab === id ? "0 1px 4px rgba(28,25,23,0.08)" : "none" }}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: `18px 15px calc(32px + env(safe-area-inset-bottom))` }}>

        {/* ════ TODAY ════ */}
        {tab === "today" && <>
          <StreakBadge streak={profile?.streakCount} T={T} />

          {/* Progress */}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkLight, fontWeight: 700, letterSpacing: "0.1em" }}>TODAY'S PROGRESS</span>
              <span style={{ fontFamily: T.fontMono, fontSize: 10, color: allDone ? T.green : T.inkMid, fontWeight: 700 }}>{completedCount}/{allTodayStepIds.length} {allDone ? "✓ All done!" : "steps"}</span>
            </div>
            <div style={{ background: T.bgSubtle, borderRadius: 99, height: 6, overflow: "hidden" }}>
              <div style={{ width: `${allTodayStepIds.length ? (completedCount / allTodayStepIds.length) * 100 : 0}%`, background: allDone ? T.green : T.accent, height: "100%", borderRadius: 99, transition: "width 0.5s ease" }} />
            </div>
          </div>

          {isSunday && <WeeklyReport skinLog={skinLog} inventory={inventory} T={T} />}

          <Divider label="☀ AM — PROTECT ONLY" color={T.gold} T={T} />
          {amSteps.map(s => <StepCard key={s.id} s={s} isAm />)}
          <div style={{ background: T.goldLight, border: `1px solid ${T.gold}55`, borderRadius: T.radiusSm, padding: "9px 13px", marginTop: 2, marginBottom: 4 }}>
            <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: "0.08em" }}>❌ DO NOT USE IN AM: </span>
            <span style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkMid }}>Serums · Moisturizers · Heavy layering</span>
          </div>

          <Divider label={`🌙 PM — ${todaySched.emoji} ${todaySched.label?.toUpperCase()}`} color={todaySched.color} T={T} />
          <div style={{ background: T.bgCard, border: `1.5px solid ${todaySched.color}44`, borderRadius: T.radiusLg, padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: dark ? "none" : "0 1px 4px rgba(28,25,23,0.05)" }}>
            <div>
              <div style={{ fontFamily: T.fontMono, fontSize: 9, color: todaySched.color, fontWeight: 700, letterSpacing: "0.09em", marginBottom: 4 }}>TONIGHT'S GOAL</div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 600, color: T.ink }}>{todaySched.goal}</div>
            </div>
            <span style={{ fontSize: 24 }}>{todaySched.emoji}</span>
          </div>
          {todayPMSteps.map(s => <StepCard key={s.id} s={s} isAm={false} />)}
          {(todaySched.footnotes || []).length > 0 && (
            <div style={{ marginTop: 10, background: T.goldLight, border: `1px solid ${T.gold}55`, borderRadius: T.radiusLg, padding: "12px 16px" }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>⚡ TONIGHT'S RULES</div>
              {todaySched.footnotes.map((fn, i) => (
                <div key={i} style={{ fontFamily: T.fontBody, fontSize: 12, color: T.inkMid, lineHeight: 1.65, marginBottom: i < todaySched.footnotes.length - 1 ? 4 : 0 }}>{fn}</div>
              ))}
            </div>
          )}
        </>}

        {/* ════ ROUTINE ════ */}
        {tab === "routine" && <>
          <Divider label="☀ AM ROUTINE (DAILY)" color={T.gold} T={T} action={{ label: "+ Add AM Step", onClick: () => { setNewAmStep({ step: "", product: "", note: "" }); setAddingAmStep(true); } }} />
          {amSteps.map(s => (
            <div key={s.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4 }}>{s.step}</div>
                <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: s.note ? 2 : 0 }}>{s.product}</div>
                {s.note && <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkMid }}>{s.note}</div>}
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => setEditAmStep({ ...s })} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkLight, fontSize: 16, padding: "0 4px" }}>✏</button>
                <button onClick={() => { setAmSteps(prev => prev.filter(x => x.id !== s.id)); showToast("Step removed"); }} style={{ background: T.redLight, border: "none", borderRadius: 7, padding: "3px 8px", cursor: "pointer", fontFamily: T.fontBody, fontSize: 11, color: T.red, fontWeight: 700 }}>✕</button>
              </div>
            </div>
          ))}

          <Divider label="🌙 PM WEEKLY SCHEDULE" color={T.accent} T={T} />
          {DAYS.map(day => <DayRoutineCard key={day} day={day} />)}

          <div style={{ marginTop: 18, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: "18px 20px", boxShadow: dark ? "none" : "0 2px 8px rgba(28,25,23,0.06)" }}>
            <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.accent, fontWeight: 700, letterSpacing: "0.13em", marginBottom: 8 }}>🔥 GOLDEN RULE</div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 17, fontWeight: 600, color: T.ink, fontStyle: "italic", marginBottom: 14, lineHeight: 1.4 }}>"AM = breathable skin. PM = one job only."</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {[["Full-face moisturizer", "❌ Never"], ["Cheeks/jaw moisturizer", "✔ Yes"], ["T-zone moisturizer", "✔ Residue only"], ["AM serums/actives", "❌ Never"]].map(([r, v]) => (
                <div key={r} style={{ background: T.bgSubtle, borderRadius: T.radiusSm, padding: "9px 12px" }}>
                  <div style={{ fontFamily: T.fontBody, fontSize: 10, color: T.inkLight, marginBottom: 3 }}>{r}</div>
                  <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 700, color: v.startsWith("✔") ? T.green : T.red }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* ════ INVENTORY ════ */}
        {tab === "inventory" && <>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
            {cats.map(c => (
              <button key={c} onClick={() => setFilterCat(c)} style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 600, padding: "6px 13px", borderRadius: 99, background: filterCat === c ? T.accent : T.bgCard, color: filterCat === c ? "#fff" : T.inkMid, border: `1px solid ${filterCat === c ? T.accent : T.border}`, cursor: "pointer", transition: "all 0.15s" }}>{c}</button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={() => { setNewItem({ name: "", category: "Serum", status: "In Use", level: 100, notes: "", expiry: "" }); setAddingItem(true); }} style={{ ...btnBase, background: T.accent, color: "#fff", fontSize: 13, padding: "9px 18px" }}>+ Add Product</button>
          </div>

          {filteredInv.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: T.inkLight, fontFamily: T.fontDisplay, fontSize: 16, fontStyle: "italic" }}>No products yet.</div>
          )}

          {filteredInv.map(item => {
            const sc = STATUS_COLORS[item.status] || STATUS_COLORS["Empty"];
            const es = expiryStatus(item.expiry);
            const showExpWarn = es && es !== "ok";
            const dLeft = daysUntilExpiry(item.expiry);
            const daysLeft = item.level > 0 && item.status === "In Use" ? Math.round(item.level / 2) : null;
            return (
              <div key={item.id} style={{ ...card, border: showExpWarn ? `1.5px solid ${dLeft < 0 ? T.red : T.gold}` : `1px solid ${T.border}`, background: T.bgCard }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: item.level > 0 && item.status !== "Wishlist" ? 10 : 0 }}>
                  <div style={{ flex: 1, paddingRight: 8 }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{ background: (CAT_COLORS[item.category] || "#e5e7eb") + "33", fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99, letterSpacing: "0.06em", color: T.inkMid }}>{item.category}</span>
                      <span style={{ background: sc.bg, color: sc.text, fontFamily: T.fontBody, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>● {item.status}</span>
                      {showExpWarn && <span style={{ background: dLeft < 0 ? T.redLight : T.goldLight, color: dLeft < 0 ? T.red : T.gold, fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{dLeft < 0 ? `❌ EXPIRED (${Math.abs(dLeft)}d ago)` : `⏰ ${dLeft}d left`}</span>}
                      {daysLeft && item.level <= 20 && <span style={{ background: T.redLight, color: T.red, fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>🛒 ~{daysLeft}d left</span>}
                    </div>
                    <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 600, color: T.ink }}>{item.name}</div>
                    {item.notes && <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkMid, marginTop: 2 }}>{item.notes}</div>}
                  </div>
                  <button onClick={() => setEditItem({ ...item })} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkLight, fontSize: 18, padding: "0 4px", flexShrink: 0 }}>✏</button>
                </div>
                {item.status !== "Wishlist" && item.level > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <LevelBar level={item.level} T={T} />
                    <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.inkLight, minWidth: 30 }}>{item.level}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </>}

        {/* ════ SKIN LOG ════ */}
        {tab === "log" && <>
          <button onClick={() => setShowLog(true)} style={{ ...btnBase, width: "100%", background: T.accent, color: "#fff", fontFamily: T.fontDisplay, fontSize: 16, fontStyle: "italic", marginBottom: 18 }}>
            + Log Today's Skin
          </button>
          {skinLog.length >= 3 && <WeeklyReport skinLog={skinLog} inventory={inventory} T={T} />}
          {skinLog.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: T.inkLight, fontFamily: T.fontDisplay, fontSize: 16, fontStyle: "italic" }}>No entries yet. Log your first day!</div>
          )}
          {skinLog.map(e => (
            <div key={e.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.inkLight }}>{e.date}</span>
                <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                  <span style={{ fontSize: 18 }}>{e.mood}</span>
                  <span style={{ fontFamily: T.fontBody, fontSize: 10, fontWeight: 600, background: T.bgSubtle, padding: "2px 9px", borderRadius: 99, color: T.inkMid }}>{e.oiliness}</span>
                </div>
              </div>
              {e.notes && <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink, lineHeight: 1.6 }}>{e.notes}</div>}
            </div>
          ))}
        </>}

        {/* ════ AI ADVISOR ════ */}
        {tab === "advisor" && (
          <AIAdvisor amSteps={amSteps} daily={daily} inventory={inventory} skinLog={skinLog} profile={profile} T={T} />
        )}
      </div>

      {/* ════ MODALS ════ */}
      {editAmStep && (
        <Modal title="Edit AM Step" onClose={() => setEditAmStep(null)} T={T}>
          <Field label="Step Label" value={editAmStep.step}    onChange={v => setEditAmStep(s => ({ ...s, step: v }))}    T={T} />
          <Field label="Product"    value={editAmStep.product} onChange={v => setEditAmStep(s => ({ ...s, product: v }))} T={T} />
          <Field label="Note"       value={editAmStep.note}    onChange={v => setEditAmStep(s => ({ ...s, note: v }))}    T={T} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={saveAmStep}   style={{ ...btnBase, flex: 1, background: T.accent,   color: "#fff" }}>Save</button>
            <button onClick={deleteAmStep} style={{ ...btnBase, flex: 1, background: T.redLight, color: T.red }}>Delete</button>
          </div>
        </Modal>
      )}

      {addingAmStep && (
        <Modal title="Add AM Step" onClose={() => setAddingAmStep(false)} T={T}>
          <div style={{ background: T.goldLight, border: `1px solid ${T.gold}55`, borderRadius: T.radiusSm, padding: "10px 13px", marginBottom: 16, fontFamily: T.fontBody, fontSize: 12, color: T.inkMid, lineHeight: 1.6 }}>
            ☀ AM steps = gentle + protective only. Cleansers, toners, mists, SPF. No actives.
          </div>
          <Field label="Step Label" value={newAmStep.step}    onChange={v => setNewAmStep(s => ({ ...s, step: v }))}    placeholder="e.g. Tone" T={T} />
          <Field label="Product"    value={newAmStep.product} onChange={v => setNewAmStep(s => ({ ...s, product: v }))} placeholder="e.g. Klairs Supple Prep Toner" T={T} />
          <Field label="Note"       value={newAmStep.note}    onChange={v => setNewAmStep(s => ({ ...s, note: v }))}    placeholder="e.g. Pat gently" T={T} />
          <button onClick={doAddAmStep} style={{ ...btnBase, width: "100%", background: T.accent, color: "#fff", marginTop: 8 }}>Add to AM Routine</button>
        </Modal>
      )}

      {editDay && (
        <Modal title={`Edit ${editDay._day} — ${editDay.label}`} onClose={() => setEditDay(null)} T={T}>
          <Field label="Night Label"    value={editDay.label}         onChange={v => setEditDay(d => ({ ...d, label: v }))}         T={T} />
          <Field label="Goal"           value={editDay.goal}          onChange={v => setEditDay(d => ({ ...d, goal: v }))}          T={T} />
          <Field label="Active Product" value={editDay.activeProduct} onChange={v => setEditDay(d => ({ ...d, activeProduct: v }))} T={T} />
          <Field label="Active Note"    value={editDay.activeNote}    onChange={v => setEditDay(d => ({ ...d, activeNote: v }))}    T={T} />
          <Field label="Footnotes (one per line)" type="textarea" value={editDay.footnoteText} onChange={v => setEditDay(d => ({ ...d, footnoteText: v }))} T={T} />
          <Field label="Weekly Add-on Product" value={editDay.addonProduct} onChange={v => setEditDay(d => ({ ...d, addonProduct: v }))} placeholder="Optional" T={T} />
          <Field label="Weekly Add-on Label"   value={editDay.addonLabel}   onChange={v => setEditDay(d => ({ ...d, addonLabel: v }))}   placeholder="Optional" T={T} />
          <Field label="Weekly Add-on Note"    value={editDay.addonNote}    onChange={v => setEditDay(d => ({ ...d, addonNote: v }))}    placeholder="Optional" T={T} />
          <button onClick={saveDay} style={{ ...btnBase, width: "100%", background: T.accent, color: "#fff", marginTop: 8 }}>Save</button>
        </Modal>
      )}

      {addingPmStep && (
        <Modal title={`Add Step — ${addingPmStep} PM`} onClose={() => setAddingPmStep(null)} T={T}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: T.inkLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: T.fontBody }}>Position</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[["prefix", "Before Active"], ["suffix", "After Sealing"]].map(([val, lbl]) => (
                <button key={val} onClick={() => setNewPmStep(s => ({ ...s, type: val }))} style={{ flex: 1, padding: "9px", borderRadius: T.radiusSm, cursor: "pointer", border: `2px solid ${newPmStep.type === val ? T.accent : T.border}`, background: newPmStep.type === val ? T.accentLight : T.bgSubtle, fontFamily: T.fontBody, fontSize: 12, fontWeight: 600, color: newPmStep.type === val ? T.accent : T.inkMid }}>{lbl}</button>
              ))}
            </div>
          </div>
          <Field label="Step Label"   value={newPmStep.step}    onChange={v => setNewPmStep(s => ({ ...s, step: v }))}    placeholder="e.g. Essence" T={T} />
          <Field label="Product Name" value={newPmStep.product} onChange={v => setNewPmStep(s => ({ ...s, product: v }))} placeholder="e.g. COSRX Snail Mucin 96" T={T} />
          <Field label="Note"         value={newPmStep.note}    onChange={v => setNewPmStep(s => ({ ...s, note: v }))}    placeholder="Optional" T={T} />
          <button onClick={() => doAddPmStep(addingPmStep)} style={{ ...btnBase, width: "100%", background: T.accent, color: "#fff", marginTop: 8 }}>Add to {addingPmStep} Routine</button>
        </Modal>
      )}

      {editItem && (
        <Modal title="Edit Product" onClose={() => setEditItem(null)} T={T}>
          <Field label="Product Name" value={editItem.name}     onChange={v => setEditItem(i => ({ ...i, name: v }))}                                       T={T} />
          <Field label="Category"     value={editItem.category} onChange={v => setEditItem(i => ({ ...i, category: v }))} options={["Cleanser","Prep","Serum","Moisturizer","Mask","Sunscreen","To Buy","Other"]} T={T} />
          <Field label="Status"       value={editItem.status}   onChange={v => setEditItem(i => ({ ...i, status: v }))}   options={["In Use","Sealed/Backup","Paused","Low Stock","Empty","Wishlist"]}            T={T} />
          <Field label="Level (%)"    value={editItem.level}    onChange={v => setEditItem(i => ({ ...i, level: Number(v) }))} type="number"                 T={T} />
          <Field label="Expiry Date"  value={editItem.expiry}   onChange={v => setEditItem(i => ({ ...i, expiry: v }))}   type="date"                        T={T} />
          <Field label="Notes"        value={editItem.notes}    onChange={v => setEditItem(i => ({ ...i, notes: v }))}                                       T={T} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={saveItem}   style={{ ...btnBase, flex: 1, background: T.accent,   color: "#fff" }}>Save</button>
            <button onClick={deleteItem} style={{ ...btnBase, flex: 1, background: T.redLight, color: T.red }}>Remove</button>
          </div>
        </Modal>
      )}

      {addingItem && (
        <Modal title="Add Product" onClose={() => setAddingItem(false)} T={T}>
          <Field label="Product Name" value={newItem.name}     onChange={v => setNewItem(i => ({ ...i, name: v }))}     placeholder="Product name"             T={T} />
          <Field label="Category"     value={newItem.category} onChange={v => setNewItem(i => ({ ...i, category: v }))} options={["Cleanser","Prep","Serum","Moisturizer","Mask","Sunscreen","To Buy","Other"]} T={T} />
          <Field label="Status"       value={newItem.status}   onChange={v => setNewItem(i => ({ ...i, status: v }))}   options={["In Use","Sealed/Backup","Paused","Low Stock","Empty","Wishlist"]}            T={T} />
          <Field label="Level (%)"    value={newItem.level}    onChange={v => setNewItem(i => ({ ...i, level: Number(v) }))} type="number"                    T={T} />
          <Field label="Expiry Date"  value={newItem.expiry}   onChange={v => setNewItem(i => ({ ...i, expiry: v }))}   type="date"                           T={T} />
          <Field label="Notes"        value={newItem.notes}    onChange={v => setNewItem(i => ({ ...i, notes: v }))}    placeholder="Optional"                T={T} />
          <button onClick={doAddItem} style={{ ...btnBase, width: "100%", background: T.accent, color: "#fff", marginTop: 8 }}>Add Product</button>
        </Modal>
      )}

      {showLog && (
        <Modal title="Log Today's Skin" onClose={() => setShowLog(false)} T={T}>
          <Field label="Mood"            value={logForm.mood}     onChange={v => setLogForm(l => ({ ...l, mood: v }))}     options={["😊", "😐", "😞", "🥵", "😴"]}                       T={T} />
          <Field label="T-Zone Oiliness" value={logForm.oiliness} onChange={v => setLogForm(l => ({ ...l, oiliness: v }))} options={["Very Oily", "Oily", "Normal", "Balanced", "Dry"]} T={T} />
          <Field label="Notes" type="textarea" value={logForm.notes} onChange={v => setLogForm(l => ({ ...l, notes: v }))} placeholder="Breakouts, reactions, texture…" T={T} />
          <button onClick={saveLog} style={{ ...btnBase, width: "100%", background: T.accent, color: "#fff" }}>Save Entry</button>
        </Modal>
      )}

      {toast && <Toast msg={toast} T={T} onDone={() => setToast(null)} />}
    </div>
  );
}
