"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { clearPointer, field, setPointer, stepField } from "@/lib/field";
import { ramp, useStore } from "@/lib/store";
import { BH_FRAG, BH_VERT } from "@/shaders/blackhole";

/**
 * The camera here is not a three.js camera — the shader traces its own rays, so
 * all that crosses over is a position and an orthonormal basis.
 *
 * The orbit stays shallow, a few degrees above the disc plane, for the same
 * reason the film kept it there: from further off-axis the disc reads as an
 * ordinary ring, and the lensed far side that makes the image only shows up
 * when you are nearly edge-on to it.
 */

const DIST = 18;
const PITCH = 0.085; // radians above the disc plane, ~5°
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function BlackHole() {
  const quality = useStore((s) => s.quality);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const setTier = useStore((s) => s.setTier);

  const { gl, size } = useThree();
  const mat = useRef<THREE.ShaderMaterial>(null);
  const start = useRef(0);
  const frames = useRef({ acc: 0, count: 0, drops: 0 });

  const scratch = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      buffer: new THREE.Vector2(),
    }),
    [],
  );

  const uniforms = useMemo(
    () => ({
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3(0, 0, DIST) },
      uCamBasis: { value: new THREE.Matrix3() },
      uZoom: { value: 0.68 },
      uLift: { value: 0.06 },
      uIntro: { value: 0 },
      uSpin: { value: 1 },
      uDoppler: { value: 0.55 },
      uExposure: { value: 0.62 },
    }),
    [],
  );

  useEffect(() => {
    const el = gl.domElement;

    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      setPointer(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -(((e.clientY - r.top) / r.height) * 2 - 1),
      );
    };
    const leave = () => clearPointer();

    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave, { passive: true });
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [gl]);

  useFrame((state, dt) => {
    const u = mat.current?.uniforms;
    if (!u) return;

    if (start.current === 0) start.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - start.current;
    const motion = reducedMotion ? 0 : 1;

    stepField(dt);

    // Yaw drifts forever and the pointer only leans on it. Nobody should be
    // able to spin this thing.
    const yaw = t * 0.026 * motion + field.x * 0.16;
    const pitch = PITCH + field.y * 0.035 + Math.sin(t * 0.11) * 0.022 * motion;

    const { pos, forward, right, up, buffer } = scratch;
    const cp = Math.cos(pitch);
    pos.set(Math.sin(yaw) * cp * DIST, Math.sin(pitch) * DIST, Math.cos(yaw) * cp * DIST);

    // Aim at the hole. World-up as the reference is safe here because the pitch
    // never approaches the pole, where the basis would degenerate.
    forward.copy(pos).negate().normalize();
    right.crossVectors(forward, WORLD_UP).normalize();
    up.crossVectors(right, forward);

    u.uCamPos.value.copy(pos);
    (u.uCamBasis.value as THREE.Matrix3).set(
      right.x, up.x, forward.x,
      right.y, up.y, forward.y,
      right.z, up.z, forward.z,
    );

    gl.getDrawingBufferSize(buffer);
    u.uRes.value.copy(buffer);
    u.uTime.value = t;
    u.uSpin.value = reducedMotion ? 0.06 : 1;
    u.uIntro.value = ramp(t, 0.15, 2.6);

    // Frame the object per aspect rather than scaling one framing down: a tall
    // viewport widens the field so the disc still fits across, and lifts it so
    // the wordmark in the lower third has somewhere to sit.
    const aspect = size.width / Math.max(size.height, 1);
    u.uZoom.value = Math.min(1.25, Math.max(0.68, 1.22 / aspect));
    u.uLift.value = aspect < 1 ? 0.14 : 0.06;

    // Adaptive quality: sample over 2s windows and step down if we are clearly
    // missing frame budget. Never steps back up, to avoid oscillating.
    const f = frames.current;
    f.acc += dt;
    f.count += 1;
    if (f.acc > 2 && f.drops < 2) {
      const fps = f.count / f.acc;
      const tier = useStore.getState().quality.tier;
      if (fps < 45 && tier === "high") {
        setTier("medium");
        f.drops += 1;
      } else if (fps < 28 && tier === "medium") {
        setTier("low");
        f.drops += 1;
      }
      f.acc = 0;
      f.count = 0;
    }
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      {/* STEPS is compiled in, not a uniform: a dynamic loop bound would cost
          every pixel a branch it never needs. Keying on it rebuilds the program
          when the tier drops. */}
      <shaderMaterial
        key={quality.steps}
        ref={mat}
        vertexShader={BH_VERT}
        fragmentShader={BH_FRAG}
        uniforms={uniforms}
        defines={{ STEPS: quality.steps }}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
