/**
 * No WebGL. Same composition in CSS: a black shadow, a thin bright ring, a
 * disc edge across it. Someone who only ever sees this should still feel they
 * saw something built.
 */
export function StaticFallback() {
  return (
    <div className="fallback">
      <div className="fallback__disc" />
      <div className="fallback__shadow" />
      <h1 className="title is-revealed" aria-label="Singularity">
        {"SINGULARITY".split("").map((c, i) => (
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
