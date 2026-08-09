import { create } from "zustand";
import { detectTier, settingsFor, type QualitySettings, type Tier } from "./quality";

/** Seconds after load at which the wordmark starts to resolve. */
export const TITLE_AT = 1.9;

type UIState = {
  quality: QualitySettings;
  reducedMotion: boolean;
  webglFailed: boolean;
  setTier: (tier: Tier) => void;
  setReducedMotion: (v: boolean) => void;
  failWebgl: () => void;
};

export const useStore = create<UIState>((set, get) => ({
  quality: settingsFor("medium"),
  reducedMotion: false,
  webglFailed: false,
  setTier: (tier) => {
    if (get().quality.tier === tier) return;
    set({ quality: settingsFor(tier) });
  },
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  failWebgl: () => set({ webglFailed: true }),
}));

export function initialTier(): Tier {
  return detectTier();
}

/** Smooth 0..1 ramp between two timestamps. */
export function ramp(t: number, from: number, to: number): number {
  if (to <= from) return t >= to ? 1 : 0;
  const x = (t - from) / (to - from);
  return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
}
