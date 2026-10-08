/** How far a seed may sit from the middle of its pit. */
export const PIT_CLUSTER_RADIUS = 0.3;

export interface SeedPlacement {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  rotationZ: number;
  scale: number;
}

function mix(pitIndex: number, seedIndex: number) {
  let value = Math.imul(pitIndex + 3, 374761393) ^ Math.imul(seedIndex + 11, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return value >>> 0;
}

/**
 * Deterministic place for one seed inside a pit.
 * `seedIndex` is 0-based within that pit. The same inputs always return the same place.
 */
export function getSeedPosition(pitIndex: number, seedIndex: number, seedCount: number): SeedPlacement {
  const noise = mix(pitIndex, seedIndex);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spread = seedCount <= 1 ? 0 : Math.sqrt(seedIndex / Math.max(seedCount, 1));
  const ring = spread * 0.22;
  const angle = seedIndex * golden;
  const x = Math.cos(angle) * ring + (((noise >> 3) % 7) - 3) * 0.006;
  const z = Math.sin(angle) * ring * 0.9 + (((noise >> 6) % 7) - 3) * 0.006;
  const layer = Math.floor(seedIndex / 6);
  const y = -0.11 + layer * 0.055 + ((noise >> 9) % 5) * 0.004;
  const rotationY = ((noise >> 8) % 360) * (Math.PI / 180);
  const rotationZ = (((noise >> 16) % 24) - 12) * (Math.PI / 180);
  const scale = 0.9 + ((noise >> 12) % 16) / 100;
  return { x, y, z, rotationY, rotationZ, scale };
}
