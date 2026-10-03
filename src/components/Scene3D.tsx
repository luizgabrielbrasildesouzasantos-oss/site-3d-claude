import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";

export interface SceneState {
  scroll: number;
  mouseX: number;
  mouseY: number;
}

function Core() {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1.6, 24), []);
  const basePositions = useMemo(
    () =>
      ((geometry.attributes["position"] as THREE.BufferAttribute).array as Float32Array).slice(),
    [geometry],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pos = geometry.attributes["position"] as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const v = new THREE.Vector3();
    for (let i = 0; i < arr.length; i += 3) {
      v.set(basePositions[i]!, basePositions[i + 1]!, basePositions[i + 2]!);
      const n =
        0.22 *
        Math.sin(v.x * 2.1 + t * 1.4) *
        Math.sin(v.y * 2.3 + t * 1.1) *
        Math.sin(v.z * 1.9 + t * 0.9);
      v.normalize().multiplyScalar(1.6 + n);
      arr[i] = v.x;
      arr[i + 1] = v.y;
      arr[i + 2] = v.z;
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    if (mesh.current) mesh.current.rotation.y = t * 0.15;
  });

  return (
    <mesh ref={mesh} geometry={geometry}>
      <meshStandardMaterial
        color="#7c5cff"
        emissive="#2a1a66"
        roughness={0.25}
        metalness={0.6}
        flatShading
      />
    </mesh>
  );
}

function Ring({
  radius,
  color,
  speed,
  tilt,
}: {
  radius: number;
  color: string;
  speed: number;
  tilt: number;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.z = clock.getElapsedTime() * speed;
  });
  return (
    <group ref={group} rotation-x={tilt}>
      <mesh>
        <torusGeometry args={[radius, 0.02, 16, 128]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

function Particles({ count = 900 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 4 + Math.random() * 8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  useFrame(({ clock }) => {
    if (points.current) points.current.rotation.y = clock.getElapsedTime() * 0.03;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#9fd8ff"
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function CameraRig({ state }: { state: MutableRefObject<SceneState> }) {
  useFrame(({ camera, clock }) => {
    const s = state.current;
    const t = clock.getElapsedTime();
    const angle = t * 0.1 + s.scroll * Math.PI * 2;
    const radius = 7 - s.scroll * 2.5;
    const height = 2 + s.scroll * 3 + s.mouseY * 0.8;
    const target = new THREE.Vector3(
      Math.cos(angle) * radius + s.mouseX * 0.6,
      height,
      Math.sin(angle) * radius,
    );
    camera.position.lerp(target, 1 - Math.exp(-3 * 0.016));
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function Scene3D({ state }: { state: MutableRefObject<SceneState> }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [6, 2.5, 4], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.4} color="#cfe8ff" />
      <pointLight position={[-6, -3, -4]} intensity={12} color="#ff6ad5" />
      <pointLight position={[4, 3, -5]} intensity={10} color="#4dd8ff" />
      <Core />
      <Ring radius={2.6} color="#4dd8ff" speed={0.35} tilt={Math.PI / 2.4} />
      <Ring radius={3.3} color="#ff6ad5" speed={-0.22} tilt={Math.PI / 1.8} />
      <Particles />
      <CameraRig state={state} />
    </Canvas>
  );
}
