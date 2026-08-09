"use client";

import { useEffect, useState } from "react";

import { TITLE_AT } from "@/lib/store";

const LETTERS = "SINGULARITY".split("");

/**
 * The only crisp thing on screen.
 *
 * The wordmark resolves per letter through a mask that lifts, so the light
 * appears to come through the glyphs rather than fading them up.
 */
export function TitleOverlay() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setRevealed(true), TITLE_AT * 1000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="overlay">
      <h1 className={`title ${revealed ? "is-revealed" : ""}`} aria-label="Singularity">
        {LETTERS.map((c, i) => (
          <span
            key={`${c}-${i}`}
            className="letter"
            style={{ ["--i" as string]: String(i) }}
            aria-hidden="true"
          >
            {c}
          </span>
        ))}
      </h1>
    </div>
  );
}
