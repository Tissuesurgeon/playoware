"use client";

import { Html, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  DoubleSide,
  ExtrudeGeometry,
  LatheGeometry,
  MeshStandardMaterial,
  NoColorSpace,
  Path,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  type Group,
  type Mesh,
  type PerspectiveCamera as PerspectiveCameraImpl,
} from "three";
import { initialTerritory, opponent, relativePitNumber, type Player } from "@/engine/oware";
import { dropEase, easeInOut, HandMotion } from "@/game/animation/motion";
import { fitCamera } from "@/game/layout/camera";
import { captureBowlPosition, pitPosition } from "@/game/layout/pits";
import { getSeedPosition } from "@/game/layout/seeds";
import type { HandVisual, SceneBoardProps } from "@/game/board-types";

function mix(x: number, y: number) {
  let value = Math.imul(x + 3, 374761393) ^ Math.imul(y + 11, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return value >>> 0;
}

function elongate(scaleX: number, scaleY: number, scaleZ: number) {
  const geometry = new SphereGeometry(0.086, 14, 10);
  geometry.scale(scaleX, scaleY, scaleZ);
  return geometry;
}

const seedGeometries = [elongate(1, 0.72, 0.88), elongate(1.12, 0.66, 0.8), elongate(0.92, 0.78, 0.98)];
const seedMaterials = [
  new MeshStandardMaterial({ color: "#f3e4c4", roughness: 0.62, metalness: 0 }),
  new MeshStandardMaterial({ color: "#c6bf96", roughness: 0.7, metalness: 0 }),
  new MeshStandardMaterial({ color: "#b4bba6", roughness: 0.68, metalness: 0 }),
  new MeshStandardMaterial({ color: "#e0c396", roughness: 0.64, metalness: 0 }),
];

function seedLook(pit: number, seedIndex: number) {
  const n = mix(pit, seedIndex);
  return {
    geometry: seedGeometries[n % seedGeometries.length] ?? seedGeometries[0],
    material: seedMaterials[(n >>> 8) % seedMaterials.length] ?? seedMaterials[0],
  };
}

function paintDepth(geometry: LatheGeometry, rim: number[], well: number[]) {
  const position = geometry.attributes.position;
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox?.min.y ?? 0;
  const maxY = geometry.boundingBox?.max.y ?? 1;
  const span = Math.max(0.0001, maxY - minY);
  const colors = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const shade = ((position.getY(index) - minY) / span) ** 2;
    colors[index * 3] = (well[0] ?? 0) + ((rim[0] ?? 0) - (well[0] ?? 0)) * shade;
    colors[index * 3 + 1] = (well[1] ?? 0) + ((rim[1] ?? 0) - (well[1] ?? 0)) * shade;
    colors[index * 3 + 2] = (well[2] ?? 0) + ((rim[2] ?? 0) - (well[2] ?? 0)) * shade;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
}

const pitGeometry = new LatheGeometry(
  [
    new Vector2(0, -0.26),
    new Vector2(0.14, -0.23),
    new Vector2(0.24, -0.16),
    new Vector2(0.32, -0.08),
    new Vector2(0.37, -0.03),
    new Vector2(0.4, 0),
  ],
  32,
);
paintDepth(pitGeometry, [0.42, 0.24, 0.16], [0.14, 0.07, 0.04]);

const captureBowlGeometry = new LatheGeometry(
  [
    new Vector2(0, -0.1),
    new Vector2(0.2, -0.06),
    new Vector2(0.32, -0.02),
    new Vector2(0.4, 0.02),
    new Vector2(0.46, 0.055),
  ],
  28,
);
paintDepth(captureBowlGeometry, [0.48, 0.28, 0.18], [0.16, 0.08, 0.05]);

function grainCanvas(width: number, height: number, paint: (x: number, y: number, noise: number) => [number, number, number]) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const noise = mix(x, y) / 4294967295;
      const [red, green, blue] = paint(x, y, noise);
      const offset = (y * width + x) * 4;
      image.data[offset] = red;
      image.data[offset + 1] = green;
      image.data[offset + 2] = blue;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function woodMaps() {
  const width = 256;
  const height = 64;
  const color = grainCanvas(width, height, (x, y, noise) => {
    const along = y / height;
    const across = x / width;
    const band = Math.sin(along * Math.PI * 3.2) * 0.5 + 0.5;
    const streak = Math.sin(along * Math.PI * 9 + across * 1.4) * 0.5 + 0.5;
    const lift = (band - 0.5) * 46 + (streak - 0.5) * 16 + (noise - 0.5) * 10;
    return [
      Math.round(Math.min(150, Math.max(62, 107 + lift))),
      Math.round(Math.min(86, Math.max(28, 58 + lift * 0.42))),
      Math.round(Math.min(52, Math.max(16, 36 + lift * 0.24))),
    ];
  });
  const rough = grainCanvas(width, height, (_x, y, noise) => {
    const band = Math.sin((y / height) * Math.PI * 3.2) * 0.5 + 0.5;
    const value = Math.round(132 + band * 48 + noise * 14);
    return [value, value, value];
  });
  const map = new CanvasTexture(color);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = RepeatWrapping;
  map.wrapT = RepeatWrapping;
  map.repeat.set(0.22, 0.55);
  map.anisotropy = 4;
  const roughnessMap = new CanvasTexture(rough);
  roughnessMap.colorSpace = NoColorSpace;
  roughnessMap.wrapS = RepeatWrapping;
  roughnessMap.wrapT = RepeatWrapping;
  roughnessMap.repeat.set(0.22, 0.55);
  return { map, roughnessMap };
}

const woodMapsOnce = typeof document === "undefined" ? null : woodMaps();
const wood = new MeshStandardMaterial({
  color: woodMapsOnce ? "#ffffff" : "#6b3a24",
  roughness: 0.62,
  metalness: 0.02,
  ...(woodMapsOnce ?? {}),
});
const pitMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0, side: DoubleSide });
const captureBowlMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.02, side: DoubleSide });
const grooveGeometry = new BoxGeometry(6.4, 0.012, 0.055);
const grooveMaterial = new MeshStandardMaterial({ color: "#1c0e0a", roughness: 0.94, metalness: 0 });
const ringGeometry = new TorusGeometry(0.4, 0.026, 8, 28);
const bowlSouth = new MeshStandardMaterial({ color: "#2c6b4a", roughness: 0.55, metalness: 0, emissive: "#1f4d36", emissiveIntensity: 0.18 });
const bowlNorth = new MeshStandardMaterial({ color: "#c4622d", roughness: 0.55, metalness: 0, emissive: "#9a4a1f", emissiveIntensity: 0.14 });
const ringSouth = new MeshStandardMaterial({ color: "#2c6b4a", roughness: 0.48, emissive: "#1f4d36", emissiveIntensity: 0.35 });
const ringSouthLegal = new MeshStandardMaterial({ color: "#2c6b4a", roughness: 0.38, emissive: "#2c6b4a", emissiveIntensity: 0.9 });
const ringSouthHot = new MeshStandardMaterial({ color: "#b7e0cb", roughness: 0.35, emissive: "#2c6b4a", emissiveIntensity: 0.55 });
const ringNorth = new MeshStandardMaterial({ color: "#c4622d", roughness: 0.48, emissive: "#9a4a1f", emissiveIntensity: 0.35 });
const ringNorthLegal = new MeshStandardMaterial({ color: "#c4622d", roughness: 0.38, emissive: "#c4622d", emissiveIntensity: 0.9 });
const ringNorthHot = new MeshStandardMaterial({ color: "#f3c2a4", roughness: 0.35, emissive: "#c4622d", emissiveIntensity: 0.55 });
const ringForfeit = new MeshStandardMaterial({ color: "#8d3b32", roughness: 0.6, emissive: "#5a241e", emissiveIntensity: 0.2 });

function ownerRing(owner: Player, hot: boolean, legal: boolean, forfeit: boolean) {
  if (forfeit) return ringForfeit;
  if (owner === "player1") return hot ? ringSouthHot : legal ? ringSouthLegal : ringSouth;
  return hot ? ringNorthHot : legal ? ringNorthLegal : ringNorth;
}
const mouthMaterial = new MeshStandardMaterial({ transparent: true, opacity: 0.02, depthWrite: false, color: "#000000" });

function FrameCamera({ preview = false }: { preview?: boolean }) {
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);
  const camera = useRef<PerspectiveCameraImpl>(null);
  const fit = useMemo(() => fitCamera(width, height, preview), [width, height, preview]);

  useLayoutEffect(() => {
    camera.current?.lookAt(0, -0.1, 0);
    invalidate();
  }, [fit, invalidate]);

  useFrame(() => {
    camera.current?.lookAt(0, -0.1, 0);
  });

  return <PerspectiveCamera ref={camera} makeDefault near={0.1} far={50} fov={fit.fov} position={fit.position} />;
}

function SeedMesh({
  pit,
  seedIndex,
  count,
  settling,
  duration,
  reduced,
}: {
  pit: number;
  seedIndex: number;
  count: number;
  settling: boolean;
  duration: number;
  reduced: boolean;
}) {
  const ref = useRef<Mesh>(null);
  const rest = getSeedPosition(pit, seedIndex, count);
  const started = useRef(0);

  useLayoutEffect(() => {
    started.current = performance.now();
  }, [settling, pit, seedIndex, count]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    if (!settling || reduced) {
      mesh.position.set(rest.x, rest.y, rest.z);
      return;
    }
    const t = Math.min(1, (performance.now() - started.current) / Math.max(duration, 1));
    const drop = dropEase(t);
    mesh.position.set(
      rest.x * drop.progress,
      0.62 + (rest.y - 0.62) * drop.progress + drop.lift,
      rest.z * drop.progress,
    );
  });

  const look = seedLook(pit, seedIndex);
  return (
    <mesh
      ref={ref}
      geometry={look.geometry}
      material={look.material}
      rotation={[0.35, rest.rotationY, rest.rotationZ]}
      scale={rest.scale}
    />
  );
}

function Pit({
  index,
  count,
  owner,
  legal,
  hot,
  forfeit,
  landed,
  dropMs,
  reduced,
  onPlay,
}: {
  index: number;
  count: number;
  owner: Player;
  legal: boolean;
  hot: boolean;
  forfeit: boolean;
  landed: boolean;
  dropMs: number;
  reduced: boolean;
  onPlay?: (pit: number) => void;
}) {
  const place = pitPosition(index);
  const [hovered, setHovered] = useState(false);
  const side: Player = index < 6 ? "player1" : "player2";
  const number = relativePitNumber(side, index);
  const outward = index < 6 ? 0.58 : -0.58;
  const ring = ownerRing(owner, hot, legal, forfeit);

  function hover(event: ThreeEvent<PointerEvent>, active: boolean) {
    event.stopPropagation();
    if (!legal) return;
    setHovered(active);
    document.body.style.cursor = active ? "pointer" : "";
  }

  return (
    <group position={[place.x, 0, place.z]}>
      <mesh
        geometry={pitGeometry}
        material={pitMaterial}
        onPointerOver={(event) => hover(event, true)}
        onPointerOut={(event) => hover(event, false)}
        onClick={(event) => {
          event.stopPropagation();
          if (legal) onPlay?.(index);
        }}
      />
      <mesh
        geometry={ringGeometry}
        material={ring}
        position={[0, 0.015, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={hovered && legal ? 1.05 : 1}
        onPointerOver={(event) => hover(event, true)}
        onPointerOut={(event) => hover(event, false)}
        onClick={(event) => {
          event.stopPropagation();
          if (legal) onPlay?.(index);
        }}
      />
      <mesh
        position={[0, 0.22, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={mouthMaterial}
        onPointerOver={(event) => hover(event, true)}
        onPointerOut={(event) => hover(event, false)}
        onClick={(event) => {
          event.stopPropagation();
          if (legal) onPlay?.(index);
        }}
      >
        <circleGeometry args={[0.56, 28]} />
      </mesh>
      {Array.from({ length: count }, (_, seedIndex) => (
        <SeedMesh
          key={seedIndex}
          pit={index}
          seedIndex={seedIndex}
          count={count}
          settling={landed && seedIndex === count - 1}
          duration={dropMs}
          reduced={reduced}
        />
      ))}
      <Html position={[0, 0.02, outward]} center zIndexRange={[2, 0]} style={{ pointerEvents: "none" }}>
        <span className="text-[11px] font-semibold text-paper">{number}</span>
      </Html>
    </group>
  );
}

function PlayerHand({ hand, travelMs, reduced }: { hand: HandVisual; travelMs: number; reduced: boolean }) {
  const ref = useRef<Group>(null);
  const motion = useRef(new HandMotion());

  useLayoutEffect(() => {
    motion.current.retarget(hand.pit, performance.now(), travelMs, reduced);
  }, [hand.pit, travelMs, reduced]);

  useFrame(() => {
    const place = motion.current.sample(performance.now());
    ref.current?.position.set(place.x, place.y, place.z);
  });

  const shown = Math.min(6, hand.count);
  return (
    <group ref={ref}>
      {Array.from({ length: shown }, (_, index) => {
        const look = seedLook(index, index);
        return (
          <mesh
            key={index}
            geometry={look.geometry}
            material={look.material}
            position={[(index % 3) * 0.07 - 0.07, 0.12 + Math.floor(index / 3) * 0.08, index % 2 === 0 ? -0.03 : 0.03]}
            rotation={[0.4, index * 0.4, 0.2]}
          />
        );
      })}
      <Html center position={[0, 0.36, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <span className="inline-flex max-w-[9rem] items-center gap-1.5 rounded-full bg-paper/95 px-2 py-0.5 text-xs font-semibold text-ink shadow-sm">
          {hand.player ? <span className="truncate">{hand.player}</span> : null}
          <span className="tabular-nums">{hand.count}</span>
        </span>
      </Html>
    </group>
  );
}

function CaptureFlight({
  capture,
  duration,
  reduced,
  placement,
}: {
  capture: { pit: number; count: number; player: Player };
  duration: number;
  reduced: boolean;
  placement: "side" | "end";
}) {
  const ref = useRef<Group>(null);
  const started = useRef(0);

  useLayoutEffect(() => {
    started.current = performance.now();
  }, [capture.pit, capture.count, capture.player]);

  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    const t = reduced ? 1 : easeInOut(Math.min(1, (performance.now() - started.current) / Math.max(duration, 1)));
    const from = pitPosition(capture.pit);
    const to = captureBowlPosition(capture.player, placement);
    group.position.set(from.x + (to.x - from.x) * t, 0.28 + Math.sin(t * Math.PI) * (reduced ? 0 : 0.42), from.z + (to.z - from.z) * t);
  });

  const shown = Math.min(6, capture.count);
  return (
    <group ref={ref}>
      {Array.from({ length: shown }, (_, index) => {
        const pose = getSeedPosition(capture.pit, index + 40, shown);
        const look = seedLook(capture.pit, index);
        return (
          <mesh
            key={index}
            geometry={look.geometry}
            material={look.material}
            position={[pose.x * 0.4, index * 0.01, pose.z * 0.4]}
            rotation={[0.3, pose.rotationY, pose.rotationZ]}
            scale={pose.scale}
          />
        );
      })}
    </group>
  );
}

function Bowl({ player, count, placement }: { player: Player; count: number; placement: "side" | "end" }) {
  const place = captureBowlPosition(player, placement);
  const shown = Math.min(8, count);
  const store = player === "player1" ? 20 : 21;
  return (
    <group position={[place.x, 0, place.z]}>
      <mesh geometry={captureBowlGeometry} material={captureBowlMaterial} castShadow receiveShadow raycast={() => undefined} />
      <mesh
        geometry={ringGeometry}
        material={player === "player1" ? bowlSouth : bowlNorth}
        position={[0, 0.055, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={1.15}
        raycast={() => undefined}
      />
      {Array.from({ length: shown }, (_, index) => {
        const pose = getSeedPosition(store, index, Math.max(shown, 1));
        const look = seedLook(store, index);
        return (
          <mesh
            key={index}
            geometry={look.geometry}
            material={look.material}
            position={[pose.x * 1.3, 0.08 + pose.y + 0.16, pose.z * 1.3]}
            rotation={[0.2, pose.rotationY, pose.rotationZ]}
            scale={pose.scale}
          />
        );
      })}
    </group>
  );
}

const railGrooves = [-1.66, -1.54, -1.42, 1.42, 1.54, 1.66];

function RailEngraving() {
  return (
    <group>
      {railGrooves.map((z) => (
        <mesh key={z} geometry={grooveGeometry} material={grooveMaterial} position={[0, 0.022, z]} raycast={() => undefined} />
      ))}
    </group>
  );
}

function BoardShell({ compact }: { compact: boolean }) {
  const geometry = useMemo(() => {
    const width = compact ? 7.2 : 8.35;
    const depth = compact ? 3.5 : 3.9;
    const radius = 0.28;
    const shape = new Shape();
    const left = -width / 2;
    const bottom = -depth / 2;
    shape.moveTo(left + radius, bottom);
    shape.lineTo(left + width - radius, bottom);
    shape.absarc(left + width - radius, bottom + radius, radius, -Math.PI / 2, 0, false);
    shape.lineTo(left + width, bottom + depth - radius);
    shape.absarc(left + width - radius, bottom + depth - radius, radius, 0, Math.PI / 2, false);
    shape.lineTo(left + radius, bottom + depth);
    shape.absarc(left + radius, bottom + depth - radius, radius, Math.PI / 2, Math.PI, false);
    shape.lineTo(left, bottom + radius);
    shape.absarc(left + radius, bottom + radius, radius, Math.PI, Math.PI * 1.5, false);

    for (let index = 0; index < 12; index += 1) {
      const place = pitPosition(index);
      const hole = new Path();
      hole.absarc(place.x, place.z, 0.4, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }

    const board = new ExtrudeGeometry(shape, {
      depth: 0.46,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.045,
      bevelSegments: 3,
      curveSegments: 20,
    });
    board.rotateX(Math.PI / 2);
    board.computeBoundingBox();
    const top = board.boundingBox?.max.y ?? 0;
    board.translate(0, -top + 0.01, 0);
    return board;
  }, [compact]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return <mesh geometry={geometry} material={wood} castShadow receiveShadow raycast={() => undefined} />;
}

function BoardModel(props: SceneBoardProps) {
  const {
    board,
    territory = initialTerritory(),
    viewer,
    legalPits,
    selectedPit,
    lastPit,
    landedPit,
    hand,
    capture,
    captured = { player1: 0, player2: 0 },
    forfeitedPits = [],
    travelMs = 280,
    captureMs = 420,
    reduced = false,
    onPlay,
    disabled = false,
  } = props;
  const width = useThree((state) => state.size.width);
  const placement = !props.preview && width < 520 ? "end" : "side";
  const dropMs = Math.max(160, Math.round(travelMs * 0.9));
  const capturePlayer: Player | null = capture ? (capture.toward === "bottom" ? viewer : opponent(viewer)) : null;

  return (
    <group rotation={viewer === "player2" ? [0, Math.PI, 0] : [0, 0, 0]}>
      {props.preview || placement === "end" ? null : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]} receiveShadow>
          <planeGeometry args={[11, 6]} />
          <meshStandardMaterial color="#f3eee6" />
        </mesh>
      )}
      <BoardShell compact={placement === "end"} />
      <RailEngraving />
      {board.map((count, index) => (
        <Pit
          key={index}
          index={index}
          count={count ?? 0}
          owner={territory[index] ?? "player1"}
          legal={!disabled && legalPits.includes(index)}
          hot={selectedPit === index || lastPit === index}
          forfeit={forfeitedPits.includes(index)}
          landed={landedPit === index}
          dropMs={dropMs}
          reduced={reduced}
          onPlay={onPlay}
        />
      ))}
      <Bowl player="player1" count={captured.player1} placement={placement} />
      <Bowl player="player2" count={captured.player2} placement={placement} />
      {hand && hand.count > 0 ? <PlayerHand hand={hand} travelMs={travelMs} reduced={reduced} /> : null}
      {capture && capturePlayer ? (
        <CaptureFlight
          capture={{ pit: capture.pit, count: capture.count, player: capturePlayer }}
          duration={captureMs}
          reduced={reduced}
          placement={placement}
        />
      ) : null}
    </group>
  );
}

function PreviewSettle({ active }: { active: boolean }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!active) return;
    let frames = 0;
    let id = 0;
    const tick = () => {
      invalidate();
      frames += 1;
      if (frames < 4) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active, invalidate]);

  return null;
}

export function OwareScene(props: SceneBoardProps) {
  return (
    <Canvas
      shadows
      frameloop={props.preview ? "demand" : "always"}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onPointerMissed={() => props.onAccelerate?.()}
      onCreated={({ gl }) => gl.setClearColor("#f3eee6")}
    >
      <color attach="background" args={["#f3eee6"]} />
      <PreviewSettle active={Boolean(props.preview)} />
      <FrameCamera preview={props.preview} />
      <ambientLight intensity={0.62} color="#fff4e8" />
      <directionalLight
        position={[3.5, 9, 5]}
        intensity={1.35}
        color="#fff1dc"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={2}
        shadow-camera-far={22}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
      />
      <directionalLight position={[-4, 3, -3]} intensity={0.32} color="#ffe8d0" />
      <BoardModel {...props} />
    </Canvas>
  );
}
