import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { ESTIMATED_JOINTS } from './albatrossRig';
import './RigTool.css';

/**
 * Dev-only rigging tool — not part of the game, reachable only at
 * `?rig=1` (see App.tsx). Loads public/models/albatross.stl, centers it
 * the exact same way AlbatrossModel.tsx does (so joint positions
 * exported here plug straight into that component's coordinate space,
 * no conversion needed), and renders it with its edges outlined. Click
 * anywhere on the mesh to drop a named joint there; each joint can
 * optionally name a parent (an already-placed joint), drawn as a bone
 * line between them — a lightweight hand-placed skeleton, since the STL
 * itself has none. A placed joint can be repositioned either by typing
 * X/Y/Z directly in its row or by selecting it ("Edit" button, or click
 * its marker in the 3D view) to get a per-axis drag gizmo
 * (`TransformControls`, translate mode — grabbing one arrow constrains
 * the drag to that single axis).
 *
 * Deliberately raw three.js, not react-three-fiber, despite the rest of
 * this app using R3F throughout. An R3F `<Canvas>` rendering this exact
 * geometry reliably lost its WebGL context on load in this environment
 * (confirmed via systematic isolation — removing edges, OrbitControls,
 * the near/far ratio, switching frameloop="demand", constraining `gl`
 * options and `dpr` one at a time, none of it stopped the crash, right
 * down to a single solid mesh with one ambient light) while the exact
 * same geometry rendered via plain `THREE.WebGLRenderer` (this file's
 * actual approach) stayed stable through repeated manual renders. Since
 * this tool has no real "scene graph state" to reconcile — it's an
 * imperative editor, not a game with per-frame declarative state —
 * dropping to raw three.js sidesteps whatever the real R3F/Canvas
 * interaction problem was rather than continuing to chase it.
 */

interface Joint {
  id: string;
  name: string;
  parentId: string | null;
  position: [number, number, number];
}

const SELECTED_COLOR = 0xffe14d;
const UNSELECTED_COLOR = 0xff5a3c;

/**
 * Seeds the tool with the geometrically-estimated shoulder/elbow/wrist
 * rig (see albatrossRig.ts) instead of starting empty — so the estimate
 * actually used by AlbatrossModel.tsx can be seen, sanity-checked
 * against the mesh, and dragged/typed into place if it's off, rather
 * than trusting numbers baked into code with no visual check.
 */
function buildSeedJoints(): Joint[] {
  const idByName = new Map(ESTIMATED_JOINTS.map((j, i) => [j.name, `seed-${i}`]));
  return ESTIMATED_JOINTS.map((j) => ({
    id: idByName.get(j.name)!,
    name: j.name,
    parentId: j.parent ? (idByName.get(j.parent) ?? null) : null,
    position: j.position,
  }));
}

export function RigTool() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [joints, setJoints] = useState<Joint[]>(buildSeedJoints);
  const [placing, setPlacing] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const [selectedJointId, setSelectedJointId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const idCounterRef = useRef(0);
  const jointNumRef = useRef(1);
  const placingRef = useRef(placing);
  placingRef.current = placing;
  const pendingParentIdRef = useRef(pendingParentId);
  pendingParentIdRef.current = pendingParentId;
  const selectedJointIdRef = useRef(selectedJointId);
  selectedJointIdRef.current = selectedJointId;

  const renderRef = useRef<(() => void) | null>(null);
  const markerGroupRef = useRef<THREE.Group | null>(null);
  const sphereMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const transformControlsRef = useRef<InstanceType<typeof TransformControls> | null>(null);

  // Imperative scene setup — runs once. See the doc comment above for why this is raw three.js, not R3F.
  useEffect(() => {
    // Captured up front: React warns (correctly) that a ref's .current may
    // differ by the time this effect's cleanup runs.
    const sphereMap = sphereMapRef.current;
    const containerMaybeNull = containerRef.current;
    if (!containerMaybeNull) return;
    const container: HTMLDivElement = containerMaybeNull;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a1e26');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10);
    camera.position.set(0.8, 0.5, 0.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(1);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8);
    dl.position.set(1, 2, 1);
    scene.add(dl);
    scene.add(new THREE.GridHelper(1, 20));
    scene.add(new THREE.AxesHelper(0.3));

    const markerGroup = new THREE.Group();
    scene.add(markerGroup);
    markerGroupRef.current = markerGroup;

    function render() {
      renderer.render(scene, camera);
    }
    renderRef.current = render;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; // on-demand rendering only — no reason to run a continuous loop for a static editor
    controls.addEventListener('change', render);

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setSize(0.8);
    scene.add(transformControls.getHelper());
    transformControlsRef.current = transformControls;
    transformControls.addEventListener('change', render);
    // Dragging a gizmo arrow shouldn't also orbit the camera underneath it.
    transformControls.addEventListener('dragging-changed', (e) => {
      controls.enabled = !e.value;
    });
    transformControls.addEventListener('objectChange', () => {
      const id = selectedJointIdRef.current;
      const obj = transformControls.object;
      if (!id || !obj) return;
      updateJointRef.current(id, { position: [obj.position.x, obj.position.y, obj.position.z] });
    });

    function resize() {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const raycaster = new THREE.Raycaster();
    let currentMesh: THREE.Mesh | null = null;

    function onClick(e: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);

      if (placingRef.current) {
        if (!currentMesh) return;
        const hit = raycaster.intersectObject(currentMesh, false)[0];
        if (hit) placeJointRef.current([hit.point.x, hit.point.y, hit.point.z]);
        return;
      }

      // Not placing — a click can instead select an existing joint marker for the drag gizmo.
      const spheres = Array.from(sphereMapRef.current.values());
      const hit = raycaster.intersectObjects(spheres, false)[0];
      if (hit) {
        const entry = Array.from(sphereMapRef.current.entries()).find(([, mesh]) => mesh === hit.object);
        if (entry) selectJointRef.current(entry[0]);
      }
    }
    renderer.domElement.addEventListener('click', onClick);

    const loader = new STLLoader();
    loader.load('/models/albatross.stl', (geometry) => {
      geometry.computeBoundingBox();
      const center = new THREE.Vector3();
      geometry.boundingBox!.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);
      geometry.computeVertexNormals();

      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x1a2a38, transparent: true, opacity: 0.6, depthWrite: false }));
      scene.add(mesh);
      currentMesh = mesh;

      const edges = new THREE.EdgesGeometry(geometry, 20);
      scene.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x5fb0ff })));

      render();
    });

    return () => {
      ro.disconnect();
      renderer.domElement.removeEventListener('click', onClick);
      transformControls.dispose();
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      // React 18 StrictMode double-invokes this effect in dev (mount,
      // cleanup, mount) — a real bug this caught, not just a headless-
      // test artifact: sphereMapRef's meshes are added to THIS scene's
      // markerGroup once, on creation, and reused (not re-added) on
      // every later sync since the marker-sync effect only calls
      // `group.add` in its "sphere doesn't exist yet" branch. Without
      // clearing the map here, the second mount gets a brand-new,
      // empty markerGroup while sphereMapRef still points at meshes
      // belonging to the first (now-disposed) scene — they exist, are
      // tracked, and update position correctly, just aren't part of
      // the scene actually being rendered anymore. The bone lines never
      // showed this bug because they're fully torn down and rebuilt
      // from scratch on every sync, not cached. Clearing the map here
      // forces a full, correct rebuild against whatever scene is
      // actually current.
      sphereMap.clear();
    };
  }, []);

  // Cursor feedback for placing mode.
  useEffect(() => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (canvas) canvas.style.cursor = placing ? 'crosshair' : 'grab';
  }, [placing]);

  // Sync joint markers into the imperative scene. Spheres are persistent
  // (a Map keyed by joint id, not torn down every render) specifically
  // so TransformControls can stay attached to the same object while its
  // position is being dragged — rebuilding the mesh mid-drag would pull
  // the gizmo out from under the user's cursor. Only the (cheap) bone
  // lines get fully rebuilt each time.
  useEffect(() => {
    const group = markerGroupRef.current;
    if (!group) return;
    const sphereMap = sphereMapRef.current;

    for (const [id, sphere] of sphereMap) {
      if (!joints.some((j) => j.id === id)) {
        group.remove(sphere);
        sphereMap.delete(id);
      }
    }
    for (const j of joints) {
      let sphere = sphereMap.get(j.id);
      if (!sphere) {
        sphere = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 16), new THREE.MeshBasicMaterial({ color: UNSELECTED_COLOR, depthTest: false }));
        sphere.renderOrder = 999; // always drawn on top of the mesh/wireframe, regardless of depth — a marker should never be hidden inside the model it's marking
        group.add(sphere);
        sphereMap.set(j.id, sphere);
      }
      sphere.position.set(...j.position);
      (sphere.material as THREE.MeshBasicMaterial).color.set(j.id === selectedJointId ? SELECTED_COLOR : UNSELECTED_COLOR);
    }

    for (const child of [...group.children]) {
      if (child instanceof THREE.Line) group.remove(child);
    }
    for (const j of joints) {
      const parent = j.parentId ? joints.find((p) => p.id === j.parentId) : null;
      if (parent) {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...parent.position), new THREE.Vector3(...j.position)]);
        const bone = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe14d, depthTest: false }));
        bone.renderOrder = 998;
        group.add(bone);
      }
    }

    renderRef.current?.();
  }, [joints, selectedJointId]);

  // Attach/detach the drag gizmo when the selection changes.
  useEffect(() => {
    const tc = transformControlsRef.current;
    if (!tc) return;
    const sphere = selectedJointId ? sphereMapRef.current.get(selectedJointId) : null;
    if (sphere) tc.attach(sphere);
    else tc.detach();
    renderRef.current?.();
  }, [selectedJointId, joints.length]);

  function placeJoint(position: [number, number, number]) {
    const id = `joint-${++idCounterRef.current}`;
    const joint: Joint = { id, name: `joint${jointNumRef.current++}`, parentId: pendingParentIdRef.current, position };
    setJoints((prev) => [...prev, joint]);
    setPlacing(false);
    setSelectedJointId(id);
  }
  function selectJoint(id: string) {
    setPlacing(false);
    setSelectedJointId((prev) => (prev === id ? null : id));
  }
  // Read via refs from the imperative click/gizmo handlers above
  // (registered once) so they always call the latest version — same
  // "latest value ref" pattern used throughout this app's R3F code for
  // the same reason: a callback registered once in an effect can't see
  // later renders' closures otherwise.
  const placeJointRef = useRef(placeJoint);
  placeJointRef.current = placeJoint;
  const selectJointRef = useRef(selectJoint);
  selectJointRef.current = selectJoint;

  function updateJoint(id: string, patch: Partial<Joint>) {
    setJoints((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }
  const updateJointRef = useRef(updateJoint);
  updateJointRef.current = updateJoint;

  function removeJoint(id: string) {
    setJoints((prev) => prev.filter((j) => j.id !== id).map((j) => (j.parentId === id ? { ...j, parentId: null } : j)));
    setSelectedJointId((prev) => (prev === id ? null : prev));
  }

  function updateAxis(id: string, axis: 0 | 1 | 2, raw: string) {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setJoints((prev) =>
      prev.map((j) => {
        if (j.id !== id) return j;
        const position: [number, number, number] = [...j.position];
        position[axis] = n;
        return { ...j, position };
      }),
    );
  }

  async function handleCopy() {
    const exportData = joints.map((j) => ({
      name: j.name,
      parent: j.parentId ? (joints.find((p) => p.id === j.parentId)?.name ?? null) : null,
      position: j.position.map((n) => Math.round(n * 10000) / 10000),
    }));
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail (permissions, insecure context) — the data isn't lost, just not silently copied.
    }
  }

  return (
    <div className="rig-tool">
      <div className="rig-canvas-wrap" ref={containerRef} />

      <div className="rig-panel">
        <h1>Albatross Rig Tool</h1>
        <p className="rig-hint">
          Orbit/zoom with the mouse to line up a shot, then place a joint. Click a placed joint's marker (or its "Edit" button) to drag it with a
          per-axis gizmo, or type exact X/Y/Z values. Axes: red=X, green=Y, blue=Z. Grid square = 0.1 units.
        </p>

        <div className="rig-add-row">
          <select value={pendingParentId ?? ''} onChange={(e) => setPendingParentId(e.target.value || null)}>
            <option value="">No parent (root)</option>
            {joints.map((j) => (
              <option key={j.id} value={j.id}>
                parent: {j.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={placing ? 'active' : ''}
            onClick={() =>
              setPlacing((p) => {
                if (!p) setSelectedJointId(null);
                return !p;
              })
            }
          >
            {placing ? 'Click the model…' : '+ Add joint'}
          </button>
        </div>

        <div className="rig-joint-list">
          {joints.length === 0 && <p className="rig-empty">No joints placed yet.</p>}
          {joints.map((j) => (
            <div key={j.id} className={`rig-joint-row${j.id === selectedJointId ? ' selected' : ''}`}>
              <input value={j.name} onChange={(e) => updateJoint(j.id, { name: e.target.value })} />
              <select value={j.parentId ?? ''} onChange={(e) => updateJoint(j.id, { parentId: e.target.value || null })}>
                <option value="">no parent</option>
                {joints
                  .filter((p) => p.id !== j.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <button type="button" className={`rig-edit${j.id === selectedJointId ? ' active' : ''}`} onClick={() => selectJoint(j.id)}>
                {j.id === selectedJointId ? 'Editing' : 'Edit'}
              </button>
              <button type="button" className="rig-remove" onClick={() => removeJoint(j.id)} aria-label={`Remove ${j.name}`}>
                ×
              </button>
              <div className="rig-axis-inputs">
                {(['X', 'Y', 'Z'] as const).map((label, axis) => (
                  <label key={label} className="rig-axis-input">
                    {label}
                    <input type="number" step={0.001} value={j.position[axis]} onChange={(e) => updateAxis(j.id, axis as 0 | 1 | 2, e.target.value)} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="rig-copy" onClick={handleCopy} disabled={joints.length === 0}>
          {copied ? 'Copied!' : 'Copy joints as JSON'}
        </button>
      </div>
    </div>
  );
}
