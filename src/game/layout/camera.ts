import { PerspectiveCamera, Vector3 } from "three";

const BOUNDS = [
  new Vector3(-5.27, 0.3, 0),
  new Vector3(5.27, 0.3, 0),
  new Vector3(-4.2, 0.2, -2.1),
  new Vector3(4.2, 0.2, 2.1),
  new Vector3(0, 0.25, -2.15),
  new Vector3(0, 0.25, 2.15),
];

/** The phone plank ends just past the houses. Bowls sit beyond each row. */
const PHONE_BOUNDS = [
  new Vector3(-3.7, 0.25, 0),
  new Vector3(3.7, 0.25, 0),
  new Vector3(-3.55, 0.2, 1.85),
  new Vector3(3.55, 0.2, -1.85),
  new Vector3(0.55, 0.35, 2.62),
  new Vector3(-0.55, 0.35, -2.62),
];

export function fitCamera(width: number, height: number, preview = false): { fov: number; position: [number, number, number] } {
  const narrowWidth = width < 520;
  const phone = !preview && narrowWidth;
  const narrow = width < 900;
  const fov = preview && narrowWidth ? 36 : phone ? 42 : narrow ? 36 : 32;
  const base: [number, number, number] =
    preview && narrowWidth ? [0, 8.2, 6.2] : phone ? [0, 9.5, 3.2] : narrow ? [0, 8.4, 7.2] : [0, 5.6, 6.6];
  if (width < 1 || height < 1) return { fov, position: base };

  const camera = new PerspectiveCamera(fov, width / height, 0.1, 50);
  const bounds = phone ? PHONE_BOUNDS : BOUNDS;
  const edge = phone ? 0.96 : 0.94;
  let scale = phone ? 0.45 : 0.85;
  for (let step = 0; step < 48; step += 1) {
    camera.position.set(base[0] * scale, base[1] * scale, base[2] * scale);
    camera.lookAt(0, -0.1, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const inside = bounds.every((point) => {
      const projected = point.clone().project(camera);
      return Math.abs(projected.x) < edge && Math.abs(projected.y) < 0.9 && projected.z < 1;
    });
    if (inside) break;
    scale += 0.05;
  }
  return { fov, position: [base[0] * scale, base[1] * scale, base[2] * scale] };
}
