// src/App.jsx — Skincare Dashboard v3.0
// Design language: Apothecary minimal · light + dark mode · terracotta accent · Cormorant serif

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import React from "react";
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
  l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght=0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;600&display=swap";
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
      { id: "am1", step: "Cleanse",  product: "CeraVe Foaming Facial Cleanser",        note: "Gel cleanser — removes excess oil" },
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
      { id: "am1", step: "Cleanse",  product: "Avène Extremely Gentle Cleanser Lotion", no-rinse — ultra gentle" },
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
  { id: 1,  name: "Neutrogena Hydro Boost Cleanser",             category: "Cleanser",    status: "In Use",    level: 90,  notes: "Brand new", expiry: "" },
  { id: 2,  name: "Rose Water Mist",                               category: "Prep",        status: "In Use",    level: 60,  notes: "", expiry: "" },
  { id: 3,  name: "Hyphen Rice Water Brightening Pads",            category: "Prep",        status: "In Use",    level: 70,  notes: "1 almost full + 2 unopened packs", expiry: "" },
  { id: 6,  name: "Hyphen Double Shot Radiance Lift Serum",        category: "Serum",        status: "In Use",    level: 55,  notes: "1 almost full + 1 unopened backup", expiry: "" },
  { id: 7,  name: "The Ordinary Niacinamide 10% + Zinc 1%",        category: "Serum",        status: "In Use",    level: 45,  notes: "", expiry: "" },
  { id: 9,  name: "Elizabeth Arden Ceramide Capsules (Gold)",      category: "Serum",        status: "In Use",    level: 55,  notes: "More than half left", expiry: "" },
  { id: 13, name: "TO Natural Moisturizing Factors + Rice Lipids", category: "Moisturizer", status: "In Use",    level: 65,  notes: "Rich texture", expiry: "" },
  { id: 17, name: "Innisfree Volcanic Clay Mask",                  category: "Mask",        status: "In Use",    level: 30,  notes: "Almost full", expiry: "" },
  { id: 18, name: "Suroskie Rose Collagen Sheet Mask",              category: "Mask",        status: "Low Stock", level: 5,   notes: "Only 1 sheet left!", expiry: "" },
  { id: 19, name: "Hyphen All I Need SPF 50 PA++++",               category: "Sunscreen",   status: "In Use",    level: 50,  notes: "1 almost full + 1 unopened", expiry: "" },
  { id: 20, name: "Hyphen Advanced De-Pigmentation Serum",          category: "To Buy",      status: "Wishlist",  level: 0,   notes: "India window — fills Alpha Arbutin gap", expiry: "" },
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

// ── AI Advisor (Named Export) ─────────────────────────────────────────────
export function AIAdvisor({ amSteps, daily, inventory, skinLog, profile, T }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

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

      const safeAm = Array.isArray(amSteps) ? amSteps.map(s => s?.product || "") : [];
      const safeDaily = daily ? Object.entries(daily).map(([day, d]) => ({ day, active: d?.active?.product || "" })) : [];
      const safeInventory = Array.isArray(inventory) ? inventory.map(i => ({ name: i?.name || "", status: i?.status || "", level: (i?.level || 0) + "%" })) : [];
      const safeLog = Array.isArray(skinLog) ? skinLog.slice(0, 5).map(e => ({ date: e?.date || "", mood: e?.mood || "", oiliness: e?.oiliness || "" })) : [];

      const systemPrompt = [
        "You are a knowledgeable, friendly skincare advisor. You have full context about this user's routine, inventory, and skin log.",
        `USER PROFILE: Skin type: ${profile?.skinType || "Not specified"}, Name: ${profile?.displayName || "User"}, Streak: ${profile?.streakCount || 0} days`,
        `AM ROUTINE: ${JSON.stringify(safeAm)}`,
        `PM SCHEDULE: ${JSON.stringify(safeDaily)}`,
        `INVENTORY: ${JSON.stringify(safeInventory)}`,
        `RECENT LOG: ${JSON.stringify(safeLog)}`,
        "Give concise, personalised advice. Keep responses short and mobile-friendly. Be warm, not clinical."
      ].join("\n");

      const targetUrl = window.location.origin + "/api/chat";

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          system: systemPrompt,
          messages: historyPayload,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMsg = "Unknown API Error";
        try {
          const errJson = JSON.parse(errorText);
          errorMsg = errJson.error || errorMsg;
        } catch {
          errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();

      if (data.error) {
        setMessages(prev => [...prev, { role: "assistant", content: "Error: " + data.error }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.text }]);
      }
    } catch (err) {
      console.error("Fetch Exception Captured:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Connection issue: " + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "What's causing my oily T-zone?", 
    "Can I add Vitamin C to my routine?", 
    "Is my routine good for PIH?", 
    "What should I restock first?"
  ];

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

// ── Main App (Default Export) ─────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem("sc-theme") === "dark");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("routine");

  // Local state contexts for standard tracking loops
  const [amSteps, setAmSteps] = useState(MY_AM_DEFAULT);
  const [daily, setDaily] = useState(MY_DAILY_DEFAULT);
  const [inventory, setInventory] = useState(MY_INVENTORY_DEFAULT);
  const [skinLog, setSkinLog] = useState([]);

  const T = useMemo(() => makeTokens(dark), [dark]);

  const toggleDark = () => {
    setDark(prev => {
      const next = !prev;
      localStorage.setItem("sc-theme", next ? "dark" : "light");
      return next;
    });
  };

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const p = await loadProfile(u.uid);
        if (p) {
          setProfile(p);
          const am = await loadUserData(u.uid, "amSteps"); if (am) setAmSteps(am);
          const dy = await loadUserData(u.uid, "daily");   if (dy) setDaily(dy);
          const iv = await loadUserData(u.uid, "inventory"); if (iv) setInventory(iv);
          const sl = await loadUserData(u.uid, "skinLog");   if (sl) setSkinLog(sl);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const handleOnboardingComplete = (p, am, dy) => {
    setProfile(p);
    setAmSteps(am);
    setDaily(dy);
    setInventory([]);
    setSkinLog([]);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100svh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.inkLight, fontFamily: T.fontMono, fontSize: 11 }}>
        LOADING APOTHECARY CONTEXT...
      </div>
    );
  }

  if (!user) return <SignIn dark={dark} toggleDark={toggleDark} />;
  if (!profile) return <Onboarding user={user} onComplete={handleOnboardingComplete} dark={dark} toggleDark={toggleDark} />;

  return (
    <div style={{ minHeight: "100svh", background: T.bg, color: T.ink, fontFamily: T.fontBody, transition: "background 0.3s", paddingBottom: 60 }}>
      <header style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}`, background: T.bgCard }}>
        <div>
          <h1 style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 600, color: T.ink, margin: 0, fontStyle: "italic" }}>Apothecary Skin</h1>
          <p style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkLight, margin: "2px 0 0", letterSpacing: "0.05em" }}>V3.0 // {TODAY.toUpperCase()}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <DarkToggle dark={dark} toggle={toggleDark} />
          <button onClick={signOutUser} style={{ background: "none", border: `1px solid ${T.border}`, padding: "6px 12px", borderRadius: T.radiusSm, color: T.inkMid, fontFamily: T.fontBody, fontSize: 12, cursor: "pointer" }}>Sign Out</button>
        </div>
      </header>

      <main style={{ maxWidth: 540, margin: "0 auto", padding: "20px 16px" }}>
        <StreakBadge streak={profile?.streakCount} T={T} />
        <WeeklyReport skinLog={skinLog} inventory={inventory} T={T} />

        {/* Tab Switcher Layout */}
        <div style={{ display: "flex", background: T.bgSubtle, borderRadius: T.radius, padding: 4, marginBottom: 20 }}>
          {["routine", "inventory", "advisor"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: T.radiusSm, background: activeTab === tab ? T.bgCard : "none", color: activeTab === tab ? T.accent : T.inkMid, fontFamily: T.fontBody, fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s" }}>
              {tab === "advisor" ? "AI Advisor" : tab}
            </button>
          ))}
        </div>

        {/* Tab Views Render Blocks */}
        {activeTab === "routine" && (
          <div style={{ background: T.bgCard, padding: 16, borderRadius: T.radiusLg, border: `1px solid ${T.border}` }}>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: 20, margin: "0 0 12px", fontStyle: "italic" }}>Today's Skincare Sequence</h2>
            <Divider label="AM ROUTINE" color={T.accent} T={T} />
            {amSteps.map((s, idx) => (
              <div key={s.id || idx} style={{ display: "flex", gap: 12, marginBottom: 10, paddingBottom: 10, borderBottom: idx !== amSteps.length - 1 ? `1px dashed ${T.border}` : "none" }}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.inkLight }}>{idx + 1}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.product}</div>
                  <div style={{ fontSize: 12, color: T.inkLight }}>{s.step} {s.note && `· ${s.note}`}</div>
                </div>
              </div>
            ))}
            
            <Divider label={`${TODAY.toUpperCase()} PM SCHEDULE`} color={T.purple} T={T} />
            {PM_BASE_PREFIX.map((s, idx) => (
              <div key={s.id || idx} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.inkLight }}>P-{idx + 1}</span>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, color: T.inkMid }}>{s.product}</div>
                  <div style={{ fontSize: 11, color: T.inkLight }}>{s.step}</div>
                </div>
              </div>
            ))}
            <div style={{ background: T.bgSubtle, padding: 12, borderRadius: T.radius, margin: "10px 0", borderLeft: `4px solid ${daily[TODAY]?.color || T.accent}` }}>
              <div style={{ fontSize: 11, fontFamily: T.fontMono, fontWeight: 700, color: daily[TODAY]?.color }}>{daily[TODAY]?.label.toUpperCase()}</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginTop: 2 }}>{daily[TODAY]?.active?.product}</div>
              <div style={{ fontSize: 12, color: T.inkMid }}>{daily[TODAY]?.active?.step} · {daily[TODAY]?.active?.note}</div>
            </div>
            {PM_BASE_SUFFIX.map((s, idx) => (
              <div key={s.id || idx} style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.inkLight }}>S-{idx + 1}</span>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, color: T.inkMid }}>{s.product}</div>
                  <div style={{ fontSize: 11, color: T.inkLight }}>{s.step} · {s.note}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "inventory" && (
          <div style={{ background: T.bgCard, padding: 16, borderRadius: T.radiusLg, border: `1px solid ${T.border}` }}>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: 20, margin: "0 0 16px", fontStyle: "italic" }}>Product Vault</h2>
            {inventory.map((item) => (
              <div key={item.id} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 10, background: CAT_COLORS[item.category] + "33", color: T.ink, padding: "2px 6px", borderRadius: 4, marginRight: 6, fontFamily: T.fontMono, fontWeight: 600 }}>{item.category.toUpperCase()}</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: T.ink }}>{item.name}</span>
                  </div>
                  <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 99, background: STATUS_COLORS[item.status]?.bg, color: STATUS_COLORS[item.status]?.text, fontWeight: 600 }}>{item.status}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}><LevelBar level={item.level} T={T} /></div>
                  <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.inkLight, minWidth: 28, textAlign: "right" }}>{item.level}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "advisor" && (
          <div style={{ background: T.bgCard, padding: 16, borderRadius: T.radiusLg, border: `1px solid ${T.border}` }}>
            <AIAdvisor amSteps={amSteps} daily={daily} inventory={inventory} skinLog={skinLog} profile={profile} T={T} />
          </div>
        )}
      </main>
    </div>
  );
}
