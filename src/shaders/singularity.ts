/**
 * Expansion study.
 *
 * One fullscreen pass. A dot-filled sphere, a gold limb, and a slow drift of
 * dust around it — all analytic, so there is no geometry, no texture, and no
 * postprocessing chain behind this.
 *
 * Screen units: 1.0 is half the *short* axis, so the sphere stays a circle at
 * every aspect ratio and the composition never squashes.
 */

/** Sphere radius in screen units. The framing uniform is derived from it, so
    the two cannot drift apart. */
export const SPHERE_R = 0.78;

export const SING_VERT = /* glsl */ `#version 300 es

void main() {
  // Fullscreen triangle straight out of the vertex index — no buffers needed.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const SING_FRAG = /* glsl */ `#version 300 es

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2  uRes;       // drawing buffer size, in pixels
uniform float uTime;      // seconds; frozen for reduced motion
uniform vec2  uLean;      // damped pointer, -1..1
uniform float uIntro;     // 0..1, opens the piece out of black
uniform float uExposure;  // overall stop
uniform float uScale;     // per-aspect framing

out vec4 fragColor;

#ifndef LAYERS
  #define LAYERS 3
#endif
#ifndef DUST
  #define DUST 3
#endif

#define R        ${SPHERE_R.toFixed(3)}   // sphere radius
#define RIM_W    0.016

// Sampled from the reference: deep blue body, teal dots, ice highlight,
// amber limb, mid-blue dust. No hue outside this ramp.
const vec3 DEEP  = vec3(0.035, 0.161, 0.247);
const vec3 CYAN  = vec3(0.122, 0.659, 0.722);
const vec3 ICE   = vec3(0.639, 0.910, 0.961);
const vec3 GOLD  = vec3(0.910, 0.710, 0.227);
const vec3 SHELL = vec3(0.071, 0.447, 0.627);

// ---------------------------------------------------------------------------
// Hashes and value noise.
// ---------------------------------------------------------------------------

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

/**
 * Deliberately not the fract(sin(x) * 43758.0) variety. sin() of large
 * arguments loses precision badly across drivers, and on a software rasteriser
 * it collapses to zero — every cell then fails the density gate and the whole
 * dot field silently renders as nothing.
 */
vec3 hash33(vec3 p) {
  vec3 q = fract(p * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yxz + 33.33);
  return fract((q.xxy + q.yxx) * q.zyx);
}

float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));

  float x00 = mix(n000, n100, f.x);
  float x10 = mix(n010, n110, f.x);
  float x01 = mix(n001, n101, f.x);
  float x11 = mix(n011, n111, f.x);

  return mix(mix(x00, x10, f.y), mix(x01, x11, f.y), f.z);
}

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}

// ---------------------------------------------------------------------------
// Dots. The volume is diced into cells; a cell that clears the gate holds one
// round dot at a jittered position. The jitter is kept inside the cell so a dot
// is never clipped by the cell it belongs to — that is what lets a single
// lookup per layer stand in for a proper point splat.
//
// Cell size is measured on the unit sphere, not in pixels, so the dots keep the
// same size relative to the sphere on a phone and on a 5K display.
// ---------------------------------------------------------------------------

/**
 * Whether a cell holds a dot at all, and how bright it is this instant. Empty
 * cells are what make this read as dots rather than as noise, and each dot
 * breathes on a phase taken from its own hash — shimmer, never strobe, and
 * never all in step.
 */
float dotLife(vec3 rnd, float gate) {
  float on = smoothstep(gate, gate + 0.22, rnd.z);
  if (on <= 0.0) return 0.0;
  return on * (0.6 + 0.4 * sin(uTime * 0.8 + rnd.x * 6.2831));
}

/** Dots through a volume — for the sphere, where the surface cuts the lattice. */
float dotCell(vec3 p, float scale, float radius, float gate) {
  vec3 c = p * scale;
  vec3 rnd = hash33(floor(c));

  float life = dotLife(rnd, gate);
  if (life <= 0.0) return 0.0;

  vec3 centre = vec3(0.5) + (rnd - 0.5) * (1.0 - 2.0 * radius);
  return smoothstep(radius, radius * 0.32, length(fract(c) - centre)) * life;
}

/**
 * Dots across a plane. This has to be its own function rather than a volume
 * lookup at a fixed depth: with the third axis pinned, every cell centre sits
 * a jitter-width away in z, no dot is ever within one radius of the sample,
 * and the field renders as nothing at all. seed separates one layer from the
 * next.
 */
float dotCell2(vec2 p, float scale, float radius, float gate, float seed) {
  vec2 c = p * scale;
  vec3 rnd = hash33(vec3(floor(c), seed));

  float life = dotLife(rnd, gate);
  if (life <= 0.0) return 0.0;

  vec2 centre = vec2(0.5) + (rnd.xy - 0.5) * (1.0 - 2.0 * radius);
  return smoothstep(radius, radius * 0.32, length(fract(c) - centre)) * life;
}

/** Layered dots: a coarse pass for structure, finer passes for tooth. */
float dotField(vec3 p, float scale, float radius, float gate) {
  float sum = 0.0;
  float amp = 1.0;
  float norm = 0.0;

  for (int k = 0; k < LAYERS; k++) {
    sum += dotCell(p + float(k) * 21.7, scale * pow(2.03, float(k)), radius, gate) * amp;
    norm += amp;
    amp *= 0.55;
  }
  return sum / max(norm, 1e-4);
}

/**
 * The core, at the centre. There is no bloom pass to lean on, so the glow is an
 * inverse-square tail plus a tight gaussian centre — cheap, and it clips to
 * white in the middle the way a real overexposed point does.
 */
float corePoint(vec2 uv) {
  float d2 = dot(uv, uv);
  return 0.00030 / (d2 + 2.0e-5) + 0.55 * exp(-d2 / 0.00055);
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  // Normalising on the short axis is what keeps the sphere circular, and
  // uScale is derived from R, so the sphere is centred and fully in frame at
  // every aspect ratio.
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
  uv *= uScale;

  float r = length(uv);
  float t = uTime;

  // The silhouette never moves. Only the sample point rotates, so dots flow
  // across a sphere that stays perfectly symmetrical.
  mat3 view = rotY(t * 0.10 + uLean.x * 0.34)
            * rotX(0.22 + uLean.y * 0.26 + sin(t * 0.13) * 0.06);

  vec3 col = vec3(0.0);

  // ---- body ----------------------------------------------------------------
  if (r < R) {
    float z = sqrt(max(R * R - r * r, 0.0));
    vec3 q = view * (vec3(uv, z) / R);
    float ndv = z / R;                     // 1 at the centre, 0 at the limb

    float g = dotField(q, 26.0, 0.34, 0.30);

    // A ray grazing the limb crosses more of the volume than one through the
    // middle, so the same density has to read brighter there.
    float depth = mix(1.0, 2.05, pow(1.0 - ndv, 1.6));

    col += mix(DEEP * 0.9, CYAN, g * 0.85) * (0.24 + g * 1.45) * depth;
    col += ICE * g * g * 0.5;

    // Gold gathers where the shell of the sphere turns edge-on.
    col += GOLD * pow(1.0 - ndv, 3.4) * (0.28 + g * 1.05);
  }

  // ---- gold rim ------------------------------------------------------------
  float rim = exp(-pow((r - R) / RIM_W, 2.0));
  if (rim > 0.002) {
    // Angular noise keeps the ring from reading as vector-clean linework.
    float ang = atan(uv.y, uv.x);
    float grain = 0.58 + 0.42 * vnoise(vec3(ang * 9.0, r * 44.0, t * 0.35));
    col += GOLD * rim * 1.45 * grain;
    col += ICE * rim * rim * 0.30 * grain;
  }

  // ---- drifting dust -------------------------------------------------------
  // Loose dots outside the limb, each layer on its own slow rotation so the
  // field shears against itself instead of turning as one rigid disc.
  // Tight falloff: the dust is a shell hugging the limb, not a starfield. By
  // the corner of a wide display it has faded to nothing.
  float halo = smoothstep(R - 0.02, R + 0.07, r) * exp(-max(r - R, 0.0) * 3.4);
  if (halo > 0.002) {
    float dust = 0.0;
    for (int k = 0; k < DUST; k++) {
      float fk = float(k);
      // Alternating direction: neighbouring layers counter-rotate, so the field
      // shears against itself instead of turning as one rigid disc.
      float dir = mod(fk, 2.0) < 0.5 ? 1.0 : -1.0;
      float a = t * (0.020 + fk * 0.011) * dir + fk * 2.1;
      float ca = cos(a), sa = sin(a);
      vec2 du = mat2(ca, -sa, sa, ca) * uv;

      // No time term in the lattice itself: the rotation is what moves the
      // dots. Sliding the lattice would make each dot jump as it crossed a
      // cell border instead of travelling.
      dust += dotCell2(du, 22.0 + fk * 9.0, 0.19, 0.70, fk * 17.0)
            / (1.0 + fk * 0.45);
    }
    col += mix(SHELL, ICE, 0.42) * dust * halo * 2.4;
  }

  // ---- core ----------------------------------------------------------------
  float pulse = 0.76 + 0.24 * sin(t * 1.7);
  col += vec3(0.55, 0.88, 1.0) * corePoint(uv) * pulse * 0.9;

  // A wide halo so the object sits in light rather than cutting out of black.
  col += SHELL * exp(-r * r / 0.95) * 0.09;

  col *= uIntro * uExposure;

  col *= mix(0.5, 1.0, smoothstep(2.0, 0.5, r));
  col = aces(col);

  // Break the banding the long dark gradients would otherwise show.
  col += (hash13(vec3(gl_FragCoord.xy, floor(uTime * 24.0))) - 0.5) * 0.0035;

  fragColor = vec4(max(col, 0.0), 1.0);
}
`;
