// 3D dice overlay — the same theatre the classic sheet uses: a full-screen
// transparent canvas, dice thrown with cannon-es physics and rendered with
// three.js. The roll itself is computed before the throw; when the dice
// settle, each die's up-face material is swapped so the landed face shows
// the pre-computed value. Geometry is procedural: faces are clustered from
// the three.js primitives by triangle normal (the d10 is a hand-built
// pentagonal trapezohedron), and every face gets its own canvas texture.

import * as THREE from "three";
import * as CANNON from "cannon-es";

export type DiceSpec = {
  faces: number;
  value: number; // for d10: 0-9 (0 shows as "0", or "00" on the percentile die)
  percentile?: boolean;
};

const DIE_SCALE = 0.55;
const BODY_COLOR = "#33302b";
const NUMBER_COLOR = "#f5eeda";

type FaceInfo = {
  normal: THREE.Vector3;
  centroid: THREE.Vector3;
  tris: [THREE.Vector3, THREE.Vector3, THREE.Vector3][];
};

function faceTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BODY_COLOR;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = NUMBER_COLOR;
  ctx.font = `600 ${text.length > 1 ? 118 : 150}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 136);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Cluster a geometry's triangles into planar faces by matching normals.
function clusterFaces(geo: THREE.BufferGeometry): FaceInfo[] {
  const pos = geo.getAttribute("position");
  const clusters: FaceInfo[] = [];
  const v = (i: number) =>
    new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).multiplyScalar(DIE_SCALE);
  for (let i = 0; i < pos.count; i += 3) {
    const a = v(i);
    let b = v(i + 1);
    let c = v(i + 2);
    const n = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-10) continue;
    n.normalize();
    const centroid = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);
    if (n.dot(centroid) < 0) {
      // keep winding outward
      const t = b; b = c; c = t;
      n.negate();
    }
    let cluster = clusters.find((f) => f.normal.dot(n) > 0.999);
    if (!cluster) {
      cluster = { normal: n.clone(), centroid: new THREE.Vector3(), tris: [] };
      clusters.push(cluster);
    }
    cluster.tris.push([a, b, c]);
    cluster.centroid.add(centroid);
  }
  for (const f of clusters) f.centroid.divideScalar(f.tris.length);
  return clusters;
}

// Build render geometry (one material group per face) + the cannon shape.
function buildDieGeometry(faces: FaceInfo[]) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const geometry = new THREE.BufferGeometry();
  const S = 2.1 * DIE_SCALE;
  let offset = 0;
  for (const face of faces) {
    const upRef =
      Math.abs(face.normal.y) > 0.85
        ? new THREE.Vector3(0, 0, -1)
        : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(upRef, face.normal).normalize();
    const w = new THREE.Vector3().crossVectors(face.normal, u);
    let count = 0;
    for (const [a, b, c] of face.tris) {
      for (const p of [a, b, c]) {
        positions.push(p.x, p.y, p.z);
        normals.push(face.normal.x, face.normal.y, face.normal.z);
        const d = new THREE.Vector3().subVectors(p, face.centroid);
        uvs.push(0.5 + d.dot(u) / S, 0.5 + d.dot(w) / S);
        count++;
      }
    }
    geometry.addGroup(offset, count, faces.indexOf(face));
    offset += count;
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

  // Cannon convex shape from the same triangles.
  const key = (p: THREE.Vector3) =>
    `${Math.round(p.x * 500)},${Math.round(p.y * 500)},${Math.round(p.z * 500)}`;
  const vertMap = new Map<string, number>();
  const vertices: CANNON.Vec3[] = [];
  const idx = (p: THREE.Vector3) => {
    const k = key(p);
    if (!vertMap.has(k)) {
      vertMap.set(k, vertices.length);
      vertices.push(new CANNON.Vec3(p.x, p.y, p.z));
    }
    return vertMap.get(k)!;
  };
  const shapeFaces: number[][] = [];
  for (const face of faces)
    for (const [a, b, c] of face.tris) shapeFaces.push([idx(a), idx(b), idx(c)]);
  const shape = new CANNON.ConvexPolyhedron({ vertices, faces: shapeFaces });
  return { geometry, shape };
}

function d10Faces(): FaceInfo[] {
  const A = new THREE.Vector3(0, 1.05, 0).multiplyScalar(DIE_SCALE);
  const B = new THREE.Vector3(0, -1.05, 0).multiplyScalar(DIE_SCALE);
  const U: THREE.Vector3[] = [];
  const L: THREE.Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const a1 = (i * 72 * Math.PI) / 180;
    const a2 = ((i * 72 + 36) * Math.PI) / 180;
    U.push(new THREE.Vector3(Math.cos(a1) * 0.92, 0.3, Math.sin(a1) * 0.92).multiplyScalar(DIE_SCALE));
    L.push(new THREE.Vector3(Math.cos(a2) * 0.92, -0.3, Math.sin(a2) * 0.92).multiplyScalar(DIE_SCALE));
  }
  const faces: FaceInfo[] = [];
  const kite = (poly: THREE.Vector3[]) => {
    const [p0, p1, p2, p3] = poly;
    const centroid = new THREE.Vector3().add(p0).add(p1).add(p2).add(p3).divideScalar(4);
    let n = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0));
    if (n.lengthSq() < 1e-10) n = new THREE.Vector3(0, 1, 0);
    n.normalize();
    let tris: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
      [p0, p1, p2],
      [p0, p2, p3],
    ];
    if (n.dot(centroid) < 0) {
      tris = [
        [p0, p2, p1],
        [p0, p3, p2],
      ];
      n.negate();
    }
    faces.push({ normal: n, centroid, tris });
  };
  for (let i = 0; i < 5; i++) {
    const j = (i + 1) % 5;
    kite([A, U[i], L[i], U[j]]);
    kite([B, L[j], U[j], L[i]]);
  }
  return faces;
}

function facesForDie(faces: number): FaceInfo[] {
  switch (faces) {
    case 4: return clusterFaces(new THREE.TetrahedronGeometry(1));
    case 6: return clusterFaces(new THREE.BoxGeometry(1.35, 1.35, 1.35));
    case 8: return clusterFaces(new THREE.OctahedronGeometry(1));
    case 10: return d10Faces();
    case 12: return clusterFaces(new THREE.DodecahedronGeometry(1));
    case 20: return clusterFaces(new THREE.IcosahedronGeometry(1));
    default: return clusterFaces(new THREE.IcosahedronGeometry(1));
  }
}

// Assign face values: opposite faces sum to faces+1 (d10: pairs sum to 9).
function assignValues(faces: FaceInfo[], count: number): number[] {
  const values = new Array<number>(faces.length).fill(-1);
  const total = count === 10 ? 9 : count + 1;
  let next = count === 10 ? 0 : 1;
  for (let i = 0; i < faces.length; i++) {
    if (values[i] !== -1) continue;
    values[i] = next;
    const opposite = faces.findIndex(
      (f, j) => j !== i && values[j] === -1 && f.normal.dot(faces[i].normal) < -0.85,
    );
    if (opposite >= 0) values[opposite] = total - next;
    next++;
  }
  for (let i = 0; i < values.length; i++) if (values[i] === -1) values[i] = next++;
  return values;
}

type LiveDie = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material[]>;
  body: CANNON.Body;
  faceNormals: THREE.Vector3[];
  faceValues: number[];
  groupMaterial: number[];
  targetValue: number;
};

class DiceEngine {
  canvas: HTMLCanvasElement | null = null;
  renderer: THREE.WebGLRenderer | null = null;
  scene: THREE.Scene | null = null;
  camera: THREE.PerspectiveCamera | null = null;
  world: CANNON.World | null = null;
  dice: LiveDie[] = [];
  busy = false;
  walls: CANNON.Body[] = [];

  init() {
    if (this.canvas) return;
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;z-index:80;pointer-events:none;opacity:0;transition:opacity .25s ease;";
    document.body.appendChild(canvas);
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    const camera = new THREE.PerspectiveCamera(
      38,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.set(0, 10, 8.5);
    camera.lookAt(0, 0, 0.4);
    this.camera = camera;

    scene.add(new THREE.HemisphereLight(0xfff6e0, 0x2a2622, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(5, 12, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -11, 0) });
    world.allowSleep = true;
    world.broadphase = new CANNON.SAPBroadphase(world);
    this.world = world;
    const ground = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
    });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(ground);

    const diceMat = new CANNON.Material("dice");
    const floorMat = new CANNON.Material("floor");
    world.addContactMaterial(
      new CANNON.ContactMaterial(diceMat, floorMat, { friction: 0.35, restitution: 0.35 }),
    );
    world.addContactMaterial(
      new CANNON.ContactMaterial(diceMat, diceMat, { friction: 0.2, restitution: 0.45 }),
    );
    world.defaultContactMaterial.friction = 0.35;
  }

  setWalls(halfW: number, halfD: number) {
    if (!this.world) return;
    for (const w of this.walls) this.world.removeBody(w);
    this.walls = [];
    const mkWall = (x: number, z: number, ry: number) => {
      const body = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
      body.position.set(x, 0, z);
      body.quaternion.setFromEuler(0, ry, 0);
      this.world!.addBody(body);
      this.walls.push(body);
    };
    mkWall(-halfW, 0, Math.PI / 2);
    mkWall(halfW, 0, -Math.PI / 2);
    mkWall(0, -halfD, 0);
    mkWall(0, halfD, Math.PI);
  }

  spawnDie(spec: DiceSpec, index: number, total: number): LiveDie {
    const faces = facesForDie(spec.faces);
    const { geometry, shape } = buildDieGeometry(faces);
    const faceValues = assignValues(faces, spec.faces);
    const materials = faceValues.map((v) => {
      const text = spec.percentile
        ? v === 0
          ? "00"
          : `${v * 10}`
        : spec.faces === 10
          ? `${v}`
          : `${v}`;
      return new THREE.MeshStandardMaterial({
        map: faceTexture(text),
        roughness: 0.38,
        metalness: 0.08,
      });
    });
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    this.scene!.add(mesh);

    const body = new CANNON.Body({
      mass: 1.2,
      shape,
      position: new CANNON.Vec3(
        (index - (total - 1) / 2) * 1.3 + (Math.random() - 0.5),
        3.5 + Math.random() * 2,
        -2.5 + Math.random() * 1.5,
      ),
      linearDamping: 0.08,
      angularDamping: 0.12,
      allowSleep: true,
      sleepSpeedLimit: 0.35,
      sleepTimeLimit: 0.5,
    });
    body.velocity.set((Math.random() - 0.5) * 3, -1, 3.5 + Math.random() * 2.5);
    body.angularVelocity.set(
      (Math.random() - 0.5) * 24,
      (Math.random() - 0.5) * 24,
      (Math.random() - 0.5) * 24,
    );
    body.quaternion.setFromEuler(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    this.world!.addBody(body);
    return {
      mesh,
      body,
      faceNormals: faces.map((f) => f.normal),
      faceValues,
      groupMaterial: faces.map((_, i) => i),
      targetValue: spec.value,
    };
  }

  remapToTargets() {
    const up = new THREE.Vector3(0, 1, 0);
    for (const die of this.dice) {
      const q = new THREE.Quaternion(
        die.body.quaternion.x,
        die.body.quaternion.y,
        die.body.quaternion.z,
        die.body.quaternion.w,
      );
      let upFace = 0;
      let best = -Infinity;
      die.faceNormals.forEach((normal, i) => {
        const world = normal.clone().applyQuaternion(q);
        if (world.y > best) {
          best = world.y;
          upFace = i;
        }
      });
      void up;
      const valueFace = die.faceValues.indexOf(die.targetValue);
      if (valueFace < 0 || valueFace === upFace) continue;
      const gm = die.groupMaterial;
      const previousHolder = gm.indexOf(valueFace);
      gm[previousHolder] = gm[upFace];
      gm[upFace] = valueFace;
      die.mesh.geometry.groups.forEach((group, gi) => {
        group.materialIndex = gm[gi];
      });
    }
  }

  clearDice() {
    if (!this.world || !this.scene) return;
    for (const die of this.dice) {
      this.world.removeBody(die.body);
      this.scene.remove(die.mesh);
      die.mesh.geometry.dispose();
      for (const m of die.mesh.material) (m as THREE.Material).dispose();
    }
    this.dice = [];
  }

  async roll(specs: DiceSpec[]): Promise<void> {
    this.init();
    if (!this.renderer || !this.scene || !this.camera || !this.world || !this.canvas)
      return;
    this.clearDice();
    const aspect = window.innerWidth / window.innerHeight;
    const halfW = aspect < 1 ? 4.1 : 8;
    const halfD = aspect < 1 ? 6.5 : 5.5;
    this.camera.aspect = aspect;
    const zoom = aspect < 1 ? 1.3 : 1;
    this.camera.position.set(0, 10 * zoom, 8.5 * zoom);
    this.camera.lookAt(0, 0, 0.4);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.setWalls(halfW, halfD);

    const capped = specs.slice(0, 12);
    this.dice = capped.map((spec, i) => this.spawnDie(spec, i, capped.length));
    this.canvas.style.opacity = "1";
    this.busy = true;

    const started = performance.now();
    let calmSince = 0;
    await new Promise<void>((resolve) => {
      let last = performance.now();
      const step = () => {
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        this.world!.step(1 / 60, dt, 3);
        for (const die of this.dice) {
          die.mesh.position.copy(die.body.position as unknown as THREE.Vector3);
          die.mesh.quaternion.copy(die.body.quaternion as unknown as THREE.Quaternion);
        }
        this.renderer!.render(this.scene!, this.camera!);
        const calm = this.dice.every(
          (d) =>
            d.body.sleepState === CANNON.Body.SLEEPING ||
            (d.body.velocity.length() < 0.12 && d.body.angularVelocity.length() < 0.12),
        );
        if (calm) {
          if (!calmSince) calmSince = now;
        } else calmSince = 0;
        const elapsed = now - started;
        if ((calmSince && now - calmSince > 450) || elapsed > 5500) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    this.remapToTargets();
    // A few final frames so the remapped faces are what the player sees.
    for (let i = 0; i < 3; i++) {
      this.renderer.render(this.scene, this.camera);
      await new Promise((r) => requestAnimationFrame(r));
    }
    await new Promise((r) => setTimeout(r, 1300));
    if (this.canvas) this.canvas.style.opacity = "0";
    await new Promise((r) => setTimeout(r, 260));
    this.clearDice();
    this.busy = false;
  }
}

let engine: DiceEngine | null = null;

// Animate a roll. Fire-and-forget safe: any failure (no WebGL, etc.)
// resolves silently — the numeric result is already shown by the caller.
export async function animateRoll(specs: DiceSpec[]): Promise<void> {
  if (typeof window === "undefined" || specs.length === 0) return;
  try {
    engine ??= new DiceEngine();
    await engine.roll(specs);
  } catch {
    // animation is theatre; never break the sheet over it
  }
}
