import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { DATA_W } from "./shaders";

export type SpineInfo = {
  id: number;
  cell: number;
  row: number;
  col: number;
  type: number;
  bbox: [number, number, number, number];
  cx: number;
  cy: number;
  depth: number;
  gloss: number;
  occluded: boolean;
};
export type CellInfo = {
  id: number;
  key: string;
  row: number;
  col: number;
  inner: [number, number, number, number];
  tags: string[];
  partial: string[];
};
export type SpriteInfo = {
  file: string;
  depth: string;
  bbox: [number, number, number, number];
  spine_id?: number;
  depth_level?: number;
  object_id?: string;
};
export type SceneData = {
  colorSize: [number, number];
  mapSize: [number, number];
  aspect: number;
  cells: CellInfo[];
  spines: SpineInfo[];
  objects: { id: string; label: string; cell: string; bbox: [number, number, number, number] }[];
  sprites: Record<string, SpriteInfo>;
  cellTags: Record<string, string[]>;
};

export type ShelfAssets = {
  scene: SceneData;
  color: THREE.Texture;
  depth: THREE.Texture;
  normal: THREE.Texture;
  id: THREE.Texture;
  cell: THREE.Texture;
  spineData: THREE.DataTexture;
  sprites: Record<string, { tex: THREE.Texture; depth: THREE.Texture; info: SpriteInfo }>;
};

const loader = new THREE.TextureLoader();
const load = (url: string, nearest = false) =>
  new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.NoColorSpace; // shaders linearise the colour themselves
        t.flipY = false; // maps are addressed top-down in the shaders
        t.generateMipmaps = !nearest;
        t.minFilter = nearest ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
        t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
        t.anisotropy = nearest ? 1 : 4;
        t.needsUpdate = true;
        resolve(t);
      },
      undefined,
      reject,
    );
  });

function buildSpineData(scene: SceneData) {
  const data = new Float32Array(DATA_W * 2 * 4);
  for (const s of scene.spines) {
    if (s.id >= DATA_W) continue;
    const o0 = s.id * 4;
    data[o0] = s.cx;
    data[o0 + 1] = s.cy;
    data[o0 + 2] = s.type;
    data[o0 + 3] = s.depth;
    const o1 = (DATA_W + s.id) * 4;
    data[o1] = s.row;
    data[o1 + 1] = s.cell;
    data[o1 + 2] = s.gloss;
    data[o1 + 3] = s.occluded ? 1 : 0;
  }
  const tex = new THREE.DataTexture(data, DATA_W, 2, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

let cache: Promise<ShelfAssets> | null = null;
async function loadAll(): Promise<ShelfAssets> {
  const scene: SceneData = await (await fetch(staticFile("shelf/scene.json"))).json();
  const [color, depth, normal, id, cell] = await Promise.all([
    load(staticFile("shelf/color.jpg")),
    load(staticFile("shelf/depth.png")),
    load(staticFile("shelf/normal.png")),
    load(staticFile("shelf/spine_id.png"), true),
    load(staticFile("shelf/cell_id.png"), true),
  ]);
  const sprites: ShelfAssets["sprites"] = {};
  for (const [name, info] of Object.entries(scene.sprites)) {
    const [tex, dep] = await Promise.all([
      load(staticFile(`shelf/${info.file}`)),
      load(staticFile(`shelf/${info.depth}`)),
    ]);
    sprites[name] = { tex, depth: dep, info };
  }
  return { scene, color, depth, normal, id, cell, spineData: buildSpineData(scene), sprites };
}

export function useShelfAssets(): ShelfAssets | null {
  const [assets, setAssets] = useState<ShelfAssets | null>(null);
  const [handle] = useState(() => delayRender("Loading shelf textures", { timeoutInMilliseconds: 120000 }));
  useEffect(() => {
    if (!cache) cache = loadAll();
    cache
      .then((a) => {
        setAssets(a);
        continueRender(handle);
      })
      .catch((e) => {
        console.error("shelf assets failed", e);
        cache = null;
      });
  }, [handle]);
  return assets;
}
