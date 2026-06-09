// src/App.jsx
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  auth, db,
  signInWithGoogle, signOutUser, onAuthStateChanged,
  loadUserData, saveUserData, loadProfile, saveProfile,
} from "./firebase";

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
      { id: "am1", step: "Cleanse",  product: "CeraVe Foaming Facial Cleanser",    note: "Gel cleanser — removes excess oil" },
      { id: "am2", step: "Tone",     product: "Klairs Supple Preparation Toner",   note: "Lightweight — no alcohol" },
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
      { id: "am1", step: "Cleanse",  product: "Cetaphil Gentle Skin Cleanser",      note: "Works for both zones" },
      { id: "am2", step: "Prep",     product: "Rose Water Mist",                    note: "Optional light mist" },
      { id: "am3", step: "Protect",  product: "Hyphen All I Need SPF 50 PA++++",   note: "FINAL step — nothing after this" },
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

function buildDailyForSkinType(type) {
  const base = {
    Mon: { label: "Barrier Night", color: "#3b82f6", bg: "#eff6ff", emoji: "🟦", goal: "Repair + strengthen barrier", active: { step: "Target", product: "Ceramide Capsules or Repair Serum", note: "Barrier restoration" }, footnotes: ["⚠ No actives tonight — barrier nights only."], weeklyAddon: null },
    Tue: { label: "Hydration Night", color: "#22c55e", bg: "#f0fdf4", emoji: "🟩", goal: "Deep hydration reset", active: { step: "Target", product: "Hyaluronic Acid Serum", note: "Full face — apply to damp skin" }, footnotes: ["💧 HA works best on slightly damp skin."], weeklyAddon: null },
    Wed: { label: "Treatment Night", color: "#8b5cf6", bg: "#faf5ff", emoji: "🟪", goal: "Targeted treatment", active: { step: "Target", product: "Niacinamide 10% + Zinc", note: "T-zone focus" }, footnotes: ["⚠ One active only tonight."], weeklyAddon: null },
    Thu: { label: "Pigment Night", color: "#eab308", bg: "#fefce8", emoji: "🟨", goal: "Fade dark spots + even tone", active: { step: "Target", product: "Vitamin C Serum or Brightening Serum", note: "PIH fading — full face" }, footnotes: ["⚠ Use brightening serum only tonight."], weeklyAddon: null },
    Fri: { label: "Barrier Night", color: "#3b82f6", bg: "#eff6ff", emoji: "🟦", goal: "Recovery + hydration rebuild", active: { step: "Target", product: "Ceramide Capsules or Repair Serum", note: "Barrier restoration" }, footnotes: ["⚠ No actives tonight — barrier nights only."], weeklyAddon: null },
    Sat: { label: "Reset Night", color: "#a855f7", bg: "#faf5ff", emoji: "🟪", goal: "Hydration reset + deep pore clean", active: { step: "Target", product: "Hyaluronic Acid 2% + B5", note: "Hydration reset — full face" }, footnotes: ["⚠ HA only tonight.", "🗓 Clay mask add-on every 10–14 days."], weeklyAddon: { label: "Clay Cleanse (every 10–14 days)", product: "Clay Mask of choice", note: "T-zone only" } },
    Sun: { label: "Pigment Night", color: "#eab308", bg: "#fefce8", emoji: "🟨", goal: "Consistent pigmentation fading", active: { step: "Target", product: "Vitamin C Serum or Brightening Serum", note: "PIH fading — full face" }, footnotes: ["⚠ Brightening serum only tonight."], weeklyAddon: null },
  };
  return base;
}

// ── My personal defaults (for existing users migrating) ───────────────────
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
  Mon: { label: "Barrier Night", color: "#3b82f6", bg: "#eff6ff", emoji: "🟦", goal: "Repair + strengthen barrier", active: { step: "Target", product: "Elizabeth Arden Ceramide Capsules (Gold or Silver)", note: "Barrier restoration" }, footnotes: ["⚠ No actives tonight — barrier nights only. No Niacinamide, no Double Shot.", "🧴 Moisturizer on cheeks/jaw only. T-zone gets fingertip residue only."], weeklyAddon: null },
  Tue: { label: "Oil Control Night", color: "#22c55e", bg: "#f0fdf4", emoji: "🟩", goal: "Reduce sebum + control pores", active: { step: "Target", product: "The Ordinary Niacinamide 10% + Zinc 1%", note: "T-zone focus only" }, footnotes: ["⚠ Niacinamide only tonight — do not combine with Double Shot.", "🧴 Moisturizer on cheeks/jaw only."], weeklyAddon: null },
  Wed: { label: "Oil Control + Pore Reset", color: "#22c55e", bg: "#f0fdf4", emoji: "🟩", goal: "Decongest + refine pores", active: { step: "Target", product: "The Ordinary Niacinamide 10% + Zinc 1%", note: "T-zone focus" }, footnotes: ["🗓 Weekly add-on: Rice Water Pads MUST go BEFORE Niacinamide.", "📍 Pads are T-zone only.", "🧴 Moisturizer on cheeks/jaw only."], weeklyAddon: { label: "Pore Reset", product: "Hyphen Rice Water Brightening Pads", note: "T-zone only — apply BEFORE Niacinamide" } },
  Thu: { label: "Pigment Night", color: "#eab308", bg: "#fefce8", emoji: "🟨", goal: "Fade PIH + even skin tone", active: { step: "Target", product: "Hyphen Double Shot Radiance Lift Serum", note: "PIH fading — full face" }, footnotes: ["⚠ Double Shot ONLY tonight — no Niacinamide alongside.", "🧴 Moisturizer on cheeks/jaw only."], weeklyAddon: null },
  Fri: { label: "Barrier Night", color: "#3b82f6", bg: "#eff6ff", emoji: "🟦", goal: "Recovery + hydration rebuild", active: { step: "Target", product: "Elizabeth Arden Ceramide Capsules (Gold or Silver)", note: "Barrier restoration" }, footnotes: ["⚠ No actives tonight — barrier nights only.", "🧴 Moisturizer on cheeks/jaw only."], weeklyAddon: null },
  Sat: { label: "Reset Night", color: "#a855f7", bg: "#faf5ff", emoji: "🟪", goal: "Hydration reset + deep pore clean", active: { step: "Target", product: "The Ordinary Hyaluronic Acid 2% + B5", note: "Hydration reset — full face" }, footnotes: ["⚠ HA only tonight.", "🗓 Clay Mask add-on (T-zone only) every 10–14 days."], weeklyAddon: { label: "Clay Cleanse (every 10–14 days)", product: "Innisfree Volcanic Clay Mask", note: "T-zone only" } },
  Sun: { label: "Pigment Night", color: "#eab308", bg: "#fefce8", emoji: "🟨", goal: "Consistent pigmentation fading", active: { step: "Target", product: "Hyphen Double Shot Radiance Lift Serum", note: "PIH fading — full face" }, footnotes: ["⚠ Double Shot ONLY tonight — no Niacinamide alongside.", "🧴 Moisturizer on cheeks/jaw only."], weeklyAddon: null },
};
const MY_INVENTORY_DEFAULT = [
  { id: 1,  name: "Neutrogena Hydro Boost Cleanser",               category: "Cleanser",    status: "In Use",        level: 90,  notes: "Brand new", expiry: "" },
  { id: 2,  name: "Rose Water Mist",                               category: "Prep",        status: "In Use",        level: 60,  notes: "", expiry: "" },
  { id: 3,  name: "Hyphen Rice Water Brightening Pads",            category: "Prep",        status: "In Use",        level: 70,  notes: "1 almost full + 2 unopened packs", expiry: "" },
  { id: 6,  name: "Hyphen Double Shot Radiance Lift Serum",        category: "Serum",       status: "In Use",        level: 55,  notes: "1 almost full + 1 unopened backup", expiry: "" },
  { id: 7,  name: "The Ordinary Niacinamide 10% + Zinc 1%",        category: "Serum",       status: "In Use",        level: 45,  notes: "", expiry: "" },
  { id: 9,  name: "Elizabeth Arden Ceramide Capsules (Gold)",      category: "Serum",       status: "In Use",        level: 55,  notes: "More than half left", expiry: "" },
  { id: 13, name: "TO Natural Moisturizing Factors + Rice Lipids", category: "Moisturizer", status: "In Use",        level: 65,  notes: "Rich texture", expiry: "" },
  { id: 17, name: "Innisfree Volcanic Clay Mask",                  category: "Mask",        status: "In Use",        level: 30,  notes: "Almost full", expiry: "" },
  { id: 18, name: "Suroskie Rose Collagen Sheet Mask",             category: "Mask",        status: "Low Stock",     level: 5,   notes: "Only 1 sheet left!", expiry: "" },
  { id: 19, name: "Hyphen All I Need SPF 50 PA++++",               category: "Sunscreen",   status: "In Use",        level: 50,  notes: "1 almost full + 1 unopened", expiry: "" },
  { id: 20, name: "Hyphen Advanced De-Pigmentation Serum",         category: "To Buy",      status: "Wishlist",      level: 0,   notes: "India window — fills Alpha Arbutin gap", expiry: "" },
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
  return todayProds.some(tp => {
    const words = n.split(/\s+/).filter(w => w.length > 3);
    return words.some(w => tp.includes(w));
  });
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

// ── Design tokens ─────────────────────────────────────────────────────────
const T = {
  font:  "'Fraunces',Georgia,serif",
  sans:  "'DM Sans',system-ui,sans-serif",
  mono:  "'DM Mono','Courier New',monospace",
  dark:  "#1c1917",
  muted: "#78716c",
  brdr:  "#e7e5e4",
  gold:  "#f59e0b",
  green: "#10b981",
  bg:    "#fafaf9",
};

// ── Sub-components ────────────────────────────────────────────────────────
function LevelBar({ level }) {
  const c = level > 60 ? "#4ade80" : level > 25 ? "#fbbf24" : "#f87171";
  return (
    <div style={{ background: "#e2e8f0", borderRadius: 99, height: 6, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, level)}%`, background: c, height: "100%", borderRadius: 99, transition: "width 0.4s" }} />
    </div>
  );
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.72)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "22px 22px 32px", width: "100%", maxWidth: 540, maxHeight: "88vh", overflowY: "auto", paddingBottom: "max(32px, env(safe-area-inset-bottom))" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: "#e2e8f0", borderRadius: 99, margin: "0 auto 18px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: T.font, fontSize: 17, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8", padding: "4px 8px" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", options, placeholder }) {
  const s = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontFamily: "inherit", fontSize: 16, background: "#f8fafc", outline: "none", boxSizing: "border-box", color: T.dark, WebkitAppearance: "none" };
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label>
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

function Divider({ label, color, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 11px" }}>
      <span style={{ fontFamily: T.mono, fontSize: 10, color, fontWeight: 700, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: T.brdr }} />
      {action && (
        <button onClick={action.onClick} style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 700, color: action.color || color, background: (action.color || color) + "18", border: `1px solid ${(action.color || color)}44`, borderRadius: 99, padding: "3px 10px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)", background: T.dark, color: "#fff", fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: "10px 20px", borderRadius: 99, zIndex: 200, pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
      {msg}
    </div>
  );
}

// ── Onboarding screen ─────────────────────────────────────────────────────
function Onboarding({ user, onComplete }) {
  const [chosen, setChosen] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    if (!chosen) return;
    setSaving(true);
    const template = SKIN_TEMPLATES[chosen];
    const profile = {
      displayName: user.displayName,
      photoURL: user.photoURL,
      skinType: chosen,
      createdAt: new Date().toISOString(),
      streakCount: 0,
      lastCompletedDate: null,
    };
    await saveProfile(user.uid, profile);
    await saveUserData(user.uid, "amSteps",   template.am);
    await saveUserData(user.uid, "daily",     template.daily);
    await saveUserData(user.uid, "inventory", []);
    await saveUserData(user.uid, "skinLog",   []);
    await saveUserData(user.uid, "checked",   { date: TODAY_DATE, steps: {} });
    onComplete(profile, template.am, template.daily);
  };

  return (
    <div style={{ minHeight: "100svh", background: T.dark, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');`}</style>
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: "#a8a29e", letterSpacing: "0.16em", marginBottom: 8, textAlign: "center" }}>WELCOME, {(user.displayName || "").split(" ")[0].toUpperCase()}</div>
        <div style={{ fontFamily: T.font, fontSize: 26, fontWeight: 700, color: "#fff", fontStyle: "italic", textAlign: "center", marginBottom: 6 }}>What's your skin type?</div>
        <div style={{ fontFamily: T.sans, fontSize: 13, color: "#a8a29e", textAlign: "center", marginBottom: 28 }}>We'll build your starter routine — you can customise everything later.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {Object.entries(SKIN_TEMPLATES).map(([key, tmpl]) => (
            <button key={key} onClick={() => setChosen(key)} style={{
              background: chosen === key ? "#fff" : "#292524",
              border: `2px solid ${chosen === key ? "#fff" : "#44403c"}`,
              borderRadius: 14, padding: "14px 18px", cursor: "pointer", textAlign: "left",
              transition: "all 0.15s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{tmpl.emoji}</span>
                <div>
                  <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 700, color: chosen === key ? T.dark : "#fff", marginBottom: 2 }}>{tmpl.label}</div>
                  <div style={{ fontFamily: T.sans, fontSize: 11, color: chosen === key ? T.muted : "#a8a29e" }}>{tmpl.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <button onClick={handleStart} disabled={!chosen || saving} style={{
          width: "100%", padding: "14px", borderRadius: 14, border: "none", cursor: chosen ? "pointer" : "not-allowed",
          background: chosen ? T.gold : "#44403c", color: chosen ? T.dark : "#78716c",
          fontFamily: T.font, fontSize: 16, fontWeight: 700, fontStyle: "italic",
          transition: "all 0.15s",
        }}>
          {saving ? "Building your routine…" : "Start my routine →"}
        </button>
      </div>
    </div>
  );
}

// ── Sign-in screen ────────────────────────────────────────────────────────
function SignIn() {
  const [loading, setLoading] = useState(false);
  const handleSignIn = async () => {
    setLoading(true);
    try { await signInWithGoogle(); }
    catch (e) { console.error(e); setLoading(false); }
  };
  return (
    <div style={{ minHeight: "100svh", background: T.dark, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');`}</style>
      <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: "#a8a29e", letterSpacing: "0.18em", marginBottom: 12 }}>SUMMER 2026</div>
        <div style={{ fontFamily: T.font, fontSize: 32, fontWeight: 700, color: "#fff", fontStyle: "italic", marginBottom: 8, lineHeight: 1.2 }}>Your personal<br/>skin dashboard</div>
        <div style={{ fontFamily: T.sans, fontSize: 13, color: "#a8a29e", marginBottom: 40, lineHeight: 1.6 }}>Track your routine, inventory, and skin — privately. Share the app with friends; everyone gets their own space.</div>
        <button onClick={handleSignIn} disabled={loading} style={{
          width: "100%", padding: "15px", borderRadius: 14, border: "none", cursor: "pointer",
          background: "#fff", color: T.dark, fontFamily: T.sans, fontSize: 15, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.3z"/><path fill="#34A853" d="M24 48c6.6 0 12.2-2.2 16.2-6l-7.9-6c-2.2 1.5-5 2.3-8.3 2.3-6.4 0-11.8-4.3-13.7-10.1H2.2v6.2C6.2 42.6 14.5 48 24 48z"/><path fill="#FBBC05" d="M10.3 28.2c-.5-1.5-.8-3-.8-4.6s.3-3.2.8-4.6v-6.2H2.2C.8 16.1 0 19.9 0 23.6s.8 7.5 2.2 10.8l8.1-6.2z"/><path fill="#EA4335" d="M24 9.5c3.6 0 6.8 1.2 9.3 3.6l7-7C36.2 2.2 30.6 0 24 0 14.5 0 6.2 5.4 2.2 13.4l8.1 6.2C12.2 13.8 17.6 9.5 24 9.5z"/></svg>
          {loading ? "Signing in…" : "Continue with Google"}
        </button>
        <div style={{ fontFamily: T.sans, fontSize: 11, color: "#57534e", marginTop: 18, lineHeight: 1.6 }}>Your data is private. Friends who use this app get their own separate space — nobody can see anyone else's routine.</div>
      </div>
    </div>
  );
}

// ── Weekly Report ─────────────────────────────────────────────────────────
function WeeklyReport({ skinLog, inventory }) {
  const today = new Date();
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
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
    <div style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", borderRadius: 16, padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ fontFamily: T.mono, fontSize: 9, color: "#a5b4fc", fontWeight: 700, letterSpacing: "0.14em", marginBottom: 10 }}>📊 THIS WEEK'S REPORT</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: "#a5b4fc", marginBottom: 4 }}>ENTRIES</div>
          <div style={{ fontFamily: T.font, fontSize: 22, fontWeight: 700, color: "#fff" }}>{weekLogs.length}</div>
          <div style={{ fontFamily: T.sans, fontSize: 10, color: "#a5b4fc" }}>days logged</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: "#a5b4fc", marginBottom: 4 }}>MOOD AVG</div>
          <div style={{ fontFamily: T.font, fontSize: 22, fontWeight: 700, color: "#fff" }}>{moodEmoji}</div>
          <div style={{ fontFamily: T.sans, fontSize: 10, color: "#a5b4fc" }}>{avgMood >= 4 ? "Great week" : avgMood >= 2.5 ? "So-so" : "Rough week"}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: "#a5b4fc", marginBottom: 4 }}>OILINESS</div>
          <div style={{ fontFamily: T.font, fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 4 }}>{oilText}</div>
          <div style={{ fontFamily: T.sans, fontSize: 10, color: "#a5b4fc" }}>avg trend</div>
        </div>
      </div>
      {lowStock.length > 0 && (
        <div style={{ marginTop: 10, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ fontFamily: T.sans, fontSize: 11, color: "#fca5a5", fontWeight: 700 }}>
            🛒 Restock soon: {lowStock.map(i => i.name.split(" ").slice(0,2).join(" ")).join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Streak badge ──────────────────────────────────────────────────────────
function StreakBadge({ streak }) {
  if (!streak || streak < 2) return null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: streak >= 7 ? "#7c3aed" : T.gold + "22", border: `1px solid ${streak >= 7 ? "#7c3aed" : T.gold}`, borderRadius: 99, padding: "4px 12px", marginBottom: 14 }}>
      <span style={{ fontSize: 14 }}>{streak >= 7 ? "🔥" : "⚡"}</span>
      <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: streak >= 7 ? "#c4b5fd" : T.gold }}>{streak} day streak</span>
    </div>
  );
}

// ── AI Advisor ────────────────────────────────────────────────────────────
function AIAdvisor({ amSteps, daily, inventory, skinLog, profile }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const systemPrompt = `You are a knowledgeable, friendly skincare advisor embedded in a personal skincare dashboard app. You have full context about this user's routine, inventory, and skin log.

USER PROFILE:
- Skin type: ${profile?.skinType || "Not specified"}
- Name: ${profile?.displayName || "User"}
- Streak: ${profile?.streakCount || 0} days

AM ROUTINE:
${JSON.stringify(amSteps, null, 2)}

PM WEEKLY SCHEDULE:
${JSON.stringify(Object.entries(daily).map(([day, d]) => ({ day, label: d.label, goal: d.goal, active: d.active.product })), null, 2)}

INVENTORY (products they own):
${JSON.stringify(inventory.map(i => ({ name: i.name, status: i.status, level: i.level + "%" })), null, 2)}

RECENT SKIN LOG (last 5 entries):
${JSON.stringify(skinLog.slice(0, 5).map(e => ({ date: e.date, mood: e.mood, oiliness: e.oiliness, notes: e.notes })), null, 2)}

Your role:
- Answer skincare questions with scientific accuracy but plain language
- Give personalised advice based on their actual routine and products
- Flag potential ingredient conflicts if asked about adding products
- Suggest routine adjustments based on their skin log trends
- Keep responses concise and mobile-friendly (short paragraphs, no excessive bullet points)
- Be warm and encouraging, not clinical
- Never recommend anything harmful or unsupported by evidence`;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ system: systemPrompt, messages: [...messages, userMsg] }),
});
const data = await res.json();
const reply = data.text || "Sorry, couldn't get a response.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error — please try again." }]);
    }
    setLoading(false);
  };

  const suggestions = [
    "What's causing my oily T-zone?",
    "Can I add Vitamin C to my routine?",
    "Is my current routine good for PIH?",
    "What should I restock first?",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100svh - 170px)" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        {messages.length === 0 && (
          <div>
            <div style={{ background: "#fff", border: `1px solid ${T.brdr}`, borderRadius: 15, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: "#818cf8", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>AI SKIN ADVISOR</div>
              <div style={{ fontFamily: T.font, fontSize: 15, fontWeight: 600, color: T.dark, marginBottom: 4 }}>Hi {(profile?.displayName || "").split(" ")[0]}! I know your routine inside out.</div>
              <div style={{ fontFamily: T.sans, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>Ask me anything — ingredient conflicts, routine tweaks, product recommendations, or why your skin is doing that thing it's doing.</div>
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>QUICK QUESTIONS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => setInput(s)} style={{
                  fontFamily: T.sans, fontSize: 12, fontWeight: 600, color: "#4338ca",
                  background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 99,
                  padding: "6px 13px", cursor: "pointer",
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "82%", padding: "11px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: m.role === "user" ? T.dark : "#fff",
              border: m.role === "assistant" ? `1px solid ${T.brdr}` : "none",
              fontFamily: T.sans, fontSize: 13, color: m.role === "user" ? "#fff" : T.dark, lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 5, padding: "10px 14px", background: "#fff", border: `1px solid ${T.brdr}`, borderRadius: "16px 16px 16px 4px", width: "fit-content", marginBottom: 12 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#c4b5fd", animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: `1px solid ${T.brdr}` }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask anything about your skin…"
          style={{
            flex: 1, padding: "11px 14px", borderRadius: 12, border: `1.5px solid ${T.brdr}`,
            fontFamily: T.sans, fontSize: 16, outline: "none", background: "#fff", color: T.dark,
          }}
        />
        <button onClick={send} disabled={!input.trim() || loading} style={{
          background: input.trim() ? T.dark : "#e2e8f0", color: input.trim() ? "#fff" : T.muted,
          border: "none", borderRadius: 12, padding: "11px 16px", cursor: "pointer",
          fontFamily: T.sans, fontSize: 13, fontWeight: 700, transition: "all 0.15s",
        }}>Send</button>
      </div>
      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Main App ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Auth state ──
  const [authUser,     setAuthUser]     = useState(undefined); // undefined = loading
  const [profile,      setProfile]      = useState(null);
  const [needsOnboard, setNeedsOnboard] = useState(false);

  // ── App data ──
  const [amSteps,   setAmSteps]   = useState(MY_AM_DEFAULT);
  const [daily,     setDaily]     = useState(MY_DAILY_DEFAULT);
  const [inventory, setInventory] = useState([]);
  const [skinLog,   setSkinLog]   = useState([]);
  const [checked,   setChecked]   = useState({ date: TODAY_DATE, steps: {} });

  // ── UI state ──
  const [tab,         setTab]         = useState("today");
  const [filterCat,   setFilterCat]   = useState("All");
  const [toast,       setToast]       = useState(null);
  const [editAmStep,  setEditAmStep]  = useState(null);
  const [editDay,     setEditDay]     = useState(null);
  const [editItem,    setEditItem]    = useState(null);
  const [addingItem,  setAddingItem]  = useState(false);
  const [newItem,     setNewItem]     = useState({ name:"", category:"Serum", status:"In Use", level:100, notes:"", expiry:"" });
  const [logForm,     setLogForm]     = useState({ mood:"😊", oiliness:"Normal", notes:"" });
  const [showLog,     setShowLog]     = useState(false);
  const [addingAmStep, setAddingAmStep] = useState(false);
  const [newAmStep,   setNewAmStep]   = useState({ step:"", product:"", note:"" });
  const [addingPmStep, setAddingPmStep] = useState(null);
  const [newPmStep,   setNewPmStep]   = useState({ type:"prefix", step:"", product:"", note:"" });

  const showToast = useCallback((msg) => setToast(msg), []);

  // ── Listen for auth changes ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user || null);
      if (!user) { setNeedsOnboard(false); return; }
      const prof = await loadProfile(user.uid);
      if (!prof) {
        setNeedsOnboard(true);
      } else {
        setProfile(prof);
        setNeedsOnboard(false);
        await loadAllData(user.uid);
      }
    });
    return unsub;
  }, []);

  const loadAllData = async (uid) => {
    const [am, dy, inv, log, chk] = await Promise.all([
      loadUserData(uid, "amSteps"),
      loadUserData(uid, "daily"),
      loadUserData(uid, "inventory"),
      loadUserData(uid, "skinLog"),
      loadUserData(uid, "checked"),
    ]);
    if (am)  setAmSteps(am);
    if (dy)  setDaily(dy);
    if (inv) setInventory(inv);
    if (log) setSkinLog(log);
    if (chk) {
      if (chk.date === TODAY_DATE) setChecked(chk);
      else setChecked({ date: TODAY_DATE, steps: {} });
    }
  };

  // ── Persist to Firestore with debounce ──
  const saveDebounced = useCallback((field, value) => {
    if (!authUser) return;
    saveUserData(authUser.uid, field, value).catch(console.error);
  }, [authUser]);

  useEffect(() => { if (authUser) saveDebounced("amSteps",   amSteps);   }, [amSteps]);
  useEffect(() => { if (authUser) saveDebounced("daily",     daily);     }, [daily]);
  useEffect(() => { if (authUser) saveDebounced("inventory", inventory); }, [inventory]);
  useEffect(() => { if (authUser) saveDebounced("skinLog",   skinLog);   }, [skinLog]);
  useEffect(() => { if (authUser) saveDebounced("checked",   checked);   }, [checked]);

  // ── Streak logic ──
  const updateStreak = useCallback(async () => {
    if (!authUser || !profile) return;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString("en-CA");
    let newStreak = profile.streakCount || 0;
    if (profile.lastCompletedDate === yesterdayStr) {
      newStreak = newStreak + 1;
    } else if (profile.lastCompletedDate !== TODAY_DATE) {
      newStreak = 1;
    }
    const updatedProfile = { ...profile, streakCount: newStreak, lastCompletedDate: TODAY_DATE };
    setProfile(updatedProfile);
    await saveProfile(authUser.uid, updatedProfile);
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

  const allTodaySteps = [...amSteps.map(s => s.id), ...todayPMSteps.map(s => s.id)];
  const checkedSteps  = checked.steps || {};
  const completedCount = allTodaySteps.filter(id => checkedSteps[id]).length;
  const allDone = completedCount === allTodaySteps.length && allTodaySteps.length > 0;

  useEffect(() => {
    if (allDone && profile && profile.lastCompletedDate !== TODAY_DATE) {
      updateStreak();
      showToast("🔥 Routine complete! Streak updated.");
    }
  }, [allDone]);

  const toggleCheck = (id) => {
    setChecked(prev => ({ ...prev, steps: { ...prev.steps, [id]: !prev.steps?.[id] } }));
  };

  const todayProducts = useMemo(() =>
    [...amSteps.map(s => s.product), ...todayPMSteps.map(s => s.product)].map(p => p.toLowerCase()),
  [amSteps, todayPMSteps]);

  // Alerts
  const lowStockAlerts = inventory.filter(i => i.status === "Low Stock" || (i.level > 0 && i.level <= 20 && i.status !== "Wishlist"));
  const wishlistAlerts = inventory.filter(i => i.status === "Wishlist");
  const expiryAlerts   = inventory.filter(i => { const es = expiryStatus(i.expiry); return es && es !== "ok"; });

  const card = { background: "#fff", borderRadius: 15, border: `1px solid ${T.brdr}`, padding: "15px 17px", marginBottom: 10 };
  const btnBase = { fontFamily: T.sans, fontWeight: 600, cursor: "pointer", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 15 };

  // ── Step card ──
  function StepCard({ s, isAm }) {
    const isChecked = checkedSteps[s.id];
    return (
      <div style={{ ...card, display: "flex", gap: 12, alignItems: "flex-start", opacity: isChecked ? 0.4 : 1, background: s.isAddon ? "#f0fdf4" : "#fff", border: s.isAddon ? "1.5px solid #bbf7d0" : `1px solid ${T.brdr}` }}>
        <button onClick={() => toggleCheck(s.id)} style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, marginTop: 1, cursor: "pointer", border: `2px solid ${isChecked ? T.green : T.brdr}`, background: isChecked ? T.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isChecked && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3, color: isAm ? T.gold : (s.isAddon ? T.green : "#818cf8") }}>{s.step}</div>
          <div style={{ fontFamily: T.font, fontSize: 15, fontWeight: 600, color: T.dark, marginBottom: s.note ? 3 : 0 }}>{s.product}</div>
          {s.note && <div style={{ fontFamily: T.sans, fontSize: 12, color: s.isAddon ? "#166534" : T.muted, lineHeight: 1.5 }}>{s.note}</div>}
        </div>
      </div>
    );
  }

  // ── Routine day card ──
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
      setDaily(prev => {
        const d = prev[day];
        const field = type === "prefix" ? "extraPrefix" : "extraSuffix";
        return { ...prev, [day]: { ...d, [field]: (d[field] || []).filter(s => s.id !== stepId) } };
      });
      showToast("Step removed");
    };

    return (
      <div style={{ ...card, padding: 0, overflow: "hidden", background: isToday ? sc.bg : "#fff", border: isToday ? `1.5px solid ${sc.color}55` : `1px solid ${T.brdr}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "15px 17px", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: isToday ? sc.color : T.muted, minWidth: 30 }}>{day}</span>
              <span style={{ background: sc.color + "22", color: sc.color, fontFamily: T.sans, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99 }}>{sc.emoji} {sc.label}</span>
              {isToday && <span style={{ background: sc.color, color: "#fff", fontFamily: T.mono, fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 99, letterSpacing: "0.09em" }}>TODAY</span>}
            </div>
            <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.dark, marginBottom: 2 }}>{sc.active.product}</div>
            <div style={{ fontFamily: T.sans, fontSize: 11, color: T.muted }}>{sc.goal}</div>
            {sc.weeklyAddon && <div style={{ fontFamily: T.sans, fontSize: 11, color: T.green, marginTop: 4 }}>＋ {sc.weeklyAddon.label || sc.weeklyAddon.product}</div>}
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
            <button onClick={e => { e.stopPropagation(); setEditDay({ _day: day, label: sc.label, goal: sc.goal, activeProduct: sc.active.product, activeNote: sc.active.note, footnoteText: (sc.footnotes || []).join("\n"), addonProduct: sc.weeklyAddon?.product || "", addonNote: sc.weeklyAddon?.note || "", addonLabel: sc.weeklyAddon?.label || "" }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#d4d4d0", fontSize: 18, padding: "0 4px" }}>✏</button>
            <span style={{ color: T.muted, fontSize: 14, padding: "0 4px" }}>{expanded ? "▲" : "▼"}</span>
          </div>
        </div>

        {expanded && (
          <div style={{ borderTop: `1px solid ${T.brdr}`, padding: "12px 17px 15px" }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>FULL STEP ORDER</div>
            {allPmSteps.map((s, idx) => {
              const isExtra = s.id?.startsWith("pm_extra_");
              const extraType = isExtra ? ((sc.extraPrefix || []).find(x => x.id === s.id) ? "prefix" : "suffix") : null;
              return (
                <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 11px", background: s.isAddon ? "#f0fdf4" : isExtra ? "#faf5ff" : "#f8fafc", borderRadius: 10, marginBottom: 5, border: isExtra ? "1px solid #e9d5ff" : "1px solid transparent" }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, minWidth: 18, marginTop: 1 }}>{idx + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: T.mono, fontSize: 9, color: s.isAddon ? T.green : isExtra ? "#a855f7" : "#818cf8", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 2 }}>{s.step || "Step"}</div>
                    <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.dark }}>{s.product}</div>
                    {s.note && <div style={{ fontFamily: T.sans, fontSize: 11, color: T.muted, marginTop: 1 }}>{s.note}</div>}
                  </div>
                  {isExtra && (
                    <button onClick={() => deletePmStep(s.id, extraType)} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "3px 8px", cursor: "pointer", fontFamily: T.sans, fontSize: 11, color: "#991b1b", fontWeight: 700, flexShrink: 0 }}>✕</button>
                  )}
                </div>
              );
            })}
            <button onClick={() => { setNewPmStep({ type: "prefix", step: "", product: "", note: "" }); setAddingPmStep(day); }} style={{ marginTop: 8, width: "100%", padding: "9px", borderRadius: 10, border: `1.5px dashed ${sc.color}66`, background: sc.color + "0a", fontFamily: T.sans, fontSize: 12, fontWeight: 700, color: sc.color, cursor: "pointer" }}>
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
  const doAddAmStep  = () => {
    if (!newAmStep.product.trim()) return;
    setAmSteps(s => [...s, { ...newAmStep, id: "am_" + Date.now() }]);
    setNewAmStep({ step: "", product: "", note: "" });
    setAddingAmStep(false);
    showToast("AM step added ✓");
  };
  const saveDay = () => {
    setDaily(prev => ({ ...prev, [editDay._day]: { ...prev[editDay._day], label: editDay.label, goal: editDay.goal, active: { step: "Target", product: editDay.activeProduct, note: editDay.activeNote }, footnotes: (editDay.footnoteText || "").split("\n").filter(f => f.trim()), weeklyAddon: editDay.addonProduct ? { label: editDay.addonLabel, product: editDay.addonProduct, note: editDay.addonNote } : null } }));
    setEditDay(null);
    showToast("Day updated ✓");
  };
  const doAddPmStep = (dayKey) => {
    if (!newPmStep.product.trim()) return;
    const newId = "pm_extra_" + Date.now();
    setDaily(prev => {
      const d = prev[dayKey];
      const field = newPmStep.type === "prefix" ? "extraPrefix" : "extraSuffix";
      return { ...prev, [dayKey]: { ...d, [field]: [...(d[field] || []), { ...newPmStep, id: newId }] } };
    });
    setNewPmStep({ type: "prefix", step: "", product: "", note: "" });
    setAddingPmStep(null);
    showToast("PM step added ✓");
  };
  const saveItem   = () => { setInventory(inv => inv.map(i => i.id === editItem.id ? editItem : i)); setEditItem(null); showToast("Product saved ✓"); };
  const deleteItem = () => { setInventory(inv => inv.filter(i => i.id !== editItem.id)); setEditItem(null); showToast("Product removed"); };
  const doAddItem  = () => { if (!newItem.name.trim()) return; setInventory(inv => [...inv, { ...newItem, id: Date.now() }]); setAddingItem(false); showToast("Product added ✓"); };
  const saveLog    = () => {
    setSkinLog(p => [{ ...logForm, date: TODAY_DATE, id: Date.now() }, ...p]);
    setLogForm({ mood: "😊", oiliness: "Normal", notes: "" });
    setShowLog(false);
    showToast("Skin entry logged ✓");
  };

  const cats = ["All", ...Array.from(new Set(inventory.map(i => i.category)))];
  const filteredInv = filterCat === "All" ? inventory : inventory.filter(i => i.category === filterCat);

  // ── Loading / auth gate ──
  if (authUser === undefined) {
    return (
      <div style={{ minHeight: "100svh", background: T.dark, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", color: "#a8a29e", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }
  if (!authUser) return <SignIn />;
  if (needsOnboard) {
    return (
      <Onboarding
        user={authUser}
        onComplete={(prof, am, dy) => {
          setProfile(prof);
          setAmSteps(am);
          setDaily(dy);
          setInventory([]);
          setSkinLog([]);
          setNeedsOnboard(false);
        }}
      />
    );
  }

  const isSunday = new Date().getDay() === 0;

  // ═══════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');`}</style>

      <div style={{ fontFamily: T.sans, background: T.bg, minHeight: "100svh", color: T.dark }}>

        {/* ── HEADER ── */}
        <div style={{ background: T.dark, paddingTop: `calc(14px + env(safe-area-inset-top))`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: "#a8a29e", letterSpacing: "0.14em", marginBottom: 2 }}>SUMMER 2026 · SKIN DASHBOARD</div>
                <div style={{ fontFamily: T.font, fontSize: 20, fontWeight: 700, color: "#fff", fontStyle: "italic" }}>
                  {profile?.displayName?.split(" ")[0]}'s Routine
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {profile?.photoURL && <img src={profile.photoURL} alt="" style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid #44403c" }} />}
                  <button onClick={signOutUser} style={{ fontFamily: T.mono, fontSize: 9, color: "#57534e", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.08em" }}>SIGN OUT</button>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: T.gold, letterSpacing: "0.1em" }}>TODAY</div>
                  <div style={{ fontFamily: T.font, fontSize: 16, fontWeight: 600, color: "#fff" }}>{TODAY}</div>
                </div>
              </div>
            </div>

            {/* Alerts */}
            {(lowStockAlerts.length > 0 || expiryAlerts.length > 0 || wishlistAlerts.length > 0) && (
              <div style={{ marginTop: 9, display: "flex", gap: 5, flexWrap: "wrap" }}>
                {lowStockAlerts.slice(0,2).map(i => (
                  <span key={i.id} style={{ background: "#7f1d1d28", border: "1px solid #ef4444", borderRadius: 7, padding: "2px 8px", fontFamily: T.sans, fontSize: 10, color: "#fca5a5", fontWeight: 700 }}>⚠ Low: {i.name.split(" ").slice(0,3).join(" ")}</span>
                ))}
                {expiryAlerts.slice(0,1).map(i => {
                  const d = daysUntilExpiry(i.expiry);
                  return <span key={i.id} style={{ background: d < 0 ? "#7f1d1d28" : "#78350f28", border: `1px solid ${d < 0 ? "#ef4444" : T.gold}`, borderRadius: 7, padding: "2px 8px", fontFamily: T.sans, fontSize: 10, color: d < 0 ? "#fca5a5" : "#fde68a", fontWeight: 700 }}>{d < 0 ? "❌ Expired: " : "⏰ Exp soon: "}{i.name.split(" ").slice(0,3).join(" ")}</span>;
                })}
                {wishlistAlerts.slice(0,1).map(i => (
                  <span key={i.id} style={{ background: "#581c8728", border: "1px solid #a855f7", borderRadius: 7, padding: "2px 8px", fontFamily: T.sans, fontSize: 10, color: "#d8b4fe", fontWeight: 700 }}>🛒 {i.name.split(" ").slice(0,4).join(" ")}</span>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: 2, marginTop: 12, background: "#292524", borderRadius: 99, padding: 3, overflowX: "auto" }}>
              {[["today","Today"],["routine","Routine"],["inventory","Inventory"],["log","Log"],["advisor","✨ Advisor"]].map(([id,lbl]) => (
                <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 12px", borderRadius: 99, border: "none", cursor: "pointer", fontFamily: T.sans, fontSize: 12, fontWeight: 600, background: tab === id ? "#fff" : "transparent", color: tab === id ? T.dark : "#a8a29e", transition: "all 0.18s", whiteSpace: "nowrap", flexShrink: 0 }}>{lbl}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ maxWidth: 640, margin: "0 auto", padding: `18px 15px calc(32px + env(safe-area-inset-bottom))` }}>

          {/* ════ TODAY ════ */}
          {tab === "today" && <>
            <StreakBadge streak={profile?.streakCount} />

            {/* Progress bar */}
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, fontWeight: 700, letterSpacing: "0.1em" }}>TODAY'S PROGRESS</span>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: allDone ? T.green : T.muted, fontWeight: 700 }}>{completedCount}/{allTodaySteps.length} {allDone ? "✓ All done!" : "steps"}</span>
              </div>
              <div style={{ background: "#e2e8f0", borderRadius: 99, height: 7, overflow: "hidden" }}>
                <div style={{ width: `${allTodaySteps.length ? (completedCount / allTodaySteps.length) * 100 : 0}%`, background: allDone ? T.green : T.gold, height: "100%", borderRadius: 99, transition: "width 0.5s ease" }} />
              </div>
            </div>

            {isSunday && <WeeklyReport skinLog={skinLog} inventory={inventory} />}

            <Divider label="☀ AM — PROTECT ONLY" color={T.gold} />
            {amSteps.map(s => <StepCard key={s.id} s={s} isAm />)}
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 11, padding: "9px 13px", marginTop: 2, marginBottom: 4 }}>
              <span style={{ fontFamily: T.mono, fontSize: 9, color: "#c2410c", fontWeight: 700, letterSpacing: "0.08em" }}>❌ DO NOT USE IN AM: </span>
              <span style={{ fontFamily: T.sans, fontSize: 11, color: "#9a3412" }}>Serums · Moisturizers · Heavy layering</span>
            </div>

            <Divider label={`🌙 PM — ${todaySched.emoji} ${todaySched.label?.toUpperCase()}`} color={todaySched.color} />
            <div style={{ background: todaySched.bg, border: `1.5px solid ${todaySched.color}44`, borderRadius: 13, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: todaySched.color, fontWeight: 700, letterSpacing: "0.09em", marginBottom: 2 }}>TONIGHT'S GOAL</div>
                <div style={{ fontFamily: T.font, fontSize: 14, fontWeight: 600, color: T.dark }}>{todaySched.goal}</div>
              </div>
              <span style={{ fontSize: 22 }}>{todaySched.emoji}</span>
            </div>
            {todayPMSteps.map(s => <StepCard key={s.id} s={s} isAm={false} />)}
            {(todaySched.footnotes || []).length > 0 && (
              <div style={{ marginTop: 10, background: "#fefce8", border: "1px solid #fde68a", borderRadius: 12, padding: "11px 15px" }}>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 7 }}>⚡ TONIGHT'S RULES</div>
                {todaySched.footnotes.map((fn, i) => (
                  <div key={i} style={{ fontFamily: T.sans, fontSize: 12, color: "#92400e", lineHeight: 1.65, marginBottom: i < todaySched.footnotes.length - 1 ? 4 : 0 }}>{fn}</div>
                ))}
              </div>
            )}
          </>}

          {/* ════ ROUTINE ════ */}
          {tab === "routine" && <>
            <Divider label="☀ AM ROUTINE (DAILY)" color={T.gold} action={{ label: "+ Add AM Step", onClick: () => { setNewAmStep({ step:"", product:"", note:"" }); setAddingAmStep(true); } }} />
            {amSteps.map(s => (
              <div key={s.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 3 }}>{s.step}</div>
                  <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.dark, marginBottom: s.note ? 2 : 0 }}>{s.product}</div>
                  {s.note && <div style={{ fontFamily: T.sans, fontSize: 11, color: T.muted }}>{s.note}</div>}
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => setEditAmStep({ ...s })} style={{ background: "none", border: "none", cursor: "pointer", color: "#d4d4d0", fontSize: 18, padding: "0 4px" }}>✏</button>
                  <button onClick={() => { setAmSteps(prev => prev.filter(x => x.id !== s.id)); showToast("Step removed"); }} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "3px 8px", cursor: "pointer", fontFamily: T.sans, fontSize: 11, color: "#991b1b", fontWeight: 700 }}>✕</button>
                </div>
              </div>
            ))}

            <Divider label="🌙 PM WEEKLY SCHEDULE" color="#818cf8" />
            {DAYS.map(day => <DayRoutineCard key={day} day={day} />)}

            <div style={{ marginTop: 18, background: T.dark, borderRadius: 16, padding: "16px 18px" }}>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: "0.13em", marginBottom: 8 }}>🔥 GOLDEN RULE</div>
              <div style={{ fontFamily: T.font, fontSize: 15, fontWeight: 600, color: "#fff", fontStyle: "italic", marginBottom: 12 }}>"AM = breathable skin. PM = one job only."</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {[["Full-face moisturizer","❌ Never"],["Cheeks/jaw moisturizer","✔ Yes"],["T-zone moisturizer","✔ Residue only"],["AM serums/actives","❌ Never"]].map(([r,v]) => (
                  <div key={r} style={{ background: "#292524", borderRadius: 10, padding: "8px 11px" }}>
                    <div style={{ fontFamily: T.sans, fontSize: 10, color: "#a8a29e", marginBottom: 2 }}>{r}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: v.startsWith("✔") ? T.green : "#f87171" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </>}

          {/* ════ INVENTORY ════ */}
          {tab === "inventory" && <>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
              {cats.map(c => (
                <button key={c} onClick={() => setFilterCat(c)} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: "6px 13px", borderRadius: 99, background: filterCat === c ? T.dark : "#f5f5f4", color: filterCat === c ? "#fff" : T.muted, border: "none", cursor: "pointer" }}>{c}</button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 11 }}>
              <button onClick={() => { setNewItem({ name:"", category:"Serum", status:"In Use", level:100, notes:"", expiry:"" }); setAddingItem(true); }} style={{ ...btnBase, background: T.dark, color: "#fff", fontSize: 13, padding: "8px 16px" }}>+ Add Product</button>
            </div>

            {filteredInv.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: T.muted, fontFamily: T.font, fontSize: 15, fontStyle: "italic" }}>
                No products yet. Add something to track!
              </div>
            )}

            {filteredInv.map(item => {
              const sc = STATUS_COLORS[item.status] || STATUS_COLORS["Empty"];
              const es = expiryStatus(item.expiry);
              const showExpWarn = es && es !== "ok";
              const dLeft = daysUntilExpiry(item.expiry);
              const daysLeft = item.level > 0 && item.status === "In Use" ? Math.round(item.level / 2) : null;
              return (
                <div key={item.id} style={{ ...card, border: showExpWarn ? `1.5px solid ${dLeft < 0 ? "#ef4444" : T.gold}` : `1px solid ${T.brdr}`, background: showExpWarn ? (dLeft < 0 ? "#fff5f5" : "#fffbeb") : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: item.level > 0 && item.status !== "Wishlist" ? 9 : 0 }}>
                    <div style={{ flex: 1, paddingRight: 8 }}>
                      <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
                        <span style={{ background: (CAT_COLORS[item.category]||"#e5e7eb")+"33", fontFamily: T.mono, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99, letterSpacing: "0.06em" }}>{item.category}</span>
                        <span style={{ background: sc.bg, color: sc.text, fontFamily: T.sans, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>● {item.status}</span>
                        {showExpWarn && <span style={{ background: dLeft < 0 ? "#fee2e2" : "#fef3c7", color: dLeft < 0 ? "#991b1b" : "#92400e", fontFamily: T.mono, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{dLeft < 0 ? `❌ EXPIRED (${Math.abs(dLeft)}d ago)` : `⏰ ${dLeft}d left`}</span>}
                        {daysLeft && item.level <= 20 && <span style={{ background: "#fee2e2", color: "#991b1b", fontFamily: T.mono, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>🛒 ~{daysLeft} days left</span>}
                      </div>
                      <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: T.dark }}>{item.name}</div>
                      {item.notes && <div style={{ fontFamily: T.sans, fontSize: 11, color: T.muted, marginTop: 2 }}>{item.notes}</div>}
                    </div>
                    <button onClick={() => setEditItem({ ...item })} style={{ background: "none", border: "none", cursor: "pointer", color: "#d4d4d0", fontSize: 20, padding: "0 4px", flexShrink: 0 }}>✏</button>
                  </div>
                  {item.status !== "Wishlist" && item.level > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <LevelBar level={item.level} />
                      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, minWidth: 30 }}>{item.level}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </>}

          {/* ════ SKIN LOG ════ */}
          {tab === "log" && <>
            <button onClick={() => setShowLog(true)} style={{ ...btnBase, width: "100%", background: T.dark, color: "#fff", fontFamily: T.font, fontSize: 15, fontStyle: "italic", marginBottom: 18 }}>
              + Log Today's Skin
            </button>
            {!isSunday && skinLog.length >= 3 && <WeeklyReport skinLog={skinLog} inventory={inventory} />}
            {skinLog.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: T.muted, fontFamily: T.font, fontSize: 15, fontStyle: "italic" }}>No entries yet. Log your first day!</div>
            )}
            {skinLog.map(e => (
              <div key={e.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{e.date}</span>
                  <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                    <span style={{ fontSize: 18 }}>{e.mood}</span>
                    <span style={{ fontFamily: T.sans, fontSize: 10, fontWeight: 600, background: "#f5f5f4", padding: "2px 9px", borderRadius: 99, color: T.muted }}>{e.oiliness}</span>
                  </div>
                </div>
                {e.notes && <div style={{ fontFamily: T.sans, fontSize: 12, color: T.dark, lineHeight: 1.55 }}>{e.notes}</div>}
              </div>
            ))}
          </>}

          {/* ════ AI ADVISOR ════ */}
          {tab === "advisor" && (
            <AIAdvisor
              amSteps={amSteps}
              daily={daily}
              inventory={inventory}
              skinLog={skinLog}
              profile={profile}
            />
          )}
        </div>
      </div>

      {/* ════ MODALS ════ */}
      {editAmStep && (
        <Modal title="Edit AM Step" onClose={() => setEditAmStep(null)}>
          <Field label="Step Label" value={editAmStep.step}    onChange={v => setEditAmStep(s=>({...s,step:v}))} />
          <Field label="Product"    value={editAmStep.product} onChange={v => setEditAmStep(s=>({...s,product:v}))} />
          <Field label="Note"       value={editAmStep.note}    onChange={v => setEditAmStep(s=>({...s,note:v}))} />
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button onClick={saveAmStep}   style={{ ...btnBase, flex:1, background:T.dark, color:"#fff" }}>Save</button>
            <button onClick={deleteAmStep} style={{ ...btnBase, flex:1, background:"#fee2e2", color:"#991b1b" }}>Delete</button>
          </div>
        </Modal>
      )}

      {addingAmStep && (
        <Modal title="Add AM Step" onClose={() => setAddingAmStep(false)}>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 13px", marginBottom: 16, fontFamily: T.sans, fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
            ☀ AM steps = gentle + protective only. Cleansers, toners, mists, SPF. No actives.
          </div>
          <Field label="Step Label (e.g. Tone, Mist, Protect)" value={newAmStep.step}    onChange={v => setNewAmStep(s=>({...s,step:v}))} placeholder="e.g. Tone" />
          <Field label="Product Name"                           value={newAmStep.product} onChange={v => setNewAmStep(s=>({...s,product:v}))} placeholder="e.g. Klairs Supple Prep Toner" />
          <Field label="Note (optional)"                        value={newAmStep.note}    onChange={v => setNewAmStep(s=>({...s,note:v}))} placeholder="e.g. Pat gently, avoid eye area" />
          <button onClick={doAddAmStep} style={{ ...btnBase, width:"100%", background:T.dark, color:"#fff", marginTop:8 }}>Add to AM Routine</button>
        </Modal>
      )}

      {editDay && (
        <Modal title={`Edit ${editDay._day} — ${editDay.label}`} onClose={() => setEditDay(null)}>
          <Field label="Night Label"    value={editDay.label}         onChange={v => setEditDay(d=>({...d,label:v}))} />
          <Field label="Goal"           value={editDay.goal}          onChange={v => setEditDay(d=>({...d,goal:v}))} />
          <Field label="Active Product" value={editDay.activeProduct} onChange={v => setEditDay(d=>({...d,activeProduct:v}))} />
          <Field label="Active Note"    value={editDay.activeNote}    onChange={v => setEditDay(d=>({...d,activeNote:v}))} />
          <Field label="Footnotes (one per line)" type="textarea" value={editDay.footnoteText} onChange={v => setEditDay(d=>({...d,footnoteText:v}))} />
          <Field label="Weekly Add-on Product (blank = none)" value={editDay.addonProduct} onChange={v => setEditDay(d=>({...d,addonProduct:v}))} placeholder="Optional" />
          <Field label="Weekly Add-on Label" value={editDay.addonLabel} onChange={v => setEditDay(d=>({...d,addonLabel:v}))} placeholder="Optional" />
          <Field label="Weekly Add-on Note"  value={editDay.addonNote}  onChange={v => setEditDay(d=>({...d,addonNote:v}))} placeholder="Optional" />
          <button onClick={saveDay} style={{ ...btnBase, width:"100%", background:T.dark, color:"#fff", marginTop:8 }}>Save</button>
        </Modal>
      )}

      {addingPmStep && (
        <Modal title={`Add Step — ${addingPmStep} PM`} onClose={() => setAddingPmStep(null)}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Position in routine</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[["prefix","Before Active"],["suffix","After Sealing"]].map(([val, lbl]) => (
                <button key={val} onClick={() => setNewPmStep(s => ({...s, type: val}))} style={{ flex: 1, padding: "9px", borderRadius: 10, cursor: "pointer", border: `2px solid ${newPmStep.type === val ? "#818cf8" : "#e2e8f0"}`, background: newPmStep.type === val ? "#eef2ff" : "#f8fafc", fontFamily: T.sans, fontSize: 12, fontWeight: 700, color: newPmStep.type === val ? "#4338ca" : T.muted }}>{lbl}</button>
              ))}
            </div>
            <div style={{ fontFamily: T.sans, fontSize: 11, color: T.muted, marginTop: 6 }}>
              {newPmStep.type === "prefix" ? "After cleanse/prep, before your active (e.g. essence, treatment toner)" : "After your active serum, in the sealing layer (e.g. sleeping mask, face oil)"}
            </div>
          </div>
          <Field label="Step Label"      value={newPmStep.step}    onChange={v => setNewPmStep(s=>({...s,step:v}))} placeholder="e.g. Essence, Sleep Mask" />
          <Field label="Product Name"    value={newPmStep.product} onChange={v => setNewPmStep(s=>({...s,product:v}))} placeholder="e.g. COSRX Advanced Snail 96" />
          <Field label="Note (optional)" value={newPmStep.note}    onChange={v => setNewPmStep(s=>({...s,note:v}))} placeholder="e.g. Full face, light layer" />
          <button onClick={() => doAddPmStep(addingPmStep)} style={{ ...btnBase, width:"100%", background:T.dark, color:"#fff", marginTop:8 }}>Add to {addingPmStep} Routine</button>
        </Modal>
      )}

      {editItem && (
        <Modal title="Edit Product" onClose={() => setEditItem(null)}>
          <Field label="Product Name" value={editItem.name}     onChange={v => setEditItem(i=>({...i,name:v}))} />
          <Field label="Category"     value={editItem.category} onChange={v => setEditItem(i=>({...i,category:v}))} options={["Cleanser","Prep","Serum","Moisturizer","Mask","Sunscreen","To Buy","Other"]} />
          <Field label="Status"       value={editItem.status}   onChange={v => setEditItem(i=>({...i,status:v}))}   options={["In Use","Sealed/Backup","Paused","Low Stock","Empty","Wishlist"]} />
          <Field label="Level (%)"    value={editItem.level}    onChange={v => setEditItem(i=>({...i,level:Number(v)}))} type="number" />
          <Field label="Expiry Date"  value={editItem.expiry}   onChange={v => setEditItem(i=>({...i,expiry:v}))} type="date" />
          <Field label="Notes"        value={editItem.notes}    onChange={v => setEditItem(i=>({...i,notes:v}))} />
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button onClick={saveItem}   style={{ ...btnBase, flex:1, background:T.dark, color:"#fff" }}>Save</button>
            <button onClick={deleteItem} style={{ ...btnBase, flex:1, background:"#fee2e2", color:"#991b1b" }}>Remove</button>
          </div>
        </Modal>
      )}

      {addingItem && (
        <Modal title="Add Product" onClose={() => setAddingItem(false)}>
          <Field label="Product Name" value={newItem.name}     onChange={v => setNewItem(i=>({...i,name:v}))} placeholder="Product name" />
          <Field label="Category"     value={newItem.category} onChange={v => setNewItem(i=>({...i,category:v}))} options={["Cleanser","Prep","Serum","Moisturizer","Mask","Sunscreen","To Buy","Other"]} />
          <Field label="Status"       value={newItem.status}   onChange={v => setNewItem(i=>({...i,status:v}))}   options={["In Use","Sealed/Backup","Paused","Low Stock","Empty","Wishlist"]} />
          <Field label="Level (%)"    value={newItem.level}    onChange={v => setNewItem(i=>({...i,level:Number(v)}))} type="number" />
          <Field label="Expiry Date"  value={newItem.expiry}   onChange={v => setNewItem(i=>({...i,expiry:v}))} type="date" />
          <Field label="Notes"        value={newItem.notes}    onChange={v => setNewItem(i=>({...i,notes:v}))} placeholder="Optional" />
          <button onClick={doAddItem} style={{ ...btnBase, width:"100%", background:T.dark, color:"#fff", marginTop:8 }}>Add Product</button>
        </Modal>
      )}

      {showLog && (
        <Modal title="Log Today's Skin" onClose={() => setShowLog(false)}>
          <Field label="Mood"            value={logForm.mood}     onChange={v => setLogForm(l=>({...l,mood:v}))}     options={["😊","😐","😞","🥵","😴"]} />
          <Field label="T-Zone Oiliness" value={logForm.oiliness} onChange={v => setLogForm(l=>({...l,oiliness:v}))} options={["Very Oily","Oily","Normal","Balanced","Dry"]} />
          <Field label="Notes" type="textarea" value={logForm.notes} onChange={v => setLogForm(l=>({...l,notes:v}))} placeholder="Breakouts, reactions, texture, new products…" />
          <button onClick={saveLog} style={{ ...btnBase, width:"100%", background:T.dark, color:"#fff" }}>Save Entry</button>
        </Modal>
      )}

      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </>
  );
}
