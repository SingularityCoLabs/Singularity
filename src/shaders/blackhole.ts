/**
 * Gargantua.
 *
 * One full-screen pass. Every pixel fires a photon backwards from the camera
 * and integrates it through the Schwarzschild field until it falls through the
 * horizon, crosses the accretion disc, or escapes to the stars.
 *
 * Units: the Schwarzschild radius is 1, so the horizon sits at r = 1, the
 * photon sphere at 1.5, and the shadow has impact parameter 3*sqrt(3)/2 =
 * 2.598. Working in these units leaves the null geodesic free of constants:
 *
 *   d2x/dl2 = -1.5 * h^2 * x / |x|^5,   h = |x cross v|
 *
 * That is the Binet form, not a fudge — it bends light by 2/b in the weak
 * field, so the shadow comes out the right size and the far side of the disc
 * lifts over the top of the hole on its own. Nothing here draws an arc.
 */

export const BH_VERT = /* glsl */ `
void main() {
  // Fullscreen: bypass the projection entirely and write clip space.
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BH_FRAG = /* glsl */ `
precision highp float;

uniform vec2  uRes;        // drawing buffer size, in pixels
uniform float uTime;
uniform vec3  uCamPos;
uniform mat3  uCamBasis;   // columns: right, up, forward
uniform float uZoom;       // tan(halfFovY)
uniform float uLift;       // raises the object in frame, screen units
uniform float uIntro;      // 0..1, fades the field up from black
uniform float uSpin;       // disc rotation scale; drops for reduced motion
uniform float uDoppler;    // 0..1 relativistic beaming
uniform float uExposure;   // overall stop; the frame is meant to sit dark

#ifndef STEPS
  #define STEPS 190
#endif

// The architecture, in Schwarzschild radii. None of these are art direction:
// the horizon is at 1, the shadow the camera sees is 3*sqrt(3)/2 across, and
// the disc can only start at the innermost stable circular orbit, 3.
#define HORIZON   1.0
#define DISK_IN   3.0
#define DISK_OUT  12.0
#define ESCAPE    26.0

// ---------------------------------------------------------------------------
// Hashes and value noise. Only the disc samples them, and only on the handful
// of steps where a ray actually crosses the plane.
// ---------------------------------------------------------------------------

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123);
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

float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(p);
    p *= 2.07;
    amp *= 0.5;
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Sky. Faint, because its job is to be bent — the smear of stars around the
// shadow is what tells you the light is being pulled.
//
// Monochrome throughout: stars vary in brightness, never in hue.
// ---------------------------------------------------------------------------

vec3 skySample(vec3 dir) {
  float lum = 0.0;

  for (int k = 0; k < 3; k++) {
    float scale = 44.0 * pow(2.4, float(k));
    vec3 p = dir * scale;
    vec3 rnd = hash33(floor(p));

    // Most cells hold nothing. Density is set by how few clear the gate.
    float gate = 0.955;
    if (rnd.z <= gate) continue;

    float d = length(fract(p) - rnd);
    float point = pow(smoothstep(0.34, 0.0, d), 9.0);
    float mag = (rnd.z - gate) / (1.0 - gate);

    lum += point * mag * (1.6 - float(k) * 0.34);
  }

  // A dust lane, so the sky is not a uniform sprinkle.
  float lane = dot(dir, normalize(vec3(0.34, 0.86, -0.38))) * 2.5;
  lum += 0.040 * exp(-lane * lane) * (0.30 + fbm(dir * 3.1 + 11.0) * 0.9);

  // Never mathematically black: a trace of ambience holds the frame.
  return vec3(lum + 0.006);
}

// ---------------------------------------------------------------------------
// The disc. Sampled where a ray crosses y = 0, between the inner edge and the
// rim. Thin on purpose — the whole read of the image comes from seeing the far
// side lensed over the top and under the bottom of a razor.
//
// The inner edge is the ISCO, 3 Rs, because that is where a static hole stops
// holding a circular orbit — inside it, matter falls. Nothing is placed by eye.
// ---------------------------------------------------------------------------

float discSample(vec3 p, vec3 vel, out float opacity) {
  opacity = 0.0;

  float r = length(p.xz);
  float t = (r - DISK_IN) / (DISK_OUT - DISK_IN);
  if (t < 0.0 || t > 1.0) return 0.0;

  float shape = smoothstep(0.0, 0.075, t) * (1.0 - smoothstep(0.44, 1.0, t));
  if (shape < 0.002) return 0.0;

  // Keplerian shear: the inner edge laps the rim, which is what stretches the
  // filaments instead of turning the disc as one rigid plate.
  float ang = atan(p.z, p.x) + uTime * uSpin * 2.2 * pow(DISK_IN / r, 1.5);
  vec3 q = vec3(vec2(cos(ang), sin(ang)) * r, r * 0.5);

  float coarse = fbm(q * 0.60 + vec3(0.0, 0.0, uTime * 0.014 * uSpin));
  float fine   = fbm(q * 2.85 - vec3(0.0, 0.0, uTime * 0.050 * uSpin));
  float dens = shape * (0.46 + 1.00 * coarse) * (0.58 + 0.68 * fine);

  // With no hue to carry it, radius has to read as tone: near-white at the
  // inner edge falling to dark graphite at the rim.
  float temp = pow(DISK_IN / r, 1.25);
  float tone = mix(0.16, 1.0, smoothstep(0.06, 0.92, temp));

  // Beaming and gravitational shift, as brightness alone.
  float beta = clamp(sqrt(0.5 / max(r, 1.05)), 0.0, 0.75);
  vec3 orbit = normalize(cross(vec3(0.0, 1.0, 0.0), p)) * beta;
  vec3 toEye = -normalize(vel);
  float gamma = inversesqrt(max(1.0 - beta * beta, 1e-3));
  float shift = sqrt(max(1.0 - HORIZON / r, 0.04))
              / max(gamma * (1.0 - dot(orbit, toEye)), 1e-3);

  float boost = mix(1.0, clamp(shift * shift * shift, 0.08, 6.0), uDoppler);

  opacity = clamp(dens * 1.30, 0.0, 1.0);
  return tone * dens * (0.55 + 3.2 * temp) * boost;
}

// ---------------------------------------------------------------------------

void main() {
  vec2 screen = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

  vec3 pos = uCamPos;
  vec3 vel = normalize(uCamBasis * vec3((screen - vec2(0.0, uLift)) * uZoom, 1.0));

  // Conserved along the geodesic, and equal to the impact parameter squared.
  vec3 angular = cross(pos, vel);
  float h2 = dot(angular, angular);

  float light = 0.0;
  float trans = 1.0;
  bool escaped = false;

  for (int i = 0; i < STEPS; i++) {
    float r2 = dot(pos, pos);
    float r = sqrt(r2);

    if (r < HORIZON) break;
    if (r > ESCAPE && dot(pos, vel) > 0.0) { escaped = true; break; }

    // Long steps where the field is flat, short where it curves.
    float dt = clamp(0.030 * r2, 0.035, 1.4);

    vec3 grav = -1.5 * h2 * pos / (r2 * r2 * r);
    vec3 next = pos + vel * dt + 0.5 * grav * dt * dt;

    // Disc crossing: y changes sign across the step. Solving for the crossing
    // rather than stepping finely through the plane is what keeps a near
    // edge-on camera affordable.
    if (pos.y * next.y < 0.0) {
      vec3 hit = mix(pos, next, pos.y / (pos.y - next.y));
      float opacity;
      light += discSample(hit, vel, opacity) * trans;

      trans *= 1.0 - opacity * 0.86;
      if (trans < 0.004) break;
    }

    vel = normalize(vel + grav * dt);
    pos = next;
  }

  // Nothing is drawn at the shadow edge. Whatever ring appears there is light
  // that wound around the hole and came back out, found by the integration.
  vec3 col = vec3(light);
  if (escaped) col += skySample(normalize(vel)) * trans;

  col *= uIntro * uExposure;

  float vig = smoothstep(1.45, 0.30, length(vec2(screen.x * 0.80, screen.y)));
  col *= mix(0.52, 1.0, vig);

  // Break the banding the long dark gradients would otherwise show.
  col += (hash13(vec3(gl_FragCoord.xy, floor(uTime * 24.0))) - 0.5) * 0.0035;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;
