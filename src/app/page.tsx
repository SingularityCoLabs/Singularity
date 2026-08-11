import { Singularity } from "@/components/Singularity";

export default function Page() {
  return (
    <main>
      <Singularity />
      <div className="scrim" aria-hidden="true" />
      <div className="center-content">
        <h1 className="title">SINGULARITY</h1>
        <p className="tagline">
          A point in space-time where gravitational forces cause matter to have
          infinite density.
        </p>
        <nav className="links" aria-label="External links">
          <a href="https://github.com/SingularityCoLabs" target="_blank" rel="noopener noreferrer" className="link">
            GitHub
          </a>
          <span className="link-divider" aria-hidden="true">·</span>
          <a href="https://dilandilruksha.dev/" target="_blank" rel="noopener noreferrer" className="link">
            dilandilruksha.dev
          </a>
        </nav>
      </div>
    </main>
  );
}
