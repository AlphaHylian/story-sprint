import { formatClock, h } from "./ui";

/**
 * A wall-clock stopwatch. Elapsed time is computed from Date.now() so it stays
 * accurate when the tab is throttled in the background.
 */
export class Clock {
  private startedAt = 0;
  private base = 0;
  private handle: number | undefined;

  constructor(private onTick: (elapsedMs: number) => void) {}

  start(fromElapsedMs = 0): void {
    this.stop();
    this.base = fromElapsedMs;
    this.startedAt = Date.now();
    this.handle = window.setInterval(() => this.onTick(this.elapsed()), 250);
    this.onTick(this.elapsed());
  }

  stop(): void {
    if (this.handle !== undefined) {
      this.base = this.elapsed();
      window.clearInterval(this.handle);
      this.handle = undefined;
    }
  }

  get running(): boolean {
    return this.handle !== undefined;
  }

  elapsed(): number {
    return this.running ? this.base + (Date.now() - this.startedAt) : this.base;
  }
}

/** The big countdown display. Negative remaining time shows as overtime. */
export function countdownDisplay(label: string) {
  const time = h("div", { class: "countdown-time", "aria-live": "off" }, "0:00");
  const caption = h("div", { class: "countdown-label" }, label);
  const el = h("div", { class: "countdown", role: "timer" }, time, caption);
  let warned = false;
  return {
    el,
    setLabel(text: string) {
      caption.textContent = text;
    },
    /** Returns true the first time the display crosses into the final minute. */
    update(remainingMs: number, overtime = false): boolean {
      time.textContent = formatClock(overtime ? -Math.abs(remainingMs) : Math.max(0, remainingMs));
      const warn = !overtime && remainingMs > 0 && remainingMs <= 60_000;
      el.classList.toggle("warn", warn);
      el.classList.toggle("over", overtime);
      el.classList.toggle("done", !overtime && remainingMs <= 0);
      if (warn && !warned) {
        warned = true;
        return true;
      }
      return false;
    },
    /** Re-arm the one-minute warning, e.g. when a new phase starts. */
    reset() {
      warned = false;
    },
  };
}
