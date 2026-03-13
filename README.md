# DateRangePicker

A fully-featured, zero-dependency React date range picker — written in TypeScript.

[![CI](https://github.com/arunkmr08/date-range-picker/actions/workflows/ci.yml/badge.svg)](https://github.com/arunkmr08/date-range-picker/actions)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)

**[Live demo →](https://arunkmr08.github.io/date-range-picker/)**

---

## Features

- **Dual-month calendar** — or single month, configurable
- **11 preset shortcuts** — Yesterday, Today, Last 7 days, Last/This week, Last/This month, Last 3/6 months, Last/This year till Date
- **Custom range** — click any two dates; preset highlights automatically
- **Time inputs** — HH:MM spinners for start and end time (hideable)
- **Single-date mode** — collapses range UI to a single pick
- **Clickable month/year headers** — popover grid pickers
- **Constraints** — disable future/past dates, weekends, set min/max range in days
- **Inline validation** — error / warning banners, Apply blocked on errors
- **Theme system** — light/dark mode + 6 accent colour presets
- **`onChange` callback** — fires on Apply with full range value
- **Zero dependencies** — React 18 only
- **Fully typed** — complete TypeScript interfaces exported

---

## Usage

```tsx
import DateRangePicker from "./components/DateRangePicker";
import type { DateRangeValue } from "./components/DateRangePicker";

function App() {
  const handleChange = (value: DateRangeValue) => {
    console.log(value.start, value.end, value.startTime, value.endTime);
  };

  return (
    <DateRangePicker
      defaultValue={{ startTime: "09:00", endTime: "18:00" }}
      onChange={handleChange}
    />
  );
}
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultValue` | `Partial<DateRangeValue>` | — | Initial start/end dates and times |
| `onChange` | `(value: DateRangeValue) => void` | — | Called when the user clicks **Apply** |

---

## `DateRangeValue`

The object passed to `onChange`:

```ts
interface DateRangeValue {
  start:     Date;         // selected start date
  end:       Date | null;  // selected end date (null in single-date mode)
  startTime: string;       // "HH:MM"
  endTime:   string;       // "HH:MM"
}
```

---

## Exported Types

```ts
import type {
  DateRangeValue,
  DateRangePickerProps,
  ValidationMessage,
  ErrorSeverity,
  Shortcut,
  Constraints,
  Theme,
} from "./components/DateRangePicker";
```

| Type | Description |
|------|-------------|
| `DateRangeValue` | The value emitted by `onChange` |
| `DateRangePickerProps` | Full props interface |
| `ErrorSeverity` | `"error" \| "warning" \| "info"` |
| `ValidationMessage` | `{ type: ErrorSeverity; msg: string }` |
| `Shortcut` | `{ label: string; get: () => [Date, Date] }` |
| `Constraints` | `{ noFuture, noPast, noWeekends, maxDays, minDays }` |
| `Theme` | Full theme token object |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build locally |
| `npm test` | Run Vitest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run coverage` | Generate coverage report |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run `tsc --noEmit` |

---

## Project Structure

```
date-range-picker/
├── src/
│   ├── components/
│   │   └── DateRangePicker/
│   │       ├── DateRangePicker.tsx        # Component + all sub-components
│   │       ├── index.ts                   # Barrel export
│   │       └── __tests__/
│   │           └── DateRangePicker.test.tsx
│   ├── test/
│   │   └── setup.ts                       # Vitest + jest-dom setup
│   ├── App.tsx
│   └── main.tsx
├── .github/
│   └── workflows/
│       └── ci.yml                         # Type-check → Lint → Build → Test
├── vite.config.ts
└── package.json
```

---

## Validation

Three severity levels are surfaced inline above the bottom bar:

| Icon | Level | Blocks Apply? |
|------|-------|---------------|
| ℹ | Info | No |
| ⚠ | Warning | No |
| ✕ | Error | **Yes** |

---

## License

[MIT](./LICENSE)
