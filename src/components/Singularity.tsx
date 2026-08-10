"use client";

import { useEffect, useRef, useState } from "react";

import { buildProgram, createContext, uniformCache } from "@/lib/gl";
import { createField, ramp, stepField } from "@/lib/motion";
import { detectTier, downgrade, settingsFor, type QualitySettings } from "@/lib/quality";
import { SING_FRAG, SING_VERT, SPHERE_R } from "@/shaders/singularity";

/** Where the clock is parked when the user has asked for no motion: far enough
    in that the dust has drifted off its seed positions. */
const STILL_T = 6.0;

/**
 * Framing. `uScale` is the half-extent of the *short* axis in shader units, so
 * the sphere covers `R / uScale` of that axis — pick the share first and solve
 * for the uniform. Phones get a fuller frame because there is less screen to
 * fill; wide displays leave more air around it. Interpolated rather than
 * stepped so a resize never snaps.
 */
function frameScale(aspect: number): number {
  const k = Math.min(Math.max((aspect - 0.55) / 0.65, 0), 1);
  const share = 0.86 - k * 0.12;
  return SPHERE_R / share;
}

export function Singularity() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = createContext(canvas);
    if (!gl) {
      setFailed(true);
      return;
    }

    let quality: QualitySettings = settingsFor(detectTier());
    let program: WebGLProgram | null = null;
    let uniform: ((name: string) => WebGLUniformLocation | null) | null = null;
    let vao: WebGLVertexArrayObject | null = null;

    const field = createField();
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let still = motionMq.matches;

    let raf = 0;
    let last = 0;
    let elapsed = 0;
    let disposed = false;
    const perf = { acc: 0, frames: 0, drops: 0 };

    /** Programs carry DUST/LAYERS as compile-time defines, so a tier change
        relinks rather than setting a uniform: a dynamic loop bound would cost
        every pixel a branch it never takes. */
    function build(): boolean {
      if (!gl) return false;
      if (program) gl.deleteProgram(program);

      program = buildProgram(gl, SING_VERT, SING_FRAG, {
        DUST: quality.dust,
        LAYERS: quality.layers,
      });
      if (!program) return false;

      uniform = uniformCache(gl, program);
      gl.useProgram(program);
      return true;
    }

    function resize() {
      if (!gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
      const w = Math.max(1, Math.round(canvas!.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas!.clientHeight * dpr));

      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }
      gl.viewport(0, 0, w, h);
    }

    function draw(t: number) {
      if (!gl || !program || !uniform) return;

      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const aspect = w / Math.max(h, 1);

      gl.useProgram(program);
      gl.bindVertexArray(vao);

      gl.uniform2f(uniform("uRes"), w, h);
      gl.uniform1f(uniform("uTime"), t);
      gl.uniform2f(uniform("uLean"), field.x, field.y);
      gl.uniform1f(uniform("uIntro"), still ? 1 : ramp(t, 0.1, 2.4));
      gl.uniform1f(uniform("uExposure"), 1.06);
      gl.uniform1f(uniform("uScale"), frameScale(aspect));

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now: number) {
      if (disposed) return;
      raf = requestAnimationFrame(frame);

      const dt = last === 0 ? 0 : Math.min((now - last) / 1000, 1 / 20);
      last = now;
      elapsed += dt;

      stepField(field, dt);
      draw(elapsed);

      // Adaptive quality: sample over 2s windows and step down if we are
      // clearly missing frame budget. Never steps back up, to avoid
      // oscillating between two tiers that both sit near the threshold.
      perf.acc += dt;
      perf.frames += 1;
      if (perf.acc > 2 && perf.drops < 2) {
        const fps = perf.frames / perf.acc;
        const next = fps < 45 ? downgrade(quality.tier) : null;
        if (next) {
          quality = settingsFor(next);
          perf.drops += 1;
          build();
          resize();
        }
        perf.acc = 0;
        perf.frames = 0;
      }
    }

    function start() {
      if (disposed || raf !== 0) return;
      last = 0; // resume without crediting the time spent paused
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (raf !== 0) cancelAnimationFrame(raf);
      raf = 0;
    }

    /** Reduced motion draws one composed frame and holds it. */
    function renderStill() {
      stop();
      field.x = 0;
      field.y = 0;
      draw(STILL_T);
    }

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (still) renderStill();
      else start();
    };

    const onPointerMove = (e: PointerEvent) => {
      field.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      field.targetY = -((e.clientY / window.innerHeight) * 2 - 1);
    };

    const onPointerLeave = () => {
      field.targetX = 0;
      field.targetY = 0;
    };

    const onMotionChange = (e: MediaQueryListEvent) => {
      still = e.matches;
      if (still) renderStill();
      else start();
    };

    const onLost = (e: Event) => {
      // Without preventDefault the context is never eligible for restoration.
      e.preventDefault();
      stop();
    };

    const onRestored = () => {
      if (disposed) return;
      vao = gl.createVertexArray();
      if (!build()) {
        setFailed(true);
        return;
      }
      resize();
      if (still) renderStill();
      else start();
    };

    // ---- boot ---------------------------------------------------------------
    // A context that arrives already lost (a previous mount, or a GPU reset)
    // cannot compile anything, so ask for it back before building.
    if (gl.isContextLost()) gl.getExtension("WEBGL_lose_context")?.restoreContext();

    vao = gl.createVertexArray();
    if (!build()) {
      setFailed(true);
      return;
    }
    resize();

    const ro = new ResizeObserver(() => {
      resize();
      if (still) renderStill();
    });
    ro.observe(canvas);

    // A devicePixelRatio change — browser zoom, or the window dragged onto a
    // display with a different density — leaves the CSS size untouched, so the
    // observer above never fires and the buffer keeps the old resolution. A
    // media query on the current ratio is the signal for it, and since it stops
    // matching the moment it fires, it has to re-arm itself.
    let dprMq: MediaQueryList | null = null;

    function watchDpr() {
      dprMq?.removeEventListener("change", onDprChange);
      dprMq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      dprMq.addEventListener("change", onDprChange);
    }

    function onDprChange() {
      if (disposed) return;
      resize();
      if (still) renderStill();
      watchDpr();
    }

    watchDpr();

    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerLeave, { passive: true });
    motionMq.addEventListener("change", onMotionChange);

    if (still) renderStill();
    else start();

    // StrictMode mounts this twice, so the teardown has to leave the canvas
    // reusable. Note what is deliberately absent: WEBGL_lose_context. Losing
    // the context here would poison the canvas — getContext() hands back the
    // same lost context on the next mount, and every compile after that fails
    // with a null info log. The context is released when the canvas is
    // collected; the resources below are what actually need freeing.
    return () => {
      disposed = true;
      stop();
      ro.disconnect();
      dprMq?.removeEventListener("change", onDprChange);

      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerLeave);
      motionMq.removeEventListener("change", onMotionChange);

      if (program) gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
    };
  }, []);

  if (failed) return <div className="fallback" aria-hidden="true" />;

  return <canvas ref={canvasRef} className="scene" aria-hidden="true" />;
}
