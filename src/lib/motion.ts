/**
 * Pointer smoothing and easing.
 *
 * The field is a factory rather than a module singleton: under StrictMode the
 * effect mounts twice, and two loops sharing one spring would fight over it.
 */

export type Field = {
  /** Pointer in normalised device coords, raw from the event. */
  targetX: number;
  targetY: number;
  /** Spring-smoothed pointer. This is what the shader consumes. */
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export function createField(): Field {
  return { targetX: 0, targetY: 0, x: 0, y: 0, vx: 0, vy: 0 };
}

/** Slow and heavy: the sphere should feel like it weighs something. */
const STIFFNESS = 18;
const DAMPING = 7.2;

export function stepField(f: Field, dt: number) {
  // Clamp dt so a backgrounded tab doesn't launch the spring into orbit.
  const h = Math.min(dt, 1 / 30);

  const ax = (f.targetX - f.x) * STIFFNESS - f.vx * DAMPING;
  const ay = (f.targetY - f.y) * STIFFNESS - f.vy * DAMPING;

  f.vx += ax * h;
  f.vy += ay * h;
  f.x += f.vx * h;
  f.y += f.vy * h;
}

/** Smooth 0..1 ramp between two timestamps. */
export function ramp(t: number, from: number, to: number): number {
  if (to <= from) return t >= to ? 1 : 0;
  const x = (t - from) / (to - from);
  return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
}
