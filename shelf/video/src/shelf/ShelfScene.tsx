import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useShelfAssets, ShelfAssets } from "./assets";
import { ASPECT, CamKey, DUST, LIGHT, LOOK, WAVE } from "./config";
import { cameraAt, rng } from "./math";
import {
  dustFragment,
  dustVertex,
  shelfFragment,
  shelfVertex,
  spriteFragment,
  spriteVertex,
} from "./shaders";
import { lightAt } from "./timeline";

const SEG_X = 640; // plane tessellation (>= 512 x 350 asked; ~4 px of the 2560 map per quad)
const SEG_Y = Math.round(SEG_X / ASPECT);

// image coords (0..1, y down) -> world
export const toWorld = (x: number, y: number): [number, number] => [(x - 0.5) * ASPECT, 0.5 - y];

function lightingUniforms() {
  return {
    uLightPos: { value: new THREE.Vector3() },
    uLightIntensity: { value: 0 },
    uLightRadius: { value: LIGHT.radius },
    uAmbient: { value: 0 },
    uWarm: { value: new THREE.Vector3(...LOOK.warm) },
    uAmbientColor: { value: new THREE.Vector3(...LOOK.ambientColor) },
    uSpecPower: { value: LOOK.specPower },
    uSpec: { value: LOOK.spec },
    uExposure: { value: LOOK.exposure },
    uVignette: { value: LOOK.vignette },
    uGrain: { value: LOOK.grain },
    uFrame: { value: 0 },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
  };
}

type Frameish = { frame: number; width: number; height: number };

function applyCommon(u: Record<string, THREE.IUniform>, f: Frameish) {
  const l = lightAt(f.frame);
  (u.uLightPos.value as THREE.Vector3).set(...l.pos);
  u.uLightIntensity.value = l.intensity;
  u.uAmbient.value = l.ambient;
  u.uLightRadius.value = l.radius;
  u.uFrame.value = f.frame;
  (u.uResolution.value as THREE.Vector2).set(f.width, f.height);
}

const ShelfPlane: React.FC<{ a: ShelfAssets } & Frameish> = ({ a, ...f }) => {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: shelfVertex,
      fragmentShader: shelfFragment,
      uniforms: {
        ...lightingUniforms(),
        uColor: { value: a.color },
        uDepth: { value: a.depth },
        uNormal: { value: a.normal },
        uId: { value: a.id },
        uCell: { value: a.cell },
        uSpineData: { value: a.spineData },
        uMapSize: { value: new THREE.Vector2(...a.scene.mapSize) },
        uDepthScale: { value: LOOK.depthScale },
        uNormalStrength: { value: LOOK.normalStrength },
        uBloom: { value: LOOK.bloom },
        uWave: { value: new THREE.Vector4(WAVE.start, WAVE.sweep, WAVE.rowDelay, WAVE.pulse) },
        uWaveAmp: { value: WAVE.amplitude },
        uWaveBrighten: { value: WAVE.brighten },
        uCellTint: { value: Array.from({ length: 35 }, () => new THREE.Vector4(1, 1, 1, 0)) },
      },
    });
  }, [a]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(ASPECT, 1, SEG_X, SEG_Y), []);
  useLayoutEffect(() => applyCommon(material.uniforms, f), [material, f]);
  return <mesh geometry={geometry} material={material} />;
};

const Sprite: React.FC<{ a: ShelfAssets; name: string; z: number; gloss: number } & Frameish> = ({
  a,
  name,
  z,
  gloss,
  ...f
}) => {
  const s = a.sprites[name];
  const [x0, y0, x1, y1] = s.info.bbox;
  const [wx, wy] = toWorld((x0 + x1) / 2, (y0 + y1) / 2);
  const w = (x1 - x0) * ASPECT;
  const h = y1 - y0;
  const material = useMemo(() => {
    const img = s.tex.image as HTMLImageElement;
    return new THREE.ShaderMaterial({
      vertexShader: spriteVertex,
      fragmentShader: spriteFragment,
      transparent: true,
      uniforms: {
        ...lightingUniforms(),
        uSprite: { value: s.tex },
        uSpriteDepth: { value: s.depth },
        uDepthScale: { value: LOOK.depthScale * 0.15 },
        uGloss: { value: gloss },
        uBrighten: { value: 0 },
        uTexel: { value: new THREE.Vector2(1 / img.width, 1 / img.height) },
      },
    });
  }, [s, gloss]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(w, h, 32, 32), [w, h]);
  useLayoutEffect(() => applyCommon(material.uniforms, f), [material, f]);
  return <mesh geometry={geometry} material={material} position={[wx, wy, z]} renderOrder={2} />;
};

const Dust: React.FC<Frameish> = (f) => {
  const { frame } = f;
  const seeds = useMemo(() => {
    const r = rng(DUST.seed);
    const [x0, y0, z0, x1, y1, z1] = DUST.box;
    return Array.from({ length: DUST.count }, () => ({
      p: [x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), z0 + r() * (z1 - z0)],
      v: [(r() - 0.5) * 0.0004, (r() - 0.6) * 0.00025, (r() - 0.5) * 0.0002],
      ph: r() * Math.PI * 2,
      fr: 0.01 + r() * 0.025,
      size: DUST.size * (0.4 + r() * r() * 1.6),
      tw: r(),
    }));
  }, []);
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(DUST.count * 3), 3));
    g.setAttribute("aBright", new THREE.BufferAttribute(new Float32Array(DUST.count), 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(seeds.map((s) => s.size)), 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uWarm: { value: new THREE.Vector3(...LOOK.warm) }, uPx: { value: 1 } },
    });
    return { geometry: g, material: m };
  }, [seeds]);
  useLayoutEffect(() => {
    const l = lightAt(frame);
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const br = geometry.getAttribute("aBright") as THREE.BufferAttribute;
    const [bx0, by0, , bx1, by1] = DUST.box;
    seeds.forEach((s, i) => {
      // slow drift + layered sine turbulence, wrapped inside the box
      let x = s.p[0] + s.v[0] * frame + 0.012 * Math.sin(frame * s.fr + s.ph);
      let y = s.p[1] + s.v[1] * frame + 0.009 * Math.sin(frame * s.fr * 1.3 + s.ph * 2.1);
      const z = s.p[2] + s.v[2] * frame + 0.01 * Math.sin(frame * s.fr * 0.7 + s.ph * 0.5);
      x = bx0 + ((((x - bx0) % (bx1 - bx0)) + (bx1 - bx0)) % (bx1 - bx0));
      y = by0 + ((((y - by0) % (by1 - by0)) + (by1 - by0)) % (by1 - by0));
      pos.setXYZ(i, x, y, z);
      // visible mostly inside the light: brightness ~ illumination at the particle
      const dx = x - l.pos[0];
      const dy = y - l.pos[1];
      const dz = z - l.pos[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      const beam = Math.exp(-d2 / (2 * 0.17 * 0.17));
      const twinkle = 0.7 + 0.3 * Math.sin(frame * 0.21 + s.tw * 40);
      br.setX(i, (beam * l.intensity * 0.9 + l.ambient * 0.04) * twinkle);
    });
    pos.needsUpdate = true;
    br.needsUpdate = true;
    material.uniforms.uPx.value = f.height / 1080;
  }, [frame, geometry, material, seeds, f.height]);
  return <points geometry={geometry} material={material} renderOrder={3} frustumCulled={false} />;
};

const CameraRig: React.FC<{ keys: CamKey[]; frame: number }> = ({ keys, frame }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const c = cameraAt(keys, frame);
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = c.fov;
    cam.near = 0.01;
    cam.far = 20;
    cam.position.set(...c.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(...c.target);
    cam.rotateZ((c.roll * Math.PI) / 180);
    cam.updateProjectionMatrix();
  }, [camera, keys, frame]);
  return null;
};

export const ShelfScene: React.FC<{ camera: CamKey[] }> = ({ camera }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const a = useShelfAssets();
  const f = useMemo(() => ({ frame, width, height }), [frame, width, height]);
  const kerouac = a?.sprites.book_kerouac;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* the canvas is created only once the textures are in: while rendering, R3F only redraws on
          frame changes, so content that arrives later would never be drawn */}
      {a ? (
        <ThreeCanvas width={width} height={height} gl={{ antialias: true }} camera={{ fov: 30, position: [0, 0, 1.5] }}>
          <CameraRig keys={camera} frame={frame} />
          <ShelfPlane a={a} {...f} />
          {kerouac ? (
            <Sprite
              a={a}
              name="book_kerouac"
              z={(kerouac.info.depth_level ?? 0.86) * LOOK.depthScale + 0.0005}
              gloss={0.25}
              {...f}
            />
          ) : null}
          <Sprite a={a} name="bust" z={0.86 * LOOK.depthScale + 0.001} gloss={0.5} {...f} />
          <Dust {...f} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
