import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { fitCamera } from "@/game/layout/camera";

const BOWLS = [new Vector3(-5.27, 0.3, 0), new Vector3(5.27, 0.3, 0)];
const PITS = [new Vector3(-2.9, 0.2, 0.92), new Vector3(2.9, 0.2, -0.92), new Vector3(-2.9, 0.2, -0.92), new Vector3(2.9, 0.2, 0.92)];

function inside(width: number, height: number, preview = false) {
  const fit = fitCamera(width, height, preview);
  const camera = new PerspectiveCamera(fit.fov, width / height, 0.1, 50);
  camera.position.set(...fit.position);
  camera.lookAt(0, -0.1, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return [...BOWLS, ...PITS].every((point) => {
    const projected = point.clone().project(camera);
    return Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1;
  });
}

describe("fitCamera", () => {
  it("keeps both capture bowls and the pits inside a phone frame", () => {
    expect(inside(358, 354)).toBe(true);
    expect(inside(288, 294)).toBe(true);
    expect(inside(388, 210)).toBe(true);
  });

  it("keeps both capture bowls and the pits inside a desktop frame", () => {
    expect(inside(1120, 448)).toBe(true);
    expect(inside(992, 540)).toBe(true);
    expect(inside(608, 500)).toBe(true);
  });
});
