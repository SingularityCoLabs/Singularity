/**
 * Pointer state, smoothed.
 *
 * A plain mutable singleton rather than React state on purpose: it is written
 * and read every frame, and routing that through React would re-render the
 * tree 60 times a second.
 */

type FieldState = {
  /** Pointer in normalised device coords, raw from the event. */
  targetX: number;
  targetY: number;
  /** Spring-smoothed pointer. This is what the camera consumes. */
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export const field: FieldState = {
  targetX: 0,
  targetY: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
};

/** Slow and heavy: the camera should feel like it weighs something. */
const STIFFNESS = 18;
const DAMPING = 7.2;

export function stepField(dt: number) {
  // Clamp dt so a backgrounded tab doesn't launch the spring into orbit.
  const h = Math.min(dt, 1 / 30);

  const ax = (field.targetX - field.x) * STIFFNESS - field.vx * DAMPING;
  const ay = (field.targetY - field.y) * STIFFNESS - field.vy * DAMPING;

  field.vx += ax * h;
  field.vy += ay * h;
  field.x += field.vx * h;
  field.y += field.vy * h;
}

export function setPointer(nx: number, ny: number) {
  field.targetX = nx;
  field.targetY = ny;
}

export function clearPointer() {
  field.targetX = 0;
  field.targetY = 0;
}
