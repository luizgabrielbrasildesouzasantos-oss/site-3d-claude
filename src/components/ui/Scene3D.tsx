import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export type SceneState = {
  scroll: number; // 0..1
  mouseX: number; // -1..1
  mouseY: number; // -1..1
};

type Props = { state: React.RefObject<SceneState> };

const PALETTE: string[] = ["#7c5cff", "#22d3ee", "#f472b6", "#fbbf24"];
const colorAt = (i: number): string => PALETTE[i % PALETTE.length] ?? "#ffffff";

function CameraRig({ state }: Props) {
  useFrame(({ camera }, dt) => {
    const s = state.current;
    const t = s.scroll;
    // A câmera percorre um arco enquanto você rola a página.
    const angle = t * Math.PI * 1.2;
    const radius = 8 - Math.sin(t * Math.PI) * 2.5;
    const targetX = Math.sin(angle) * radius + s.mouseX * 0.8;
    const targetY = 1.5 - t * 3 + s.mouseY * 0.6;
    const targetZ = Math.cos(angle) * radius;
    const k = 1 - Math.exp(-dt * 3);
    camera.position.x += (targetX - camera.position.x) * k;
    camera.position.y += (targetY - camera.position.y) * k;
    camera.position.z += (targetZ - camera.position.z) * k;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Core({ state }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1.6, 12), []);
  const base = useMemo(
    () => Float32Array.from((geo.getAttribute("position") as THREE.BufferAttribute).array),
    [geo],
  );

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(base[i * 3] ?? 0, base[i * 3 + 1] ?? 0, base[i * 3 + 2] ?? 0);
      const n = v.clone().normalize();
      const wave =
        Math.sin(n.x * 3 + t * 1.2) * Math.cos(n.y * 3 + t * 0.9) * 0.18 +
        Math.sin(n.z * 4 - t * 1.5) * 0.08;
      v.multiplyScalar(1 + wave);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const spin = dt * (0.25 + state.current.scroll * 0.8);
    if (mesh.current) {
      mesh.current.rotation.y += spin;
      mesh.current.rotation.x += spin * 0.4;
    }
    if (wire.current) {
      wire.current.rotation.y -= spin * 0.6;
      wire.current.rotation.z += spin * 0.3;
    }
  });

  return (
    <group>
      <mesh ref={mesh} geometry={geo}>
        <meshStandardMaterial
          color="#6d4aff"
          metalness={0.7}
          roughness={0.25}
          emissive="#2a1a80"
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh ref={wire} scale={1.55}>
        <icosahedronGeometry args={[1.6, 2]} />
        <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function Rings() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      child.rotation.z += dt * (0.2 + i * 0.12) * (i % 2 ? -1 : 1);
      child.rotation.x += dt * 0.05 * (i + 1);
    });
  });
  return (
    <group ref={group} rotation={[0.9, 0.2, 0]}>
      {[3.2, 4.1, 5.0].map((r, i) => (
        <mesh key={r}>
          <torusGeometry args={[r, 0.012 + i * 0.006, 12, 160]} />
          <meshBasicMaterial color={colorAt(i)} transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function Particles({ count = 2500 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 22;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      c.set(colorAt(Math.floor(Math.random() * PALETTE.length)));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    return { positions, colors };
  }, [count]);

  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.02;
      ref.current.rotation.x += dt * 0.006;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function FloatingShapes() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const items = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        angle: (i / 14) * Math.PI * 2,
        radius: 5.5 + Math.random() * 3,
        y: (Math.random() - 0.5) * 6,
        speed: 0.15 + Math.random() * 0.25,
        size: 0.2 + Math.random() * 0.25,
        kind: i % 3,
        color: colorAt(i),
      })),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    items.forEach((it, i) => {
      const m = refs.current[i];
      if (!m) return;
      const a = it.angle + t * it.speed;
      m.position.set(
        Math.cos(a) * it.radius,
        it.y + Math.sin(t + i) * 0.5,
        Math.sin(a) * it.radius,
      );
      m.rotation.x = t * 0.6 + i;
      m.rotation.y = t * 0.4;
    });
  });

  return (
    <>
      {items.map((it, i) => (
        <mesh key={i} ref={(el) => void (refs.current[i] = el)}>
          {it.kind === 0 && <octahedronGeometry args={[it.size]} />}
          {it.kind === 1 && <boxGeometry args={[it.size, it.size, it.size]} />}
          {it.kind === 2 && <tetrahedronGeometry args={[it.size * 1.2]} />}
          <meshStandardMaterial
            color={it.color}
            metalness={0.6}
            roughness={0.3}
            emissive={it.color}
            emissiveIntensity={0.35}
          />
        </mesh>
      ))}
    </>
  );
}

export default function Scene3D({ state }: Props) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 1.5, 8], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={["#05030f"]} />
      <fog attach="fog" args={["#05030f", 12, 34]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[6, 6, 6]} intensity={80} color="#22d3ee" />
      <pointLight position={[-6, -4, -5]} intensity={70} color="#f472b6" />
      <pointLight position={[0, 0, 0]} intensity={30} color="#7c5cff" />
      <CameraRig state={state} />
      <Core state={state} />
      <Rings />
      <FloatingShapes />
      <Particles />
    </Canvas>
  );
}
