export interface Point {
  x: number;
  y: number;
  visibility?: number;
}

// ─── Angle ───────────────────────────────────────────────────────────
/**
 * Angle at vertex B formed by A-B-C, in degrees 0-180.
 */
export function calculateAngle(A: Point, B: Point, C: Point): number {
  const radians =
    Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

// ─── Smoothing ───────────────────────────────────────────────────────
/**
 * Exponential Moving Average — reacts faster than SMA, feels buttery.
 * alpha = 0 → no change, alpha = 1 → no smoothing.
 */
export class EMA {
  private value: number | null = null;
  private alpha: number;

  constructor(alpha = 0.35) {
    this.alpha = alpha;
  }

  /** Feed a raw measurement, get the smoothed value back. */
  add(raw: number): number {
    if (this.value === null) {
      this.value = raw;
    } else {
      this.value = this.alpha * raw + (1 - this.alpha) * this.value;
    }
    return this.value;
  }

  get(): number {
    return this.value ?? 0;
  }

  reset() {
    this.value = null;
  }
}

/**
 * 2-D position smoother — smooths x,y independently to make joints "sturdy".
 */
export class PositionSmoother {
  private sx: EMA;
  private sy: EMA;

  constructor(alpha = 0.4) {
    this.sx = new EMA(alpha);
    this.sy = new EMA(alpha);
  }

  add(p: Point): Point {
    return {
      x: this.sx.add(p.x),
      y: this.sy.add(p.y),
      visibility: p.visibility,
    };
  }
}

// ─── Error % ─────────────────────────────────────────────────────────
/**
 * 45° deviation from target = 100 % error.
 */
export function calculateErrorPct(
  target: number,
  current: number,
): number {
  const diff = Math.abs(target - current);
  return Math.min(Math.max((diff / 45) * 100, 0), 100);
}

// ─── Clamp ───────────────────────────────────────────────────────────
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ─── Rep State Machine (ref-based, no React state) ───────────────────
export type RepPhase = "UP" | "GOING_DOWN" | "DOWN" | "GOING_UP";

export interface RepEngine {
  phase: RepPhase;
  reps: number;
  /** Frames held in the candidate state before confirming transition */
  holdFrames: number;
  /** Timestamp of last counted rep (for cooldown) */
  lastRepTime: number;
  /** Timestamp when the current rep started (at the bottom) to check speed */
  repStartTime: number;
}

const DEBOUNCE_FRAMES = 3; // Must hold state for N frames
const COOLDOWN_MS = 350;   // Minimum ms between reps
const MIN_REP_DURATION_MS = 350; // Speed sanity rule

export function createRepEngine(): RepEngine {
  return { phase: "UP", reps: 0, holdFrames: 0, lastRepTime: 0, repStartTime: 0 };
}

/**
 * Enhanced Rep Engine to support speed sanity and dynamic thresholds.
 */
export function tickRepEngine(
  engine: RepEngine,
  elbowAngle: number,
  now: number,
  A_UP = 155,
  A_DOWN = 95,
): RepEngine {
  switch (engine.phase) {
    case "UP":
      if (elbowAngle < A_UP - 5) { // Small hysteresis
        engine.phase = "GOING_DOWN";
        engine.holdFrames = 0;
      }
      break;

    case "GOING_DOWN":
      if (elbowAngle <= A_DOWN) {
        engine.holdFrames++;
        if (engine.holdFrames >= DEBOUNCE_FRAMES) {
          engine.phase = "DOWN";
          engine.holdFrames = 0;
          engine.repStartTime = now; // Mark start of upward phase
        }
      } else if (elbowAngle >= A_UP) {
        engine.phase = "UP";
        engine.holdFrames = 0;
      } else {
        engine.holdFrames = 0;
      }
      break;

    case "DOWN":
      if (elbowAngle > A_DOWN + 5) { // Small hysteresis
        engine.phase = "GOING_UP";
        engine.holdFrames = 0;
      }
      break;

    case "GOING_UP":
      if (elbowAngle >= A_UP) {
        engine.holdFrames++;
        if (engine.holdFrames >= DEBOUNCE_FRAMES) {
          const duration = now - engine.repStartTime;
          if (now - engine.lastRepTime > COOLDOWN_MS && duration >= MIN_REP_DURATION_MS) {
            engine.reps++;
            engine.lastRepTime = now;
          }
          engine.phase = "UP";
          engine.holdFrames = 0;
        }
      } else if (elbowAngle <= A_DOWN) {
        engine.phase = "DOWN";
        engine.holdFrames = 0;
      } else {
        engine.holdFrames = 0;
      }
      break;
  }

  return engine;
}

/**
 * Tracks body movement (depth signal) to prevent arm-only reps.
 */
export class BodyDepthTracker {
  private baselineY: EMA;
  private maxDownY = -1;
  private requiredDropPx = 0;
  
  constructor(alpha = 0.1) {
    this.baselineY = new EMA(alpha);
  }

  /** Update the "TOP" baseline while the user is in the UP phase. */
  updateBaseline(y: number) {
    this.baselineY.add(y);
  }

  /** Track the maximum downward position achieved during a rep. */
  trackDepth(y: number) {
    if (this.maxDownY === -1 || y > this.maxDownY) {
      this.maxDownY = y;
    }
  }

  /** Calculate the required drop based on current body size (shoulder width). */
  setRequiredDrop(shoulderWidthPx: number, mode: "front" | "side") {
    const factor = mode === "front" ? 0.10 : 0.06;
    const minPx = mode === "front" ? 18 : 12;
    this.requiredDropPx = Math.max(shoulderWidthPx * factor, minPx);
  }

  /** True if the user has moved down enough to count as a real rep. */
  checkValidity(): boolean {
    const baseline = this.baselineY.get();
    if (baseline === 0 || this.maxDownY === -1) return false;
    return (this.maxDownY - baseline) >= this.requiredDropPx;
  }

  resetRep() {
    this.maxDownY = -1;
  }

  get depthSignal() {
    const baseline = this.baselineY.get();
    if (baseline === 0 || this.maxDownY === -1) return 0;
    return this.maxDownY - baseline;
  }

  get target() { return this.requiredDropPx; }
}

// ─── Geometry Helpers ────────────────────────────────────────────────
/** Euclidean distance between two points (in whatever coord space). */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Midpoint of two points. */
export function avgPoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility ?? 0, b.visibility ?? 0),
  };
}
