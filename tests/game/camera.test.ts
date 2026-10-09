import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { fitCamera } from "@/game/layout/camera";
import { PIT_SPACING } from "@/game/layout/pits";

const SIDE_BOWLS = [new Vector3(-5.27, 0.3, 0), new Vector3(5.27, 0.3, 0)];
const END_BOWLS = [new Vector3(0, 0.22, 2.15), new Vector3(0, 0.22, -2.15)];
const PITS = [new Vector3(-2.9, 0.2, 0.92), new Vector3(2.9, 0.2, -0.92), new Vector3(-2.9, 0.2, -0.92), new Vector3(2.9, 0.2, 0.92)];

function view(width: number, height: number, preview = false) {
  const fit = fitCamera(width, height, preview);
  const camera = new PerspectiveCamera(fit.fov, width / height, 0.1, 50);
  camera.position.set(...fit.position);
  camera.lookAt(0, -0.1, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function inside(width: number, height: number, points: Vector3[], preview = false) {
  const camera = view(width, height, preview);
  return points.every((point) => {
    const projected = point.clone().project(camera);
    return Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1;
  });
}

function housePitch(width: number, height: number) {
  const camera = view(width, height);
  const left = new Vector3(-2.5 * PIT_SPACING, 0.2, 0.92).project(camera);
  const next = new Vector3(-1.5 * PIT_SPACING, 0.2, 0.92).project(camera);
  return (Math.abs(next.x - left.x) / 2) * width;
}

describe("fitCamera", () => {
  it("keeps the houses and the end bowls inside a phone frame", () => {
    expect(inside(390, 400, [...END_BOWLS, ...PITS])).toBe(true);
    expect(inside(360, 340, [...END_BOWLS, ...PITS])).toBe(true);
    expect(inside(320, 320, [...END_BOWLS, ...PITS])).toBe(true);
  });

  it("gives each house a thumb-sized gap on a phone", () => {
    expect(housePitch(390, 400)).toBeGreaterThanOrEqual(44);
    expect(housePitch(360, 340)).toBeGreaterThanOrEqual(40);
  });

  it("keeps both capture bowls and the pits inside a desktop frame", () => {
    expect(inside(1120, 448, [...SIDE_BOWLS, ...PITS])).toBe(true);
    expect(inside(992, 540, [...SIDE_BOWLS, ...PITS])).toBe(true);
    expect(inside(608, 500, [...SIDE_BOWLS, ...PITS])).toBe(true);
  });

  it("keeps the side bowls inside a phone-sized preview", () => {
    expect(inside(360, 220, [...SIDE_BOWLS, ...PITS], true)).toBe(true);
  });
});
