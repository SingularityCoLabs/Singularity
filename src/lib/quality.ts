export type Tier = "high" | "medium" | "low";

export type QualitySettings = {
  tier: Tier;
  /** Ceiling on devicePixelRatio. The shader is fill-bound, so this is the
      single biggest lever on frame cost. */
  maxDpr: number;
  /** Expanding wavefronts drawn per frame. */
  shells: number;
  /** Cell-splat layers in the stipple. Each layer is a full hash33 lookup. */
  layers: number;
};

const PRESETS: Record<Tier, Omit<QualitySettings, "tier">> = {
  high: { maxDpr: 1.75, shells: 7, layers: 3 },
  medium: { maxDpr: 1.4, shells: 5, layers: 2 },
  low: { maxDpr: 1.0, shells: 4, layers: 2 },
};

export function settingsFor(tier: Tier): QualitySettings {
  return { tier, ...PRESETS[tier] };
}

/** Best-effort capability sniff. Quality is chosen for the user, never by them. */
export function detectTier(): Tier {
  if (typeof window === "undefined") return "medium";

  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory ?? (coarse ? 4 : 8);
  const cores = navigator.hardwareConcurrency ?? (coarse ? 4 : 8);
  const area = window.innerWidth * window.innerHeight;

  if (coarse) {
    // Phones and tablets: never attempt the full sample count.
    return memory >= 6 && cores >= 6 ? "medium" : "low";
  }
  if (memory <= 4 || cores <= 4) return "low";
  if (cores <= 6 || area > 4_200_000) return "medium";
  return "high";
}

/** The next tier down, or null at the bottom. */
export function downgrade(tier: Tier): Tier | null {
  return tier === "high" ? "medium" : tier === "medium" ? "low" : null;
}
