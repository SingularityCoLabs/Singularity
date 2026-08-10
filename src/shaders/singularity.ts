/**
 * Expansion study.
 *
 * One fullscreen pass. A stipple-filled sphere, a gold limb, and a train of
 * wavefronts expanding out of the centre — all analytic, so there is no
 * geometry, no texture, and no postprocessing chain behind this.
 *
 * Screen units: 1.0 is half the *short* axis, so the sphere stays a circle at
 * every aspect ratio and the composition never squashes.
 */

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

#ifndef SHELLS
  #define SHELLS 6
#endif
#ifndef LAYERS
  #define LAYERS 3
#endif

#define R        0.44   // sphere radius
#define REACH    0.68   // how far past R the wavefronts travel
#define RIM_W    0.013
#define SHELL_W  0.006

// Sampled from the reference: deep blue body, teal stipple, ice highlight,
// amber limb, mid-blue shells. No hue outside this ramp.
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
 * stipple field silently renders as nothing.
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
// Stipple. Most cells hold nothing; the ones that clear the gate hold a
// jittered point splat. Empty cells are what make this read as grain rather
// than as noise.
//
// The field lives in the *rotating* volume, so speckles travel with the
// surface instead of being reseeded per frame. On top of that each cell
// twinkles on a phase taken from its own hash — shimmer, never strobe.
// ---------------------------------------------------------------------------

float stipple(vec3 p, float scale, float gate) {
  float sum = 0.0;
  float amp = 1.0;
  float norm = 0.0;

  for (int k = 0; k < LAYERS; k++) {
    vec3 c = p * scale * pow(2.03, float(k));
    vec3 rnd = hash33(floor(c));

    // Every cell contributes something. A sparse splat would give stars; what
    // the reference has is grain, so the gate sets how much of the range lights
    // up rather than which cells exist at all.
    float lit = smoothstep(gate, 1.0, rnd.z);
    float tw = 0.55 + 0.45 * sin(uTime * 0.8 + rnd.x * 6.2831);

    sum += lit * tw * amp;
    norm += amp;
    amp *= 0.55;
  }
  return sum / max(norm, 1e-4);
}

/**
 * A core point source. There is no bloom pass to lean on, so the glow is an
 * inverse-square tail plus a tight gaussian centre — cheap, and it clips to
 * white in the middle the way a real overexposed point does.
 */
float corePoint(vec2 uv, vec2 c) {
  float d2 = dot(uv - c, uv - c);
  return 0.00030 / (d2 + 2.0e-5) + 0.55 * exp(-d2 / 0.00055);
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  // Normalising on the short axis is what keeps the sphere circular.
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
  uv *= uScale;

  float r = length(uv);
  float t = uTime;

  // The silhouette never moves. Only the sample point rotates, so grain flows
  // across a sphere that stays perfectly symmetrical.
  mat3 view = rotY(t * 0.10 + uLean.x * 0.34)
            * rotX(0.22 + uLean.y * 0.26 + sin(t * 0.13) * 0.06);

  vec3 col = vec3(0.0);

  // ---- body ----------------------------------------------------------------
  if (r < R) {
    float z = sqrt(max(R * R - r * r, 0.0));
    vec3 q = view * (vec3(uv, z) / R);
    float ndv = z / R;                     // 1 at the centre, 0 at the limb

    float g = stipple(q, 190.0, 0.34);

    // A ray grazing the limb crosses more of the volume than one through the
    // middle, so the same density has to read brighter there.
    float depth = mix(1.0, 2.05, pow(1.0 - ndv, 1.6));

    col += mix(DEEP * 0.9, CYAN, g * 0.85) * (0.26 + g * 1.45) * depth;
    col += ICE * g * g * 0.45;

    // Gold gathers where the shell of the sphere turns edge-on.
    col += GOLD * pow(1.0 - ndv, 3.4) * (0.30 + g * 1.05);
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

  // ---- expanding wavefronts ------------------------------------------------
  // Each shell rides a fract() phase offset by k/SHELLS, so they are evenly
  // spaced and recycle forever. The window fades in after birth and out before
  // death, which is what makes the wrap seamless instead of popping.
  for (int k = 0; k < SHELLS; k++) {
    float ph = fract(t * 0.055 + float(k) / float(SHELLS));
    float rad = R + ph * REACH;
    float w = SHELL_W * (0.5 + ph * 2.4);
    float d = (r - rad) / w;
    float line = exp(-d * d);
    if (line < 0.0025) continue;

    float window = smoothstep(0.0, 0.08, ph) * (1.0 - smoothstep(0.30, 1.0, ph));
    // Stippled in screen space: the wavefronts are made of the same dust the
    // body is, so they must not read as clean vector arcs.
    float grain = 0.30 + 0.90 * stipple(vec3(uv * 3.0, float(k) * 7.0), 64.0, 0.30);

    col += SHELL * line * window * grain * 1.55;
    col += ICE * line * line * window * grain * 0.32;
  }

  // ---- cores ---------------------------------------------------------------
  float pulse = 0.76 + 0.24 * sin(t * 1.7);
  float cores = corePoint(uv, vec2(0.0, 0.034)) + corePoint(uv, vec2(0.0, -0.034));
  col += vec3(0.55, 0.88, 1.0) * cores * pulse;

  // A wide halo so the object sits in light rather than cutting out of black.
  col += SHELL * exp(-r * r / 0.30) * 0.09;

  col *= uIntro * uExposure;

  col *= mix(0.45, 1.0, smoothstep(1.55, 0.28, r));
  col = aces(col);

  // Break the banding the long dark gradients would otherwise show.
  col += (hash13(vec3(gl_FragCoord.xy, floor(uTime * 24.0))) - 0.5) * 0.0035;

  fragColor = vec4(max(col, 0.0), 1.0);
}
`;
