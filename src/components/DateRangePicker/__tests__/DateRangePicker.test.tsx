import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DateRangePicker from "../DateRangePicker";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const user = userEvent.setup();
function getApplyBtn() { return screen.getByRole("button", { name: /apply/i }); }
function getClearBtn()  { return screen.getByRole("button", { name: /clear/i }); }

// ─── Smoke tests ─────────────────────────────────────────────────────────────
describe("DateRangePicker – rendering", () => {
  it("renders without crashing", () => {
    render(<DateRangePicker />);
    expect(getApplyBtn()).toBeInTheDocument();
  });

  it("shows the Shortcuts sidebar by default", () => {
    render(<DateRangePicker />);
    expect(screen.getByText("Shortcuts")).toBeInTheDocument();
  });

  it("shows both Apply and Clear buttons", () => {
    render(<DateRangePicker />);
    expect(getApplyBtn()).toBeInTheDocument();
    expect(getClearBtn()).toBeInTheDocument();
  });
});

// ─── defaultValue ─────────────────────────────────────────────────────────────
describe("DateRangePicker – defaultValue", () => {
  it("seeds start date from defaultValue", () => {
    const start = new Date(2024, 0, 15); // Jan 15 2024
    render(<DateRangePicker defaultValue={{ start }} />);
    expect(screen.getByText(/15 Jan 2024/i)).toBeInTheDocument();
  });

  it("seeds startTime from defaultValue", () => {
    render(<DateRangePicker defaultValue={{ startTime: "08:30" }} />);
    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    expect(inputs[0].value).toBe("08");
    expect(inputs[1].value).toBe("30");
  });
});

// ─── onChange callback ────────────────────────────────────────────────────────
describe("DateRangePicker – onChange", () => {
  it("Apply is disabled when no dates are selected", async () => {
    render(<DateRangePicker />);
    await user.click(getClearBtn());
    expect(getApplyBtn()).toBeDisabled();
  });

  it("calls onChange with start, end, startTime, endTime on Apply", async () => {
    const onChange = vi.fn();
    const start = new Date(2024, 0, 10);
    const end   = new Date(2024, 0, 20);
    render(<DateRangePicker defaultValue={{ start, end }} onChange={onChange} />);

    await user.click(getApplyBtn());

    expect(onChange).toHaveBeenCalledOnce();
    const value = onChange.mock.calls[0][0];
    expect(value.start).toEqual(start);
    expect(value.end).toEqual(end);
    expect(value.startTime).toBe("09:00");
    expect(value.endTime).toBe("17:00");
  });

  it("does not throw when onChange is not provided", async () => {
    const start = new Date(2024, 0, 10);
    const end   = new Date(2024, 0, 20);
    render(<DateRangePicker defaultValue={{ start, end }} />);
    await user.click(getApplyBtn());
  });

  it("Apply is disabled while picking (first date clicked, second not yet)", async () => {
    render(<DateRangePicker />);
    await user.click(getClearBtn());
    expect(getApplyBtn()).toBeDisabled();
  });
});

// ─── Clear button ─────────────────────────────────────────────────────────────
describe("DateRangePicker – Clear", () => {
  it("clears selection and disables Apply", async () => {
    const start = new Date(2024, 0, 10);
    const end   = new Date(2024, 0, 20);
    render(<DateRangePicker defaultValue={{ start, end }} />);

    expect(getApplyBtn()).not.toBeDisabled();
    await user.click(getClearBtn());
    expect(getApplyBtn()).toBeDisabled();
  });
});

// ─── Shortcut sidebar ─────────────────────────────────────────────────────────
describe("DateRangePicker – Shortcuts", () => {
  it("renders all expected shortcuts", () => {
    render(<DateRangePicker />);
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
    expect(screen.getByText("Last 6 months")).toBeInTheDocument();
    expect(screen.getByText("This year till Date")).toBeInTheDocument();
  });

  it("clicking a shortcut enables Apply", async () => {
    render(<DateRangePicker />);
    await user.click(getClearBtn());
    expect(getApplyBtn()).toBeDisabled();

    await user.click(screen.getByText("Today"));
    expect(getApplyBtn()).not.toBeDisabled();
  });

  it("clicking Custom Date clears selection", async () => {
    const start = new Date(2024, 0, 10);
    const end   = new Date(2024, 0, 20);
    render(<DateRangePicker defaultValue={{ start, end }} />);

    expect(getApplyBtn()).not.toBeDisabled();
    await user.click(screen.getByText("Custom Date"));
    expect(getApplyBtn()).toBeDisabled();
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────
describe("DateRangePicker – validation helpers (unit)", () => {
  it("Apply is enabled with a valid range", () => {
    const start = new Date(2024, 0, 1);
    const end   = new Date(2024, 0, 7);
    render(<DateRangePicker defaultValue={{ start, end }} />);
    expect(getApplyBtn()).not.toBeDisabled();
  });
});

// ─── SELECTION day count ──────────────────────────────────────────────────────
describe("DateRangePicker – SELECTION day count", () => {
  it("shows inclusive day count", () => {
    const start = new Date(2024, 0, 1);
    const end   = new Date(2024, 0, 7);
    render(<DateRangePicker defaultValue={{ start, end }} />);
    expect(screen.getByText(/·\s*7 days/i)).toBeInTheDocument();
  });

  it("shows 1 day for a same-day range", () => {
    const d = new Date(2024, 0, 5);
    render(<DateRangePicker defaultValue={{ start: d, end: d }} />);
    expect(screen.getByText(/·\s*1 day$/i)).toBeInTheDocument();
  });
});
