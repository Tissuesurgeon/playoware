"use client";

import { Html, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DoubleSide,
  ExtrudeGeometry,
  MeshStandardMaterial,
  Path,
  Shape,
  SphereGeometry,
  TorusGeometry,
  type Group,
  type Mesh,
  type PerspectiveCamera as PerspectiveCameraImpl,
} from "three";
import { opponent, ownsPit, relativePitNumber, type Player } from "@/engine/oware";
import { dropEase, easeInOut, HandMotion } from "@/game/animation/motion";
import { captureBowlPosition, pitPosition } from "@/game/layout/pits";
import { getSeedPosition } from "@/game/layout/seeds";
import type { HandVisual, SceneBoardProps } from "@/game/board-types";

const seedGeometry = new SphereGeometry(0.086, 14, 10);
seedGeometry.scale(1, 0.72, 0.88);
const pitGeometry = new SphereGeometry(0.4, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const ringGeometry = new TorusGeometry(0.4, 0.026, 8, 28);

const wood = new MeshStandardMaterial({ color: "#6b3f28", roughness: 0.78, metalness: 0.03 });
const pitMaterial = new MeshStandardMaterial({ color: "#1a0e09", roughness: 0.94, metalness: 0, side: DoubleSide });
const seedMaterial = new MeshStandardMaterial({ color: "#f4e7cb", roughness: 0.46, metalness: 0.02 });
const bowlMaterial = new MeshStandardMaterial({ color: "#4a2c1c", roughness: 0.84 });
const ringIdle = new MeshStandardMaterial({ color: "#5a3824", roughness: 0.8 });
const ringLegal = new MeshStandardMaterial({ color: "#e7b15a", roughness: 0.42, emissive: "#8a5a22", emissiveIntensity: 0.35 });
const ringHot = new MeshStandardMaterial({ color: "#f3d7a1", roughness: 0.35, emissive: "#e7b15a", emissiveIntensity: 0.55 });
const ringForfeit = new MeshStandardMaterial({ color: "#8d3b32", roughness: 0.6, emissive: "#5a241e", emissiveIntensity: 0.2 });
const mouthMaterial = new MeshStandardMaterial({ transparent: true, opacity: 0.02, depthWrite: false, color: "#000000" });

function FrameCamera() {
  const width = useThree((state) => state.size.width);
  const invalidate = useThree((state) => state.invalidate);
  const phone = width < 520;
  const narrow = width < 900;
  const camera = useRef<PerspectiveCameraImpl>(null);

  useLayoutEffect(() => {
    camera.current?.lookAt(0, -0.1, 0);
    invalidate();
  }, [phone, narrow, invalidate]);

  useFrame(() => {
    camera.current?.lookAt(0, -0.1, 0);
  });

  return (
    <PerspectiveCamera
      ref={camera}
      makeDefault
      near={0.1}
      far={50}
      fov={phone ? 48 : narrow ? 36 : 32}
      position={phone ? [0, 11.5, 8.4] : narrow ? [0, 8.4, 7.2] : [0, 5.6, 6.6]}
    />
  );
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

  return (
    <mesh
      ref={ref}
      geometry={seedGeometry}
      material={seedMaterial}
      rotation={[0.35, rest.rotationY, rest.rotationZ]}
      scale={rest.scale}
    />
  );
}

function Pit({
  index,
  count,
  viewer,
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
  viewer: Player;
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
  const owner = ownsPit(viewer, index) ? viewer : opponent(viewer);
  const number = relativePitNumber(owner, index);
  const outward = index < 6 ? 0.58 : -0.58;
  const ring = hot ? ringHot : forfeit ? ringForfeit : legal ? ringLegal : ringIdle;

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
        <circleGeometry args={[0.46, 24]} />
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
        <span className="text-[11px] font-semibold text-cream/80">{number}</span>
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
        const pose = getSeedPosition(hand.pit, index + 30, shown);
        return (
          <mesh
            key={index}
            geometry={seedGeometry}
            material={seedMaterial}
            position={[pose.x * 0.45, 0.16 + index * 0.012, pose.z * 0.45]}
            rotation={[0.4, pose.rotationY, pose.rotationZ]}
            scale={pose.scale}
          />
        );
      })}
      <Html center position={[0, 0.55, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <span className="flex flex-col items-center gap-1">
          {hand.player ? (
            <span className="rounded-full bg-walnut px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-paper uppercase">
              {hand.player}
            </span>
          ) : null}
          <span className="rounded-full bg-paper/95 px-2 py-0.5 text-xs font-semibold text-ink shadow-sm">{hand.count}</span>
        </span>
      </Html>
    </group>
  );
}

function CaptureFlight({
  capture,
  duration,
  reduced,
}: {
  capture: { pit: number; count: number; player: Player };
  duration: number;
  reduced: boolean;
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
    const to = captureBowlPosition(capture.player);
    group.position.set(from.x + (to.x - from.x) * t, 0.28 + Math.sin(t * Math.PI) * (reduced ? 0 : 0.42), from.z + (to.z - from.z) * t);
  });

  const shown = Math.min(6, capture.count);
  return (
    <group ref={ref}>
      {Array.from({ length: shown }, (_, index) => {
        const pose = getSeedPosition(capture.pit, index + 40, shown);
        return (
          <mesh
            key={index}
            geometry={seedGeometry}
            material={seedMaterial}
            position={[pose.x * 0.4, index * 0.01, pose.z * 0.4]}
            rotation={[0.3, pose.rotationY, pose.rotationZ]}
            scale={pose.scale}
          />
        );
      })}
    </group>
  );
}

function Bowl({ player, count }: { player: Player; count: number }) {
  const place = captureBowlPosition(player);
  const shown = Math.min(8, count);
  return (
    <group position={[place.x, 0, place.z]}>
      <mesh material={bowlMaterial} position={[0, -0.04, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.34, 0.1, 24]} />
      </mesh>
      {Array.from({ length: shown }, (_, index) => {
        const pose = getSeedPosition(player === "player1" ? 20 : 21, index, Math.max(shown, 1));
        return (
          <mesh
            key={index}
            geometry={seedGeometry}
            material={seedMaterial}
            position={[pose.x * 1.3, 0.08 + pose.y + 0.16, pose.z * 1.3]}
            rotation={[0.2, pose.rotationY, pose.rotationZ]}
            scale={pose.scale}
          />
        );
      })}
    </group>
  );
}

function BoardShell() {
  const geometry = useMemo(() => {
    const width = 8.35;
    const depth = 3.9;
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
      bevelSegments: 2,
      curveSegments: 20,
    });
    board.rotateX(Math.PI / 2);
    board.computeBoundingBox();
    const top = board.boundingBox?.max.y ?? 0;
    board.translate(0, -top + 0.01, 0);
    return board;
  }, []);

  return <mesh geometry={geometry} material={wood} castShadow receiveShadow raycast={() => undefined} />;
}

function BoardModel(props: SceneBoardProps) {
  const {
    board,
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
  const dropMs = Math.max(160, Math.round(travelMs * 0.9));
  const capturePlayer: Player | null = capture ? (capture.toward === "bottom" ? viewer : opponent(viewer)) : null;

  return (
    <group rotation={[0, viewer === "player2" ? Math.PI : 0, 0]}>
      {props.preview ? null : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]} receiveShadow>
          <planeGeometry args={[11, 6]} />
          <meshStandardMaterial color="#f3eee6" />
        </mesh>
      )}
      <BoardShell />
      {board.map((count, index) => (
        <Pit
          key={index}
          index={index}
          count={count ?? 0}
          viewer={viewer}
          legal={!disabled && legalPits.includes(index)}
          hot={selectedPit === index || lastPit === index}
          forfeit={forfeitedPits.includes(index)}
          landed={landedPit === index}
          dropMs={dropMs}
          reduced={reduced}
          onPlay={onPlay}
        />
      ))}
      <Bowl player="player1" count={captured.player1} />
      <Bowl player="player2" count={captured.player2} />
      {hand && hand.count > 0 ? <PlayerHand hand={hand} travelMs={travelMs} reduced={reduced} /> : null}
      {capture && capturePlayer ? (
        <CaptureFlight capture={{ pit: capture.pit, count: capture.count, player: capturePlayer }} duration={captureMs} reduced={reduced} />
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
      <FrameCamera />
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[3.5, 9, 5]}
        intensity={1.4}
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
      <directionalLight position={[-4, 3, -3]} intensity={0.28} />
      <BoardModel {...props} />
    </Canvas>
  );
}
