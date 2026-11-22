// Il mondo unico: tutte le città come aree tematiche in un solo paesaggio low-poly.
// Ogni città ha il proprio bioma (stili), i propri edifici semplificati e un'etichetta;
// tra le città boschi, laghi, fiumi con ponti e una corona di montagne innevate.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AMBITI, STILI } from "@/lib/stili";
import { punteggio } from "@/lib/score";
import type { Citta, Mondo, Stile } from "@/lib/types";
import type { Vista } from "./city-scene";
import { GAP_MONDO, LayoutCitta, SlotCitta, altezzaSemplice, layoutCitta, layoutMondo, zoneCitta } from "./city-layout";
import { BUDGET, Paesaggio, Zona, creaKit, generaPaesaggio, hashSeme, mobile } from "./landscape";

export interface ScenaMondo {
  seleziona(id: string | null): void;
  volaSu(id: string): void;
  vistaMondo(): void;
  vista(): Vista;
  distruggi(): void;
}

/** Il paesaggio tra le città si estende oltre l'ultima città: la corona di monti sfuma nella nebbia. */
const CORONA = 1.8;
/** Su mobile il target del volo avanza verso la camera di questa frazione della distanza. */
const SPOSTA_MOBILE = 0.3;
/** Quota minima della camera. */
const Y_MIN_CAMERA = 2;
/** Diradamento del paesaggio locale di ogni città nella vista mondo (rispetto al budget). */
export const SCALA_LOCALE_MONDO = 0.85;
/** Elementi del paesaggio tra le città: base + per città (laghi arrotondati per eccesso, fiumi per difetto). */
export const QUANTITA_TRA = {
  catene: { base: 2, perCitta: 1 },
  laghi: { base: 1, perCitta: 0.5 },
  fiumi: { base: 1, perCitta: 0.5 },
};
/** Radura centrale lasciata libera con 0 città (sotto la chiamata ad azione). */
const RADURA_VUOTA = 18;

interface InfoCitta { c: Citta; s: SlotCitta; L: LayoutCitta; stili: Stile[]; hMax: number }
interface Item { x: number; y: number; z: number; rot: number; sx: number; sy: number; sz: number; colore: string; citta: string }

export function creaMondo(
  host: HTMLElement,
  mondo: Mondo,
  opz: { onCitta: (id: string) => void; onArrivo?: (id: string) => void; vista?: Vista; anima?: boolean },
): ScenaMondo {
  const RIDUCI = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ANIMA = !RIDUCI && opz.anima !== false;
  const MOBILE = mobile();
  const scala = MOBILE ? BUDGET.mobile : BUDGET.desktop;
  const kit = creaKit();
  const { mat, scuro } = kit;
  const cielo = STILI.citta.cielo;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(cielo);

  // --- posizioni (D2) e layout di ogni città
  const { slot, raggioMondo: R } = layoutMondo(mondo.citta, { gap: GAP_MONDO });
  const info: InfoCitta[] = mondo.citta.map((c, i) => ({ c, s: slot[i], L: layoutCitta(c), stili: c.stili.length ? c.stili : (["citta"] as Stile[]), hMax: 0 }));
  const perId: Record<string, InfoCitta> = Object.fromEntries(info.map((x) => [x.c.id, x]));

  // --- camera, luci, nebbia
  const dV = R * 1.15 + 20;
  const VISTA = { pos: new THREE.Vector3(dV * 0.62, dV * 0.9, dV), target: new THREE.Vector3(0, 0, 0) };
  const d0 = VISTA.pos.length();
  scene.fog = new THREE.Fog(cielo, d0 + R * 0.6, d0 + R * 2.4);
  const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 1, R * 8);
  const controls = new OrbitControls(camera, renderer.domElement);
  if (opz.vista) {
    camera.position.fromArray(opz.vista.pos);
    controls.target.fromArray(opz.vista.target);
  } else {
    camera.position.copy(VISTA.pos);
    controls.target.copy(VISTA.target);
  }
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minDistance = 12;
  controls.maxDistance = R * 3.2;
  controls.autoRotate = ANIMA && !opz.vista;
  controls.autoRotateSpeed = 0.25;

  scene.add(new THREE.HemisphereLight("#fff6e5", "#6b8a5a", 1.6));
  const sole = new THREE.DirectionalLight("#fff1d6", 2.2);
  sole.position.set(R * 0.6, R * 1.1, R * 0.4);
  sole.castShadow = true;
  sole.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  sole.shadow.bias = -0.0004;
  Object.assign(sole.shadow.camera, { left: -R * 1.15, right: R * 1.15, top: R * 1.15, bottom: -R * 1.15, near: 1, far: R * 4 });
  scene.add(sole);

  // --- terreno del mondo
  const prato = new THREE.Mesh(new THREE.CircleGeometry(R * 3, 96), mat(STILI.citta.terreno));
  prato.rotation.x = -Math.PI / 2; prato.receiveShadow = true; scene.add(prato);
  const piano = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const me = new THREE.Mesh(geo, m);
    me.rotation.x = -Math.PI / 2; me.position.set(x, y, z); me.receiveShadow = true;
    scene.add(me);
    return me;
  };

  // --- strade tra città vicine (ogni città verso la più vicina tra quelle già piazzate)
  const strade: Zona[] = [];
  const asfalto = mat("#8a8f95");
  info.forEach((a, i) => {
    if (i === 0) return;
    let j = 0, best = Infinity;
    for (let k = 0; k < i; k++) { const dd = Math.hypot(info[k].s.x - a.s.x, info[k].s.z - a.s.z); if (dd < best) { best = dd; j = k; } }
    const b = info[j];
    const ux = (b.s.x - a.s.x) / best, uz = (b.s.z - a.s.z) / best;
    const ax = a.s.x + ux * (a.L.estensione + 1), az = a.s.z + uz * (a.L.estensione + 1);
    const bx = b.s.x - ux * (b.L.estensione + 1), bz = b.s.z - uz * (b.L.estensione + 1);
    // niente strada se attraverserebbe il nucleo di una terza città
    if (info.some((o, k) => k !== i && k !== j && distSeg(o.s.x, o.s.z, ax, az, bx, bz) < o.L.estensione + 4)) return;
    const len = Math.hypot(bx - ax, bz - az);
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, len), asfalto);
    m.rotation.y = Math.atan2(bx - ax, bz - az);
    m.position.set((ax + bx) / 2, 0.045, (az + bz) / 2);
    m.receiveShadow = true;
    scene.add(m);
    strade.push({ tipo: "segmento", ax, az, bx, bz, larghezza: 1.8, strada: true });
  });

  // --- paesaggio locale di ogni città (bioma dei suoi stili, seme proprio relativo allo slot)
  const paesaggi: Paesaggio[] = [];
  const nuclei: Zona[] = info.map(({ s, L }): Zona => ({ tipo: "cerchio", x: s.x, z: s.z, r: L.estensione + 2 }));
  const occupateLocali: Zona[] = [];
  info.forEach(({ c, s, L, stili }, i) => {
    const p = generaPaesaggio(kit, {
      stili,
      centro: [s.x, s.z],
      rInterno: L.estensione + 2,
      rEsterno: s.raggio + GAP_MONDO / 2,
      seme: hashSeme(c.id + "|mondo"),
      zone: [...zoneCitta(L, c, s.x, s.z), ...nuclei.filter((_, k) => k !== i), ...strade],
      quantita: { strade: 0 },
      scala: scala * SCALA_LOCALE_MONDO,
      nucleo: false,
    });
    scene.add(p.gruppo);
    paesaggi.push(p);
    occupateLocali.push(...p.occupate);
  });

  // --- paesaggio tra le città (e intorno al terreno vuoto se non ci sono città)
  const n = info.length;
  const zoneTra: Zona[] = [...info.map(({ s }): Zona => ({ tipo: "cerchio", x: s.x, z: s.z, r: s.raggio + GAP_MONDO / 2 })), ...occupateLocali, ...strade];
  if (!n) zoneTra.push({ tipo: "cerchio", x: 0, z: 0, r: RADURA_VUOTA });
  const Qt = QUANTITA_TRA;
  const tra = generaPaesaggio(kit, {
    stili: ["citta"],
    centro: [0, 0],
    rInterno: 0,
    rEsterno: R * CORONA,
    seme: hashSeme(mondo.citta.map((c) => c.id).sort().join("|")),
    zone: zoneTra,
    terreno: false,
    nucleo: true,
    scala,
    quantita: {
      catene: Qt.catene.base + Math.round(n * Qt.catene.perCitta),
      laghi: Qt.laghi.base + Math.ceil(n * Qt.laghi.perCitta),
      fiumi: Qt.fiumi.base + Math.floor(n * Qt.fiumi.perCitta),
      strade: 0,
      decori: 0,
    },
  });
  scene.add(tra.gruppo);
  paesaggi.push(tra);

  // --- città: nucleo, confine nel colore dell'ambito, piazze, strade, edifici semplificati (D4)
  const bersagli: THREE.Object3D[] = [];
  const lotti: Item[] = [], corpi: Item[] = [], fasce: Item[] = [], cartelli: Item[] = [], antenne: Item[] = [];
  const tetti: Record<string, Item[]> = { piatto: [], terrazza: [], spiovente: [], cupola: [], vetro: [] };
  const matBersaglio = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  for (const x of info) {
    const { c, s, L, stili } = x;
    const base = STILI[stili[0]];
    const amb = AMBITI[c.ambito];
    piano(new THREE.CircleGeometry(L.estensione + 2, 64), mat(base.terreno), s.x, 0.008, s.z);
    piano(new THREE.RingGeometry(L.estensione + 0.6, L.estensione + 1.6, 96), mat(amb.colore), s.x, 0.03, s.z);
    for (const qq of L.quartieri) {
      const conta: Record<string, number> = {};
      qq.ps.forEach((p) => { const st = p.stile ?? stili[0]; conta[st] = (conta[st] ?? 0) + 1; });
      const sq = STILI[Object.entries(conta).sort((a, b) => b[1] - a[1])[0][0] as Stile];
      piano(new THREE.CircleGeometry(qq.rPiazza, 48), mat(sq.piazza), s.x + qq.cx, 0.03, s.z + qq.cz);
      piano(new THREE.RingGeometry(qq.rPiazza, qq.rAnello, 64), mat("#6f747a"), s.x + qq.cx, 0.02, s.z + qq.cz);
    }
    for (const z of zoneCitta(L, c)) {
      if (z.tipo !== "segmento") continue;
      const len = Math.hypot(z.bx - z.ax, z.bz - z.az);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, len), mat("#8a8f95"));
      m.rotation.y = Math.atan2(z.bx - z.ax, z.bz - z.az);
      m.position.set(s.x + (z.ax + z.bx) / 2, 0.04, s.z + (z.az + z.bz) / 2);
      m.receiveShadow = true;
      scene.add(m);
    }
    for (const p of c.progetti) {
      const pos = L.pos[p.id];
      if (!pos) continue;
      const stile: Stile = p.stile ?? stili[0];
      const def = STILI[stile];
      const defT = p.accento ? STILI[p.accento] : def;
      const attivita = p.tipo === "attivita";
      const w = attivita ? pos.wBase * 1.15 : pos.wBase;
      const px = s.x + pos.x, pz = s.z + pos.z, rot = pos.rotY;
      const h = altezzaSemplice(p);
      lotti.push({ x: px, y: 0, z: pz, rot, sx: w + 3, sy: 0.18, sz: w + 3, colore: p.livello === 0 ? scuro(def.terreno, 1.05) : def.piazza, citta: c.id });
      if (h === 0) {
        cartelli.push({ x: px, y: 1.75, z: pz, rot, sx: 1.8, sy: 1.3, sz: 0.1, colore: "#fffaf0", citta: c.id });
        x.hMax = Math.max(x.hMax, 3.4);
        continue;
      }
      corpi.push({ x: px, y: 0.18, z: pz, rot, sx: w, sy: h - 0.18, sz: w, colore: def.muro ?? p.colore, citta: c.id });
      fasce.push({ x: px, y: 0.18, z: pz, rot, sx: w + 0.08, sy: 0.4, sz: w + 0.08, colore: def.muro ? p.colore : def.bordo, citta: c.id });
      let top = h;
      if (attivita || p.livello >= 4) {
        const t = defT.tetto;
        const dims: Record<string, [number, number, number]> = {
          spiovente: [w + 0.8, 2.2, w + 0.8], vetro: [w, 1.6, w], cupola: [w, w, w], terrazza: [w + 0.5, 0.25, w + 0.5], piatto: [w + 0.4, 0.35, w + 0.4],
        };
        const [sx, sy, sz] = dims[t];
        tetti[t].push({ x: px, y: h, z: pz, rot, sx, sy, sz, colore: defT.coloreTetto, citta: c.id });
        top += t === "cupola" ? w * 0.48 : sy;
      }
      if (!attivita && p.livello >= 5) {
        antenne.push({ x: px, y: top, z: pz, rot, sx: 0.14, sy: 3.2, sz: 0.14, colore: "#c9ced3", citta: c.id });
        top += 3.2;
      }
      x.hMax = Math.max(x.hMax, top);
    }
    // bersaglio del clic: disco invisibile grande quanto la città
    const disco = piano(new THREE.CircleGeometry(L.estensione + 2, 32), matBersaglio, s.x, 0.1, s.z);
    disco.receiveShadow = false;
    disco.userData.cittaId = c.id;
    bersagli.push(disco);
  }

  // geometrie unitarie con base a y = 0
  const cubo = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const piramide = () => new THREE.CylinderGeometry(0.01, 0.72, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  const geoTetti: Record<string, () => THREE.BufferGeometry> = {
    spiovente: piramide,
    vetro: () => new THREE.CylinderGeometry(0.01, 0.68, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0),
    cupola: () => new THREE.SphereGeometry(0.48, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    terrazza: cubo,
    piatto: cubo,
  };
  const matIstanze = mat("#ffffff");
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), SU = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
  const istanze: THREE.InstancedMesh[] = [];
  const istanzia = (geo: THREE.BufferGeometry, lista: Item[], ombra: boolean, bersaglio: boolean) => {
    if (!lista.length) { geo.dispose(); return; }
    const im = new THREE.InstancedMesh(geo, matIstanze, lista.length);
    lista.forEach((it, i) => {
      im.setMatrixAt(i, M4.compose(V.set(it.x, it.y, it.z), Q.setFromAxisAngle(SU, it.rot), SC.set(it.sx, it.sy, it.sz)));
      im.setColorAt(i, C.set(it.colore));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = ombra; // D5: proiettano ombra solo gli edifici
    im.receiveShadow = true;
    im.computeBoundingSphere();
    im.userData.istanze = lista.map((it) => it.citta);
    scene.add(im);
    istanze.push(im);
    if (bersaglio) bersagli.push(im);
  };
  istanzia(cubo(), lotti, false, true);
  istanzia(cubo(), corpi, true, true);
  istanzia(cubo(), fasce, true, false);
  istanzia(cubo(), cartelli, true, false);
  istanzia(cubo(), antenne, true, false);
  for (const t of Object.keys(tetti)) istanzia(geoTetti[t](), tetti[t], true, true);

  // etichette delle città
  for (const x of info) {
    const { c, s, L } = x;
    const amb = AMBITI[c.ambito];
    const lab = kit.etichetta(c.nome, `${amb.nome} · ${c.progetti.length} edifici · ${punteggio(c).totale} punti`, amb.colore);
    // dimensione costante sullo schermo: leggibile dalla vista d'insieme e da vicino
    (lab.material as THREE.SpriteMaterial).sizeAttenuation = false;
    lab.scale.set(0.17, 0.05, 1);
    lab.center.set(0.5, 0);
    lab.position.set(s.x, x.hMax + Math.max(4, L.estensione * 0.25), s.z);
    lab.userData.cittaId = c.id;
    scene.add(lab);
    bersagli.push(lab);
  }

  // --- selezione e volo camera
  const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.045, 128), new THREE.MeshBasicMaterial({ color: "#ff6b2c", transparent: true, opacity: 0.9 }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  let volo: null | { t: number; da: { tg: THREE.Vector3; ps: THREE.Vector3 }; a: { tg: THREE.Vector3; ps: THREE.Vector3 }; fine?: () => void } = null;
  const vola = (tg: THREE.Vector3, ps: THREE.Vector3, fine?: () => void) => {
    if (RIDUCI) { controls.target.copy(tg); camera.position.copy(ps); volo = null; fine?.(); return; }
    volo = { t: 0, da: { tg: controls.target.clone(), ps: camera.position.clone() }, a: { tg, ps }, fine };
  };

  function seleziona(id: string | null) {
    const x = id ? perId[id] : undefined;
    if (!x) { ring.visible = false; return; }
    controls.autoRotate = false;
    const r = x.L.estensione + 3.5;
    ring.scale.set(r, r, r);
    ring.position.set(x.s.x, 0.12, x.s.z);
    ring.visible = true;
  }

  function volaSu(id: string) {
    const x = perId[id];
    if (!x) return;
    controls.autoRotate = false;
    const dist = x.L.estensione * 2.1 + 22 + x.hMax * 0.6;
    const dir = new THREE.Vector3(camera.position.x - x.s.x, 0, camera.position.z - x.s.z);
    if (dir.lengthSq() < 1) dir.set(0.6, 0, 1);
    dir.normalize();
    // su mobile il foglio in basso copre lo schermo: il target si sposta sul terreno verso la camera
    // (mai sotto il prato), così la città appare più in alto
    const avanti = MOBILE ? dist * SPOSTA_MOBILE : 0;
    const tg = new THREE.Vector3(x.s.x + dir.x * avanti, 1.5, x.s.z + dir.z * avanti);
    vola(tg, new THREE.Vector3(x.s.x + dir.x * dist * 0.8, 1.5 + dist * 0.72, x.s.z + dir.z * dist * 0.8), () => opz.onArrivo?.(id));
  }

  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const cittaSotto = (cx: number, cy: number): string | null => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    for (const h of ray.intersectObjects(bersagli, false)) {
      const lista = h.object.userData.istanze as string[] | undefined;
      const id = lista && h.instanceId !== undefined ? lista[h.instanceId] : (h.object.userData.cittaId as string | undefined);
      if (id) return id;
    }
    return null;
  };
  let giu: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => { giu = { x: e.clientX, y: e.clientY }; controls.autoRotate = false; };
  const onUp = (e: PointerEvent) => {
    if (!giu || Math.hypot(e.clientX - giu.x, e.clientY - giu.y) > 6) { giu = null; return; }
    giu = null;
    const id = cittaSotto(e.clientX, e.clientY);
    if (id) opz.onCitta(id);
  };
  const onMove = (e: PointerEvent) => {
    if (e.buttons || e.pointerType !== "mouse") return;
    renderer.domElement.style.cursor = cittaSotto(e.clientX, e.clientY) ? "pointer" : "";
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointermove", onMove);

  const resize = () => {
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
  let raf = 0;
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (!RIDUCI) {
      paesaggi.forEach((p) => p.aggiorna(t));
      if (ring.visible) (ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.35 * Math.sin(t * 3);
    }
    if (volo) {
      volo.t = Math.min(1, volo.t + dt / 1.1);
      const k = 1 - Math.pow(1 - volo.t, 3);
      controls.target.lerpVectors(volo.da.tg, volo.a.tg, k);
      camera.position.lerpVectors(volo.da.ps, volo.a.ps, k);
      if (volo.t >= 1) { const fine = volo.fine; volo = null; fine?.(); }
    }
    controls.update();
    if (camera.position.y < Y_MIN_CAMERA) camera.position.y = Y_MIN_CAMERA; // mai sotto il prato
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();

  return {
    seleziona,
    volaSu,
    vistaMondo() {
      ring.visible = false;
      vola(VISTA.target.clone(), VISTA.pos.clone());
    },
    vista: () => ({ pos: camera.position.toArray() as Vista["pos"], target: controls.target.toArray() as Vista["target"] }),
    distruggi() {
      cancelAnimationFrame(raf);
      volo = null;
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      controls.dispose();
      paesaggi.forEach((p) => p.dispose());
      istanze.forEach((im) => im.dispose());
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
          o.geometry.dispose();
          const lista = (Array.isArray(o.material) ? o.material : [o.material]) as (THREE.Material & { map?: THREE.Texture | null })[];
          lista.forEach((m) => { m.map?.dispose(); m.dispose(); });
        }
      });
      kit.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function distSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
