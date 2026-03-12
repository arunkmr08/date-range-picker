import React, { useState, useRef, useEffect, CSSProperties, FC, ReactNode } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
export type ErrorSeverity = "error" | "warning" | "info";
export interface ValidationMessage { type: ErrorSeverity; msg: string; }
export interface Shortcut { label: string; get: () => [Date, Date]; }
export interface Constraints {
  noFuture: boolean; noPast: boolean; noWeekends: boolean;
  maxDays: number | null; minDays: number | null;
}
export interface Theme {
  accent: string; accentLight: string; dark: boolean;
  bg: string; bgAlt: string; border: string; borderLight: string; sidebar: string;
  text: string; textSub: string; textMuted: string; textLight: string; textLighter: string;
  pageBg: string;
}
type DisabledReason = "future" | "past" | "weekend" | "maxrange" | false;
type ActivePreset   = number | "custom" | null;

// ─── Constants ───────────────────────────────────────────────────────────────
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS         = ["S","M","T","W","T","F","S"];

const ACCENTS = [
  { label: "Sky",     value: "#32A7E8" },
  { label: "Violet",  value: "#9C6FE4" },
  { label: "Emerald", value: "#10B981" },
  { label: "Rose",    value: "#E84A6F" },
  { label: "Amber",   value: "#F59E0B" },
  { label: "Teal",    value: "#14B8A6" },
];

const SHORTCUTS: Shortcut[] = [
  { label: "Yesterday",           get: () => { const d = off(-1); return [d, d]; } },
  { label: "Today",               get: () => { const d = td(); return [d, d]; } },
  { label: "Last 7 days",         get: () => [off(-6), td()] },
  { label: "Last week",           get: () => { const d = td(), s = off(-d.getDay() - 7), e = new Date(s); e.setDate(s.getDate() + 6); return [s, e]; } },
  { label: "This week",           get: () => { const d = td(), s = off(-d.getDay()), e = new Date(s); e.setDate(s.getDate() + 6); return [s, e]; } },
  { label: "Last month",          get: () => { const d = td(); return [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 0)]; } },
  { label: "This month",          get: () => { const d = td(); return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 0)]; } },
  { label: "Last 3 months",       get: () => [off(-90), td()] },
  { label: "Last 6 months",       get: () => [off(-182), td()] },
  { label: "Last year till Date", get: () => { const y = td().getFullYear() - 1; return [new Date(y, 0, 1), td()]; } },
  { label: "This year till Date", get: () => { const y = td().getFullYear(); return [new Date(y, 0, 1), td()]; } },
];

// ─── Theme factory ────────────────────────────────────────────────────────────
function makeTheme(accent: string, dark: boolean): Theme {
  if (dark) return {
    accent, accentLight: accent + "33", dark: true,
    bg: "#1e1e2e", bgAlt: "#181825", border: "#313244", borderLight: "#2a2a3d",
    sidebar: "#1a1a2a", text: "#cdd6f4", textSub: "#bac2de",
    textMuted: "#a6adc8", textLight: "#7f849c", textLighter: "#585b70", pageBg: "#11111b",
  };
  return {
    accent, accentLight: accent + "1a", dark: false,
    bg: "#ffffff", bgAlt: "#fafafa", border: "#e4e4e4", borderLight: "#f0f0f0",
    sidebar: "#ffffff", text: "#111111", textSub: "#444444",
    textMuted: "#777777", textLight: "#999999", textLighter: "#cccccc", pageBg: "#efefef",
  };
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function td(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function off(n: number): Date { const d = td(); d.setDate(d.getDate() + n); return d; }
function pad(n: number): string { return String(n).padStart(2, "0"); }
function sameDay(a: Date | null, b: Date | null): boolean { return !!(a && b && a.toDateString() === b.toDateString()); }
function between(d: Date, s: Date | null, e: Date | null): boolean {
  if (!s || !e) return false;
  const t = d.getTime(), lo = Math.min(s.getTime(), e.getTime()), hi = Math.max(s.getTime(), e.getTime());
  return t > lo && t < hi;
}
function dayDiff(a: Date, b: Date): number { return Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000); }
function toMins(t: string): number { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fmt(d: Date | null, t: string): string {
  if (!d) return "—";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}  ·  ${t}`;
}
function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
function isWeekend(d: Date): boolean { const day = d.getDay(); return day === 0 || day === 6; }

// ─── Validation engine ────────────────────────────────────────────────────────
function getErrors(
  start: Date | null, end: Date | null, startTime: string, endTime: string,
  constraints: Constraints, singleMode: boolean, picking: boolean,
): ValidationMessage[] {
  const errors: ValidationMessage[] = [];
  const { noFuture, noPast, noWeekends, maxDays, minDays } = constraints;
  if (!singleMode && start && !end && !picking) return errors;
  const effectiveEnd: Date | null = singleMode ? start : end;
  if (!effectiveEnd) return errors;
  if (noFuture && start! > td()) errors.push({ type: "error", msg: "Start date cannot be in the future." });
  if (noFuture && effectiveEnd > td()) errors.push({ type: "error", msg: "End date cannot be in the future." });
  if (noPast && start! < td() && !sameDay(start, td())) errors.push({ type: "error", msg: "Start date cannot be in the past." });
  if (noPast && effectiveEnd < td() && !sameDay(effectiveEnd, td())) errors.push({ type: "error", msg: "End date cannot be in the past." });
  if (noWeekends && isWeekend(start!)) errors.push({ type: "error", msg: "Start date falls on a weekend." });
  if (noWeekends && isWeekend(effectiveEnd)) errors.push({ type: "error", msg: "End date falls on a weekend." });
  if (!singleMode && start && effectiveEnd) {
    const diff = dayDiff(start, effectiveEnd);
    if (maxDays && diff > maxDays) errors.push({ type: "error", msg: `Range exceeds maximum of ${maxDays} days (${diff} selected).` });
    if (minDays && diff < minDays && !sameDay(start, effectiveEnd)) errors.push({ type: "error", msg: `Range is below minimum of ${minDays} days (${diff} selected).` });
    if (sameDay(start, effectiveEnd) && minDays && minDays > 0) errors.push({ type: "warning", msg: "Start and end are the same day — zero-duration range." });
  }
  if (!singleMode && start && effectiveEnd && sameDay(start, effectiveEnd)) {
    if (toMins(endTime) <= toMins(startTime)) errors.push({ type: "error", msg: "End time must be after start time on the same day." });
  }
  return errors;
}

// ─── Popup ────────────────────────────────────────────────────────────────────
interface PopupProps { children: ReactNode; onClose: () => void; T: Theme; }

const Popup: FC<PopupProps> = ({ children, onClose, T }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return (
    <div ref={ref} style={{
      position: "absolute", top: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)",
      zIndex: 200, background: T.bg, border: `1px solid ${T.border}`,
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)", padding: 14,
    }}>
      {children}
    </div>
  );
};

// ─── Month Picker ─────────────────────────────────────────────────────────────
interface MonthPickerProps { month: number; onChange: (m: number) => void; onClose: () => void; T: Theme; }

const MonthPicker: FC<MonthPickerProps> = ({ month, onChange, onClose, T }) => (
  <Popup onClose={onClose} T={T}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2, width: 180 }}>
      {MONTHS_SHORT.map((m, i) => (
        <button key={m} onClick={() => { onChange(i); onClose(); }} style={{
          background: month === i ? T.accent : "none", border: "none", padding: "8px 6px",
          fontSize: 14, color: month === i ? "#fff" : T.textMuted, cursor: "pointer",
          fontFamily: "inherit", fontWeight: month === i ? 500 : 400, transition: "all 0.1s",
        }}>{m}</button>
      ))}
    </div>
  </Popup>
);

// ─── Year Picker ──────────────────────────────────────────────────────────────
interface YearPickerProps { year: number; onChange: (y: number) => void; onClose: () => void; T: Theme; }

const YearPicker: FC<YearPickerProps> = ({ year, onChange, onClose, T }) => {
  const [page, setPage] = useState<number>(Math.floor(year / 12) * 12);
  const navBtn: CSSProperties = { background: "none", border: "none", cursor: "pointer", fontSize: 24, color: T.textLighter, padding: "0 4px", fontFamily: "inherit", lineHeight: 1 };
  return (
    <Popup onClose={onClose} T={T}>
      <div style={{ width: 180 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={() => setPage(p => p - 12)} style={navBtn}>‹</button>
          <span style={{ fontSize: 12, color: T.textLight }}>{page}–{page + 11}</span>
          <button onClick={() => setPage(p => p + 12)} style={navBtn}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2 }}>
          {Array.from({ length: 12 }, (_, i) => page + i).map(y => (
            <button key={y} onClick={() => { onChange(y); onClose(); }} style={{
              background: year === y ? T.accent : "none", border: "none", padding: "8px 6px",
              fontSize: 14, color: year === y ? "#fff" : T.textMuted, cursor: "pointer",
              fontFamily: "inherit", fontWeight: year === y ? 500 : 400, transition: "all 0.1s",
            }}>{y}</button>
          ))}
        </div>
      </div>
    </Popup>
  );
};

// ─── Calendar ─────────────────────────────────────────────────────────────────
interface CalendarProps {
  year: number; month: number;
  onNav: (dir: 1 | -1) => void;
  onMonthChange: (m: number) => void;
  onYearChange:  (y: number) => void;
  start: Date | null; end: Date | null; hover: Date | null;
  onDay: (date: Date) => void; onHover: (date: Date | null) => void;
  singleMode: boolean; constraints: Constraints; T: Theme;
}

const Calendar: FC<CalendarProps> = ({
  year, month, onNav, onMonthChange, onYearChange,
  start, end, hover, onDay, onHover, singleMode, constraints, T,
}) => {
  const [showMonth, setShowMonth] = useState(false);
  const [showYear,  setShowYear]  = useState(false);
  const { noFuture, noPast, noWeekends, maxDays } = constraints;

  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const eff   = hover && start && !end ? hover : end;
  const cells = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => new Date(year, month, i + 1))];

  const getDisabledReason = (date: Date): DisabledReason => {
    if (noFuture && date > td()) return "future";
    if (noPast && date < td() && !sameDay(date, td())) return "past";
    if (noWeekends && isWeekend(date)) return "weekend";
    if (maxDays && start && !end && dayDiff(start, date) > maxDays) return "maxrange";
    return false;
  };

  const navBtn: CSSProperties = { background: "none", border: "none", cursor: "pointer", fontSize: 24, color: T.textLighter, padding: "0 4px", fontFamily: "inherit", lineHeight: 1 };
  const hdrBtn: CSSProperties = { background: "none", border: "none", cursor: "pointer", fontSize: 14, color: T.text, padding: "2px 5px", fontFamily: "inherit", borderBottom: `1px dashed ${T.accent}`, lineHeight: 1.2 };

  return (
    <div style={{ flex: 1, minWidth: 240 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <button onClick={() => onNav(-1)} style={navBtn}>‹</button>
        <div style={{ display: "flex", gap: 4, position: "relative" }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => { setShowMonth(v => !v); setShowYear(false); }} style={hdrBtn}>{MONTHS_FULL[month]}</button>
            {showMonth && <MonthPicker month={month} onChange={m => { onMonthChange(m); setShowMonth(false); }} onClose={() => setShowMonth(false)} T={T} />}
          </div>
          <div style={{ position: "relative" }}>
            <button onClick={() => { setShowYear(v => !v); setShowMonth(false); }} style={hdrBtn}>{year}</button>
            {showYear && <YearPicker year={year} onChange={y => { onYearChange(y); setShowYear(false); }} onClose={() => setShowYear(false)} T={T} />}
          </div>
        </div>
        <button onClick={() => onNav(1)} style={navBtn}>›</button>
      </div>

      {/* Day-of-week labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
        {DAYS.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 12, color: T.textLighter, paddingBottom: 6 }}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", rowGap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`_${i}`} />;
          const dr      = getDisabledReason(date);
          const isStart = sameDay(date, start);
          const isEnd   = sameDay(date, eff);
          const inRange = !singleMode && between(date, start, eff);
          const isToday = sameDay(date, td());
          const sel     = isStart || isEnd;
          const capL    = !singleMode && isStart && !!eff && !sameDay(start, eff);
          const capR    = !singleMode && isEnd   && !!start && !sameDay(start, eff);
          return (
            <div key={date.toISOString()} style={{ position: "relative", height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {(inRange || capL || capR) && (
                <div style={{ position: "absolute", top: 3, bottom: 3, left: capL ? "50%" : 0, right: capR ? "50%" : 0, background: T.accentLight, zIndex: 0 }} />
              )}
              <button
                onClick={() => !dr && onDay(date)}
                onMouseEnter={() => !dr && onHover(date)}
                onMouseLeave={() => onHover(null)}
                aria-label={date.toDateString()} aria-disabled={!!dr} aria-selected={sel}
                title={dr === "future" ? "Future dates not allowed" : dr === "past" ? "Past dates not allowed" : dr === "weekend" ? "Weekends not available" : dr === "maxrange" ? `Exceeds max range of ${maxDays} days` : undefined}
                style={{
                  position: "relative", zIndex: 1,
                  width: 30, height: 30, borderRadius: "50%",
                  border: isToday && !sel ? `1px solid ${T.accent}` : "none",
                  background: dr ? (dr === "maxrange" ? (T.dark ? "#3a1a1a" : "#fff5f5") : "transparent") : sel ? T.accent : "transparent",
                  color: dr ? (T.dark ? "#4a4a6a" : "#d0d0d0") : sel ? "#fff" : isToday ? T.accent : T.textSub,
                  fontSize: 14, fontWeight: sel ? 500 : 400, cursor: dr ? "not-allowed" : "pointer",
                  fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.1s",
                  textDecoration: dr === "weekend" && !sel ? "line-through" : "none",
                  opacity: dr && dr !== "maxrange" ? 0.35 : 1,
                }}
              >{date.getDate()}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Time Input ───────────────────────────────────────────────────────────────
interface TimeInputProps { label: string; value: string; onChange: (val: string) => void; hasError: boolean; T: Theme; }

const TimeInput: FC<TimeInputProps> = ({ label, value, onChange, hasError, T }) => {
  const [h, m] = value.split(":").map(Number);
  const setH = (v: number) => onChange(`${pad(Math.max(0, Math.min(23, v)))}:${pad(m)}`);
  const setM = (v: number) => onChange(`${pad(h)}:${pad(Math.max(0, Math.min(59, v)))}`);
  const tick: CSSProperties = { background: "none", border: "none", cursor: "pointer", fontSize: 9, color: T.textLighter, padding: "1px 2px", fontFamily: "inherit", lineHeight: 1 };
  const num:  CSSProperties = { width: 28, textAlign: "center", border: "none", background: "transparent", fontSize: 14, fontWeight: 400, color: hasError ? "#e05252" : T.text, outline: "none", fontFamily: "inherit", padding: 0 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: hasError ? "#e05252" : T.textLighter, letterSpacing: "0.08em" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4, borderBottom: `1px solid ${hasError ? "#e05252" : T.borderLight}`, paddingBottom: 2 }}>
        {([[h, setH], [m, setM]] as [number, (v: number) => void][]).map(([val, set], i) => (
          <React.Fragment key={i}>
            {i === 1 && <span style={{ fontSize: 14, color: T.textLighter, lineHeight: 1, margin: "0 1px" }}>:</span>}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <button onClick={() => set(val + 1)} style={tick}>▲</button>
              <input type="number" value={pad(val)} onChange={e => set(Number(e.target.value))} style={num} />
              <button onClick={() => set(val - 1)} style={tick}>▼</button>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ─── Error Banner ─────────────────────────────────────────────────────────────
interface ErrorBannerProps { errors: ValidationMessage[]; T: Theme; }

const ErrorBanner: FC<ErrorBannerProps> = ({ errors, T }) => {
  if (!errors.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "12px 26px", background: T.bgAlt, borderTop: `1px solid ${T.borderLight}` }}>
      {errors.map((e, i) => {
        const isErr  = e.type === "error";
        const isWarn = e.type === "warning";
        const color  = isErr ? "#c0392b" : isWarn ? "#b7811a" : "#6b7280";
        const bg     = isErr ? (T.dark ? "#3a1515" : "#fff5f5") : isWarn ? (T.dark ? "#3a2e0a" : "#fffbea") : (T.dark ? "#1e2230" : "#f8f9fb");
        const bdr    = isErr ? "#fad2d2" : isWarn ? "#f5dea3" : "#e8eaed";
        const icon   = isErr ? "✕" : isWarn ? "⚠" : "ℹ";
        return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: bg, border: `1px solid ${bdr}`, padding: "8px 12px" }}>
            <span style={{ fontSize: 14, color, marginTop: 1, flexShrink: 0, fontWeight: 600 }}>{icon}</span>
            <span style={{ fontSize: 14, color, lineHeight: 1.5 }}>{e.msg}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Toggle ───────────────────────────────────────────────────────────────────
interface ToggleProps { label: string; description?: string; checked: boolean; onChange: () => void; T: Theme; }

const Toggle: FC<ToggleProps> = ({ label, description, checked, onChange, T }) => (
  <label style={{ display: "flex", alignItems: "flex-start", gap: 14, cursor: "pointer", padding: "12px 0", borderBottom: `1px solid ${T.borderLight}` }}>
    <div onClick={onChange} style={{
      marginTop: 2, width: 30, height: 17, borderRadius: 9,
      background: checked ? T.accent : (T.dark ? "#3a3a5c" : "#e0e0e0"),
      position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s",
    }}>
      <div style={{ position: "absolute", top: 2, left: checked ? 13 : 2, width: 13, height: 13, borderRadius: "50%", background: "#fff", transition: "left 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }} />
    </div>
    <div>
      <div style={{ fontSize: 14, color: T.text }}>{label}</div>
      {description && <div style={{ fontSize: 13, color: T.textLight, marginTop: 3 }}>{description}</div>}
    </div>
  </label>
);

// ─── Stepper ──────────────────────────────────────────────────────────────────
interface StepperProps { value: number; onChange: (v: number) => void; min?: number; max?: number; T: Theme; }

const Stepper: FC<StepperProps> = ({ value, onChange, min = 1, max = 999, T }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
    <button onClick={() => onChange(Math.max(min, value - 1))} style={{ background: "none", border: `1px solid ${T.border}`, width: 26, height: 26, cursor: "pointer", fontSize: 14, color: T.textLight, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>−</button>
    <input
      type="number" value={value} min={min} max={max}
      onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
      style={{ width: 50, textAlign: "center", border: `1px solid ${T.border}`, padding: "3px 4px", fontSize: 14, color: T.text, fontFamily: "inherit", outline: "none", background: T.bg }}
    />
    <button onClick={() => onChange(Math.min(max, value + 1))} style={{ background: "none", border: `1px solid ${T.border}`, width: 26, height: 26, cursor: "pointer", fontSize: 14, color: T.textLight, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>+</button>
    <span style={{ fontSize: 13, color: T.textLighter, letterSpacing: "0.06em" }}>DAYS</span>
  </div>
);

// ─── DateRangePicker ──────────────────────────────────────────────────────────
const DateRangePicker: FC = () => {
  const now = td();

  // ── Picker state ─────────────────────────────────────────────────────────────
  const [start,     setStart]     = useState<Date | null>(() => SHORTCUTS[2].get()[0]);
  const [end,       setEnd]       = useState<Date | null>(() => SHORTCUTS[2].get()[1]);
  const [hover,     setHover]     = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime,   setEndTime]   = useState<string>("17:00");
  const [picking,   setPicking]   = useState<boolean>(false);
  const [lm,        setLm]        = useState<number>(now.getMonth());
  const [ly,        setLy]        = useState<number>(now.getFullYear());
  const [active,    setActive]    = useState<ActivePreset>(2);

  // ── Config state ──────────────────────────────────────────────────────────────
  const [hidePresets,   setHidePresets]   = useState(false);
  const [hideTime,      setHideTime]      = useState(false);
  const [hideTwoMonths, setHideTwoMonths] = useState(false);
  const [singleMode,    setSingleMode]    = useState(false);
  const [noFuture,      setNoFuture]      = useState(false);
  const [noPast,        setNoPast]        = useState(false);
  const [noWeekends,    setNoWeekends]    = useState(false);
  const [useMaxDays,    setUseMaxDays]    = useState(false);
  const [maxDays,       setMaxDays]       = useState(30);
  const [useMinDays,    setUseMinDays]    = useState(false);
  const [minDays,       setMinDays]       = useState(2);

  // ── Theme state ───────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(false);
  const [accent,   setAccent]   = useState(ACCENTS[0].value);
  const T = makeTheme(accent, darkMode);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const rm: number = lm === 11 ? 0 : lm + 1;
  const ry: number = lm === 11 ? ly + 1 : ly;

  const constraints: Constraints = {
    noFuture, noPast, noWeekends,
    maxDays: useMaxDays ? maxDays : null,
    minDays: useMinDays ? minDays : null,
  };

  const errors       = getErrors(start, end, startTime, endTime, constraints, singleMode, picking);
  const hasErrors    = errors.some(e => e.type === "error");
  const timeConflict = !singleMode && !!start && !!end && sameDay(start, end) && toMins(endTime) <= toMins(startTime);
  const canApply     = (singleMode ? !!start : (!!start && !!end)) && !hasErrors;

  // ── Navigation ────────────────────────────────────────────────────────────────
  const nav = (dir: 1 | -1): void => {
    let m = lm + dir, y = ly;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setLm(m); setLy(y);
  };
  const setLeftMonth  = (m: number): void => setLm(m);
  const setLeftYear   = (y: number): void => setLy(y);
  const setRightMonth = (m: number): void => { let nl = m - 1, ny = ry; if (nl < 0) { nl = 11; ny--; } setLm(nl); setLy(ny); };
  const setRightYear  = (y: number): void => setLy(rm === 0 ? y - 1 : y);

  // ── Selection ─────────────────────────────────────────────────────────────────
  const pickDay = (date: Date): void => {
    if (singleMode) { setStart(date); setEnd(null); setPicking(false); setActive("custom"); return; }
    if (!picking || !start) { setStart(date); setEnd(null); setPicking(true); setActive("custom"); }
    else { if (date < start) { setEnd(start); setStart(date); } else setEnd(date); setPicking(false); }
  };

  const pickShortcut = (s: Shortcut, i: number): void => {
    const [a, b] = s.get();
    setStart(a); setEnd(b); setPicking(false); setActive(i);
    setLm(a.getMonth()); setLy(a.getFullYear());
  };

  const clear = (): void => { setStart(null); setEnd(null); setPicking(false); setActive(null); };

  // ── Inline toggle knob (used for Max/Min range) ───────────────────────────────
  const knob = (on: boolean, onClick: () => void) => (
    <div onClick={onClick} style={{ marginTop: 2, width: 30, height: 17, borderRadius: 9, background: on ? T.accent : (T.dark ? "#3a3a5c" : "#e0e0e0"), position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
      <div style={{ position: "absolute", top: 2, left: on ? 13 : 2, width: 13, height: 13, borderRadius: "50%", background: "#fff", transition: "left 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }} />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: T.pageBg,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      fontFamily: "'Segoe UI Variable','Segoe UI',system-ui,sans-serif",
      paddingTop: 56, paddingBottom: 56, gap: 32, flexWrap: "wrap",
      transition: "background 0.2s",
    }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        button:focus { outline: none; }
        button:hover { opacity: 0.7; }
      `}</style>

      {/* ── Picker ── */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 12, color: T.textLight, letterSpacing: "0.12em", marginBottom: 12, textTransform: "uppercase" }}>Date Range Picker</div>
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, display: "flex", flexDirection: "column", width: "max-content", boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)", transition: "background 0.2s, border-color 0.2s" }}>

          <div style={{ display: "flex", position: "relative" }}>

            {/* Shortcuts sidebar */}
            {!hidePresets && (
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 160, borderRight: `1px solid ${T.borderLight}`, display: "flex", flexDirection: "column", background: T.sidebar, zIndex: 1, transition: "background 0.2s" }}>
                <div style={{ padding: "20px 18px 12px", fontSize: 12, color: T.textLighter, letterSpacing: "0.14em", textTransform: "uppercase", flexShrink: 0 }}>Shortcuts</div>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", paddingBottom: 10 }}>
                  <button onClick={() => { clear(); setActive("custom"); }} style={{
                    background: "none", border: "none", padding: "7px 18px", textAlign: "left", fontSize: 14,
                    color: active === "custom" ? T.accent : T.textLight, fontWeight: active === "custom" ? 500 : 400,
                    cursor: "pointer", fontFamily: "inherit",
                    borderLeft: active === "custom" ? `1.5px solid ${T.accent}` : "1.5px solid transparent",
                    transition: "all 0.1s", flexShrink: 0,
                  }}>Custom Date</button>
                  <div style={{ height: 1, background: T.borderLight, margin: "7px 0", flexShrink: 0 }} />
                  {SHORTCUTS.map((s, i) => (
                    <button key={s.label} onClick={() => pickShortcut(s, i)} style={{
                      background: "none", border: "none", padding: "7px 18px", textAlign: "left", fontSize: 14,
                      color: active === i ? T.accent : T.textLight, fontWeight: active === i ? 500 : 400,
                      cursor: "pointer", fontFamily: "inherit",
                      borderLeft: active === i ? `1.5px solid ${T.accent}` : "1.5px solid transparent",
                      transition: "all 0.1s", flexShrink: 0,
                    }}>{s.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Calendars */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: hidePresets ? 0 : 160 }}>
              <div style={{ display: "flex", padding: "26px 26px 20px", gap: 0 }}>
                <Calendar year={ly} month={lm} onNav={nav} onMonthChange={setLeftMonth} onYearChange={setLeftYear} start={start} end={end} hover={hover} onDay={pickDay} onHover={setHover} singleMode={singleMode} constraints={constraints} T={T} />
                {!hideTwoMonths && (
                  <>
                    <div style={{ width: 1, background: T.borderLight, margin: "0 22px" }} />
                    <Calendar year={ry} month={rm} onNav={nav} onMonthChange={setRightMonth} onYearChange={setRightYear} start={start} end={end} hover={hover} onDay={pickDay} onHover={setHover} singleMode={singleMode} constraints={constraints} T={T} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Validation banners */}
          <ErrorBanner errors={errors} T={T} />

          {/* Bottom bar */}
          <div style={{ borderTop: `1px solid ${T.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 26px", gap: 18, flexWrap: "wrap" }}>
            {!hideTime && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
                <TimeInput label="START" value={startTime} onChange={setStartTime} hasError={timeConflict} T={T} />
                <div style={{ width: 12, height: 1, background: T.borderLight, marginBottom: 13 }} />
                {!singleMode && <TimeInput label="END" value={endTime} onChange={setEndTime} hasError={timeConflict} T={T} />}
              </div>
            )}

            <div style={{ flex: 1, padding: hideTime ? "0" : "0 12px", minWidth: 160 }}>
              <div style={{ fontSize: 12, color: T.textLighter, letterSpacing: "0.1em", marginBottom: 5, display: "flex", alignItems: "center", gap: 6 }}>
                <span>{singleMode ? "SELECTED" : "SELECTION"}</span>
                {!singleMode && start && end && !hasErrors && (
                  <span>· {dayDiff(start, end) + 1} day{dayDiff(start, end) + 1 !== 1 ? "s" : ""}</span>
                )}
              </div>
              {hideTime && !singleMode ? (
                <div style={{ fontSize: 13, color: T.textMuted, display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ color: start && errors.some(e => e.type === "error" && e.msg.toLowerCase().includes("start")) ? "#c0392b" : T.textMuted }}>{fmtDate(start)}</span>
                  <span style={{ color: T.textLighter }}>→</span>
                  <span style={{ color: end && errors.some(e => e.type === "error" && e.msg.toLowerCase().includes("end")) ? "#c0392b" : T.textMuted }}>{fmtDate(end)}</span>
                </div>
              ) : (
                <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                  <div style={{ color: start && errors.some(e => e.type === "error" && e.msg.toLowerCase().includes("start")) ? "#c0392b" : T.textMuted }}>
                    {hideTime ? fmtDate(start) : fmt(start, startTime)}
                  </div>
                  {!singleMode && (
                    <div style={{ color: end && errors.some(e => e.type === "error" && e.msg.toLowerCase().includes("end")) ? "#c0392b" : T.textMuted }}>
                      {fmt(end, endTime)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={clear} style={{ background: "none", border: `1px solid ${T.border}`, padding: "8px 14px", fontSize: 13, color: T.textLighter, cursor: "pointer", fontFamily: "inherit" }}>Clear</button>
              <button
                disabled={!canApply}
                title={hasErrors ? "Fix errors before applying" : !start ? "Select a date first" : !end && !singleMode ? "Select an end date" : ""}
                style={{ background: canApply ? T.accent : (T.dark ? "#2a2a40" : "#f0f0f0"), border: "none", padding: "8px 18px", fontSize: 13, color: canApply ? "#fff" : T.textLighter, cursor: canApply ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 500, transition: "all 0.15s" }}
              >Apply</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Config panel ── */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 12, color: T.textLight, letterSpacing: "0.12em", marginBottom: 12, textTransform: "uppercase" }}>Configuration</div>
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, transition: "background 0.2s, border-color 0.2s" }}>

          {/* Display + Constraints */}
          <div style={{ display: "flex" }}>
            <div style={{ flex: 1, padding: "0 20px", borderRight: `1px solid ${T.borderLight}` }}>
              <div style={{ padding: "14px 0 6px", fontSize: 12, color: T.textLighter, letterSpacing: "0.14em", textTransform: "uppercase" }}>Display</div>
              <Toggle label="Hide presets"      description="Remove the shortcut sidebar"  checked={hidePresets}   onChange={() => setHidePresets(v => !v)} T={T} />
              <Toggle label="Hide time inputs"  description="Date-only, no hour/minute"    checked={hideTime}      onChange={() => setHideTime(v => !v)} T={T} />
              <Toggle label="Single month view" description="One calendar instead of two"  checked={hideTwoMonths} onChange={() => setHideTwoMonths(v => !v)} T={T} />
              <Toggle label="Single date"       description="Pick one date, not a range"   checked={singleMode}    onChange={() => { setSingleMode(v => !v); clear(); }} T={T} />
            </div>
            <div style={{ flex: 1, padding: "0 20px" }}>
              <div style={{ padding: "14px 0 6px", fontSize: 12, color: T.textLighter, letterSpacing: "0.14em", textTransform: "uppercase" }}>Constraints</div>
              <Toggle label="Disable future dates" description="Block dates after today"   checked={noFuture}   onChange={() => { setNoFuture(v => !v);   clear(); }} T={T} />
              <Toggle label="Disable past dates"   description="Block dates before today"  checked={noPast}     onChange={() => { setNoPast(v => !v);     clear(); }} T={T} />
              <Toggle label="Disable weekends"     description="Sat and Sun unavailable"   checked={noWeekends} onChange={() => { setNoWeekends(v => !v); clear(); }} T={T} />
            </div>
          </div>

          {/* Max + Min range */}
          <div style={{ display: "flex", borderTop: `1px solid ${T.borderLight}` }}>
            <div style={{ flex: 1, padding: "14px 20px", borderRight: `1px solid ${T.borderLight}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                {knob(useMaxDays, () => { setUseMaxDays(v => !v); clear(); })}
                <div>
                  <div style={{ fontSize: 14, color: T.text }}>Max range</div>
                  <div style={{ fontSize: 13, color: T.textLight, marginTop: 3 }}>Limit selectable days</div>
                </div>
              </div>
              {useMaxDays && <Stepper value={maxDays} onChange={setMaxDays} min={1} T={T} />}
            </div>
            <div style={{ flex: 1, padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                {knob(useMinDays, () => { setUseMinDays(v => !v); clear(); })}
                <div>
                  <div style={{ fontSize: 14, color: T.text }}>Min range</div>
                  <div style={{ fontSize: 13, color: T.textLight, marginTop: 3 }}>Require minimum days</div>
                </div>
              </div>
              {useMinDays && <Stepper value={minDays} onChange={setMinDays} min={1} T={T} />}
            </div>
          </div>

          {/* Theme */}
          <div style={{ borderTop: `1px solid ${T.borderLight}`, padding: "0 20px" }}>
            <div style={{ padding: "14px 0 6px", fontSize: 12, color: T.textLighter, letterSpacing: "0.14em", textTransform: "uppercase" }}>Theme</div>
            <Toggle label="Dark mode" description="Switch to dark colour scheme" checked={darkMode} onChange={() => setDarkMode(v => !v)} T={T} />
            <div style={{ padding: "14px 0" }}>
              <div style={{ fontSize: 13, color: T.textLight, marginBottom: 10 }}>Accent colour</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {ACCENTS.map(a => (
                  <button
                    key={a.value}
                    title={a.label}
                    onClick={() => setAccent(a.value)}
                    style={{
                      width: 26, height: 26, borderRadius: "50%", background: a.value,
                      border: "none", cursor: "pointer", padding: 0, flexShrink: 0,
                      boxShadow: accent === a.value ? `0 0 0 2px ${T.bg}, 0 0 0 4px ${a.value}` : "none",
                      transition: "box-shadow 0.15s",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DateRangePicker;
