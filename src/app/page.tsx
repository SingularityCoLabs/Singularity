"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { StaticFallback } from "@/components/StaticFallback";
import { TitleOverlay } from "@/components/TitleOverlay";
import { useStore } from "@/lib/store";

// The WebGL scene never renders on the server: it depends on canvas
// capabilities that only exist in the browser.
const Scene = dynamic(() => import("@/components/Scene").then((m) => m.Scene), {
  ssr: false,
});

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function Page() {
  const webglFailed = useStore((s) => s.webglFailed);
  const failWebgl = useStore((s) => s.failWebgl);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!hasWebGL()) failWebgl();
    setChecked(true);
  }, [failWebgl]);

  if (!checked) return <main />;

  return (
    <main>
      {webglFailed ? <StaticFallback /> : <Scene />}
      <div className="grain" />
      {webglFailed ? null : <TitleOverlay />}
      <div className="boot" />
    </main>
  );
}
