# DateRangePicker

A fully-featured, zero-dependency React date range picker — written in TypeScript.

![CI](https://github.com/YOUR_USERNAME/date-range-picker/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)

---

## Features

- **Dual-month calendar** — or single month, configurable
- **12 preset shortcuts** — Today, Last 7/14/30 days, This/Last week, month, year, and more
- **Custom range** — click any two dates; preset highlights automatically
- **Time inputs** — HH:MM spinners for start and end time
- **Single-date mode** — collapses range UI to a single pick
- **Clickable month/year headers** — popover grid pickers
- **Constraints** — disable future/past dates, weekends, set min/max range in days
- **Inline validation** — error / warning / info banners, Apply blocked on errors
- **Zero dependencies** — React 18 only
- **Fully typed** — complete TypeScript interfaces exported

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run `tsc --noEmit` |

---

## Project Structure

```
date-range-picker/
├── src/
│   ├── components/
│   │   └── DateRangePicker/
│   │       ├── DateRangePicker.tsx   # Component + all sub-components
│   │       └── index.ts              # Barrel export
│   ├── App.tsx
│   └── main.tsx
├── .github/
│   └── workflows/
│       └── ci.yml                    # Type-check → Lint → Build
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── eslint.config.js
└── package.json
```

---

## Exported Types

```ts
import DateRangePicker from "./components/DateRangePicker";
import type { ValidationMessage, ErrorSeverity, Shortcut, Constraints } from "./components/DateRangePicker";
```

| Type | Description |
|------|-------------|
| `ErrorSeverity` | `"error" \| "warning" \| "info"` |
| `ValidationMessage` | `{ type: ErrorSeverity; msg: string }` |
| `Shortcut` | `{ label: string; get: () => [Date, Date] }` |
| `Constraints` | `{ noFuture, noPast, noWeekends, maxDays, minDays }` |

---

## Validation

Three severity levels are surfaced inline above the bottom bar:

| Icon | Level | Blocks Apply? |
|------|-------|---------------|
| ℹ | Info | No |
| ⚠ | Warning | No |
| ✕ | Error | **Yes** |

---

## Theme

Two constants at the top of `DateRangePicker.tsx` control all colour usage:

```ts
const P       = "#32A7E8"; // primary — buttons, active states, Apply
const P_LIGHT = "rgba(50,167,232,0.10)"; // range fill tint
```

---

## CI

Every push and pull request to `main` runs:

1. `tsc --noEmit` — TypeScript type check
2. `eslint` — lint
3. `vite build` — production build

---

## License

[MIT](./LICENSE)
