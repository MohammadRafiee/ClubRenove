import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  ChevronLeft, ChevronRight, Lock, Download, Search, X, Check, LogOut, Gauge,
} from "lucide-react";
import { supabase } from "./supabaseClient";

/* =========================================================================
   CONFIG — edit this block to change every question, label, and option in
   the survey. Nothing below this section needs to change to update copy.
   ========================================================================= */

const BUSINESS_TYPES = [
  "Restaurant", "Café", "Boutique", "Salon", "Fitness Studio",
  "Medical Office", "Retail", "Office", "Other",
];

const BUSINESS_SIZES = ["Under 500 sq ft", "500–1,000 sq ft", "1,000–2,000 sq ft", "Over 2,000 sq ft"];

const CHALLENGE_OPTIONS = [
  "Customers have difficulty hearing each other",
  "Employees struggle to communicate",
  "Music sounds uneven from area to area",
  "Some areas are louder than others",
  "Music is too loud",
  "Music is too quiet",
  "Echo or reverberation",
  "None of these",
];

const FUTURE_INTEREST_OPTIONS = [
  "Acoustic assessment",
  "Sound system design",
  "Music system installation",
  "Acoustic treatment",
  "Noise reduction",
  "Not interested at this time",
];

const PREFERRED_CONTACT = ["Phone call", "Email", "Text message"];

const ENVIRONMENT_ITEMS = [
  { id: "noiseLevel", label: "Noise level", question: "How would you describe the noise level in your space?", low: "Very noisy", high: "Very quiet" },
  { id: "easeOfConversation", label: "Ease of conversation", question: "How easy is it for customers to hold a conversation here?", low: "Very difficult", high: "Very easy" },
  { id: "customerComfort", label: "Customer comfort", question: "How comfortable do customers seem in your space?", low: "Not comfortable", high: "Very comfortable" },
  { id: "musicQuality", label: "Music quality", question: "How would you rate the quality of your background music?", low: "Poor", high: "Excellent" },
  { id: "atmosphere", label: "Overall atmosphere", question: "How would you rate the overall atmosphere of your business?", low: "Poor", high: "Excellent" },
];

const IMPORTANCE_ITEMS = [
  { id: "betterConversations", label: "Easy conversations", question: "How important is it that customers can hold conversations easily in your space?" },
  { id: "pleasantAtmosphere", label: "Pleasant atmosphere", question: "How important is the overall atmosphere to your business?" },
  { id: "distributedMusic", label: "Even music coverage", question: "How important is it that music sounds consistent throughout your space?" },
  { id: "reducedEcho", label: "Minimal echo", question: "How important is it that your space has minimal echo?" },
  { id: "speechClarity", label: "Speech clarity", question: "How important is it that speech comes through clearly in your space?" },
  { id: "employeeComfort", label: "Employee wellbeing impact", question: "How much do you think your employees' wellbeing affects business results — like service quality, retention, or productivity?", low: "No noticeable impact", high: "Major impact" },
];

const SOUND_BUDGET_RANGES = [
  "Under $500",
  "$500 – $2,000",
  "$2,000 – $5,000",
  "$5,000 – $15,000",
  "More than $15,000",
  "I'd need to know more first",
];

function buildQuestions() {
  const qs = [];
  qs.push({ id: "businessName", section: "Business Information", type: "text", label: "What's the name of your business?", placeholder: "e.g. The Corner Bistro", required: true });
  qs.push({ id: "businessType", section: "Business Information", type: "select", label: "Which best describes your business?", options: BUSINESS_TYPES, required: true });
  qs.push({ id: "businessSize", section: "Business Information", type: "select", label: "About how large is your space?", options: BUSINESS_SIZES, required: true });
  qs.push({ id: "employeeCount", section: "Business Information", type: "number", label: "How many employees work here?", placeholder: "e.g. 12", required: true });

 ENVIRONMENT_ITEMS.forEach((item) => {
  qs.push({ id: item.id, section: "Current Environment", type: "likert", label: item.question, low: item.low, high: item.high, required: true });
});

  qs.push({ id: "challenges", section: "Challenges", type: "multiselect", label: "Which of these have you experienced?", helper: "Select all that apply.", options: CHALLENGE_OPTIONS, allowOther: true, required: true });

  qs.push({ id: "soundBudgetRange", section: "Investment", type: "select", label: "If we could meaningfully improve the sound and atmosphere of your space, what investment range would feel reasonable to consider?", options: SOUND_BUDGET_RANGES, required: true });
  
IMPORTANCE_ITEMS.forEach((item) => {
  qs.push({
    id: item.id,
    section: "Priorities",
    type: "likert",
    label: item.question,
    low: item.low || "Not important",
    high: item.high || "Very important",
    required: true,
  });
});

  qs.push({ id: "futureInterest", section: "Future Interest", type: "multiselect", label: "Would you like to learn more about any of these?", helper: "Select all that apply.", options: FUTURE_INTEREST_OPTIONS, required: true });

  qs.push({ id: "contactName", section: "Contact Information", type: "text", label: "What's your name?", placeholder: "Full name", required: true });
  qs.push({ id: "contactPhone", section: "Contact Information", type: "tel", label: "Best phone number to reach you?", placeholder: "(555) 555-5555", required: false });
  qs.push({ id: "contactEmail", section: "Contact Information", type: "email", label: "What's your email address?", placeholder: "name@business.com", required: false });
  qs.push({ id: "preferredContact", section: "Contact Information", type: "select", label: "How would you prefer we follow up?", options: PREFERRED_CONTACT, required: true });
  qs.push({ id: "comments", section: "Contact Information", type: "textarea", label: "Anything else you'd like us to know?", placeholder: "Optional", required: false });

  return qs;
}

const QUESTIONS = buildQuestions();

/* =========================================================================
   DESIGN TOKENS
   ========================================================================= */

const COLORS = {
  bg: "#F7F6F3",
  panel: "#FFFFFF",
  ink: "#1B222C",
  inkSoft: "#5B6472",
  line: "#E1DED6",
  teal: "#2F8F86",
  tealDark: "#1F6961",
  amber: "#E2A83D",
  rust: "#C1543C",
  meterBg: "#EAE7DF",
};

/* =========================================================================
   DATA LAYER (Supabase)
   ========================================================================= */

const DRAFT_KEY = "acoustics-survey-draft";

function fromRow(row) {
  return {
    id: row.id,
    timestamp: row.created_at,
    startedAt: row.started_at,
    durationSeconds: row.duration_seconds,
    businessName: row.business_name,
    businessType: row.business_type,
    businessSize: row.business_size,
    employeeCount: row.employee_count,
    ratings: row.ratings || {},
    challenges: row.challenges || [],
    challengesOther: row.challenges_other || "",
    importance: row.importance || {},
    futureInterest: row.future_interest || [],
    investment: row.investment || {},
    contact: {
      name: row.contact_name,
      phone: row.contact_phone,
      email: row.contact_email,
      preferredContact: row.preferred_contact,
      comments: row.comments,
    },
  };
}

function toRow(entry) {
  return {
    started_at: entry.startedAt,
    duration_seconds: entry.durationSeconds,
    business_name: entry.businessName,
    business_type: entry.businessType,
    business_size: entry.businessSize,
    employee_count: entry.employeeCount,
    ratings: entry.ratings,
    challenges: entry.challenges,
    challenges_other: entry.challengesOther,
    importance: entry.importance,
    future_interest: entry.futureInterest,
    investment: entry.investment,
    contact_name: entry.contact.name,
    contact_phone: entry.contact.phone,
    contact_email: entry.contact.email,
    preferred_contact: entry.contact.preferredContact,
    comments: entry.contact.comments,
  };
}

async function loadSubmissions() {
  const { data, error } = await supabase
    .from("survey_submissions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return data.map(fromRow);
}

async function saveSubmission(entry) {
  const { error } = await supabase.from("survey_submissions").insert([toRow(entry)]);
  if (error) throw error;
}

async function bumpStartedCount() {
  try {
    await supabase.from("survey_starts").insert([{}]);
  } catch {
    /* best-effort */
  }
}

async function getStartedCount() {
  const { count, error } = await supabase
    .from("survey_starts")
    .select("*", { count: "exact", head: true });
  if (error) return 0;
  return count || 0;
}

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* =========================================================================
   SMALL UI PRIMITIVES
   ========================================================================= */

function PrimaryButton({ children, onClick, disabled, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#C9C6BE" : COLORS.ink,
        color: "#fff",
        border: "none",
        borderRadius: 14,
        padding: "16px 28px",
        fontFamily: "Inter, sans-serif",
        fontWeight: 600,
        fontSize: 17,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, disabled, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "transparent",
        color: disabled ? "#C9C6BE" : COLORS.ink,
        border: `1.5px solid ${disabled ? "#DEDBD3" : COLORS.line}`,
        borderRadius: 14,
        padding: "16px 24px",
        fontFamily: "Inter, sans-serif",
        fontWeight: 600,
        fontSize: 17,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function LevelMeter({ current, total }) {
  const segments = 24;
  const filled = Math.round((current / total) * segments);
  return (
    <div style={{ display: "flex", gap: 3, width: "100%" }}>
      {Array.from({ length: segments }).map((_, i) => {
        const isFilled = i < filled;
        const isPeak = i === filled - 1;
        let color = COLORS.meterBg;
        if (isFilled) {
          const t = i / segments;
          color = isPeak ? COLORS.amber : t > 0.7 ? COLORS.amber : COLORS.teal;
        }
        return <div key={i} style={{ flex: 1, height: 7, borderRadius: 2, background: color, transition: "background 0.25s ease" }} />;
      })}
    </div>
  );
}

function LikertScale({ value, onChange, low, high }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 18 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              style={{
                width: 64, height: 64, borderRadius: "50%",
                border: active ? `2px solid ${COLORS.teal}` : `1.5px solid ${COLORS.line}`,
                background: active ? COLORS.teal : COLORS.panel,
                color: active ? "#fff" : COLORS.ink,
                fontFamily: "IBM Plex Mono, monospace", fontSize: 22, fontWeight: 500, cursor: "pointer",
                boxShadow: active ? "0 4px 14px rgba(47,143,134,0.35)" : "none",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: COLORS.inkSoft, fontFamily: "Inter, sans-serif", padding: "0 4px" }}>
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function MultiSelect({ options, value = [], onChange, allowOther, otherValue, onOtherChange }) {
  const toggle = (opt) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            style={{
              display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 12,
              border: active ? `2px solid ${COLORS.teal}` : `1.5px solid ${COLORS.line}`,
              background: active ? "rgba(47,143,134,0.08)" : COLORS.panel,
              textAlign: "left", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 16, color: COLORS.ink,
            }}
          >
            <span style={{
              width: 24, height: 24, borderRadius: 7, flexShrink: 0,
              border: active ? "none" : `1.5px solid ${COLORS.line}`,
              background: active ? COLORS.teal : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {active && <Check size={16} color="#fff" strokeWidth={3} />}
            </span>
            {opt}
          </button>
        );
      })}
      {allowOther && value.includes("Other") && (
        <input value={otherValue || ""} onChange={(e) => onOtherChange(e.target.value)} placeholder="Tell us more…" style={inputStyle} />
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "16px 18px", borderRadius: 12, border: `1.5px solid ${COLORS.line}`,
  fontFamily: "Inter, sans-serif", fontSize: 17, color: COLORS.ink, background: COLORS.panel,
  outline: "none", boxSizing: "border-box",
};

/* =========================================================================
   QUESTION RENDERER
   ========================================================================= */

function QuestionScreen({ question, answers, setAnswer }) {
  const value = answers[question.id];

  if (question.type === "text" || question.type === "tel" || question.type === "email") {
    return <input type={question.type === "text" ? "text" : question.type} value={value || ""} onChange={(e) => setAnswer(question.id, e.target.value)} placeholder={question.placeholder} autoFocus style={inputStyle} />;
  }
  if (question.type === "number") {
    return <input type="number" inputMode="numeric" value={value ?? ""} onChange={(e) => setAnswer(question.id, e.target.value)} placeholder={question.placeholder} autoFocus style={inputStyle} />;
  }
  if (question.type === "textarea") {
    return <textarea value={value || ""} onChange={(e) => setAnswer(question.id, e.target.value)} placeholder={question.placeholder} rows={4} style={{ ...inputStyle, resize: "vertical" }} />;
  }
  if (question.type === "select") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {question.options.map((opt) => {
          const active = value === opt;
          return (
            <button key={opt} onClick={() => setAnswer(question.id, opt)} style={{
              padding: "16px 18px", borderRadius: 12,
              border: active ? `2px solid ${COLORS.teal}` : `1.5px solid ${COLORS.line}`,
              background: active ? "rgba(47,143,134,0.08)" : COLORS.panel,
              textAlign: "left", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 16,
              fontWeight: active ? 600 : 400, color: COLORS.ink,
            }}>
              {opt}
            </button>
          );
        })}
      </div>
    );
  }
  if (question.type === "likert") {
    return <LikertScale value={value} onChange={(v) => setAnswer(question.id, v)} low={question.low} high={question.high} />;
  }
  if (question.type === "multiselect") {
    return (
      <MultiSelect
        options={question.options}
        value={value || []}
        onChange={(v) => setAnswer(question.id, v)}
        allowOther={question.allowOther}
        otherValue={answers[question.id + "Other"]}
        onOtherChange={(v) => setAnswer(question.id + "Other", v)}
      />
    );
  }
  return null;
}

function isAnswered(question, answers) {
  if (!question.required) return true;
  const v = answers[question.id];
  if (question.type === "multiselect") return Array.isArray(v) && v.length > 0;
  if (question.type === "likert") return typeof v === "number";
  return v !== undefined && v !== null && String(v).trim() !== "";
}

/* =========================================================================
   SURVEY FLOW
   ========================================================================= */

function SurveyFlow({ onComplete, onExitToIntro }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw).answers || {} : {};
    } catch {
      return {};
    }
  });
  const [saving, setSaving] = useState(false);
  const startedAtRef = useRef(new Date().toISOString());

  const question = QUESTIONS[stepIndex];
  const total = QUESTIONS.length;

  const setAnswer = useCallback((id, val) => {
    setAnswers((prev) => ({ ...prev, [id]: val }));
  }, []);

  const goNext = async () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, stepIndex }));
    } catch {
      /* ignore */
    }
    if (stepIndex < total - 1) {
      setStepIndex((i) => i + 1);
    } else {
      setSaving(true);
      const entry = buildSubmission(answers, startedAtRef.current);
      try {
        await saveSubmission(entry);
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        onComplete(entry);
      } catch (e) {
        setSaving(false);
        alert("We couldn't save your response — please try again.");
      }
    }
  };

  const goBack = () => {
    if (stepIndex === 0) { onExitToIntro(); return; }
    setStepIndex((i) => i - 1);
  };

  const answered = isAnswered(question, answers);
  const isLast = stepIndex === total - 1;

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", background: COLORS.bg }}>
      <div style={{ padding: "20px 24px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: COLORS.inkSoft, letterSpacing: 1 }}>{question.section.toUpperCase()}</span>
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: COLORS.inkSoft }}>{String(stepIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        </div>
        <LevelMeter current={stepIndex + 1} total={total} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 28px", maxWidth: 560, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 26, fontWeight: 600, color: COLORS.ink, marginBottom: 6, lineHeight: 1.3 }}>{question.label}</h2>
        {question.helper && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: COLORS.inkSoft, marginBottom: 20 }}>{question.helper}</p>}
        {!question.helper && <div style={{ height: 16 }} />}
        <QuestionScreen question={question} answers={answers} setAnswer={setAnswer} />
        {!question.required && <p style={{ marginTop: 12, fontFamily: "Inter, sans-serif", fontSize: 13, color: COLORS.inkSoft, fontStyle: "italic" }}>Optional</p>}
      </div>

      <div style={{ padding: "18px 24px 28px", display: "flex", gap: 12, maxWidth: 560, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <SecondaryButton onClick={goBack} style={{ flex: "0 0 auto" }}>
          <ChevronLeft size={20} style={{ verticalAlign: "middle" }} />
        </SecondaryButton>
        <PrimaryButton onClick={goNext} disabled={!answered || saving} style={{ flex: 1 }}>
          {saving ? "Saving…" : isLast ? "Submit" : "Next"}
          {!isLast && !saving && <ChevronRight size={18} style={{ verticalAlign: "middle", marginLeft: 6 }} />}
        </PrimaryButton>
      </div>
    </div>
  );
}

function buildSubmission(answers, startedAt) {
  const now = new Date();
  const started = new Date(startedAt);
  return {
    id: uuid(),
    timestamp: now.toISOString(),
    startedAt,
    durationSeconds: Math.max(0, Math.round((now - started) / 1000)),
    businessName: answers.businessName || "",
    businessType: answers.businessType || "",
    businessSize: answers.businessSize || "",
    employeeCount: answers.employeeCount || "",
    ratings: Object.fromEntries(ENVIRONMENT_ITEMS.map((i) => [i.id, answers[i.id]])),
    challenges: answers.challenges || [],
    challengesOther: answers.challengesOther || "",
    importance: Object.fromEntries(IMPORTANCE_ITEMS.map((i) => [i.id, answers[i.id]])),
    futureInterest: answers.futureInterest || [],
    investment: {
    soundBudgetRange: answers.soundBudgetRange || "",
    },
    contact: {
      name: answers.contactName || "",
      phone: answers.contactPhone || "",
      email: answers.contactEmail || "",
      preferredContact: answers.preferredContact || "",
      comments: answers.comments || "",
    },
  };
}

/* =========================================================================
   INTRO / THANK YOU
   ========================================================================= */

function IntroScreen({ onBegin, onAdminTap }) {
  const [tapCount, setTapCount] = useState(0);
  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: COLORS.bg, textAlign: "center" }}>
      <div onClick={() => setTapCount((c) => c + 1)} style={{ marginBottom: 28, cursor: "default" }}>
        <Gauge size={40} color={COLORS.teal} strokeWidth={1.75} />
      </div>
      <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 30, fontWeight: 700, color: COLORS.ink, marginBottom: 12, maxWidth: 440 }}>
        Help us understand your space
      </h1>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 16, color: COLORS.inkSoft, maxWidth: 380, marginBottom: 36, lineHeight: 1.6 }}>
        A short, 3–5 minute survey about the sound and atmosphere of your business. Your answers help us recommend the right improvements — no obligation.
      </p>
      <PrimaryButton onClick={onBegin} style={{ padding: "18px 40px", fontSize: 18 }}>Begin survey</PrimaryButton>
      <button onClick={() => { if (tapCount >= 2) onAdminTap(); }} style={{ marginTop: 40, background: "none", border: "none", color: COLORS.line, fontSize: 12, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
        {tapCount >= 2 ? "Open admin" : "·"}
      </button>
    </div>
  );
}

function ThankYouScreen({ submission, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 10000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: COLORS.bg, textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: COLORS.teal, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
        <Check size={36} color="#fff" strokeWidth={3} />
      </div>
      <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 26, fontWeight: 700, color: COLORS.ink, marginBottom: 10 }}>Thank you!</h1>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 16, color: COLORS.inkSoft, maxWidth: 360, marginBottom: 28, lineHeight: 1.6 }}>
        We've saved your responses and will follow up using the contact details you provided.
      </p>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13, color: COLORS.inkSoft, background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "10px 16px" }}>
        SURVEY ID {submission.id.slice(0, 8).toUpperCase()}
      </div>
      <button onClick={onDone} style={{ marginTop: 32, background: "none", border: "none", color: COLORS.inkSoft, fontSize: 14, cursor: "pointer", textDecoration: "underline", fontFamily: "Inter, sans-serif" }}>
        Start another survey
      </button>
    </div>
  );
}

/* =========================================================================
   ADMIN
   ========================================================================= */

function AdminLogin({ onSuccess, onCancel }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    if (error) {
      setError("Incorrect email or password");
      setPw("");
    } else {
      onSuccess();
    }
  };

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: COLORS.bg }}>
      <Lock size={32} color={COLORS.ink} style={{ marginBottom: 18 }} />
      <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 22, fontWeight: 700, color: COLORS.ink, marginBottom: 18 }}>Admin access</h2>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoFocus style={{ ...inputStyle, maxWidth: 280, textAlign: "center", marginBottom: 10 }} />
      <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Password" style={{ ...inputStyle, maxWidth: 280, textAlign: "center", marginBottom: error ? 8 : 18 }} />
      {error && <p style={{ color: COLORS.rust, fontFamily: "Inter, sans-serif", fontSize: 13, marginBottom: 14 }}>{error}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <SecondaryButton onClick={onCancel} style={{ padding: "12px 20px", fontSize: 15 }}>Cancel</SecondaryButton>
        <PrimaryButton onClick={submit} disabled={loading} style={{ padding: "12px 20px", fontSize: 15 }}>{loading ? "Checking…" : "Log in"}</PrimaryButton>
      </div>
    </div>
  );
}

function toCSV(rows) {
  const header = [
    "id", "timestamp", "durationSeconds", "businessName", "businessType", "businessSize", "employeeCount",
    ...ENVIRONMENT_ITEMS.map((i) => `rating_${i.id}`),
    "challenges", "challengesOther",
    ...IMPORTANCE_ITEMS.map((i) => `importance_${i.id}`),
    "futureInterest", "contactName", "contactPhone", "contactEmail", "preferredContact", "comments",
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  rows.forEach((r) => {
    const line = [
      r.id, r.timestamp, r.durationSeconds, r.businessName, r.businessType, r.businessSize, r.employeeCount,
      ...ENVIRONMENT_ITEMS.map((i) => r.ratings?.[i.id] ?? ""),
      (r.challenges || []).join("; "), r.challengesOther,
      ...IMPORTANCE_ITEMS.map((i) => r.importance?.[i.id] ?? ""),
      (r.futureInterest || []).join("; "),
      r.contact?.name, r.contact?.phone, r.contact?.email, r.contact?.preferredContact, r.contact?.comments,
    ].map(esc);
    lines.push(line.join(","));
  });
  return lines.join("\n");
}

function downloadCSV(rows) {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `acoustics-survey-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function average(nums) {
  const clean = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: "18px 20px", flex: 1, minWidth: 150 }}>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: COLORS.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
      <p style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 26, fontWeight: 700, color: COLORS.ink }}>{value}</p>
      {sub && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: COLORS.inkSoft, marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,34,44,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={onClose}>
      <div style={{ background: COLORS.panel, borderRadius: 16, padding: 28, maxWidth: 520, width: "100%", maxHeight: "85vh", overflowY: "auto", position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer" }}>
          <X size={20} color={COLORS.inkSoft} />
        </button>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: COLORS.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</p>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 15, color: COLORS.ink }}>{value}</p>
    </div>
  );
}

function SubmissionDetail({ submission }) {
  const s = submission;
  return (
    <div>
      <h3 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{s.businessName || "(no name)"}</h3>
      <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: COLORS.inkSoft, marginBottom: 18 }}>{new Date(s.timestamp).toLocaleString()} · ID {s.id.slice(0, 8)}</p>
      <DetailRow label="Business type" value={s.businessType} />
      <DetailRow label="Size" value={s.businessSize} />
      <DetailRow label="Employees" value={s.employeeCount} />
      <div style={{ height: 1, background: COLORS.line, margin: "16px 0" }} />
      {ENVIRONMENT_ITEMS.map((i) => <DetailRow key={i.id} label={i.label} value={s.ratings?.[i.id]} />)}
      <div style={{ height: 1, background: COLORS.line, margin: "16px 0" }} />
      <DetailRow label="Challenges" value={(s.challenges || []).join(", ")} />
      <DetailRow label="Challenges — other" value={s.challengesOther} />
      <div style={{ height: 1, background: COLORS.line, margin: "16px 0" }} />
      {IMPORTANCE_ITEMS.map((i) => <DetailRow key={i.id} label={i.label} value={s.importance?.[i.id]} />)}
      <div style={{ height: 1, background: COLORS.line, margin: "16px 0" }} />
      <DetailRow label="Future interest" value={(s.futureInterest || []).join(", ")} />
      <div style={{ height: 1, background: COLORS.line, margin: "16px 0" }} />
      <DetailRow label="Contact name" value={s.contact?.name} />
      <DetailRow label="Phone" value={s.contact?.phone} />
      <DetailRow label="Email" value={s.contact?.email} />
      <DetailRow label="Preferred contact" value={s.contact?.preferredContact} />
      <DetailRow label="Comments" value={s.contact?.comments} />
    </div>
  );
}

function ChartCard({ title, children, span2 }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16, gridColumn: span2 ? "1 / -1" : "auto" }}>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, color: COLORS.ink, marginBottom: 8 }}>{title}</p>
      {children}
    </div>
  );
}

function AdminDashboard({ onExit }) {
  const [submissions, setSubmissions] = useState([]);
  const [startedCount, setStartedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [interestFilter, setInterestFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [subs, started] = await Promise.all([loadSubmissions(), getStartedCount()]);
    setSubmissions(subs);
    setStartedCount(started);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => submissions.filter((s) => {
    if (typeFilter !== "All" && s.businessType !== typeFilter) return false;
    if (interestFilter !== "All" && !(s.futureInterest || []).includes(interestFilter)) return false;
    if (dateFrom && new Date(s.timestamp) < new Date(dateFrom)) return false;
    if (dateTo && new Date(s.timestamp) > new Date(dateTo + "T23:59:59")) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${s.businessName} ${s.contact?.name} ${s.contact?.email}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [submissions, typeFilter, interestFilter, dateFrom, dateTo, search]);

  const stats = useMemo(() => {
    const total = submissions.length;
    const completionRate = startedCount > 0 ? Math.round((total / startedCount) * 100) : total > 0 ? 100 : 0;
    const avgDuration = average(submissions.map((s) => s.durationSeconds));
    const typeCounts = {};
    submissions.forEach((s) => { if (s.businessType) typeCounts[s.businessType] = (typeCounts[s.businessType] || 0) + 1; });
    const commonType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    return { total, completionRate, avgDuration, commonType };
  }, [submissions, startedCount]);

  const ratingChartData = useMemo(() => ENVIRONMENT_ITEMS.map((i) => ({
    name: i.label.replace("Overall ", "").replace("Quality of ", ""),
    value: Math.round((average(submissions.map((s) => s.ratings?.[i.id])) || 0) * 10) / 10,
  })), [submissions]);

  const importanceChartData = useMemo(() => IMPORTANCE_ITEMS.map((i) => ({
    name: i.label.length > 18 ? i.label.slice(0, 16) + "…" : i.label,
    value: Math.round((average(submissions.map((s) => s.importance?.[i.id])) || 0) * 10) / 10,
  })), [submissions]);

  const interestChartData = useMemo(() => FUTURE_INTEREST_OPTIONS.map((opt) => ({
    name: opt.length > 16 ? opt.slice(0, 14) + "…" : opt,
    value: submissions.filter((s) => (s.futureInterest || []).includes(opt)).length,
  })), [submissions]);

  const businessTypesPresent = useMemo(() => Array.from(new Set(submissions.map((s) => s.businessType).filter(Boolean))), [submissions]);

  const logout = async () => {
    await supabase.auth.signOut();
    onExit();
  };

  return (
    <div style={{ minHeight: "100%", background: COLORS.bg, padding: "24px 20px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, maxWidth: 1000, margin: "0 auto 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Gauge size={22} color={COLORS.teal} />
          <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 22, fontWeight: 700, color: COLORS.ink }}>Survey Dashboard</h1>
        </div>
        <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: COLORS.inkSoft, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 14 }}>
          <LogOut size={16} /> Log out
        </button>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
          <StatCard label="Completed surveys" value={stats.total} />
          <StatCard label="Completion rate" value={`${stats.completionRate}%`} sub={`${startedCount} started`} />
          <StatCard label="Avg. completion time" value={stats.avgDuration ? `${Math.round(stats.avgDuration / 60 * 10) / 10} min` : "—"} />
          <StatCard label="Most common business" value={stats.commonType} />
        </div>

        {submissions.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <ChartCard title="Average environment ratings (1–5)">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ratingChartData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "Inter" }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>{ratingChartData.map((_, i) => <Cell key={i} fill={COLORS.teal} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Average importance ratings (1–5)">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={importanceChartData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "Inter" }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>{importanceChartData.map((_, i) => <Cell key={i} fill={COLORS.amber} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Interest in services" span2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={interestChartData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fontFamily: "Inter" }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>{interestChartData.map((_, i) => <Cell key={i} fill={COLORS.tealDark} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <Search size={16} color={COLORS.inkSoft} style={{ position: "absolute", left: 12, top: 12 }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, business, email…" style={{ ...inputStyle, padding: "10px 12px 10px 34px", fontSize: 14 }} />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "10px 12px", fontSize: 14 }}>
            <option>All</option>
            {businessTypesPresent.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={interestFilter} onChange={(e) => setInterestFilter(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "10px 12px", fontSize: 14 }}>
            <option>All</option>
            {FUTURE_INTEREST_OPTIONS.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "10px 12px", fontSize: 14 }} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "10px 12px", fontSize: 14 }} />
          <button onClick={() => downloadCSV(filtered)} disabled={filtered.length === 0} style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.ink, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontFamily: "Inter, sans-serif", fontWeight: 600, cursor: filtered.length ? "pointer" : "not-allowed", opacity: filtered.length ? 1 : 0.5 }}>
            <Download size={15} /> Export CSV
          </button>
        </div>

        <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}`, borderRadius: 14, overflow: "hidden" }}>
          {loading ? (
            <p style={{ padding: 24, fontFamily: "Inter, sans-serif", color: COLORS.inkSoft }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p style={{ padding: 24, fontFamily: "Inter, sans-serif", color: COLORS.inkSoft }}>No submissions match these filters yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.line}`, textAlign: "left" }}>
                  {["Business", "Type", "Date", "Avg rating", "Contact"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", color: COLORS.inkSoft, fontWeight: 500, fontSize: 12, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const avgRating = average(ENVIRONMENT_ITEMS.map((i) => s.ratings?.[i.id]));
                  return (
                    <tr key={s.id} onClick={() => setSelected(s)} style={{ borderBottom: `1px solid ${COLORS.line}`, cursor: "pointer" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>{s.businessName || "—"}</td>
                      <td style={{ padding: "12px 16px", color: COLORS.inkSoft }}>{s.businessType || "—"}</td>
                      <td style={{ padding: "12px 16px", color: COLORS.inkSoft }}>{new Date(s.timestamp).toLocaleDateString()}</td>
                      <td style={{ padding: "12px 16px" }}>{avgRating ? avgRating.toFixed(1) : "—"}</td>
                      <td style={{ padding: "12px 16px", color: COLORS.inkSoft }}>{s.contact?.name || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <SubmissionDetail submission={selected} />
        </Modal>
      )}
    </div>
  );
}

/* =========================================================================
   ROOT APP
   ========================================================================= */

export default function App() {
  const [stage, setStage] = useState("intro"); // intro | survey | thankyou | adminLogin | admin
  const [lastSubmission, setLastSubmission] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStage("admin");
      setCheckingSession(false);
    });
  }, []);

  const begin = async () => {
    bumpStartedCount();
    setStage("survey");
  };

  if (checkingSession) return null;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", width: "100%", minHeight: "100vh" }}>
      <style>{`
        input:focus, textarea:focus, select:focus { border-color: ${COLORS.teal} !important; }
        table tr:hover { background: ${COLORS.bg}; }
        * { box-sizing: border-box; }
      `}</style>

      {stage === "intro" && <IntroScreen onBegin={begin} onAdminTap={() => setStage("adminLogin")} />}
      {stage === "survey" && (
        <SurveyFlow
          onComplete={(entry) => { setLastSubmission(entry); setStage("thankyou"); }}
          onExitToIntro={() => setStage("intro")}
        />
      )}
      {stage === "thankyou" && lastSubmission && <ThankYouScreen submission={lastSubmission} onDone={() => setStage("intro")} />}
      {stage === "adminLogin" && <AdminLogin onSuccess={() => setStage("admin")} onCancel={() => setStage("intro")} />}
      {stage === "admin" && <AdminDashboard onExit={() => setStage("intro")} />}
    </div>
  );
}
