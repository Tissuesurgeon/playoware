import { PerspectiveCamera, Vector3 } from "three";

const BOUNDS = [
  new Vector3(-5.27, 0.3, 0),
  new Vector3(5.27, 0.3, 0),
  new Vector3(-4.2, 0.2, -2.1),
  new Vector3(4.2, 0.2, 2.1),
  new Vector3(0, 0.25, -2.15),
  new Vector3(0, 0.25, 2.15),
];

export function fitCamera(width: number, height: number, preview = false): { fov: number; position: [number, number, number] } {
  const phone = width < 520;
  const narrow = width < 900;
  const fov = preview && phone ? 36 : phone ? 48 : narrow ? 36 : 32;
  const base: [number, number, number] =
    preview && phone ? [0, 8.2, 6.2] : phone ? [0, 11.5, 8.4] : narrow ? [0, 8.4, 7.2] : [0, 5.6, 6.6];
  if (width < 1 || height < 1) return { fov, position: base };

  const camera = new PerspectiveCamera(fov, width / height, 0.1, 50);
  let scale = 0.85;
  for (let step = 0; step < 30; step += 1) {
    camera.position.set(base[0] * scale, base[1] * scale, base[2] * scale);
    camera.lookAt(0, -0.1, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const inside = BOUNDS.every((point) => {
      const projected = point.clone().project(camera);
      return Math.abs(projected.x) < 0.94 && Math.abs(projected.y) < 0.92 && projected.z < 1;
    });
    if (inside) break;
    scale += 0.05;
  }
  return { fov, position: [base[0] * scale, base[1] * scale, base[2] * scale] };
}
