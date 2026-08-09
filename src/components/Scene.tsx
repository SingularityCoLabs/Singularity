"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";

import { BlackHole } from "./BlackHole";
import { initialTier, useStore } from "@/lib/store";

export function Scene() {
  const quality = useStore((s) => s.quality);
  const setTier = useStore((s) => s.setTier);
  const setReducedMotion = useStore((s) => s.setReducedMotion);
  const failWebgl = useStore((s) => s.failWebgl);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTier(initialTier());

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);

    setReady(true);
    return () => mq.removeEventListener("change", onChange);
  }, [setTier, setReducedMotion]);

  if (!ready) return null;

  return (
    <Canvas
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
        depth: false,
        // The disc runs far above 1.0 so the bloom has something to bloom.
        // Tone mapping happens at the end of the chain, not here.
        toneMapping: THREE.NoToneMapping,
      }}
      dpr={[1, quality.maxDpr]}
      flat
      fallback={null}
      onError={() => failWebgl()}
      style={{ position: "absolute", inset: 0 }}
    >
      <BlackHole />

      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom
          intensity={0.55}
          luminanceThreshold={0.72}
          luminanceSmoothing={0.22}
          mipmapBlur
          radius={0.78}
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}
