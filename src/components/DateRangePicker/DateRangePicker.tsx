import React, { useState, useRef, useEffect, CSSProperties, FC, ReactNode } from "react";

// ─── Theme ──────────────────────────────────────────────────────────────────
const P       = "#32A7E8" as const;
const P_LIGHT = "rgba(50,167,232,0.10)" as const;

// ─── Types ──────────────────────────────────────────────────────────────────
export type ErrorSeverity = "error" | "warning" | "info";

export interface ValidationMessage {
  type: ErrorSeverity;
  msg: string;
}

export interface Shortcut {
  label: string;
  get: () => [Date, Date];
}

export interface Constraints {
  noFuture:   boolean;
  noPast:     boolean;
  noWeekends: boolean;
  maxDays:    number | null;
  minDays:    number | null;
}

type DisabledReason = "future" | "past" | "weekend" | "maxrange" | false;
type ActivePreset   = number | "custom" | null;

// ─── Constants ──────────────────────────────────────────────────────────────
const MONTHS_SHORT: string[] = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL:  string[] = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS:         string[] = ["S","M","T","W","T","F","S"];

const SHORTCUTS: Shortcut[] = [
  { label: "Today",         get: () => { const d = td(); return [d, d]; } },
  { label: "Yesterday",     get: () => { const d = off(-1); return [d, d]; } },
  { label: "Last 7 days",   get: () => [off(-6), td()] },
  { label: "Last 14 days",  get: () => [off(-13), td()] },
  { label: "Last 30 days",  get: () => [off(-29), td()] },
  { label: "This week",     get: () => { const d = td(), s = off(-d.getDay()), e = new Date(s); e.setDate(s.getDate() + 6); return [s, e]; } },
  { label: "Last week",     get: () => { const d = td(), s = off(-d.getDay() - 7), e = new Date(s); e.setDate(s.getDate() + 6); return [s, e]; } },
  { label: "This month",    get: () => { const d = td(); return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 0)]; } },
  { label: "Last month",    get: () => { const d = td(); return [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 0)]; } },
  { label: "Last 3 months", get: () => [off(-90), td()] },
  { label: "This year",     get: () => { const y = td().getFullYear(); return [new Date(y, 0, 1), new Date(y, 11, 31)]; } },
  { label: "Last year",     get: () => { const y = td().getFullYear() - 1; return [new Date(y, 0, 1), new Date(y, 11, 31)]; } },
];

// ─── Pure helpers ────────────────────────────────────────────────────────────
function td(): Date   { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function off(n: number): Date { const d = td(); d.setDate(d.getDate() + n); return d; }
function pad(n: number): string { return String(n).padStart(2, "0"); }
function sameDay(a: Date | null, b: Date | null): boolean { return !!(a && b && a.toDateString() === b.toDateString()); }
function between(d: Date, s: Date | null, e: Date | null): boolean {
  if (!s || !e) return false;
  const t = d.getTime(), lo = Math.min(s.getTime(), e.getTime()), hi = Math.max(s.getTime(), e.getTime());
  return t > lo && t < hi;
}
function dayDiff(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}
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

// ─── Validation engine ───────────────────────────────────────────────────────
function getErrors(
  start:       Date | null,
  end:         Date | null,
  startTime:   string,
  endTime:     string,
  constraints: Constraints,
  singleMode:  boolean,
  picking:     boolean,
): ValidationMessage[] {
  const errors: ValidationMessage[] = [];
  const { noFuture, noPast, noWeekends, maxDays, minDays } = constraints;

  if (!start && !picking) {
    errors.push({ type: "info", msg: singleMode ? "Select a date to continue." : "Select a start date to begin." });
    return errors;
  }
  if (start && !end && !singleMode && picking) {
    errors.push({ type: "info", msg: "Now select an end date." });
    return errors;
  }
  if (!singleMode && start && !end && !picking) return errors;

  const effectiveEnd: Date | null = singleMode ? start : end;
  if (!effectiveEnd) return errors;

  if (noFuture && start!  > td()) errors.push({ type: "error", msg: "Start date cannot be in the future." });
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

// ─── Shared inline styles ────────────────────────────────────────────────────
const S: Record<string, CSSProperties> = {
  navBtn:  { background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#bbb", padding: "0 4px", fontFamily: "inherit", lineHeight: 1 },
  hdrBtn:  { background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#111", padding: "2px 4px", fontFamily: "inherit", borderBottom: `1px dashed ${P}`, lineHeight: 1.2 },
  tick:    { background: "none", border: "none", cursor: "pointer", fontSize: 7,  color: "#ccc", padding: "1px 2px", fontFamily: "inherit", lineHeight: 1 },
  timeNum: { width: 24, textAlign: "center", border: "none", background: "transparent", fontSize: 15, fontWeight: 400, color: "#111", outline: "none", fontFamily: "'Segoe UI Variable','Segoe UI',system-ui,sans-serif", padding: 0 },
};

// ─── Popup ───────────────────────────────────────────────────────────────────
interface PopupProps { children: ReactNode; onClose: () => void; }

const Popup: FC<PopupProps> = ({ children, onClose }) => {
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
      zIndex: 200, background: "#fff", border: "1px solid #e4e4e4",
      boxShadow: "0 8px 24px rgba(0,0,0,0.09)", padding: 12,
    }}>
      {children}
    </div>
  );
};

// ─── Month Picker ────────────────────────────────────────────────────────────
interface MonthPickerProps { month: number; onChange: (m: number) => void; onClose: () => void; }

const MonthPicker: FC<MonthPickerProps> = ({ month, onChange, onClose }) => (
  <Popup onClose={onClose}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2, width: 160 }}>
      {MONTHS_SHORT.map((m, i) => (
        <button key={m} onClick={() => { onChange(i); onClose(); }} style={{
          background: month === i ? P : "none", border: "none", padding: "7px 4px",
          fontSize: 11, color: month === i ? "#fff" : "#555", cursor: "pointer",
          fontFamily: "inherit", fontWeight: month === i ? 500 : 400, transition: "all 0.1s",
        }}>{m}</button>
      ))}
    </div>
  </Popup>
);

// ─── Year Picker ─────────────────────────────────────────────────────────────
interface YearPickerProps { year: number; onChange: (y: number) => void; onClose: () => void; }

const YearPicker: FC<YearPickerProps> = ({ year, onChange, onClose }) => {
  const [page, setPage] = useState<number>(Math.floor(year / 12) * 12);
  return (
    <Popup onClose={onClose}>
      <div style={{ width: 160 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button onClick={() => setPage(p => p - 12)} style={S.navBtn}>‹</button>
          <span style={{ fontSize: 10, color: "#999" }}>{page}–{page + 11}</span>
          <button onClick={() => setPage(p => p + 12)} style={S.navBtn}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2 }}>
          {Array.from({ length: 12 }, (_, i) => page + i).map(y => (
            <button key={y} onClick={() => { onChange(y); onClose(); }} style={{
              background: year === y ? P : "none", border: "none", padding: "7px 4px",
              fontSize: 11, color: year === y ? "#fff" : "#555", cursor: "pointer",
              fontFamily: "inherit", fontWeight: year === y ? 500 : 400, transition: "all 0.1s",
            }}>{y}</button>
          ))}
        </div>
      </div>
    </Popup>
  );
};

// ─── Calendar ────────────────────────────────────────────────────────────────
interface CalendarProps {
  year:          number;
  month:         number;
  onNav:         (dir: 1 | -1) => void;
  onMonthChange: (m: number) => void;
  onYearChange:  (y: number) => void;
  start:         Date | null;
  end:           Date | null;
  hover:         Date | null;
  onDay:         (date: Date) => void;
  onHover:       (date: Date | null) => void;
  singleMode:    boolean;
  constraints:   Constraints;
}

const Calendar: FC<CalendarProps> = ({
  year, month, onNav, onMonthChange, onYearChange,
  start, end, hover, onDay, onHover, singleMode, constraints,
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

  return (
    <div style={{ flex: 1, minWidth: 208 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={() => onNav(-1)} style={S.navBtn}>‹</button>
        <div style={{ display: "flex", gap: 3, position: "relative" }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => { setShowMonth(v => !v); setShowYear(false); }} style={S.hdrBtn}>
              {MONTHS_FULL[month]}
            </button>
            {showMonth && (
              <MonthPicker month={month} onChange={m => { onMonthChange(m); setShowMonth(false); }} onClose={() => setShowMonth(false)} />
            )}
          </div>
          <div style={{ position: "relative" }}>
            <button onClick={() => { setShowYear(v => !v); setShowMonth(false); }} style={S.hdrBtn}>
              {year}
            </button>
            {showYear && (
              <YearPicker year={year} onChange={y => { onYearChange(y); setShowYear(false); }} onClose={() => setShowYear(false)} />
            )}
          </div>
        </div>
        <button onClick={() => onNav(1)} style={S.navBtn}>›</button>
      </div>

      {/* Day-of-week labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
        {DAYS.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9, color: "#c4c4c4", paddingBottom: 5 }}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", rowGap: 1 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`_${i}`} />;
          const disabledReason = getDisabledReason(date);
          const isStart = sameDay(date, start);
          const isEnd   = sameDay(date, eff);
          const inRange = !singleMode && between(date, start, eff);
          const isToday = sameDay(date, td());
          const sel     = isStart || isEnd;
          const capL    = !singleMode && isStart && !!eff && !sameDay(start, eff);
          const capR    = !singleMode && isEnd   && !!start && !sameDay(start, eff);

          return (
            <div key={date.toISOString()} style={{ position: "relative", height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {(inRange || capL || capR) && (
                <div style={{ position: "absolute", top: 3, bottom: 3, left: capL ? "50%" : 0, right: capR ? "50%" : 0, background: P_LIGHT, zIndex: 0 }} />
              )}
              <button
                onClick={() => !disabledReason && onDay(date)}
                onMouseEnter={() => !disabledReason && onHover(date)}
                onMouseLeave={() => onHover(null)}
                aria-label={date.toDateString()}
                aria-disabled={!!disabledReason}
                aria-selected={sel}
                title={
                  disabledReason === "future"   ? "Future dates not allowed" :
                  disabledReason === "past"     ? "Past dates not allowed" :
                  disabledReason === "weekend"  ? "Weekends not available" :
                  disabledReason === "maxrange" ? `Exceeds max range of ${maxDays} days` : undefined
                }
                style={{
                  position: "relative", zIndex: 1,
                  width: 26, height: 26, borderRadius: "50%",
                  border: isToday && !sel ? `1px solid ${P}` : "none",
                  background: disabledReason ? (disabledReason === "maxrange" ? "#fff5f5" : "transparent") : sel ? P : "transparent",
                  color:      disabledReason ? "#d0d0d0" : sel ? "#fff" : isToday ? P : "#444",
                  fontSize: 11, fontWeight: sel ? 500 : 400,
                  cursor: disabledReason ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.1s",
                  textDecoration: disabledReason === "weekend" && !sel ? "line-through" : "none",
                  opacity: disabledReason && disabledReason !== "maxrange" ? 0.35 : 1,
                }}
              >{date.getDate()}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Time Input ──────────────────────────────────────────────────────────────
interface TimeInputProps {
  label:    string;
  value:    string;
  onChange: (val: string) => void;
  hasError: boolean;
}

const TimeInput: FC<TimeInputProps> = ({ label, value, onChange, hasError }) => {
  const [h, m] = value.split(":").map(Number);
  const setH = (v: number) => onChange(`${pad(Math.max(0, Math.min(23, v)))}:${pad(m)}`);
  const setM = (v: number) => onChange(`${pad(h)}:${pad(Math.max(0, Math.min(59, v)))}`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 9, color: hasError ? "#e05252" : "#bbb", letterSpacing: "0.08em" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 3, borderBottom: `1px solid ${hasError ? "#e05252" : "#e8e8e8"}`, paddingBottom: 2 }}>
        {([[h, setH], [m, setM]] as [number, (v: number) => void][]).map(([val, set], i) => (
          <React.Fragment key={i}>
            {i === 1 && <span style={{ fontSize: 13, color: "#ddd", lineHeight: 1, margin: "0 1px" }}>:</span>}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <button onClick={() => set(val + 1)} style={S.tick}>▲</button>
              <input
                type="number"
                value={pad(val)}
                onChange={e => set(Number(e.target.value))}
                style={{ ...S.timeNum, color: hasError ? "#e05252" : "#111" }}
              />
              <button onClick={() => set(val - 1)} style={S.tick}>▼</button>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ─── Error Banner ────────────────────────────────────────────────────────────
interface ErrorBannerProps { errors: ValidationMessage[]; }

const ErrorBanner: FC<ErrorBannerProps> = ({ errors }) => {
  if (!errors.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 22px", background: "#fafafa", borderTop: "1px solid #f0f0f0" }}>
      {errors.map((e, i) => {
        const isErr  = e.type === "error";
        const isWarn = e.type === "warning";
        const color  = isErr ? "#c0392b" : isWarn ? "#b7811a" : "#6b7280";
        const bg     = isErr ? "#fff5f5" : isWarn ? "#fffbea" : "#f8f9fb";
        const bdr    = isErr ? "#fad2d2" : isWarn ? "#f5dea3" : "#e8eaed";
        const icon   = isErr ? "✕" : isWarn ? "⚠" : "ℹ";
        return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, background: bg, border: `1px solid ${bdr}`, padding: "6px 10px" }}>
            <span style={{ fontSize: 10, color, marginTop: 1, flexShrink: 0, fontWeight: 600 }}>{icon}</span>
            <span style={{ fontSize: 11, color, lineHeight: 1.5 }}>{e.msg}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Toggle ──────────────────────────────────────────────────────────────────
interface ToggleProps {
  label:       string;
  description?: string;
  checked:     boolean;
  onChange:    () => void;
}

const Toggle: FC<ToggleProps> = ({ label, description, checked, onChange }) => (
  <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", padding: "10px 0", borderBottom: "1px solid #f4f4f4" }}>
    <div onClick={onChange} style={{
      marginTop: 2, width: 30, height: 17, borderRadius: 9,
      background: checked ? P : "#e0e0e0",
      position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s",
    }}>
      <div style={{
        position: "absolute", top: 2, left: checked ? 13 : 2,
        width: 13, height: 13, borderRadius: "50%",
        background: "#fff", transition: "left 0.18s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: "#222", fontWeight: 400 }}>{label}</div>
      {description && <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>{description}</div>}
    </div>
  </label>
);

// ─── Stepper ─────────────────────────────────────────────────────────────────
interface StepperProps { value: number; onChange: (v: number) => void; min?: number; max?: number; }

const Stepper: FC<StepperProps> = ({ value, onChange, min = 1, max = 999 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
    <button onClick={() => onChange(Math.max(min, value - 1))} style={{ background: "none", border: "1px solid #e4e4e4", width: 22, height: 22, cursor: "pointer", fontSize: 13, color: "#888", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>−</button>
    <input
      type="number" value={value} min={min} max={max}
      onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
      style={{ width: 44, textAlign: "center", border: "1px solid #e4e4e4", padding: "2px 4px", fontSize: 12, color: "#111", fontFamily: "inherit", outline: "none" }}
    />
    <button onClick={() => onChange(Math.min(max, value + 1))} style={{ background: "none", border: "1px solid #e4e4e4", width: 22, height: 22, cursor: "pointer", fontSize: 13, color: "#888", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>+</button>
    <span style={{ fontSize: 10, color: "#bbb" }}>days</span>
  </div>
);

// ─── DateRangePicker ─────────────────────────────────────────────────────────
const DateRangePicker: FC = () => {
  const now = td();

  // ── Picker state ─────────────────────────────────────────────────────────
  const [start,     setStart]     = useState<Date | null>(() => SHORTCUTS[4].get()[0]);
  const [end,       setEnd]       = useState<Date | null>(() => SHORTCUTS[4].get()[1]);
  const [hover,     setHover]     = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime,   setEndTime]   = useState<string>("17:00");
  const [picking,   setPicking]   = useState<boolean>(false);
  const [lm,        setLm]        = useState<number>(now.getMonth());
  const [ly,        setLy]        = useState<number>(now.getFullYear());
  const [active,    setActive]    = useState<ActivePreset>(4);

  // ── Config state ─────────────────────────────────────────────────────────
  const [hidePresets,    setHidePresets]    = useState(false);
  const [hideTime,       setHideTime]       = useState(false);
  const [hideTwoMonths,  setHideTwoMonths]  = useState(false);
  const [singleMode,     setSingleMode]     = useState(false);
  const [noFuture,       setNoFuture]       = useState(false);
  const [noPast,         setNoPast]         = useState(false);
  const [noWeekends,     setNoWeekends]     = useState(false);
  const [useMaxDays,     setUseMaxDays]     = useState(false);
  const [maxDays,        setMaxDays]        = useState(30);
  const [useMinDays,     setUseMinDays]     = useState(false);
  const [minDays,        setMinDays]        = useState(2);

  // ── Derived ───────────────────────────────────────────────────────────────
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

  // ── Navigation ────────────────────────────────────────────────────────────
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

  // ── Selection ─────────────────────────────────────────────────────────────
  const pickDay = (date: Date): void => {
    if (singleMode) { setStart(date); setEnd(null); setPicking(false); setActive("custom"); return; }
    if (!picking || !start) { setStart(date); setEnd(null); setPicking(true); setActive("custom"); }
    else { if (date < start) { setEnd(start); setStart(date); } else setEnd(date); setPicking(false); }
  };

  const pickShortcut = (s: Shortcut, i: number): void => {
    const [a, b] = s.get(); setStart(a); setEnd(b); setPicking(false); setActive(i);
  };

  const clear = (): void => { setStart(null); setEnd(null); setPicking(false); setActive(null); };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#efefef",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      fontFamily: "'Segoe UI Variable','Segoe UI',system-ui,sans-serif",
      paddingTop: 48, paddingBottom: 48, gap: 28, flexWrap: "wrap",
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
        <div style={{ fontSize: 9, color: "#aaa", letterSpacing: "0.12em", marginBottom: 10, textTransform: "uppercase" }}>Date Range Picker</div>
        <div style={{ background: "#fff", border: "1px solid #e4e4e4", display: "flex", flexDirection: "column", width: "max-content" }}>

          <div style={{ display: "flex", position: "relative" }}>

            {/* Presets sidebar */}
            {!hidePresets && (
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 138, borderRight: "1px solid #ebebeb", display: "flex", flexDirection: "column", background: "#fff", zIndex: 1 }}>
                <div style={{ padding: "18px 16px 10px", fontSize: 8, color: "#ccc", letterSpacing: "0.14em", textTransform: "uppercase", flexShrink: 0 }}>Presets</div>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", paddingBottom: 8 }}>
                  {SHORTCUTS.map((s, i) => (
                    <button key={s.label} onClick={() => pickShortcut(s, i)} style={{
                      background: "none", border: "none", padding: "5px 16px", textAlign: "left", fontSize: 11,
                      color: active === i ? P : "#999", fontWeight: active === i ? 500 : 400,
                      cursor: "pointer", fontFamily: "inherit",
                      borderLeft: active === i ? `1.5px solid ${P}` : "1.5px solid transparent",
                      transition: "all 0.1s", flexShrink: 0,
                    }}>{s.label}</button>
                  ))}
                  <div style={{ height: 1, background: "#f0f0f0", margin: "6px 0", flexShrink: 0 }} />
                  <button onClick={() => { clear(); setActive("custom"); }} style={{
                    background: "none", border: "none", padding: "5px 16px", textAlign: "left", fontSize: 11,
                    color: active === "custom" ? P : "#999", fontWeight: active === "custom" ? 500 : 400,
                    cursor: "pointer", fontFamily: "inherit",
                    borderLeft: active === "custom" ? `1.5px solid ${P}` : "1.5px solid transparent",
                    transition: "all 0.1s", flexShrink: 0,
                  }}>Custom range</button>
                </div>
              </div>
            )}

            {/* Calendars */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: hidePresets ? 0 : 138 }}>
              <div style={{ display: "flex", padding: "22px 22px 16px", gap: 0 }}>
                <Calendar year={ly} month={lm} onNav={nav} onMonthChange={setLeftMonth} onYearChange={setLeftYear} start={start} end={end} hover={hover} onDay={pickDay} onHover={setHover} singleMode={singleMode} constraints={constraints} />
                {!hideTwoMonths && (
                  <>
                    <div style={{ width: 1, background: "#f0f0f0", margin: "0 18px" }} />
                    <Calendar year={ry} month={rm} onNav={nav} onMonthChange={setRightMonth} onYearChange={setRightYear} start={start} end={end} hover={hover} onDay={pickDay} onHover={setHover} singleMode={singleMode} constraints={constraints} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Validation banners */}
          <ErrorBanner errors={errors} />

          {/* Bottom bar */}
          <div style={{ borderTop: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", gap: 16, flexWrap: "wrap" }}>
            {!hideTime && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
                <TimeInput label="START" value={startTime} onChange={setStartTime} hasError={timeConflict} />
                <div style={{ width: 10, height: 1, background: "#e0e0e0", marginBottom: 11 }} />
                {!singleMode && <TimeInput label="END" value={endTime} onChange={setEndTime} hasError={timeConflict} />}
              </div>
            )}

            <div style={{ flex: 1, padding: hideTime ? "0" : "0 10px", minWidth: 140 }}>
              <div style={{ fontSize: 9, color: "#ccc", letterSpacing: "0.1em", marginBottom: 4 }}>
                {singleMode ? "SELECTED" : "SELECTION"}
              </div>
              {hideTime && !singleMode ? (
                <div style={{ fontSize: 10, color: "#777", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: start && errors.some(e => e.type === "error" && e.msg.toLowerCase().includes("start")) ? "#c0392b" : "#777" }}>
                    {fmtDate(start)}
                  </span>
                  <span style={{ color: "#ccc" }}>→</span>
                  <span style={{ color: end && errors.some(e => e.type === "error" && e.msg.toLowerCase().includes("end")) ? "#c0392b" : "#777" }}>
                    {fmtDate(end)}
                  </span>
                  {start && end && !hasErrors && (
                    <span style={{ fontSize: 9, color: "#bbb" }}>· {dayDiff(start, end)} day{dayDiff(start, end) !== 1 ? "s" : ""}</span>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 10, lineHeight: 1.8 }}>
                  <div style={{ color: start && errors.some(e => e.type === "error" && e.msg.toLowerCase().includes("start")) ? "#c0392b" : "#777" }}>
                    {fmt(start, startTime)}
                  </div>
                  {!singleMode && (
                    <div style={{ color: end && errors.some(e => e.type === "error" && e.msg.toLowerCase().includes("end")) ? "#c0392b" : "#777" }}>
                      {fmt(end, endTime)}
                    </div>
                  )}
                </div>
              )}
              {!hideTime && start && end && !singleMode && !hasErrors && (
                <div style={{ fontSize: 9, color: "#bbb", marginTop: 2 }}>
                  {dayDiff(start, end)} day{dayDiff(start, end) !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={clear} style={{ background: "none", border: "1px solid #e8e8e8", padding: "6px 12px", fontSize: 10, color: "#bbb", cursor: "pointer", fontFamily: "inherit" }}>Clear</button>
              <button
                disabled={!canApply}
                title={hasErrors ? "Fix errors before applying" : !start ? "Select a date first" : !end && !singleMode ? "Select an end date" : ""}
                style={{ background: canApply ? P : "#f0f0f0", border: "none", padding: "6px 16px", fontSize: 10, color: canApply ? "#fff" : "#ccc", cursor: canApply ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 500, transition: "all 0.15s" }}
              >Apply</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Config panel ── */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 268, maxWidth: 300 }}>
        <div style={{ fontSize: 9, color: "#aaa", letterSpacing: "0.12em", marginBottom: 10, textTransform: "uppercase" }}>Configuration</div>
        <div style={{ background: "#fff", border: "1px solid #e4e4e4" }}>

          <div style={{ padding: "12px 18px 4px", fontSize: 8, color: "#ccc", letterSpacing: "0.14em", textTransform: "uppercase", borderBottom: "1px solid #f4f4f4" }}>Display</div>
          <div style={{ padding: "0 18px" }}>
            <Toggle label="Hide presets"      description="Remove the shortcut sidebar"        checked={hidePresets}   onChange={() => setHidePresets(v => !v)} />
            <Toggle label="Hide time inputs"  description="Date-only, no hour/minute"          checked={hideTime}      onChange={() => setHideTime(v => !v)} />
            <Toggle label="Single month view" description="One calendar instead of two"        checked={hideTwoMonths} onChange={() => setHideTwoMonths(v => !v)} />
            <Toggle label="Single date"       description="Pick one date, not a range"         checked={singleMode}    onChange={() => { setSingleMode(v => !v); clear(); }} />
          </div>

          <div style={{ padding: "12px 18px 4px", fontSize: 8, color: "#ccc", letterSpacing: "0.14em", textTransform: "uppercase", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f4f4f4", marginTop: 4 }}>Constraints</div>
          <div style={{ padding: "0 18px" }}>
            <Toggle label="Disable future dates" description="Block selection of dates after today"  checked={noFuture}  onChange={() => { setNoFuture(v => !v);  clear(); }} />
            <Toggle label="Disable past dates"   description="Block selection of dates before today" checked={noPast}    onChange={() => { setNoPast(v => !v);    clear(); }} />
            <Toggle label="Disable weekends"     description="Saturdays and Sundays are unavailable" checked={noWeekends} onChange={() => { setNoWeekends(v => !v); clear(); }} />

            {/* Max range */}
            <div style={{ padding: "10px 0", borderBottom: "1px solid #f4f4f4" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#222" }}>Max range</div>
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>Limit how many days can be selected</div>
                </div>
                <div onClick={() => { setUseMaxDays(v => !v); clear(); }} style={{ width: 30, height: 17, borderRadius: 9, background: useMaxDays ? P : "#e0e0e0", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, left: useMaxDays ? 13 : 2, width: 13, height: 13, borderRadius: "50%", background: "#fff", transition: "left 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                </div>
              </div>
              {useMaxDays && <Stepper value={maxDays} onChange={setMaxDays} min={1} />}
            </div>

            {/* Min range */}
            <div style={{ padding: "10px 0", borderBottom: "1px solid #f4f4f4" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#222" }}>Min range</div>
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>Require a minimum number of days</div>
                </div>
                <div onClick={() => { setUseMinDays(v => !v); clear(); }} style={{ width: 30, height: 17, borderRadius: 9, background: useMinDays ? P : "#e0e0e0", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, left: useMinDays ? 13 : 2, width: 13, height: 13, borderRadius: "50%", background: "#fff", transition: "left 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                </div>
              </div>
              {useMinDays && <Stepper value={minDays} onChange={setMinDays} min={1} />}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DateRangePicker;
