// src/App.jsx — Skincare Dashboard v4.0
// No hardcoded products. All data from Firebase.
// AM: shared routine with per-day overrides
// PM: shared base (Cleanse→Prep→Target→Seal) fully editable, steps insertable anywhere
// Alternates: any step, any day, weekly/2w/3w/monthly rotation from chosen start date
// Backup: JSON + PDF export

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  auth, db,
  signInWithGoogle, signOutUser, onAuthStateChanged,
  loadUserData, saveUserData, loadProfile, saveProfile,
} from "./firebase";

if (!document.getElementById("sc-fonts")) {
  const l = document.createElement("link");
  l.id = "sc-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;600&display=swap";
  document.head.appendChild(l);
}

const makeTokens = (dark) => ({
  bg:          dark ? "#141210" : "#F7F4EF",
  bgCard:      dark ? "#1E1B18" : "#FFFFFF",
  bgSubtle:    dark ? "#2A2520" : "#F0EDE8",
  border:      dark ? "#2E2926" : "#E8E3DA",
  borderDark:  dark ? "#3D3732" : "#D5CEC3",
  ink:         dark ? "#F2EDE6" : "#1C1917",
  inkMid:      dark ? "#A89F96" : "#57534E",
  inkLight:    dark ? "#6B6460" : "#A8A29E",
  accent:      "#C2622D",
  accentLight: dark ? "rgba(194,98,45,0.15)" : "#F5E6DC",
  gold:        "#B5862A",
  goldLight:   dark ? "rgba(181,134,42,0.18)" : "#FBF0D9",
  green:       "#4A7C59",
  greenLight:  dark ? "rgba(74,124,89,0.18)" : "#E8F2EC",
  red:         "#C0392B",
  redLight:    dark ? "rgba(192,57,43,0.15)" : "#FDECEA",
  purple:      "#a855f7",
  purpleLight: dark ? "rgba(168,85,247,0.15)" : "#faf5ff",
  blue:        "#3b82f6",
  blueLight:   dark ? "rgba(59,130,246,0.15)" : "#eff6ff",
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontBody:    "'DM Sans', -apple-system, sans-serif",
  fontMono:    "'DM Mono', 'Courier New', monospace",
  radius: "12px", radiusLg: "18px", radiusSm: "8px",
});

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const TODAY_IDX = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d-1; })();
const TODAY = DAYS[TODAY_IDX];
const TODAY_DATE = new Date().toLocaleDateString("en-CA");

// ── Default empty structures ──────────────────────────────────────────
// These are SHAPES only — no product names hardcoded

const DEFAULT_AM_STEPS = [
  { id: "am1", category: "Cleanse",  product: "", note: "" },
  { id: "am2", category: "Prep",     product: "", note: "" },
  { id: "am3", category: "Protect",  product: "", note: "" },
];

const DEFAULT_PM_BASE = [
  { id: "pm1", category: "Cleanse",  product: "", note: "" },
  { id: "pm2", category: "Prep",     product: "", note: "" },
  { id: "pm3", category: "Target",   product: "", note: "" },
  { id: "pm4", category: "Seal",     product: "", note: "" },
];

// Default per-day PM schedule — shape only, no products
const DEFAULT_DAILY = () => {
  const schedule = {};
  DAYS.forEach(day => {
    schedule[day] = {
      label: "Night", color: "#A8A29E", emoji: "🌙",
      goal: "",
      steps: DEFAULT_PM_BASE.map(s => ({ ...s, id: s.id + "_" + day })),
      footnotes: [],
      weeklyAddon: null,
    };
  });
  return schedule;
};

// ── Alternate rotation helpers ────────────────────────────────────────
// alternate = { stepId, altProduct, altNote, frequency: "weekly"|"2w"|"3w"|"monthly", startDate: "YYYY-MM-DD" }
const getAlternateForToday = (step, alternates, todayDate) => {
  const alt = (alternates || []).find(a => a.stepId === step.id);
  if (!alt || !alt.startDate) return null;

  const start = new Date(alt.startDate);
  const today = new Date(todayDate);
  const msPerDay = 86400000;
  const daysDiff = Math.floor((today - start) / msPerDay);
  if (daysDiff < 0) return null; // hasn't started yet

  let periodDays;
  switch (alt.frequency) {
    case "weekly":   periodDays = 7;  break;
    case "2w":       periodDays = 14; break;
    case "3w":       periodDays = 21; break;
    case "monthly":  periodDays = 28; break;
    default:         periodDays = 7;
  }

  const period = Math.floor(daysDiff / periodDays);
  // Even period = original product, odd period = alternate product
  return period % 2 === 1 ? alt : null;
};

// ── Expiry helpers ────────────────────────────────────────────────────
const daysUntilExpiry = (expiry) => {
  if (!expiry) return null;
  return Math.floor((new Date(expiry) - new Date()) / 86400000);
};
const expiryStatus = (expiry) => {
  const d = daysUntilExpiry(expiry);
  if (d === null) return null;
  if (d < 0)   return "expired";
  if (d <= 90) return "soon";
  return "ok";
};
const productInToday = (invName, todayProds) => {
  const n = invName.toLowerCase();
  return todayProds.some(tp =>
    n.split(/\s+/).filter(w => w.length > 3).some(w => tp.includes(w))
  );
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

// ── Onboarding skin types (for template suggestions only — no hardcoded products) ──
const SKIN_TYPES = [
  { key: "Oily",      emoji: "💧", label: "Oily / Acne-prone",       desc: "Focus on sebum control, lightweight hydration" },
  { key: "Dry",       emoji: "🌸", label: "Dry / Sensitive",          desc: "Focus on barrier repair, deep hydration" },
  { key: "Combo",     emoji: "⚖️", label: "Combination",              desc: "Balance T-zone oil, hydrate dry cheeks" },
  { key: "Sensitive", emoji: "🤍", label: "Sensitive / Redness-prone",desc: "Minimal, fragrance-free, barrier-first" },
];

// ── Primitive UI components ───────────────────────────────────────────

function DarkToggle({ dark, toggle }) {
  return (
    <button onClick={toggle} style={{ width: 44, height: 26, borderRadius: 13, border: "none", background: dark ? "#C2622D" : "#E0D9D0", cursor: "pointer", position: "relative", transition: "background 0.3s", flexShrink: 0, padding: 0 }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: dark ? 21 : 3, transition: "left 0.25s", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
        {dark ? "🌙" : "☀️"}
      </div>
    </button>
  );
}

function Modal({ title, onClose, children, T }) {
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,12,10,0.72)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: T.bgCard, borderRadius: "20px 20px 0 0", padding: "22px 22px 32px", width: "100%", maxWidth: 540, maxHeight: "88vh", overflowY: "auto", paddingBottom: "max(32px, env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
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
      {options
        ? <select value={value} onChange={e => onChange(e.target.value)} style={s}>{options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}</select>
        : type === "textarea"
          ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...s, minHeight: 72, resize: "vertical" }} />
          : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s} />
      }
    </div>
  );
}

function Divider({ label, color, action, T }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 0 12px" }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 10, color, fontWeight: 700, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
      {action && <button onClick={action.onClick} style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 600, color: action.color || color, background: (action.color || color) + "18", border: `1px solid ${(action.color || color)}44`, borderRadius: 99, padding: "3px 10px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{action.label}</button>}
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

function LevelBar({ level, T }) {
  const c = level > 60 ? T.green : level > 25 ? T.gold : T.red;
  return (
    <div style={{ background: T.bgSubtle, borderRadius: 99, height: 5, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, level)}%`, background: c, height: "100%", borderRadius: 99, transition: "width 0.4s" }} />
    </div>
  );
}

// ── Step editor — reorderable list with alternate support ─────────────
function StepListEditor({ steps, alternates, onStepsChange, onAlternatesChange, T, showAlternate = false }) {
  const [editingAlt, setEditingAlt] = useState(null); // stepId being edited for alternate
  const [altForm, setAltForm] = useState({ altProduct: "", altNote: "", frequency: "weekly", startDate: TODAY_DATE });

  const moveStep = (idx, dir) => {
    const s = [...steps];
    const target = idx + dir;
    if (target < 0 || target >= s.length) return;
    [s[idx], s[target]] = [s[target], s[idx]];
    onStepsChange(s);
  };

  const updateStep = (idx, field, val) => {
    const s = [...steps]; s[idx] = { ...s[idx], [field]: val }; onStepsChange(s);
  };

  const addStep = () => {
    onStepsChange([...steps, { id: "step_" + Date.now(), category: "Step", product: "", note: "" }]);
  };

  const removeStep = (idx) => {
    onStepsChange(steps.filter((_, i) => i !== idx));
  };

  const saveAlt = () => {
    const others = (alternates || []).filter(a => a.stepId !== editingAlt);
    onAlternatesChange([...others, { stepId: editingAlt, ...altForm }]);
    setEditingAlt(null);
  };

  const removeAlt = (stepId) => {
    onAlternatesChange((alternates || []).filter(a => a.stepId !== stepId));
  };

  return (
    <div>
      {steps.map((s, idx) => {
        const hasAlt = (alternates || []).find(a => a.stepId === s.id);
        return (
          <div key={s.id} style={{ background: T.bgSubtle, borderRadius: T.radiusSm, padding: "10px 12px", marginBottom: 8, border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 4, width: 22, height: 22, cursor: "pointer", fontSize: 10, color: T.inkLight }}>▲</button>
                <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 4, width: 22, height: 22, cursor: "pointer", fontSize: 10, color: T.inkLight }}>▼</button>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={s.category} onChange={e => updateStep(idx, "category", e.target.value)} placeholder="Category" style={{ width: 90, padding: "5px 8px", borderRadius: T.radiusSm, border: `1px solid ${T.border}`, fontFamily: T.fontMono, fontSize: 10, fontWeight: 700, background: T.bgCard, color: T.accent, outline: "none", textTransform: "uppercase" }} />
                  <input value={s.product} onChange={e => updateStep(idx, "product", e.target.value)} placeholder="Product name" style={{ flex: 1, padding: "5px 8px", borderRadius: T.radiusSm, border: `1px solid ${T.border}`, fontFamily: T.fontBody, fontSize: 13, background: T.bgCard, color: T.ink, outline: "none" }} />
                </div>
                <input value={s.note} onChange={e => updateStep(idx, "note", e.target.value)} placeholder="Note (optional)" style={{ width: "100%", padding: "5px 8px", borderRadius: T.radiusSm, border: `1px solid ${T.border}`, fontFamily: T.fontBody, fontSize: 11, background: T.bgCard, color: T.inkMid, outline: "none", boxSizing: "border-box" }} />
              </div>
              <button onClick={() => removeStep(idx)} style={{ background: T.redLight, border: "none", borderRadius: 6, padding: "0 8px", cursor: "pointer", color: T.red, fontSize: 13, fontWeight: 700, flexShrink: 0, alignSelf: "center" }}>✕</button>
            </div>
            {showAlternate && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                {hasAlt ? (
                  <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center", background: T.purpleLight, borderRadius: T.radiusSm, padding: "4px 8px" }}>
                    <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.purple, fontWeight: 700 }}>ALT {hasAlt.frequency?.toUpperCase()}</span>
                    <span style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink, flex: 1 }}>{hasAlt.altProduct}</span>
                    <button onClick={() => { setAltForm({ altProduct: hasAlt.altProduct, altNote: hasAlt.altNote || "", frequency: hasAlt.frequency, startDate: hasAlt.startDate }); setEditingAlt(s.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: T.purple, fontSize: 13 }}>✏</button>
                    <button onClick={() => removeAlt(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red, fontSize: 13 }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setAltForm({ altProduct: "", altNote: "", frequency: "weekly", startDate: TODAY_DATE }); setEditingAlt(s.id); }} style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 600, color: T.purple, background: T.purpleLight, border: `1px solid ${T.purple}44`, borderRadius: 99, padding: "3px 10px", cursor: "pointer" }}>
                    + Alternate
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={addStep} style={{ width: "100%", padding: "9px", borderRadius: T.radiusSm, border: `1.5px dashed ${T.accent}55`, background: T.accentLight, fontFamily: T.fontBody, fontSize: 12, fontWeight: 600, color: T.accent, cursor: "pointer", marginTop: 4 }}>
        + Add Step
      </button>

      {editingAlt && (
        <div style={{ marginTop: 14, background: T.purpleLight, border: `1px solid ${T.purple}44`, borderRadius: T.radiusLg, padding: "14px 16px" }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.purple, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>SET ALTERNATE PRODUCT</div>
          <Field label="Alternate Product" value={altForm.altProduct} onChange={v => setAltForm(f => ({ ...f, altProduct: v }))} placeholder="e.g. De-Pigmentation Serum" T={T} />
          <Field label="Note" value={altForm.altNote} onChange={v => setAltForm(f => ({ ...f, altNote: v }))} placeholder="Optional" T={T} />
          <Field label="Rotation" value={altForm.frequency} onChange={v => setAltForm(f => ({ ...f, frequency: v }))} options={[{ value: "weekly", label: "Every week" }, { value: "2w", label: "Every 2 weeks" }, { value: "3w", label: "Every 3 weeks" }, { value: "monthly", label: "Every 4 weeks" }]} T={T} />
          <Field label="Start Date (week 1 = original, week 2 = alternate...)" value={altForm.startDate} onChange={v => setAltForm(f => ({ ...f, startDate: v }))} type="date" T={T} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={saveAlt} style={{ flex: 1, padding: "10px", borderRadius: T.radiusSm, border: "none", background: T.purple, color: "#fff", fontFamily: T.fontBody, fontWeight: 600, cursor: "pointer" }}>Save Alternate</button>
            <button onClick={() => setEditingAlt(null)} style={{ flex: 1, padding: "10px", borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: "transparent", color: T.inkMid, fontFamily: T.fontBody, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step card for Today view ──────────────────────────────────────────
function StepCard({ s, isAlt, checkedSteps, toggleCheck, T }) {
  const isChecked = checkedSteps[s.id];
  return (
    <div style={{ background: isAlt ? T.purpleLight : T.bgCard, borderRadius: T.radiusLg, border: isAlt ? `1.5px solid ${T.purple}44` : `1px solid ${T.border}`, padding: "15px 17px", marginBottom: 10, display: "flex", gap: 12, alignItems: "flex-start", opacity: isChecked ? 0.4 : 1, transition: "opacity 0.2s" }}>
      <button onClick={() => toggleCheck(s.id)} style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, marginTop: 1, cursor: "pointer", border: `2px solid ${isChecked ? T.green : T.border}`, background: isChecked ? T.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
        {isChecked && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1 }}>✓</span>}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3, color: isAlt ? T.purple : T.accent }}>
          {s.category}{isAlt ? " · ALT" : ""}
        </div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: s.note ? 3 : 0 }}>{s.product || <span style={{ color: T.inkLight, fontStyle: "italic" }}>Not set</span>}</div>
        {s.note && <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.inkMid, lineHeight: 1.5 }}>{s.note}</div>}
      </div>
    </div>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────
function Onboarding({ user, onComplete, dark, toggleDark }) {
  const T = makeTokens(dark);
  const [chosen, setChosen] = useState(null);
  const [saving, setSaving]  = useState(false);

  const handleStart = async () => {
    if (!chosen) return;
    setSaving(true);
    const profile = { displayName: user.displayName, photoURL: user.photoURL, skinType: chosen, createdAt: new Date().toISOString(), streakCount: 0, lastCompletedDate: null };
    const daily   = DEFAULT_DAILY();
    await saveProfile(user.uid, profile);
    await saveUserData(user.uid, "amSteps",   DEFAULT_AM_STEPS);
    await saveUserData(user.uid, "daily",     daily);
    await saveUserData(user.uid, "inventory", []);
    await saveUserData(user.uid, "skinLog",   []);
    await saveUserData(user.uid, "checked",   { date: TODAY_DATE, steps: {} });
    await saveUserData(user.uid, "alternates",[]);
    await saveUserData(user.uid, "dayOverrides", {});
    onComplete(profile, DEFAULT_AM_STEPS, daily);
  };

  return (
    <div style={{ minHeight: "100svh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ position: "absolute", top: 20, right: 20 }}><DarkToggle dark={dark} toggle={toggleDark} /></div>
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.inkLight, letterSpacing: "0.16em", marginBottom: 8, textAlign: "center" }}>WELCOME, {(user.displayName || "").split(" ")[0].toUpperCase()}</div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 30, fontWeight: 600, color: T.ink, fontStyle: "italic", textAlign: "center", marginBottom: 6 }}>What's your skin type?</div>
        <div style={{ fontFamily: T.fontBody, fontSize: 13, color: T.inkLight, textAlign: "center", marginBottom: 28, lineHeight: 1.7 }}>We'll set up your blank routine — you fill in your products.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {SKIN_TYPES.map(t => (
            <button key={t.key} onClick={() => setChosen(t.key)} style={{ background: chosen === t.key ? T.accentLight : T.bgCard, border: `2px solid ${chosen === t.key ? T.accent : T.border}`, borderRadius: T.radiusLg, padding: "14px 18px", cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{t.emoji}</span>
                <div>
                  <div style={{ fontFamily: T.fontBody, fontSize: 14, fontWeight: 600, color: chosen === t.key ? T.accent : T.ink, marginBottom: 2 }}>{t.label}</div>
                  <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkLight }}>{t.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <button onClick={handleStart} disabled={!chosen || saving} style={{ width: "100%", padding: "14px", borderRadius: T.radius, border: "none", cursor: chosen ? "pointer" : "not-allowed", background: chosen ? T.accent : T.bgSubtle, color: chosen ? "#fff" : T.inkLight, fontFamily: T.fontDisplay, fontSize: 17, fontWeight: 600, fontStyle: "italic" }}>
          {saving ? "Setting up…" : "Start my routine →"}
        </button>
      </div>
    </div>
  );
}

// ── Sign in ───────────────────────────────────────────────────────────
function SignIn({ dark, toggleDark }) {
  const T = makeTokens(dark);
  const [loading, setLoading] = useState(false);
  const go = async () => { setLoading(true); try { await signInWithGoogle(); } catch(e) { console.error(e); setLoading(false); } };
  return (
    <div style={{ minHeight: "100svh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ position: "absolute", top: 20, right: 20 }}><DarkToggle dark={dark} toggle={toggleDark} /></div>
      <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", border: `1px solid ${T.borderDark}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", background: T.bgCard, fontSize: 30 }}>🌿</div>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.inkLight, letterSpacing: "0.18em", marginBottom: 12 }}>SUMMER 2026</div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 34, fontWeight: 600, color: T.ink, fontStyle: "italic", marginBottom: 8, lineHeight: 1.2 }}>Your personal<br />skin dashboard</div>
        <div style={{ fontFamily: T.fontBody, fontSize: 13, color: T.inkLight, lineHeight: 1.7, maxWidth: 280, margin: "0 auto 40px" }}>Track your routine, inventory, and skin — privately. Everyone gets their own space.</div>
        <button onClick={go} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: T.radius, border: `1.5px solid ${T.border}`, cursor: "pointer", background: T.bgCard, color: T.ink, fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.3z"/><path fill="#34A853" d="M24 48c6.6 0 12.2-2.2 16.2-6l-7.9-6c-2.2 1.5-5 2.3-8.3 2.3-6.4 0-11.8-4.3-13.7-10.1H2.2v6.2C6.2 42.6 14.5 48 24 48z"/><path fill="#FBBC05" d="M10.3 28.2c-.5-1.5-.8-3-.8-4.6s.3-3.2.8-4.6v-6.2H2.2C.8 16.1 0 19.9 0 23.6s.8 7.5 2.2 10.8l8.1-6.2z"/><path fill="#EA4335" d="M24 9.5c3.6 0 6.8 1.2 9.3 3.6l7-7C36.2 2.2 30.6 0 24 0 14.5 0 6.2 5.4 2.2 13.4l8.1 6.2C12.2 13.8 17.6 9.5 24 9.5z"/></svg>
          {loading ? "Signing in…" : "Continue with Google"}
        </button>
        <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkLight, marginTop: 18 }}>Your data is private. Friends get their own separate space.</div>
      </div>
    </div>
  );
}

function StreakBadge({ streak, T }) {
  if (!streak || streak < 2) return null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: streak >= 7 ? T.accentLight : T.goldLight, border: `1px solid ${streak >= 7 ? T.accent : T.gold}`, borderRadius: 99, padding: "5px 14px", marginBottom: 16 }}>
      <span style={{ fontSize: 14 }}>{streak >= 7 ? "🔥" : "⚡"}</span>
      <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 700, color: streak >= 7 ? T.accent : T.gold }}>{streak} day streak</span>
    </div>
  );
}

// ── AI Advisor ────────────────────────────────────────────────────────
function AIAdvisor({ amSteps, daily, inventory, skinLog, profile, T }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef(null);
  useEffect(() => { if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const systemPrompt = `You are a knowledgeable, friendly skincare advisor. You have full context about this user's routine, inventory, and skin log.
USER PROFILE: Skin type: ${profile?.skinType || "Not specified"}, Name: ${profile?.displayName || "User"}, Streak: ${profile?.streakCount || 0} days
AM ROUTINE: ${JSON.stringify(amSteps?.map(s => `${s.category}: ${s.product}`))}
PM SCHEDULE: ${JSON.stringify(Object.entries(daily || {}).map(([day, d]) => ({ day, steps: d.steps?.map(s => `${s.category}: ${s.product}`) })))}
INVENTORY: ${JSON.stringify(inventory?.map(i => ({ name: i.name, status: i.status, level: i.level + "%" })))}
RECENT LOG: ${JSON.stringify(skinLog?.slice(0, 5).map(e => ({ date: e.date, mood: e.mood, oiliness: e.oiliness })))}
Give concise, personalised advice. Keep responses short and mobile-friendly. Be warm, not clinical.`;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const res  = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: systemPrompt, messages: updated.slice(-12) }) });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: !res.ok || data.error ? "Error: " + (data.error || "Unknown") : data.text }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Network error: " + err.message }]);
    } finally { setLoading(false); }
  };

  const suggestions = ["What's causing my oily T-zone?", "Can I add Vitamin C?", "Is my routine good for PIH?", "What should I restock first?"];
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
              {suggestions.map(s => <button key={s} onClick={() => setInput(s)} style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.accent, background: T.accentLight, border: `1px solid ${T.accent}44`, borderRadius: 99, padding: "6px 13px", cursor: "pointer" }}>{s}</button>)}
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
            {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent, opacity: 0.5, animation: `bounce 1s ease-in-out ${i*0.15}s infinite` }} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask anything about your skin…" style={{ flex: 1, padding: "11px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontFamily: T.fontBody, fontSize: 16, outline: "none", background: T.bgSubtle, color: T.ink }} />
        <button onClick={send} disabled={!input.trim() || loading} style={{ background: input.trim() ? T.accent : T.bgSubtle, color: input.trim() ? "#fff" : T.inkLight, border: "none", borderRadius: T.radiusSm, padding: "11px 16px", cursor: "pointer", fontFamily: T.fontBody, fontSize: 13, fontWeight: 600 }}>Send</button>
      </div>
      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }`}</style>
    </div>
  );
}

// ── Backup helpers ────────────────────────────────────────────────────
function buildBackupData(profile, amSteps, daily, inventory, skinLog, alternates, dayOverrides) {
  return { version: "4.0", exportedAt: new Date().toISOString(), profile, amSteps, daily, inventory, skinLog, alternates, dayOverrides };
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadTextAsPDF(text, filename) {
  // Simple approach: open a new window with formatted content and trigger print-to-PDF
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head><title>${filename}</title><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:20px;line-height:1.7;color:#1C1917}h1{color:#C2622D;font-size:22px}h2{color:#57534E;font-size:16px;margin-top:24px;border-bottom:1px solid #E8E3DA;padding-bottom:4px}pre{background:#F0EDE8;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-word}@media print{body{margin:0}}</style></head><body>${text}</body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); }, 400);
}

function buildReadableSummary(data) {
  const d = data;
  let out = `<h1>Skincare Dashboard Export</h1><p><strong>Exported:</strong> ${new Date(d.exportedAt).toLocaleString()}</p>`;
  out += `<h2>Profile</h2><p>Name: ${d.profile?.displayName || "—"} · Skin type: ${d.profile?.skinType || "—"} · Streak: ${d.profile?.streakCount || 0} days</p>`;
  out += `<h2>AM Routine</h2><pre>${(d.amSteps || []).map((s,i) => `${i+1}. [${s.category}] ${s.product}${s.note ? " — " + s.note : ""}`).join("\n")}</pre>`;
  out += `<h2>PM Weekly Schedule</h2>`;
  DAYS.forEach(day => {
    const sc = d.daily?.[day];
    if (!sc) return;
    out += `<h3 style="margin:12px 0 4px;color:#C2622D">${day} — ${sc.label}</h3>`;
    out += `<pre>${(sc.steps || []).map((s,i) => `${i+1}. [${s.category}] ${s.product}${s.note ? " — " + s.note : ""}`).join("\n")}</pre>`;
    if ((sc.footnotes || []).length) out += `<p style="font-size:12px;color:#57534E">${sc.footnotes.join("<br>")}</p>`;
  });
  out += `<h2>Inventory (${(d.inventory || []).length} items)</h2><pre>${(d.inventory || []).map(i => `• ${i.name} [${i.category}] ${i.status} ${i.level}%${i.expiry ? " exp:"+i.expiry : ""}`).join("\n")}</pre>`;
  out += `<h2>Skin Log (last 30 entries)</h2><pre>${(d.skinLog || []).slice(0,30).map(e => `${e.date} ${e.mood} ${e.oiliness}${e.notes ? " — "+e.notes : ""}`).join("\n") || "No entries yet"}</pre>`;
  if ((d.alternates || []).length) {
    out += `<h2>Alternate Rotations</h2><pre>${d.alternates.map(a => `Step ${a.stepId}: ${a.altProduct} (${a.frequency} from ${a.startDate})`).join("\n")}</pre>`;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Main App ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [dark, setDark] = useState(() => { try { return localStorage.getItem("sc_dark") === "1"; } catch { return false; } });
  const toggleDark = () => setDark(d => { const n = !d; try { localStorage.setItem("sc_dark", n ? "1" : "0"); } catch {} return n; });
  const T = makeTokens(dark);

  const [authUser,     setAuthUser]     = useState(undefined);
  const [profile,      setProfile]      = useState(null);
  const [needsOnboard, setNeedsOnboard] = useState(false);

  // ── Core data — all from Firebase, no hardcoded products ──
  const [amSteps,     setAmSteps]     = useState(DEFAULT_AM_STEPS);
  const [daily,       setDaily]       = useState(DEFAULT_DAILY());
  const [inventory,   setInventory]   = useState([]);
  const [skinLog,     setSkinLog]     = useState([]);
  const [checked,     setChecked]     = useState({ date: TODAY_DATE, steps: {} });
  const [alternates,  setAlternates]  = useState([]);   // alternate rotations
  const [dayOverrides,setDayOverrides]= useState({});   // per-day AM overrides

  // ── UI state ──
  const [tab,           setTab]           = useState("today");
  const [toast,         setToast]         = useState(null);
  const [filterCat,     setFilterCat]     = useState("All");
  const [editingRoutine,setEditingRoutine]= useState(null); // null | "am" | day string
  const [editItem,      setEditItem]      = useState(null);
  const [addingItem,    setAddingItem]    = useState(false);
  const [newItem,       setNewItem]       = useState({ name: "", category: "Serum", status: "In Use", level: 100, notes: "", expiry: "" });
  const [logForm,       setLogForm]       = useState({ mood: "😊", oiliness: "Normal", notes: "" });
  const [showLog,       setShowLog]       = useState(false);
  const [showBackup,    setShowBackup]    = useState(false);
  const [importError,   setImportError]   = useState("");

  // Temp state while editing a routine
  const [draftSteps,   setDraftSteps]   = useState([]);
  const [draftMeta,    setDraftMeta]    = useState({});
  const [draftAlts,    setDraftAlts]    = useState([]);

  const showToast = useCallback((msg) => setToast(msg), []);

  // ── Auth ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user || null);
      if (!user) { setNeedsOnboard(false); return; }
      const prof = await loadProfile(user.uid);
      if (!prof) setNeedsOnboard(true);
      else { setProfile(prof); setNeedsOnboard(false); await loadAllData(user.uid); }
    });
    return unsub;
  }, []);

  const loadAllData = async (uid) => {
    const [am, dy, inv, log, chk, alts, over] = await Promise.all([
      loadUserData(uid, "amSteps"),    loadUserData(uid, "daily"),
      loadUserData(uid, "inventory"),  loadUserData(uid, "skinLog"),
      loadUserData(uid, "checked"),    loadUserData(uid, "alternates"),
      loadUserData(uid, "dayOverrides"),
    ]);
    if (am   !== null) setAmSteps(am);
    if (dy   !== null) setDaily(dy);
    if (inv  !== null) setInventory(inv);
    if (log  !== null) setSkinLog(log);
    if (alts !== null) setAlternates(alts);
    if (over !== null) setDayOverrides(over);
    if (chk  !== null) setChecked(chk.date === TODAY_DATE ? chk : { date: TODAY_DATE, steps: {} });
  };

  const save = useCallback((field, value) => {
    if (!authUser) return;
    saveUserData(authUser.uid, field, value).catch(console.error);
  }, [authUser]);

  useEffect(() => { if (authUser) save("amSteps",     amSteps);     }, [amSteps]);
  useEffect(() => { if (authUser) save("daily",       daily);       }, [daily]);
  useEffect(() => { if (authUser) save("inventory",   inventory);   }, [inventory]);
  useEffect(() => { if (authUser) save("skinLog",     skinLog);     }, [skinLog]);
  useEffect(() => { if (authUser) save("checked",     checked);     }, [checked]);
  useEffect(() => { if (authUser) save("alternates",  alternates);  }, [alternates]);
  useEffect(() => { if (authUser) save("dayOverrides",dayOverrides); }, [dayOverrides]);

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

  // ── Resolve today's steps with alternate rotation ──
  const resolveStepsForToday = useCallback((steps, alts) => {
    return (steps || []).map(s => {
      const alt = getAlternateForToday(s, alts, TODAY_DATE);
      if (alt) return { ...s, product: alt.altProduct, note: alt.altNote || s.note, _isAlt: true };
      return s;
    });
  }, []);

  // Today's AM — use day override if set, else shared AM
  const todayAMRaw    = dayOverrides[TODAY]?.amSteps || amSteps;
  const todayAMSteps  = useMemo(() => resolveStepsForToday(todayAMRaw, alternates), [todayAMRaw, alternates]);

  // Today's PM
  const todayDaySched = daily[TODAY] || DEFAULT_DAILY()[TODAY];
  const todayPMSteps  = useMemo(() => resolveStepsForToday(todayDaySched.steps, alternates), [todayDaySched, alternates]);

  const allTodayIds    = [...todayAMSteps.map(s => s.id), ...todayPMSteps.map(s => s.id)];
  const checkedSteps   = checked.steps || {};
  const completedCount = allTodayIds.filter(id => checkedSteps[id]).length;
  const allDone        = completedCount === allTodayIds.length && allTodayIds.length > 0;

  useEffect(() => {
    if (allDone && profile && profile.lastCompletedDate !== TODAY_DATE) {
      updateStreak(); showToast("🔥 Routine complete! Streak updated.");
    }
  }, [allDone]);

  const toggleCheck = (id) => setChecked(prev => ({ ...prev, steps: { ...prev.steps, [id]: !prev.steps?.[id] } }));

  const todayProductNames = useMemo(() =>
    [...todayAMSteps, ...todayPMSteps].map(s => (s.product || "").toLowerCase()),
  [todayAMSteps, todayPMSteps]);

  // Alerts — suppress for products in today's routine
  const lowStockAlerts = inventory.filter(i =>
    (i.status === "Low Stock" || (i.level > 0 && i.level <= 20 && i.status !== "Wishlist")) &&
    !productInToday(i.name, todayProductNames)
  );
  const expiryAlerts = inventory.filter(i => {
    const es = expiryStatus(i.expiry);
    return es && es !== "ok" && !productInToday(i.name, todayProductNames);
  });
  const wishlistAlerts = inventory.filter(i => i.status === "Wishlist");

  // ── Routine editing ──
  const openEditRoutine = (key) => {
    if (key === "am") {
      setDraftSteps([...amSteps]);
      setDraftMeta({});
      setDraftAlts([...alternates]);
    } else {
      const sc = daily[key] || DEFAULT_DAILY()[key];
      setDraftSteps([...(sc.steps || DEFAULT_PM_BASE)]);
      setDraftMeta({ label: sc.label || "", goal: sc.goal || "", color: sc.color || "#A8A29E", footnoteText: (sc.footnotes || []).join("\n") });
      setDraftAlts([...alternates]);
    }
    setEditingRoutine(key);
  };

  const saveRoutine = () => {
    if (editingRoutine === "am") {
      setAmSteps(draftSteps);
      // If there's a per-day override for today, clear it (user just edited shared)
    } else {
      setDaily(prev => ({
        ...prev,
        [editingRoutine]: {
          ...prev[editingRoutine],
          steps: draftSteps,
          label: draftMeta.label || prev[editingRoutine]?.label || "Night",
          goal:  draftMeta.goal  || prev[editingRoutine]?.goal  || "",
          color: draftMeta.color || prev[editingRoutine]?.color || "#A8A29E",
          footnotes: (draftMeta.footnoteText || "").split("\n").filter(f => f.trim()),
        },
      }));
    }
    setAlternates(draftAlts);
    setEditingRoutine(null);
    showToast("Routine saved ✓");
  };

  const saveAmDayOverride = () => {
    setDayOverrides(prev => ({ ...prev, [TODAY]: { amSteps: draftSteps } }));
    setAlternates(draftAlts);
    setEditingRoutine(null);
    showToast(`${TODAY} AM override saved ✓`);
  };

  const clearDayOverride = (day) => {
    setDayOverrides(prev => { const n = { ...prev }; delete n[day]; return n; });
    showToast("Override cleared — using shared AM");
  };

  // ── Inventory ──
  const saveItem   = () => { setInventory(inv => inv.map(i => i.id === editItem.id ? editItem : i)); setEditItem(null); showToast("Product saved ✓"); };
  const deleteItem = () => { setInventory(inv => inv.filter(i => i.id !== editItem.id)); setEditItem(null); showToast("Product removed"); };
  const doAddItem  = () => { if (!newItem.name.trim()) return; setInventory(inv => [...inv, { ...newItem, id: Date.now() }]); setAddingItem(false); showToast("Product added ✓"); };

  // ── Skin log ──
  const saveLog = () => { setSkinLog(p => [{ ...logForm, date: TODAY_DATE, id: Date.now() }, ...p]); setLogForm({ mood: "😊", oiliness: "Normal", notes: "" }); setShowLog(false); showToast("Skin entry logged ✓"); };

  // ── Backup / restore ──
  const doExportJSON = () => {
    const data = buildBackupData(profile, amSteps, daily, inventory, skinLog, alternates, dayOverrides);
    downloadJSON(data, `skincare-backup-${TODAY_DATE}.json`);
  };
  const doExportPDF = () => {
    const data = buildBackupData(profile, amSteps, daily, inventory, skinLog, alternates, dayOverrides);
    downloadTextAsPDF(buildReadableSummary(data), `skincare-backup-${TODAY_DATE}`);
  };
  const doImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.amSteps || !data.daily) { setImportError("Invalid backup file."); return; }
        setAmSteps(data.amSteps);
        setDaily(data.daily);
        if (data.inventory)   setInventory(data.inventory);
        if (data.skinLog)     setSkinLog(data.skinLog);
        if (data.alternates)  setAlternates(data.alternates);
        if (data.dayOverrides) setDayOverrides(data.dayOverrides);
        setImportError("");
        setShowBackup(false);
        showToast("Backup restored ✓");
      } catch { setImportError("Could not parse file — make sure it's a valid JSON backup."); }
    };
    reader.readAsText(file);
  };

  // ── Shared styles ──
  const card = { background: T.bgCard, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, padding: "15px 17px", marginBottom: 10, boxShadow: dark ? "none" : "0 1px 4px rgba(28,25,23,0.05)" };
  const btnBase = { fontFamily: T.fontBody, fontWeight: 600, cursor: "pointer", border: "none", borderRadius: T.radiusSm, padding: "12px 16px", fontSize: 14, transition: "all 0.15s" };
  const cats = ["All", ...Array.from(new Set(inventory.map(i => i.category)))];
  const filteredInv = filterCat === "All" ? inventory : inventory.filter(i => i.category === filterCat);
  const isSunday = new Date().getDay() === 0;

  if (authUser === undefined) return (
    <div style={{ minHeight: "100svh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${T.border}`, borderTopColor: T.accent, animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!authUser) return <SignIn dark={dark} toggleDark={toggleDark} />;
  if (needsOnboard) return (
    <Onboarding user={authUser} onComplete={(prof, am, dy) => { setProfile(prof); setAmSteps(am); setDaily(dy); setInventory([]); setSkinLog([]); setNeedsOnboard(false); }} dark={dark} toggleDark={toggleDark} />
  );

  return (
    <div style={{ fontFamily: T.fontBody, background: T.bg, minHeight: "100svh", color: T.ink, transition: "background 0.3s, color 0.3s" }}>

      {/* HEADER */}
      <div style={{ background: T.bgCard, borderBottom: `1px solid ${T.border}`, paddingTop: `calc(14px + env(safe-area-inset-top))`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkLight, letterSpacing: "0.14em", marginBottom: 2 }}>SUMMER 2026 · SKIN DASHBOARD</div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.ink, fontStyle: "italic", lineHeight: 1 }}>{profile?.displayName?.split(" ")[0]}'s Routine</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <DarkToggle dark={dark} toggle={toggleDark} />
              <button onClick={() => setShowBackup(true)} style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkLight, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.08em" }}>BACKUP</button>
              {profile?.photoURL && <img src={profile.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: "50%", border: `1.5px solid ${T.border}` }} />}
              <button onClick={signOutUser} style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkLight, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.08em" }}>OUT</button>
            </div>
          </div>
          {(lowStockAlerts.length > 0 || expiryAlerts.length > 0 || wishlistAlerts.length > 0) && (
            <div style={{ marginTop: 9, display: "flex", gap: 5, flexWrap: "wrap" }}>
              {lowStockAlerts.slice(0,2).map(i => <span key={i.id} style={{ background: T.redLight, border: `1px solid ${T.red}88`, borderRadius: 7, padding: "2px 8px", fontFamily: T.fontBody, fontSize: 10, color: T.red, fontWeight: 600 }}>⚠ Low: {i.name.split(" ").slice(0,3).join(" ")}</span>)}
              {expiryAlerts.slice(0,1).map(i => { const d = daysUntilExpiry(i.expiry); return <span key={i.id} style={{ background: T.goldLight, border: `1px solid ${T.gold}88`, borderRadius: 7, padding: "2px 8px", fontFamily: T.fontBody, fontSize: 10, color: T.gold, fontWeight: 600 }}>{d < 0 ? "❌ Expired: " : "⏰ Exp soon: "}{i.name.split(" ").slice(0,3).join(" ")}</span>; })}
              {wishlistAlerts.slice(0,1).map(i => <span key={i.id} style={{ background: T.accentLight, border: `1px solid ${T.accent}55`, borderRadius: 7, padding: "2px 8px", fontFamily: T.fontBody, fontSize: 10, color: T.accent, fontWeight: 600 }}>🛒 {i.name.split(" ").slice(0,4).join(" ")}</span>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 2, marginTop: 12, background: T.bgSubtle, borderRadius: 99, padding: 3, overflowX: "auto" }}>
            {[["today","Today"],["routine","Routine"],["inventory","Inventory"],["log","Log"],["advisor","✨ Advisor"]].map(([id,lbl]) => (
              <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 12px", borderRadius: 99, border: "none", cursor: "pointer", fontFamily: T.fontBody, fontSize: 12, fontWeight: 600, background: tab === id ? T.bgCard : "transparent", color: tab === id ? T.ink : T.inkLight, transition: "all 0.18s", whiteSpace: "nowrap", flexShrink: 0, boxShadow: tab === id ? "0 1px 4px rgba(28,25,23,0.08)" : "none" }}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: `18px 15px calc(32px + env(safe-area-inset-bottom))` }}>

        {/* ── TODAY ── */}
        {tab === "today" && <>
          <StreakBadge streak={profile?.streakCount} T={T} />
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkLight, fontWeight: 700, letterSpacing: "0.1em" }}>TODAY'S PROGRESS</span>
              <span style={{ fontFamily: T.fontMono, fontSize: 10, color: allDone ? T.green : T.inkMid, fontWeight: 700 }}>{completedCount}/{allTodayIds.length} {allDone ? "✓ All done!" : "steps"}</span>
            </div>
            <div style={{ background: T.bgSubtle, borderRadius: 99, height: 6, overflow: "hidden" }}>
              <div style={{ width: `${allTodayIds.length ? (completedCount / allTodayIds.length) * 100 : 0}%`, background: allDone ? T.green : T.accent, height: "100%", borderRadius: 99, transition: "width 0.5s ease" }} />
            </div>
          </div>

          {isSunday && inventory.length > 0 && (
            <div style={{ ...card, marginBottom: 18 }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.accent, fontWeight: 700, letterSpacing: "0.14em", marginBottom: 8 }}>THIS WEEK AT A GLANCE</div>
              <div style={{ fontFamily: T.fontBody, fontSize: 13, color: T.inkMid }}>Review your skin log and restock alerts below.</div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Divider label="☀ AM — MORNING" color={T.gold} T={T} />
            <button onClick={() => openEditRoutine("am")} style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 600, color: T.gold, background: T.goldLight, border: `1px solid ${T.gold}44`, borderRadius: 99, padding: "3px 10px", cursor: "pointer", marginLeft: 8, flexShrink: 0, marginBottom: 12 }}>
              {dayOverrides[TODAY]?.amSteps ? "Edit Override" : "Edit / Override"}
            </button>
          </div>
          {dayOverrides[TODAY]?.amSteps && (
            <div style={{ background: T.purpleLight, border: `1px solid ${T.purple}44`, borderRadius: T.radiusSm, padding: "6px 12px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.purple, fontWeight: 700 }}>TODAY HAS A CUSTOM AM OVERRIDE</span>
              <button onClick={() => clearDayOverride(TODAY)} style={{ fontFamily: T.fontBody, fontSize: 10, color: T.purple, background: "none", border: "none", cursor: "pointer" }}>Clear →</button>
            </div>
          )}
          {todayAMSteps.map(s => <StepCard key={s.id} s={s} isAlt={s._isAlt} checkedSteps={checkedSteps} toggleCheck={toggleCheck} T={T} />)}

          <Divider label={`🌙 PM — ${(todayDaySched.label || "NIGHT").toUpperCase()}`} color={todayDaySched.color || T.accent} T={T} />
          {todayDaySched.goal && (
            <div style={{ background: T.bgCard, border: `1.5px solid ${(todayDaySched.color || T.accent) + "44"}`, borderRadius: T.radiusLg, padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: T.fontMono, fontSize: 9, color: todayDaySched.color || T.accent, fontWeight: 700, letterSpacing: "0.09em", marginBottom: 4 }}>TONIGHT'S GOAL</div>
                <div style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 600, color: T.ink }}>{todayDaySched.goal}</div>
              </div>
            </div>
          )}
          {todayPMSteps.map(s => <StepCard key={s.id} s={s} isAlt={s._isAlt} checkedSteps={checkedSteps} toggleCheck={toggleCheck} T={T} />)}
          {(todayDaySched.footnotes || []).length > 0 && (
            <div style={{ marginTop: 10, background: T.goldLight, border: `1px solid ${T.gold}55`, borderRadius: T.radiusLg, padding: "12px 16px" }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>⚡ TONIGHT'S NOTES</div>
              {todayDaySched.footnotes.map((fn, i) => <div key={i} style={{ fontFamily: T.fontBody, fontSize: 12, color: T.inkMid, lineHeight: 1.65, marginBottom: 4 }}>{fn}</div>)}
            </div>
          )}
        </>}

        {/* ── ROUTINE ── */}
        {tab === "routine" && <>
          {/* Shared AM */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 12px" }}>
            <div>
              <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.gold, fontWeight: 700, letterSpacing: "0.12em" }}>☀ SHARED AM ROUTINE</div>
              <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkLight, marginTop: 2 }}>Applied every day unless overridden per day</div>
            </div>
            <button onClick={() => openEditRoutine("am")} style={{ ...btnBase, background: T.goldLight, color: T.gold, fontSize: 12, padding: "8px 14px" }}>Edit</button>
          </div>
          {amSteps.map((s, i) => (
            <div key={s.id} style={{ ...card, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.inkLight, minWidth: 18, marginTop: 2 }}>{i+1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 2 }}>{s.category}</div>
                <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 600, color: T.ink }}>{s.product || <span style={{ color: T.inkLight, fontStyle: "italic" }}>Not set</span>}</div>
                {s.note && <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkMid }}>{s.note}</div>}
                {(alternates || []).find(a => a.stepId === s.id) && (() => { const alt = alternates.find(a => a.stepId === s.id); return (
                  <div style={{ marginTop: 5, background: T.purpleLight, borderRadius: T.radiusSm, padding: "4px 8px", display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.purple, fontWeight: 700 }}>ALT {alt.frequency?.toUpperCase()}</span>
                    <span style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink }}>{alt.altProduct}</span>
                  </div>
                ); })()}
              </div>
            </div>
          ))}

          {/* PM per day */}
          <Divider label="🌙 PM WEEKLY SCHEDULE" color={T.accent} T={T} />
          {DAYS.map(day => {
            const sc = daily[day] || DEFAULT_DAILY()[day];
            const isToday = day === TODAY;
            const hasOverride = !!dayOverrides[day]?.amSteps;
            return (
              <div key={day} style={{ ...card, padding: 0, overflow: "hidden", border: isToday ? `1.5px solid ${T.accent}55` : `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 700, color: isToday ? T.accent : T.inkMid }}>{day}</span>
                      {sc.label && <span style={{ background: (sc.color || T.accent) + "22", color: sc.color || T.accent, fontFamily: T.fontBody, fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 99 }}>{sc.label}</span>}
                      {isToday && <span style={{ background: T.accent, color: "#fff", fontFamily: T.fontMono, fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 99 }}>TODAY</span>}
                      {hasOverride && <span style={{ background: T.purpleLight, color: T.purple, fontFamily: T.fontMono, fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 99 }}>AM OVERRIDE</span>}
                    </div>
                    <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkMid }}>{sc.goal || "No goal set"}</div>
                    <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkLight, marginTop: 2 }}>{(sc.steps || []).length} steps</div>
                  </div>
                  <button onClick={() => openEditRoutine(day)} style={{ ...btnBase, background: T.accentLight, color: T.accent, fontSize: 12, padding: "8px 14px" }}>Edit</button>
                </div>
              </div>
            );
          })}
        </>}

        {/* ── INVENTORY ── */}
        {tab === "inventory" && <>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
            {cats.map(c => <button key={c} onClick={() => setFilterCat(c)} style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 600, padding: "6px 13px", borderRadius: 99, background: filterCat === c ? T.accent : T.bgCard, color: filterCat === c ? "#fff" : T.inkMid, border: `1px solid ${filterCat === c ? T.accent : T.border}`, cursor: "pointer" }}>{c}</button>)}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={() => { setNewItem({ name: "", category: "Serum", status: "In Use", level: 100, notes: "", expiry: "" }); setAddingItem(true); }} style={{ ...btnBase, background: T.accent, color: "#fff", fontSize: 13, padding: "9px 18px" }}>+ Add Product</button>
          </div>
          {filteredInv.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: T.inkLight, fontFamily: T.fontDisplay, fontSize: 16, fontStyle: "italic" }}>No products yet. Add your first product above.</div>}
          {filteredInv.map(item => {
            const sc          = STATUS_COLORS[item.status] || STATUS_COLORS["Empty"];
            const es          = expiryStatus(item.expiry);
            const isInToday   = productInToday(item.name, todayProductNames);
            const showExpWarn = es && es !== "ok" && !isInToday;
            const dLeft       = daysUntilExpiry(item.expiry);
            const estDays     = item.level > 0 && item.status === "In Use" ? Math.round(item.level / 2) : null;
            return (
              <div key={item.id} style={{ ...card, border: showExpWarn ? `1.5px solid ${dLeft !== null && dLeft < 0 ? T.red : T.gold}` : `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: item.level > 0 && item.status !== "Wishlist" ? 10 : 0 }}>
                  <div style={{ flex: 1, paddingRight: 8 }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{ background: (CAT_COLORS[item.category] || "#e5e7eb") + "33", fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99, color: T.inkMid }}>{item.category}</span>
                      <span style={{ background: sc.bg, color: sc.text, fontFamily: T.fontBody, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>● {item.status}</span>
                      {showExpWarn && <span style={{ background: dLeft !== null && dLeft < 0 ? T.redLight : T.goldLight, color: dLeft !== null && dLeft < 0 ? T.red : T.gold, fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{dLeft !== null && dLeft < 0 ? `❌ EXPIRED (${Math.abs(dLeft)}d ago)` : `⏰ ${dLeft}d left`}</span>}
                      {!isInToday && estDays !== null && item.level <= 20 && <span style={{ background: T.redLight, color: T.red, fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>🛒 ~{estDays}d left</span>}
                      {item.expiry && !showExpWarn && <span style={{ background: T.bgSubtle, color: T.inkLight, fontFamily: T.fontMono, fontSize: 9, padding: "2px 8px", borderRadius: 99 }}>exp {item.expiry}</span>}
                    </div>
                    <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 600, color: T.ink }}>{item.name}</div>
                    {item.notes && <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.inkMid, marginTop: 2 }}>{item.notes}</div>}
                  </div>
                  <button onClick={() => setEditItem({ ...item })} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkLight, fontSize: 18, padding: "0 4px", flexShrink:
