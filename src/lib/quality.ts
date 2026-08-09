export type Tier = "high" | "medium" | "low";

export type QualitySettings = {
  tier: Tier;
  maxDpr: number;
  /** Integration steps per photon. This is the whole cost of the frame. */
  steps: number;
};

const PRESETS: Record<Tier, Omit<QualitySettings, "tier">> = {
  high: { maxDpr: 1.6, steps: 220 },
  medium: { maxDpr: 1.3, steps: 150 },
  low: { maxDpr: 1.0, steps: 100 },
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
    // Phones and tablets: never attempt the full integration.
    return memory >= 6 && cores >= 6 ? "medium" : "low";
  }
  if (memory <= 4 || cores <= 4) return "low";
  if (cores <= 6 || area > 4_200_000) return "medium";
  return "high";
}
