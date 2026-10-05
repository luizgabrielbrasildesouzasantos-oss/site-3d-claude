import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ComponentType } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { INGREDIENTS, LAYER_DUR, STACK_TOP, layerStart, type BurgerState } from "@/lib/burger-data";

type StateProps = { state: React.RefObject<BurgerState> };

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Gerador pseudo-aleatório determinístico (mulberry32).
function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Texturas procedurais (geradas em canvas, sem arquivos externos)      */
/* ------------------------------------------------------------------ */

function canvasTex(
  size: number,
  color: boolean,
  draw: (ctx: CanvasRenderingContext2D, s: number) => void,
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (ctx) draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

function speckle(
  ctx: CanvasRenderingContext2D,
  s: number,
  r: () => number,
  count: number,
  colors: string[],
  minR: number,
  maxR: number,
  alpha: number,
) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
    ctx.fillStyle = colors[Math.floor(r() * colors.length)] ?? "#000";
    ctx.beginPath();
    ctx.arc(r() * s, r() * s, minR + r() * (maxR - minR), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function gradient(ctx: CanvasRenderingContext2D, s: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, s);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

type Assets = {
  bunTop: THREE.Texture;
  bunBottom: THREE.Texture;
  bump: THREE.Texture;
  patty: THREE.Texture;
  tomatoCap: THREE.Texture;
};

let assetCache: Assets | null = null;

function getAssets(): Assets {
  if (assetCache) return assetCache;
  const bunTop = canvasTex(1024, true, (ctx, s) => {
    const r = rng(1);
    gradient(ctx, s, [
      [0, "#a9561a"],
      [0.45, "#d8872c"],
      [0.8, "#eab45a"],
      [1, "#f3d08a"],
    ]);
    speckle(ctx, s, r, 1800, ["#7a3a10", "#8f4a14"], 1, 7, 0.22);
    speckle(ctx, s, r, 1500, ["#f6d58f", "#fbe3ad"], 1, 6, 0.22);
  });
  const bunBottom = canvasTex(1024, true, (ctx, s) => {
    const r = rng(2);
    gradient(ctx, s, [
      [0, "#c9772a"],
      [0.5, "#e2a04a"],
      [1, "#f3d08a"],
    ]);
    speckle(ctx, s, r, 1500, ["#a8591c"], 1, 6, 0.2);
    speckle(ctx, s, r, 1200, ["#f6d58f"], 1, 6, 0.2);
  });
  const bump = canvasTex(512, false, (ctx, s) => {
    const r = rng(3);
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, r, 9000, ["#ffffff", "#000000"], 1, 3.5, 0.5);
  });
  bump.repeat.set(3, 2);
  const patty = canvasTex(1024, true, (ctx, s) => {
    const r = rng(4);
    ctx.fillStyle = "#3b1d0e";
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, r, 6500, ["#1a0b05", "#5b2f17", "#7b4426"], 1, 5, 0.6);
    speckle(ctx, s, r, 400, ["#0d0503"], 4, 12, 0.35);
  });
  const tomatoCap = canvasTex(512, true, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 10, c, c, c);
    g.addColorStop(0, "#e84a32");
    g.addColorStop(1, "#c0281a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "#a81c10";
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(c, c, c - 11, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + 0.3;
      const x = c + Math.cos(a) * s * 0.22;
      const y = c + Math.sin(a) * s * 0.22;
      ctx.fillStyle = "#f3b36a";
      ctx.beginPath();
      ctx.ellipse(x, y, 62, 38, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f8e6a0";
      for (let j = -1; j <= 1; j++) {
        ctx.beginPath();
        ctx.ellipse(
          x + Math.cos(a) * j * 22,
          y + Math.sin(a) * j * 22,
          7,
          4,
          a + 0.6,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.fillStyle = "#f6c9a8";
    ctx.beginPath();
    ctx.arc(c, c, 26, 0, Math.PI * 2);
    ctx.fill();
  });
  assetCache = { bunTop, bunBottom, bump, patty, tomatoCap };
  return assetCache;
}

/* ------------------------------------------------------------------ */
/* Geometrias                                                          */
/* ------------------------------------------------------------------ */

// Sólido de revolução suave a partir de um perfil (raio, altura).
function lathe(points: [number, number][], segments = 112, samples = 64) {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const pts = curve.getPoints(samples).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return new THREE.LatheGeometry(pts, segments);
}

const TOP_A = 1.76;
const TOP_B = 0.85;
const TOP_Y0 = 0.28;

/* ------------------------------------------------------------------ */
/* Camadas do burger (cada uma com a base em y = 0)                     */
/* ------------------------------------------------------------------ */

function BottomBun() {
  const a = getAssets();
  const geo = useMemo(
    () =>
      lathe([
        [0, 0],
        [1.3, 0],
        [1.6, 0.03],
        [1.74, 0.13],
        [1.76, 0.27],
        [1.7, 0.4],
        [1.5, 0.49],
        [0.8, 0.5],
        [0, 0.5],
      ]),
    [],
  );
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshPhysicalMaterial
        map={a.bunBottom}
        bumpMap={a.bump}
        bumpScale={0.6}
        roughness={0.5}
        clearcoat={0.25}
        clearcoatRoughness={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Patty() {
  const a = getAssets();
  const geo = useMemo(
    () =>
      lathe([
        [0, 0],
        [1.25, 0],
        [1.55, 0.03],
        [1.67, 0.12],
        [1.69, 0.2],
        [1.63, 0.29],
        [1.4, 0.33],
        [0.7, 0.335],
        [0, 0.33],
      ]),
    [],
  );
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshPhysicalMaterial
        map={a.patty}
        bumpMap={a.bump}
        bumpScale={1.6}
        roughness={0.72}
        clearcoat={0.15}
        clearcoatRoughness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Cheese({ rot = 0 }: { rot?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(3.7, 3.7, 44, 44);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      const d = Math.max(0, r - 1.45);
      const droop = -0.36 * Math.pow(Math.min(d / 1.1, 1.2), 1.7);
      const wave = Math.sin(Math.atan2(z, x) * 6 + r * 2) * 0.012 * Math.min(r, 1.5);
      pos.setY(i, 0.035 + droop + wave);
    }
    g.computeVertexNormals();
    g.rotateY(Math.PI / 4);
    return g;
  }, []);
  return (
    <group rotation={[0, rot, 0]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#ffb400"
          roughness={0.28}
          clearcoat={0.7}
          clearcoatRoughness={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function Bacon() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(3.5, 0.56, 70, 8);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const red = new THREE.Color("#7f2214");
    const fat = new THREE.Color("#f0c4a4");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = Math.sin(x * 3.4 + z * 2) * 0.07 + Math.sin(x * 8) * 0.02;
      pos.setY(i, y + 0.09);
      const t = z / 0.56 + 0.5;
      const s = Math.sin(t * Math.PI * 3 + Math.sin(x * 3) * 0.6);
      c.copy(red).lerp(fat, smooth(-0.15, 0.35, s));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      <mesh
        geometry={geo}
        position={[0.1, 0, 0.45]}
        rotation={[0, 0.4, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          vertexColors
          roughness={0.45}
          clearcoat={0.5}
          clearcoatRoughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh
        geometry={geo}
        position={[-0.1, 0.03, -0.5]}
        rotation={[0, -0.55, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          vertexColors
          roughness={0.45}
          clearcoat={0.5}
          clearcoatRoughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function Lettuce() {
  const geo = useMemo(() => {
    const R = 2.1;
    const g = new THREE.RingGeometry(0.02, R, 96, 14);
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const dark = new THREE.Color("#2e8b1a");
    const light = new THREE.Color("#a6e05e");
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      const r = Math.hypot(x, y);
      const a = Math.atan2(y, x);
      const edge = r / R;
      const k = 1 + 0.07 * Math.sin(a * 11 + 1.3) * edge;
      x *= k;
      y *= k;
      const amp = 0.03 + 0.22 * Math.pow(edge, 1.8);
      const z = amp * (Math.sin(a * 7 + r * 2.4) * 0.6 + Math.sin(a * 13 - r * 3.1) * 0.4);
      pos.setXYZ(i, x, y, z);
      c.copy(dark).lerp(light, clamp01(Math.pow(edge, 1.1) * 0.9 + Math.sin(a * 17) * 0.05));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} position={[0, 0.1, 0]} castShadow receiveShadow>
      <meshPhysicalMaterial
        vertexColors
        roughness={0.6}
        clearcoat={0.08}
        clearcoatRoughness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Tomato() {
  const a = getAssets();
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(1.38, 1.38, 0.13, 72, 1);
    g.translate(0, 0.065, 0);
    return g;
  }, []);
  const mats = useMemo(() => {
    const side = new THREE.MeshPhysicalMaterial({
      color: "#b81f12",
      roughness: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
    });
    const cap = new THREE.MeshPhysicalMaterial({
      map: a.tomatoCap,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    });
    return [side, cap, cap];
  }, [a]);
  return <mesh geometry={geo} material={mats} castShadow receiveShadow />;
}

function Onion() {
  return (
    <group position={[0.12, 0.06, -0.08]}>
      {[1.25, 0.85, 0.45].map((R, i) => (
        <mesh key={R} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1.5]} castShadow receiveShadow>
          <torusGeometry args={[R, 0.045 - i * 0.004, 12, 72]} />
          <meshPhysicalMaterial
            color="#efdcee"
            roughness={0.3}
            clearcoat={0.6}
            transparent
            opacity={0.92}
          />
        </mesh>
      ))}
    </group>
  );
}

const PICKLE_SPOTS: [number, number, number][] = [
  [0.75, 0.35, 0.2],
  [-0.7, 0.45, 0.9],
  [0.2, -0.85, 0.5],
  [-0.55, -0.75, 1.4],
  [0.05, 0.55, 0.1],
];

function Pickles() {
  const mats = useMemo(
    () => [
      new THREE.MeshPhysicalMaterial({ color: "#4b6a12", roughness: 0.3, clearcoat: 1 }),
      new THREE.MeshPhysicalMaterial({ color: "#7fa02a", roughness: 0.25, clearcoat: 1 }),
      new THREE.MeshPhysicalMaterial({ color: "#7fa02a", roughness: 0.25, clearcoat: 1 }),
    ],
    [],
  );
  return (
    <group>
      {PICKLE_SPOTS.map(([x, z, r], i) => (
        <mesh
          key={i}
          position={[x, 0.035 + i * 0.002, z]}
          rotation={[0, r, 0]}
          material={mats}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.42, 0.42, 0.06, 40]} />
        </mesh>
      ))}
    </group>
  );
}

function Sauce() {
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(1.5, 1.5, 0.08, 96, 1);
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const a = Math.atan2(z, x);
      const f = 1 + 0.08 * Math.sin(a * 5 + 1) + 0.05 * Math.sin(a * 9);
      pos.setX(i, x * f);
      pos.setZ(i, z * f);
    }
    g.translate(0, 0.04, 0);
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = (
    <meshPhysicalMaterial
      color="#e0742c"
      roughness={0.12}
      clearcoat={1}
      clearcoatRoughness={0.05}
    />
  );
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        {mat}
      </mesh>
    </group>
  );
}

function Sesame() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const r = rng(7);
    const o = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    const n = new THREE.Vector3();
    const spin = new THREE.Quaternion();
    const count = 90;
    for (let i = 0; i < count; i++) {
      const cosP = 1 - r() * (1 - Math.cos(1.1));
      const phi = Math.acos(cosP);
      const th = r() * Math.PI * 2;
      const x = TOP_A * Math.sin(phi) * Math.cos(th);
      const z = TOP_A * Math.sin(phi) * Math.sin(th);
      const y = TOP_Y0 + TOP_B * Math.cos(phi);
      n.set(x / (TOP_A * TOP_A), (y - TOP_Y0) / (TOP_B * TOP_B), z / (TOP_A * TOP_A)).normalize();
      o.position.set(x + n.x * 0.012, y + n.y * 0.012, z + n.z * 0.012);
      o.quaternion.setFromUnitVectors(up, n);
      spin.setFromAxisAngle(n, r() * Math.PI * 2);
      o.quaternion.premultiply(spin);
      o.scale.set(0.09, 0.034, 0.05);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 90]} castShadow>
      <sphereGeometry args={[1, 14, 10]} />
      <meshPhysicalMaterial color="#f3e2b8" roughness={0.45} clearcoat={0.3} />
    </instancedMesh>
  );
}

function TopBun() {
  const a = getAssets();
  const geo = useMemo(() => {
    const pts: [number, number][] = [
      [0, 0],
      [1.1, 0],
      [1.55, 0.03],
      [1.72, 0.12],
      [TOP_A, TOP_Y0],
    ];
    for (const deg of [75, 60, 45, 30, 18, 8]) {
      const t = (deg * Math.PI) / 180;
      pts.push([TOP_A * Math.sin(t), TOP_Y0 + TOP_B * Math.cos(t)]);
    }
    pts.push([0, TOP_Y0 + TOP_B]);
    return lathe(pts, 128, 80);
  }, []);
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshPhysicalMaterial
          map={a.bunTop}
          bumpMap={a.bump}
          bumpScale={0.6}
          roughness={0.42}
          clearcoat={0.45}
          clearcoatRoughness={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Sesame />
    </group>
  );
}

const Cheese1 = () => <Cheese rot={0} />;
const Cheese2 = () => <Cheese rot={0.9} />;

const LAYER_VIEW: Record<string, ComponentType> = {
  "bun-bottom": BottomBun,
  "patty-1": Patty,
  "cheese-1": Cheese1,
  bacon: Bacon,
  lettuce: Lettuce,
  tomato: Tomato,
  onion: Onion,
  pickles: Pickles,
  sauce: Sauce,
  "patty-2": Patty,
  "cheese-2": Cheese2,
  "bun-top": TopBun,
};

/* ------------------------------------------------------------------ */
/* Pilha animada pelo scroll                                           */
/* ------------------------------------------------------------------ */

const DROP = 6.5;

function BurgerStack({ state }: StateProps) {
  const root = useRef<THREE.Group>(null);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const rests = useMemo(() => {
    let y = 0;
    return INGREDIENTS.map((i) => {
      const r = y;
      y += i.height;
      return r;
    });
  }, []);
  const rnd = useMemo(() => {
    const r = rng(11);
    return INGREDIENTS.map(() => ({
      rx: (r() - 0.5) * 0.9,
      rz: (r() - 0.5) * 0.9,
      spin: (r() > 0.5 ? 1 : -1) * (1.2 + r() * 1.4),
    }));
  }, []);

  useFrame(({ clock }) => {
    const p = state.current.assemble;
    INGREDIENTS.forEach((_, i) => {
      const g = refs.current[i];
      const k = rnd[i];
      if (!g || !k) return;
      const t = clamp01((p - layerStart(i)) / LAYER_DUR);
      g.visible = t > 0;
      // Queda com gravidade (acelera) e um pulinho pequeno ao assentar, sem nunca afundar na camada de baixo.
      const T_FALL = 0.72;
      const drop = t < T_FALL ? DROP * (1 - Math.pow(t / T_FALL, 2)) : 0;
      const hop =
        t >= T_FALL && t < 1 ? 0.07 * Math.sin(((t - T_FALL) / (1 - T_FALL)) * Math.PI) : 0;
      const settle = 1 - easeOutCubic(clamp01(t / T_FALL));
      g.position.y = (rests[i] ?? 0) + drop + hop;
      g.rotation.x = k.rx * settle;
      g.rotation.z = k.rz * settle;
      g.rotation.y = k.spin * settle;
    });
    if (root.current) {
      root.current.rotation.y = p * 2.2 + clock.elapsedTime * 0.07;
    }
  });

  return (
    <group ref={root}>
      {INGREDIENTS.map((ing, i) => {
        const View = LAYER_VIEW[ing.id];
        return (
          <group
            key={ing.id + i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            visible={false}
          >
            {View ? <View /> : null}
          </group>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Cenário                                                             */
/* ------------------------------------------------------------------ */

function Board() {
  return (
    <group>
      <mesh position={[0, -0.21, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.6, 3.7, 0.4, 96]} />
        <meshStandardMaterial color="#17100d" roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.56, 0.035, 12, 160]} />
        <meshStandardMaterial color="#ff6a1a" emissive="#ff5a10" emissiveIntensity={2.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.42, 0]} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color="#0d0807" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Embers({ count = 170 }: { count?: number }) {
  const attr = useRef<THREE.BufferAttribute>(null);
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const data = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: count }, () => ({
      x: (r() - 0.5) * 10,
      z: (r() - 0.5) * 10,
      y: r() * 9,
      v: 0.35 + r() * 0.9,
      ph: r() * Math.PI * 2,
    }));
  }, [count]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    data.forEach((d, i) => {
      d.y += d.v * dt;
      if (d.y > 9) d.y = 0;
      positions[i * 3] = d.x + Math.sin(t * 0.6 + d.ph) * 0.4;
      positions[i * 3 + 1] = d.y - 0.3;
      positions[i * 3 + 2] = d.z + Math.cos(t * 0.5 + d.ph) * 0.4;
    });
    if (attr.current) attr.current.needsUpdate = true;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute ref={attr} attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.07}
        color="#ff8a2a"
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        fog={false}
      />
    </points>
  );
}

function FireLight() {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) ref.current.intensity = 9 + Math.sin(t * 9) * 1.5 + Math.sin(t * 23);
  });
  return <pointLight ref={ref} position={[0, 0.25, 0]} color="#ff7a24" distance={7} decay={2} />;
}

function Env() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pm.fromScene(room, 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.55;
    return () => {
      scene.environment = null;
      rt.dispose();
      pm.dispose();
      room.dispose();
    };
  }, [gl, scene]);
  return null;
}

function CameraRig({ state }: StateProps) {
  const base = useRef<THREE.Vector3 | null>(null);
  const shift = useRef(0);
  useFrame(({ camera, size }, dt) => {
    const s = state.current;
    if (!base.current) base.current = camera.position.clone();
    const portrait = size.width / size.height < 0.85;
    const stack = STACK_TOP * s.assemble;
    const ang = 0.5 + s.assemble * 1.4 + s.mouseX * 0.25;
    let rad = lerp(lerp(9.6, 8.4, s.assemble), 9.2, s.finale);
    if (portrait) rad *= 1.55;
    const h = lerp(3.1 + stack * 0.35, 1.5, s.finale) + s.mouseY * 0.35;
    const k = 1 - Math.exp(-dt * 3.2);
    base.current.x += (Math.sin(ang) * rad - base.current.x) * k;
    base.current.y += (h - base.current.y) * k;
    base.current.z += (Math.cos(ang) * rad - base.current.z) * k;
    shift.current += (s.shift * 0.2 * rad - shift.current) * (1 - Math.exp(-dt * 2.5));
    camera.position.copy(base.current);
    const lookY = lerp(stack * 0.42 + 0.2, 1.4, s.finale) - (portrait ? 1.1 : 0.8);
    camera.lookAt(0, lookY, 0);
    camera.translateX(-shift.current);
  });
  return null;
}

export default function BurgerScene({ state }: StateProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows="percentage"
      camera={{ position: [0, 3.5, 9.6], fov: 36, near: 0.1, far: 100 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        powerPreference: "high-performance",
      }}
    >
      <color attach="background" args={["#0b0605"]} />
      <fog attach="fog" args={["#0b0605", 16, 44]} />
      <Env />
      <ambientLight intensity={0.12} />
      <directionalLight
        position={[5, 9, 4]}
        intensity={2.6}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <directionalLight position={[-6, 3, -5]} intensity={1.6} color="#ff7a2a" />
      <pointLight position={[0, 2, 7]} intensity={30} color="#ffe2c0" />
      <FireLight />
      <CameraRig state={state} />
      <Board />
      <BurgerStack state={state} />
      <Embers />
    </Canvas>
  );
}
