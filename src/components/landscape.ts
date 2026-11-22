// Paesaggio low-poly condiviso tra la scena della città e la scena del mondo:
// helper di disegno (Kit), RNG deterministico, boschi, catene di montagne innevate,
// laghi, fiumi con ponti, sentieri e decorazioni per stile (mare, campagna, arte, tech).
// Stile: Lambert, colori piatti, palette di STILI. Nessun Math.random e nessuna Date.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DefStile, STILI } from "@/lib/stili";
import type { Stile } from "@/lib/types";

// ---------------------------------------------------------------- RNG (D3)

export type Rng = () => number;

/** FNV-1a 32 bit, mappato in [1, 2147483646] (seme valido per Park–Miller). */
export function hashSeme(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 2147483646) + 1;
}

/** Park–Miller 16807, stessa formula usata finora in city-scene. */
export function creaRng(seme: number): Rng {
  let s = Math.floor(Math.abs(seme)) % 2147483647;
  if (s <= 0) s = 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// ---------------------------------------------------------------- zone vietate

export type Zona =
  | { tipo: "cerchio"; x: number; z: number; r: number }
  | { tipo: "rettangolo"; x: number; z: number; w: number; d: number; rot?: number }
  | { tipo: "segmento"; ax: number; az: number; bx: number; bz: number; larghezza: number; strada?: boolean };

function distSegmento(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function liberoDa(x: number, z: number, raggio: number, q: Zona): boolean {
  if (q.tipo === "cerchio") return Math.hypot(x - q.x, z - q.z) >= q.r + raggio;
  if (q.tipo === "rettangolo") {
    // stessa convenzione di Object3D.rotation.y
    const dx = x - q.x, dz = z - q.z, c = Math.cos(q.rot ?? 0), s = Math.sin(q.rot ?? 0);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lx) >= q.w / 2 + raggio || Math.abs(lz) >= q.d / 2 + raggio;
  }
  return distSegmento(x, z, q.ax, q.az, q.bx, q.bz) >= q.larghezza / 2 + raggio;
}

/** true se un cerchio (x, z, raggio) non tocca nessuna zona. */
export function libero(x: number, z: number, raggio: number, zone: Zona[]): boolean {
  for (const q of zone) if (!liberoDa(x, z, raggio, q)) return false;
  return true;
}

export function mobile(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 760;
}

// ---------------------------------------------------------------- Kit di disegno condiviso

export interface Kit {
  mat(c: string, extra?: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial;
  mesh(g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], ombra?: boolean): THREE.Mesh;
  box(w: number, h: number, d: number, m: THREE.Material | THREE.Material[]): THREE.Mesh;
  tex(c: HTMLCanvasElement): THREE.CanvasTexture;
  scuro(c: string, k?: number): string;
  etichetta(testo: string, sotto: string, colore: string): THREE.Sprite;
  albero(tipo: DefStile["albero"], x: number, z: number, s?: number): THREE.Group;
  dispose(): void;
}

/** Colori di tronchi e chiome: gli stessi per l'albero singolo e per i boschi istanziati. */
const COLORI_ALBERO: Record<DefStile["albero"], { tronco: string; chioma: string }> = {
  palma: { tronco: "#9b7653", chioma: "#3f9a4a" },
  pino: { tronco: "#6b4a2c", chioma: "#2f6b45" },
  tondo: { tronco: "#7a5634", chioma: "#5a9a4c" },
  cono: { tronco: "#7a5634", chioma: "#4f8f4a" },
};

export function creaKit(): Kit {
  const mats: Record<string, THREE.MeshLambertMaterial> = {};
  const mat = (c: string, extra: THREE.MeshLambertMaterialParameters = {}) => {
    const k = c + JSON.stringify(extra);
    return (mats[k] ??= new THREE.MeshLambertMaterial({ color: c, ...extra }));
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], ombra = true) => {
    const x = new THREE.Mesh(g, m);
    x.castShadow = ombra;
    x.receiveShadow = true;
    return x;
  };
  const box = (w: number, h: number, dd: number, m: THREE.Material | THREE.Material[]) => mesh(new THREE.BoxGeometry(w, h, dd), m);
  const tex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const scuro = (c: string, k = 0.8) => "#" + new THREE.Color(c).multiplyScalar(k).getHexString();

  function etichetta(testo: string, sotto: string, colore: string) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 150;
    const x = c.getContext("2d")!;
    x.font = "700 46px Bricolage Grotesque, Segoe UI, sans-serif";
    const w = Math.min(500, Math.max(x.measureText(testo).width, 220) + 48);
    const bx = (512 - w) / 2;
    x.fillStyle = "rgba(255,252,246,0.95)";
    x.beginPath(); x.roundRect(bx, 8, w, 120, 22); x.fill();
    x.fillStyle = colore; x.fillRect(bx, 8, 10, 120);
    x.fillStyle = "#1f2a33"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(testo, 261, 52, w - 40);
    x.font = "600 30px Figtree, Segoe UI, sans-serif"; x.fillStyle = "#5d6b77";
    x.fillText(sotto, 261, 100, w - 40);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), depthTest: false, transparent: true }));
    s.scale.set(9, 2.64, 1);
    s.renderOrder = 10;
    return s;
  }

  function albero(tipo: DefStile["albero"], x: number, z: number, s = 1) {
    const g = new THREE.Group();
    const col = COLORI_ALBERO[tipo];
    if (tipo === "palma") {
      const tronco = mesh(new THREE.CylinderGeometry(0.1 * s, 0.16 * s, 2.6 * s, 6), mat(col.tronco));
      tronco.position.y = 1.3 * s; tronco.rotation.z = 0.12; g.add(tronco);
      for (let i = 0; i < 5; i++) {
        const f = box(1.6 * s, 0.06, 0.4 * s, mat(col.chioma));
        f.position.set(Math.cos((i / 5) * Math.PI * 2) * 0.7 * s + 0.15, 2.6 * s, Math.sin((i / 5) * Math.PI * 2) * 0.7 * s);
        f.rotation.y = -(i / 5) * Math.PI * 2; f.rotation.z = -0.35; g.add(f);
      }
    } else if (tipo === "pino") {
      const tronco = box(0.22 * s, 0.8 * s, 0.22 * s, mat(col.tronco)); tronco.position.y = 0.4 * s; g.add(tronco);
      for (let i = 0; i < 3; i++) {
        const c = mesh(new THREE.ConeGeometry((1 - i * 0.25) * s, 1.3 * s, 7), mat(col.chioma));
        c.position.y = (1.1 + i * 0.7) * s; g.add(c);
      }
    } else if (tipo === "tondo") {
      const tronco = box(0.22 * s, 1 * s, 0.22 * s, mat(col.tronco)); tronco.position.y = 0.5 * s; g.add(tronco);
      const chioma = mesh(new THREE.SphereGeometry(0.85 * s, 8, 6), mat(col.chioma)); chioma.position.y = 1.6 * s; g.add(chioma);
    } else {
      const tronco = box(0.25 * s, 1 * s, 0.25 * s, mat(col.tronco)); tronco.position.y = 0.5 * s; g.add(tronco);
      const chioma = mesh(new THREE.ConeGeometry(0.9 * s, 2 * s, 7), mat(col.chioma)); chioma.position.y = 1.9 * s; g.add(chioma);
    }
    g.position.set(x, 0, z);
    return g;
  }

  return {
    mat, mesh, box, tex, scuro, etichetta, albero,
    dispose() { Object.values(mats).forEach((m) => m.dispose()); },
  };
}

// ---------------------------------------------------------------- parametri nominati

export const COLORI_PAESAGGIO = {
  acqua: "#3d9bd6",
  acquaEmissive: "#0a2a40",
  fiume: "#4aa6dd",
  roccia: "#7c8a8f",
  neve: "#f5f7fa",
  sabbia: "#f1e2b3",
  riva: "#d9cf9f",
  sentiero: "#cdb98e",
  ponte: "#9b7653",
  pietra: "#b9b3a6",
  scafo: "#ffffff",
  vele: ["#ff6b2c", "#f7f4ec"],
  campi: ["#d9c25a", "#8cb85c", "#c79a4a", "#a5c26b"],
  balla: "#e0c15a",
  piedistallo: "#efe9dc",
  sculture: ["#ff6b2c", "#56a3e8", "#f2b632", "#d65db1", "#3fb98a"],
  torre: "#2c3a55",
  luceTech: "#58e1ff",
} as const;

export interface Quantita {
  boschi: number; alberiPerBosco: [number, number]; raggioBosco: [number, number]; alberiSparsi: number;
  catene: number; montiPerCatena: [number, number]; laghi: number; fiumi: number; decori: number;
  /** sentieri radiali dalla città verso l'esterno (attraversano i fiumi con ponti) */
  strade: number;
  /** colline basse nel colore del terreno */
  colline: number;
  /** massi sparsi, soprattutto ai piedi dei monti */
  rocce: number;
}

/** Valori per una città media (anello di paesaggio di riferimento: AREA_RIF). */
export const QUANTITA_BASE: Quantita = {
  boschi: 8, alberiPerBosco: [14, 26], raggioBosco: [4.5, 8], alberiSparsi: 28,
  catene: 1, montiPerCatena: [4, 7], laghi: 1, fiumi: 1, decori: 0, strade: 2, colline: 6, rocce: 14,
};

/** Variazioni per stile (bioma). */
export const PROFILI: Record<Stile, Partial<Quantita>> = {
  citta: {},
  tech: { decori: 8 },
  mare: { boschi: 5, alberiPerBosco: [6, 12], montiPerCatena: [3, 5], laghi: 0, decori: 6, colline: 3 },
  montagna: { boschi: 10, alberiPerBosco: [18, 32], alberiSparsi: 34, catene: 3, montiPerCatena: [5, 8], laghi: 1, fiumi: 2, rocce: 26 },
  campagna: { boschi: 6, alberiPerBosco: [10, 18], laghi: 2, decori: 9, colline: 10 },
  arte: { boschi: 7, decori: 9 },
};

/** scala desktop/mobile e tetti massimi per un singolo paesaggio. */
export const BUDGET = { desktop: 1, mobile: 0.55, maxAlberi: 2200, maxMonti: 48 };

/** Area dell'anello di paesaggio a cui corrispondono le QUANTITA_BASE. */
const AREA_RIF = 9800;
/** Candidati fissi per gli elementi che devono trovare posto (monti, laghi, sentieri). */
const CANDIDATI = 6;
/** Deviazioni fisse di un fiume davanti a un ostacolo (nessun consumo di rnd). */
const DEVIAZIONI = [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5];
const PASSO_FIUME = 2.4;
const VARIANTI_MONTE = 3;

export interface Lago { x: number; z: number; r: number; lobi: number; fase: number }
export interface Fiume { punti: [number, number][]; larghezza: number; ponti: [number, number, number][] }

export interface OpzioniPaesaggio {
  stili: Stile[]; centro: [number, number]; rInterno: number; rEsterno: number;
  seme: number; zone: Zona[]; quantita?: Partial<Quantita>; scala?: number;
  /** default true: anelli di terreno per stile */
  terreno?: boolean;
  /** default true: almeno un lago, un fiume e una catena (se trovano posto) */
  nucleo?: boolean;
}

export interface Paesaggio { gruppo: THREE.Group; occupate: Zona[]; aggiorna(t: number): void; dispose(): void }

// ---------------------------------------------------------------- geometrie unitarie

type TipoAlbero = DefStile["albero"];

function trasforma(g: THREE.BufferGeometry, px: number, py: number, pz: number, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Object3D();
  o.position.set(px, py, pz);
  o.rotation.set(rx, ry, rz);
  o.updateMatrix();
  g.applyMatrix4(o.matrix);
  return g;
}

function unisci(parti: THREE.BufferGeometry[]) {
  const g = mergeGeometries(parti);
  parti.forEach((p) => p.dispose());
  return g;
}

/** Tronco e chioma di un albero con s = 1: stesse misure di Kit.albero. */
function geoAlbero(tipo: TipoAlbero): { tronco: THREE.BufferGeometry; chioma: THREE.BufferGeometry } {
  if (tipo === "palma") {
    const tronco = trasforma(new THREE.CylinderGeometry(0.1, 0.16, 2.6, 6), 0, 1.3, 0, 0, 0, 0.12);
    const foglie: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      foglie.push(trasforma(new THREE.BoxGeometry(1.6, 0.06, 0.4), Math.cos(a) * 0.7 + 0.15, 2.6, Math.sin(a) * 0.7, 0, -a, -0.35));
    }
    return { tronco, chioma: unisci(foglie) };
  }
  if (tipo === "pino") {
    const coni: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) coni.push(trasforma(new THREE.ConeGeometry(1 - i * 0.25, 1.3, 7), 0, 1.1 + i * 0.7, 0));
    return { tronco: trasforma(new THREE.BoxGeometry(0.22, 0.8, 0.22), 0, 0.4, 0), chioma: unisci(coni) };
  }
  if (tipo === "tondo") {
    return { tronco: trasforma(new THREE.BoxGeometry(0.22, 1, 0.22), 0, 0.5, 0), chioma: trasforma(new THREE.SphereGeometry(0.85, 8, 6), 0, 1.6, 0) };
  }
  return { tronco: trasforma(new THREE.BoxGeometry(0.25, 1, 0.25), 0, 0.5, 0), chioma: trasforma(new THREE.ConeGeometry(0.9, 2, 7), 0, 1.9, 0) };
}

/**
 * Monte unitario (raggio 1, altezza 1, base a y = 0) con profilo irregolare deterministico,
 * e la sua calotta di neve: la stessa forma scalata verso la cima, quindi aderisce alle facce.
 */
function geoMonte(v: number): { roccia: THREE.BufferGeometry; neve: THREE.BufferGeometry } {
  const roccia = new THREE.ConeGeometry(1, 1, 7, 1);
  roccia.translate(0, 0.5, 0);
  const ph = v * 2.1 + 0.7;
  const ax = Math.sin(ph * 3.1) * 0.08, az = Math.cos(ph * 1.7) * 0.08;
  const p = roccia.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y > 0.99) { p.setXYZ(i, x + ax, y, z + az); continue; }
    const th = Math.atan2(z, x);
    const f = 1 + 0.14 * Math.sin(3 * th + ph) + 0.07 * Math.sin(5 * th + ph * 2.3);
    p.setXYZ(i, x * f, y, z * f);
  }
  roccia.computeVertexNormals();
  const neve = roccia.clone();
  const q = neve.attributes.position as THREE.BufferAttribute;
  const S = 0.4, ALLARGA = 1.05;
  for (let i = 0; i < q.count; i++) {
    const x = ax + (q.getX(i) - ax) * S * ALLARGA;
    const z = az + (q.getZ(i) - az) * S * ALLARGA;
    const y = 1 + (q.getY(i) - 1) * S;
    q.setXYZ(i, x, y, z);
  }
  neve.computeVertexNormals();
  return { roccia, neve };
}

// ---------------------------------------------------------------- generatore

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const DUE_PI = Math.PI * 2;

interface Ist { x: number; y: number; z: number; rot: number; sx: number; sy: number; sz: number; c?: THREE.Color }
interface Settore { stile: Stile; def: DefStile; a0: number; da: number; q: Quantita; mare: Mare | null }
interface Mare { a0: number; a1: number; r0: number }
interface Monte { x: number; z: number; rb: number; h: number; rot: number; v: number; s: number; zona: Zona }

function intersezione(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): [number, number] | null {
  const r1x = bx - ax, r1z = bz - az, r2x = dx - cx, r2z = dz - cz;
  const den = r1x * r2z - r1z * r2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * r2z - (cz - az) * r2x) / den;
  const u = ((cx - ax) * r1z - (cz - az) * r1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [ax + t * r1x, az + t * r1z] : null;
}

export function generaPaesaggio(kit: Kit, o: OpzioniPaesaggio): Paesaggio {
  const rnd = creaRng(o.seme);
  const [cx, cz] = o.centro;
  const rI = o.rInterno, rE = o.rEsterno, band = Math.max(4, rE - rI);
  const scala = o.scala ?? 1;
  const stili: Stile[] = o.stili.length ? o.stili : ["citta"];
  const nS = stili.length, fS = 1 / Math.sqrt(nS);
  const dim = clamp(band / 40, 0.45, 1.5);
  const k = clamp((Math.PI * (rE * rE - rI * rI)) / AREA_RIF, 0.35, 3.5);
  const kM = clamp(Math.sqrt(k), 1, 2);
  const capAlberi = Math.round(BUDGET.maxAlberi * scala), capMonti = Math.round(BUDGET.maxMonti * scala);
  // le estrazioni rnd usano sempre le quantità piene (desktop): scala dirada dopo, con una regola fissa
  // per indice, così su mobile si vede lo stesso paesaggio con meno elementi
  const tieni = (i: number, f = scala) => f >= 1 || ((i + 1) * 0.6180339887) % 1 < f;
  const nucleo = o.nucleo !== false;
  const COL = COLORI_PAESAGGIO;

  const gruppo = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const propri: THREE.Material[] = [];
  const istanze: THREE.InstancedMesh[] = [];
  const onde: THREE.Object3D[] = [], luci: THREE.Object3D[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T): T => { geos.push(x); return x; };
  const solido = (geo: THREE.BufferGeometry, m: THREE.Material) => {
    const me = new THREE.Mesh(g(geo), m);
    me.castShadow = false; // D5: ombre solo dagli edifici
    me.receiveShadow = true;
    return me;
  };
  const piatto = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const me = solido(geo, m);
    me.rotation.x = -Math.PI / 2;
    me.position.set(x, y, z);
    gruppo.add(me);
    return me;
  };
  const boxL = (w: number, h: number, d: number, m: THREE.Material) => solido(new THREE.BoxGeometry(w, h, d), m);

  // zone: quelle ricevute + quelle occupate da questo paesaggio (restituite al chiamante)
  const tutte: Zona[] = o.zone.slice();
  const occupate: Zona[] = [];
  const occupa = (q: Zona) => { occupate.push(q); tutte.push(q); return q; };

  const pt = (a: number, r: number): [number, number] => [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
  const raggioDi = (x: number, z: number) => Math.hypot(x - cx, z - cz);
  const angoloDi = (x: number, z: number) => Math.atan2(z - cz, x - cx);

  // --- settori per stile (C3.2: città fusa = paesaggi affiancati)
  const mari: Mare[] = [];
  const settori: Settore[] = stili.map((stile, i) => {
    const a0 = (i / nS) * DUE_PI, da = DUE_PI / nS;
    const q: Quantita = { ...QUANTITA_BASE, ...PROFILI[stile], ...(o.quantita ?? {}) };
    let mare: Mare | null = null;
    if (stile === "mare") {
      const m = nS === 1 ? 0.16 : 0.08; // fianchi di terra ai lati del golfo
      mare = { a0: a0 + da * m, a1: a0 + da * (1 - m), r0: rI + Math.max(7, band * 0.32) };
      mari.push(mare);
    }
    return { stile, def: STILI[stile], a0, da, q, mare };
  });
  const totale = (f: (q: Quantita) => number) => settori.reduce((n, s) => n + f(s.q), 0);
  // nucleo: se nessun profilo prevede un elemento, il primo settore ne riceve uno
  const extra = (campo: "catene" | "laghi" | "fiumi") => (nucleo && totale((q) => q[campo]) === 0 ? 1 : 0);
  const extraCatene = extra("catene"), extraLaghi = extra("laghi"), extraFiumi = extra("fiumi");

  const inMare = (x: number, z: number, m = 0) => {
    if (!mari.length) return false;
    const r = raggioDi(x, z);
    const a = angoloDi(x, z);
    for (const s of mari) {
      if (r + m < s.r0) continue;
      const d = (((a - s.a0) % DUE_PI) + DUE_PI) % DUE_PI, span = s.a1 - s.a0, ma = m / Math.max(r, 1);
      if (d <= span + ma || d >= DUE_PI - ma) return true;
    }
    return false;
  };
  const liberoTerra = (x: number, z: number, raggio: number) => {
    const r = raggioDi(x, z);
    return r - raggio >= rI + 0.5 && r <= rE && !inMare(x, z, raggio) && libero(x, z, raggio, tutte);
  };
  const angolo = (S: Settore, u: number) => S.a0 + 0.06 + u * (S.da - 0.12);
  /** angolo sulla terraferma: nei settori di mare, sui fianchi del golfo */
  const angoloTerra = (S: Settore, u: number) => {
    if (!S.mare) return angolo(S, u);
    const l1 = S.mare.a0 - S.a0, l2 = S.a0 + S.da - S.mare.a1;
    return u < 0.5 ? S.a0 + 0.03 + u * 2 * Math.max(0, l1 - 0.06) : S.mare.a1 + 0.03 + (u - 0.5) * 2 * Math.max(0, l2 - 0.06);
  };

  // --- terreno e mare (RingGeometry: theta nel piano XY, -theta dopo la rotazione su XZ)
  const acqua = kit.mat(COL.acqua, { emissive: COL.acquaEmissive });
  for (const S of settori) {
    if (o.terreno !== false) piatto(new THREE.RingGeometry(rI, rE, 64, 1, -(S.a0 + S.da), S.da), kit.mat(S.def.terreno), cx, 0.01, cz);
    if (S.mare) {
      const span = S.mare.a1 - S.mare.a0;
      piatto(new THREE.RingGeometry(rI + 3, S.mare.r0 + 1.2, 64, 1, -(S.mare.a1 + 0.05), span + 0.1), kit.mat(COL.sabbia), cx, 0.02, cz);
      piatto(new THREE.RingGeometry(S.mare.r0, rE, 64, 1, -S.mare.a1, span), acqua, cx, 0.04, cz);
    }
  }

  // --- catene di montagne innevate
  const monti: Monte[] = [];
  settori.forEach((S, si) => {
    const nCat = Math.round(S.q.catene * kM) + (si === 0 ? extraCatene : 0);
    for (let c = 0; c < nCat; c++) {
      const cand = Array.from({ length: CANDIDATI }, () => ({ u: rnd(), v: rnd() }));
      const [nMin, nMax] = S.q.montiPerCatena;
      const n = Math.min(nMax, Math.floor(lerp(nMin, nMax + 1, rnd())));
      const hMax = (S.stile === "montagna" ? 22 + rnd() * 16 : 15 + rnd() * 12) * dim;
      const rb0 = (6.5 + rnd() * 4.5) * dim;
      const jit = Array.from({ length: nMax }, () => [rnd(), rnd(), rnd(), rnd()]);
      for (const { u, v } of cand) {
        const a = angoloTerra(S, u);
        const r = rI + band * (0.58 + v * 0.3);
        const presi: Monte[] = [];
        for (let j = 0; j < n; j++) {
          const off = j - (n - 1) / 2;
          const [j0, j1, j2, j3] = jit[j];
          const h = hMax * (1 - (Math.abs(off) / n) * 0.9) * (0.8 + j1 * 0.4);
          const rb = rb0 * (0.75 + j2 * 0.45) * (0.55 + (0.45 * h) / hMax);
          const [x, z] = pt(a + (off * rb0 * 1.25) / r, r + (j0 - 0.5) * rb0 * 0.9);
          const rr = raggioDi(x, z);
          if (rr - rb * 0.9 < rI + 2 || rr + rb * 0.6 > rE || inMare(x, z, rb * 0.8) || !libero(x, z, rb * 0.8, tutte)) continue;
          presi.push({ x, z, rb, h, rot: j3 * DUE_PI, v: Math.floor(j3 * VARIANTI_MONTE) % VARIANTI_MONTE, s: si, zona: { tipo: "cerchio", x, z, r: rb * 0.85 } });
        }
        if (presi.length < Math.ceil(n / 2)) continue;
        for (const m of presi) {
          if (monti.length >= capMonti) break;
          occupa(m.zona);
          monti.push(m);
        }
        break;
      }
    }
  });

  // --- laghi
  const laghi: (Lago & { zona: Zona })[] = [];
  const formaLago = (l: Lago, f: number) => {
    const sh = new THREE.Shape();
    const N = 40;
    for (let j = 0; j <= N; j++) {
      const th = (j / N) * DUE_PI;
      const rr = l.r * f * (1 + 0.16 * Math.sin(l.lobi * th + l.fase) + 0.07 * Math.sin((l.lobi + 3) * th + l.fase * 2));
      if (j === 0) sh.moveTo(Math.cos(th) * rr, Math.sin(th) * rr);
      else sh.lineTo(Math.cos(th) * rr, Math.sin(th) * rr);
    }
    return sh;
  };
  settori.forEach((S, si) => {
    const nL = Math.round(S.q.laghi * kM) + (si === 0 ? extraLaghi : 0);
    for (let l = 0; l < nL; l++) {
      const cand = Array.from({ length: CANDIDATI }, () => ({ u: rnd(), v: rnd() }));
      const rr = rnd(), lobi = 3 + Math.floor(rnd() * 3), fase = rnd() * DUE_PI;
      const r = (S.stile === "montagna" ? 3.5 + rr * 3.5 : 4 + rr * 5) * dim;
      for (const { u, v } of cand) {
        const rad = rI + band * (0.22 + v * 0.5);
        const [x, z] = pt(angoloTerra(S, u), rad);
        if (rad - r * 1.45 < rI + 2.5 || rad + r * 1.45 > rE || inMare(x, z, r * 1.5) || !libero(x, z, r * 1.5, tutte)) continue;
        const lago = { x, z, r, lobi, fase, zona: occupa({ tipo: "cerchio", x, z, r: r * 1.45 }) };
        laghi.push(lago);
        piatto(new THREE.ShapeGeometry(formaLago(lago, 1.14)), kit.mat(S.stile === "mare" ? COL.sabbia : COL.riva), x, 0.03, z);
        piatto(new THREE.ShapeGeometry(formaLago(lago, 1)), acqua, x, 0.05, z);
        break;
      }
    }
  });

  // --- sentieri radiali dalla città (i fiumi li scavalcano con un ponte)
  const matSentiero = kit.mat(COL.sentiero);
  if (rI > 0) settori.forEach((S) => {
    const nR = Math.round(S.q.strade * fS);
    for (let s = 0; s < nR; s++) {
      const cand = Array.from({ length: CANDIDATI }, () => rnd());
      for (const u of cand) {
        const a = angoloTerra(S, u);
        const r0 = rI - 3;
        let r1 = r0;
        for (let r = r0 + 2; r <= rE; r += 2) {
          const [x, z] = pt(a, r);
          if (inMare(x, z, 1) || !libero(x, z, 1.2, tutte.filter((q) => !(q.tipo === "segmento" && q.strada)))) break;
          r1 = r;
        }
        if (r1 - r0 < band * 0.45) continue;
        const [ax, az] = pt(a, r0), [bx, bz] = pt(a, r1);
        const len = Math.hypot(bx - ax, bz - az);
        const m = boxL(1.5, 0.03, len, matSentiero);
        m.rotation.y = Math.atan2(bx - ax, bz - az);
        m.position.set((ax + bx) / 2, 0.035, (az + bz) / 2);
        gruppo.add(m);
        occupa({ tipo: "segmento", ax, az, bx, bz, larghezza: 1.5, strada: true });
        break;
      }
    }
  });

  // --- fiumi: da un monte al lago più vicino (o al mare, o al bordo); i secondi escono dai laghi
  const fiumi: Fiume[] = [];
  const matFiume = kit.mat(COL.fiume, { emissive: COL.acquaEmissive });
  const legno = kit.mat(COL.ponte), pietra = kit.mat(COL.pietra);
  const liberoFiume = (x: number, z: number, raggio: number, escl: Zona[]) => {
    if (raggioDi(x, z) - raggio < rI + 1) return false;
    for (const q of tutte) {
      if ((q.tipo === "segmento" && q.strada) || escl.includes(q)) continue;
      if (!liberoDa(x, z, raggio, q)) return false;
    }
    return true;
  };
  type Meta = { x: number; z: number; tipo: "lago" | "mare" | "bordo"; r: number };
  const traccia = (ax: number, az: number, meta: Meta, w: number, fase: number, amp: number, escl: Zona[]): [number, number][] => {
    const P: [number, number][] = [[ax, az]];
    let x = ax, z = az;
    for (let i = 0; i < 220; i++) {
      const d = Math.hypot(meta.x - x, meta.z - z);
      if (meta.tipo === "lago" && d <= meta.r + PASSO_FIUME) {
        P.push([meta.x + ((x - meta.x) / d) * meta.r * 0.6, meta.z + ((z - meta.z) / d) * meta.r * 0.6]);
        return P;
      }
      if (meta.tipo === "mare" && inMare(x, z, -1.5)) return P;
      if (meta.tipo === "bordo" && raggioDi(x, z) >= rE - 1) return P;
      const base = Math.atan2(meta.z - z, meta.x - x) + Math.sin(i * 0.5 + fase) * amp;
      let mosso = false;
      for (const off of DEVIAZIONI) {
        const nx = x + Math.cos(base + off) * PASSO_FIUME, nz = z + Math.sin(base + off) * PASSO_FIUME;
        const fuori = meta.tipo === "bordo" && raggioDi(nx, nz) > rE - 1;
        if (fuori || liberoFiume(nx, nz, w * 0.5 + 0.6, escl)) { x = nx; z = nz; mosso = true; break; }
      }
      if (!mosso) return [];
      P.push([x, z]);
    }
    return [];
  };
  const ponte = (x: number, z: number, rot: number, len: number, larg: number) => {
    const gp = new THREE.Group();
    const piano = boxL(larg, 0.22, len, legno); piano.position.y = 0.34; gp.add(piano);
    for (const sx of [-1, 1]) { const b = boxL(0.12, 0.3, len, legno); b.position.set(sx * (larg / 2 - 0.06), 0.6, 0); gp.add(b); }
    for (const sz of [-1, 1]) { const sp = boxL(larg + 0.3, 0.5, 0.7, pietra); sp.position.set(0, 0.25, (sz * len) / 2); gp.add(sp); }
    gp.position.set(x, 0, z); gp.rotation.y = rot;
    gruppo.add(gp);
  };
  const nastro = (P: [number, number][], w0: number, f: Fiume) => {
    const curva = new THREE.CatmullRomCurve3(P.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const n = Math.max(12, P.length * 3);
    const sp = curva.getSpacedPoints(n);
    const pos: number[] = [], nor: number[] = [], idx: number[] = [], larg: number[] = [];
    const Y = 0.06;
    for (let i = 0; i <= n; i++) {
      const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n, i + 1)];
      let tx = b.x - a.x, tz = b.z - a.z;
      const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const w = w0 * (0.55 + (0.9 * i) / n);
      larg.push(w);
      pos.push(sp[i].x - (tz * w) / 2, Y, sp[i].z + (tx * w) / 2, sp[i].x + (tz * w) / 2, Y, sp[i].z - (tx * w) / 2);
      nor.push(0, 1, 0, 0, 1, 0);
      if (i < n) { const q = i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
    gruppo.add(solido(geo, matFiume));
    // ponti dove il fiume incrocia una strada
    const strade = tutte.filter((q): q is Extract<Zona, { tipo: "segmento" }> => q.tipo === "segmento" && !!q.strada);
    for (const s of strade) for (let i = 0; i < n; i++) {
      const hit = intersezione(sp[i].x, sp[i].z, sp[i + 1].x, sp[i + 1].z, s.ax, s.az, s.bx, s.bz);
      if (!hit) continue;
      const rot = Math.atan2(s.bx - s.ax, s.bz - s.az);
      ponte(hit[0], hit[1], rot, larg[i] + 2.4, Math.min(s.larghezza, 2.4) + 0.6);
      f.ponti.push([hit[0], hit[1], rot]);
      break;
    }
    for (let i = 1; i < P.length; i++) occupa({ tipo: "segmento", ax: P[i - 1][0], az: P[i - 1][1], bx: P[i][0], bz: P[i][1], larghezza: w0 * 1.45 + 1 });
  };
  settori.forEach((S, si) => {
    const nF = S.q.fiumi + (si === 0 ? extraFiumi : 0);
    for (let f = 0; f < nF; f++) {
      const u = rnd(), u2 = rnd(), fase = rnd() * DUE_PI, amp = 0.25 + rnd() * 0.3;
      const w0 = (1.6 + rnd() * 0.8) * clamp(dim, 0.7, 1.4);
      const lagoVicino = (x: number, z: number) => {
        let best: (typeof laghi)[number] | null = null, bd = band * 1.6;
        for (const l of laghi) { const d = Math.hypot(l.x - x, l.z - z); if (d < bd) { bd = d; best = l; } }
        return best;
      };
      let sx: number, sz: number, meta: Meta;
      const escl: Zona[] = [];
      if (f % 2 === 1 && laghi.length) {
        // emissario: dal lago verso il bordo
        const l = laghi[Math.floor(u * laghi.length)];
        const a = angoloDi(l.x, l.z) + (u2 - 0.5) * 0.6;
        sx = l.x + Math.cos(a) * l.r * 0.6; sz = l.z + Math.sin(a) * l.r * 0.6;
        const [mx, mz] = pt(a, rE + 3);
        meta = { x: mx, z: mz, tipo: "bordo", r: 0 };
        escl.push(l.zona);
      } else {
        const montiS = monti.filter((m) => m.s === si);
        const sorg = montiS.length ? montiS[Math.floor(u * montiS.length)] : null;
        const [px, pz] = sorg ? [sorg.x, sorg.z] : pt(angoloTerra(S, u), rI + band * 0.85);
        const l = lagoVicino(px, pz);
        if (l) { meta = { x: l.x, z: l.z, tipo: "lago", r: l.r }; escl.push(l.zona); }
        else if (S.mare) { const [mx, mz] = pt((S.mare.a0 + S.mare.a1) / 2, S.mare.r0 + 4); meta = { x: mx, z: mz, tipo: "mare", r: 0 }; }
        else { const [mx, mz] = pt(angoloDi(px, pz) + 0.5, rE + 3); meta = { x: mx, z: mz, tipo: "bordo", r: 0 }; }
        if (sorg) for (const m of monti) if (Math.hypot(m.x - sorg.x, m.z - sorg.z) < sorg.rb * 2.5) escl.push(m.zona);
        const dir = Math.atan2(meta.z - pz, meta.x - px);
        const piede = sorg ? sorg.rb * 0.55 : 0;
        sx = px + Math.cos(dir) * piede; sz = pz + Math.sin(dir) * piede;
      }
      const P = traccia(sx, sz, meta, w0, fase, amp, escl);
      if (P.length < 4) continue;
      const fiume: Fiume = { punti: P, larghezza: w0, ponti: [] };
      nastro(P, w0, fiume);
      fiumi.push(fiume);
    }
  });

  // --- strade ricevute (es. tra città nel mondo) che attraversano il golfo: pontile lungo il tratto in acqua
  if (mari.length) {
    const PASSO = 1;
    for (const s of o.zone) {
      if (s.tipo !== "segmento" || !s.strada) continue;
      const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
      if (len < PASSO) continue;
      const rot = Math.atan2(s.bx - s.ax, s.bz - s.az);
      let inizio = -1;
      for (let d = 0; d <= len + PASSO; d += PASSO) {
        const t = Math.min(1, d / len);
        const acquaQui = d <= len && inMare(s.ax + (s.bx - s.ax) * t, s.az + (s.bz - s.az) * t, 0);
        if (acquaQui && inizio < 0) inizio = d;
        if (!acquaQui && inizio >= 0) {
          const t0 = Math.max(0, inizio - 1.5) / len, t1 = Math.min(len, d + 1.5) / len, tm = (t0 + t1) / 2;
          ponte(s.ax + (s.bx - s.ax) * tm, s.az + (s.bz - s.az) * tm, rot, (t1 - t0) * len, Math.min(s.larghezza, 2.4) + 0.6);
          inizio = -1;
        }
      }
    }
  }

  // --- colline basse e massi
  const colline: Ist[] = [], rocce: Ist[] = [];
  settori.forEach((S, si) => {
    const nC = Math.round(S.q.colline * k * fS);
    for (let c = 0; c < nC; c++) {
      const u = rnd(), v = rnd(), s = rnd(), hy = rnd(), ti = rnd();
      if (!tieni(c)) continue;
      const rad = rI + 4 + band * 0.9 * (rI > 0 ? v : Math.sqrt(v));
      const [x, z] = pt(angoloTerra(S, u), rad);
      const sz = (3 + s * 4) * dim;
      if (!liberoTerra(x, z, sz * 0.9)) continue;
      occupa({ tipo: "cerchio", x, z, r: sz * 0.85 });
      colline.push({ x, y: 0, z, rot: u * DUE_PI, sx: sz, sy: sz * (0.28 + hy * 0.2), sz, c: new THREE.Color(kit.scuro(S.def.terreno, 0.88 + ti * 0.08)) });
    }
    const montiS = monti.filter((m) => m.s === si);
    const nR = Math.round(S.q.rocce * k * fS);
    for (let r = 0; r < nR; r++) {
      const u = rnd(), a = rnd() * DUE_PI, d = rnd(), s = rnd(), rot = rnd() * DUE_PI;
      if (!tieni(r)) continue;
      let x: number, z: number;
      if (montiS.length) { const m = montiS[Math.floor(u * montiS.length)]; x = m.x + Math.cos(a) * m.rb * (0.95 + d * 0.6); z = m.z + Math.sin(a) * m.rb * (0.95 + d * 0.6); }
      else [x, z] = pt(angoloTerra(S, u), rI + 3 + band * 0.9 * d);
      const sz = (0.5 + s * 1.1) * clamp(dim, 0.7, 1.3);
      if (!liberoTerra(x, z, sz)) continue;
      rocce.push({ x, y: 0, z, rot, sx: sz, sy: sz * 0.75, sz: sz * (0.8 + d * 0.4), c: new THREE.Color().setScalar(0.85 + s * 0.2) });
    }
  });

  // --- decorazioni per stile (prima degli alberi, così i boschi le evitano)
  const alberi: Record<TipoAlbero, Ist[]> = { cono: [], palma: [], pino: [], tondo: [] };
  let nAlberi = 0;
  const pianta = (tipo: TipoAlbero, x: number, z: number, s: number, rot: number, tinta: number, controlla = true) => {
    if (nAlberi >= capAlberi || (controlla && !liberoTerra(x, z, 0.75 * s))) return;
    alberi[tipo].push({ x, y: 0, z, rot, sx: s, sy: s, sz: s, c: new THREE.Color().setScalar(tinta) });
    nAlberi++;
  };
  let geoSculture: THREE.BufferGeometry[] | null = null;
  let matLuce: THREE.MeshBasicMaterial | null = null;
  for (const S of settori) {
    const nD = S.q.decori > 0 ? Math.max(1, Math.round(S.q.decori * Math.sqrt(k) * fS)) : 0;
    if (S.stile === "mare" && S.mare) {
      const M = S.mare;
      for (let b = 0; b < nD; b++) {
        const u = rnd(), v = rnd(), rot = rnd() * 6;
        if (!tieni(b)) continue;
        const [x, z] = pt(lerp(M.a0 + 0.05, M.a1 - 0.05, u), lerp(M.r0 + 4, rE - 3, v));
        if (!inMare(x, z, 2) || !libero(x, z, 1.5, tutte)) continue;
        const barca = new THREE.Group();
        const scafo = boxL(2.2, 0.5, 0.8, kit.mat(COL.scafo)); scafo.position.y = 0.3; barca.add(scafo);
        const vela = solido(new THREE.ConeGeometry(0.7, 2.2, 3), kit.mat(COL.vele[b % 2])); vela.position.y = 1.6; vela.scale.z = 0.15; barca.add(vela);
        barca.position.set(x, 0, z); barca.rotation.y = rot; barca.userData.y0 = 0;
        gruppo.add(barca); onde.push(barca);
      }
      // palme sulla spiaggia
      for (let p = 0; p < nD * 2; p++) {
        const u = rnd(), v = rnd(), s = rnd(), rot = rnd();
        if (!tieni(p)) continue;
        const [x, z] = pt(lerp(M.a0, M.a1, u), lerp(rI + 3.5, M.r0 - 0.5, v));
        pianta("palma", x, z, 1 + s * 0.4, rot * DUE_PI, 0.95 + s * 0.1);
      }
      // isolette con palme
      const nIsole = k > 1.5 ? 2 : 1;
      for (let i = 0; i < nIsole; i++) {
        const u = rnd(), v = rnd(), r = (2.5 + rnd() * 2) * clamp(dim, 0.8, 1.4), p1 = rnd(), p2 = rnd();
        const [x, z] = pt(lerp(M.a0 + 0.1, M.a1 - 0.1, u), lerp(M.r0 + 8, rE - 6, v));
        if (!inMare(x, z, r + 1) || !libero(x, z, r + 1, tutte)) continue;
        piatto(new THREE.CircleGeometry(r, 9), kit.mat(COL.sabbia), x, 0.06, z);
        occupa({ tipo: "cerchio", x, z, r: r + 1 });
        pianta("palma", x + r * 0.3 * (p1 - 0.5), z + r * 0.3 * (p2 - 0.5), 1.1, p1 * DUE_PI, 1, false);
        pianta("palma", x - r * 0.35, z + r * 0.2, 0.9, p2 * DUE_PI, 0.92, false);
      }
    } else if (S.stile === "campagna") {
      for (let c = 0; c < nD; c++) {
        const u = rnd(), v = rnd(), w = (7 + rnd() * 4) * clamp(dim, 0.7, 1.2), d = (5 + rnd() * 3) * clamp(dim, 0.7, 1.2);
        if (!tieni(c)) continue;
        const a = angolo(S, u);
        const [x, z] = pt(a, rI + 5 + band * 0.45 * v);
        if (!liberoTerra(x, z, Math.hypot(w, d) * 0.45)) continue;
        const campo = boxL(w, 0.1, d, kit.mat(COL.campi[c % COL.campi.length])); campo.position.set(x, 0.06, z); campo.rotation.y = a; gruppo.add(campo);
        const balla = solido(new THREE.CylinderGeometry(0.6, 0.6, 0.9, 12), kit.mat(COL.balla)); balla.rotation.z = Math.PI / 2; balla.position.set(x + 1.5, 0.6, z); gruppo.add(balla);
        occupa({ tipo: "rettangolo", x, z, w: w + 1, d: d + 1, rot: a });
      }
    } else if (S.stile === "arte") {
      geoSculture ??= [new THREE.TorusGeometry(0.8, 0.28, 10, 24), new THREE.SphereGeometry(0.9, 14, 10), new THREE.OctahedronGeometry(1), new THREE.TorusKnotGeometry(0.6, 0.2, 48, 8)].map(g);
      for (let c = 0; c < nD; c++) {
        const u = rnd(), v = rnd();
        if (!tieni(c)) continue;
        const [x, z] = pt(angolo(S, u), rI + 3 + band * 0.4 * v);
        if (!liberoTerra(x, z, 1.4)) continue;
        const ped = boxL(1.2, 1, 1.2, kit.mat(COL.piedistallo)); ped.position.set(x, 0.5, z); gruppo.add(ped);
        const sc = new THREE.Mesh(geoSculture[c % geoSculture.length], kit.mat(COL.sculture[c % COL.sculture.length]));
        sc.receiveShadow = true; sc.position.set(x, 2, z); sc.userData.y0 = 2; gruppo.add(sc); onde.push(sc);
        occupa({ tipo: "cerchio", x, z, r: 1.4 });
      }
    } else if (S.stile === "tech") {
      if (!matLuce) { matLuce = new THREE.MeshBasicMaterial({ color: COL.luceTech }); propri.push(matLuce); }
      for (let c = 0; c < nD; c++) {
        const u = rnd(), v = rnd(), h = 4 + rnd() * 6;
        if (!tieni(c)) continue;
        const [x, z] = pt(angolo(S, u), rI + 4 + band * 0.45 * v);
        if (!liberoTerra(x, z, 0.8)) continue;
        const t = boxL(0.4, h, 0.4, kit.mat(COL.torre)); t.position.set(x, h / 2, z); gruppo.add(t);
        const l = new THREE.Mesh(g(new THREE.SphereGeometry(0.35, 10, 8)), matLuce); l.position.set(x, h + 0.3, z); gruppo.add(l); luci.push(l);
        occupa({ tipo: "cerchio", x, z, r: 0.8 });
      }
    }
  }

  // --- boschi fitti (cluster) e alberi sparsi, più densi vicino alla città
  const tipoBosco = (S: Settore, u: number): TipoAlbero => {
    switch (S.stile) {
      case "citta": return u < 0.75 ? "cono" : "tondo";
      case "montagna": return u < 0.88 ? "pino" : "cono";
      case "mare": return "palma";
      case "campagna": return u < 0.85 ? "tondo" : "cono";
      default: return u < 0.8 ? "tondo" : "cono";
    }
  };
  const vicino = (v: number) => (rI > 0 ? v * v : Math.sqrt(v));
  for (const S of settori) {
    const nB = Math.round(S.q.boschi * k * fS);
    const [rb0, rb1] = S.q.raggioBosco, [n0, n1] = S.q.alberiPerBosco;
    for (let b = 0; b < nB; b++) {
      const u = rnd(), v = rnd(), rr = rnd(), nn = rnd();
      const [bx, bz] = pt(angolo(S, u), rI + 2 + band * 0.88 * vicino(v));
      const rb = lerp(rb0, rb1, rr) * clamp(dim, 0.7, 1.4);
      const n = Math.round(lerp(n0, n1, nn));
      const tieniBosco = tieni(b);
      for (let t = 0; t < n; t++) {
        const ta = rnd() * DUE_PI, td = Math.sqrt(rnd()) * rb, ts = rnd(), rot = rnd() * DUE_PI, ti = rnd(), tk = rnd();
        if (!tieniBosco || !tieni(t, Math.sqrt(scala))) continue;
        const s = (0.75 + ts * 0.7) * (1.15 - (0.35 * td) / rb);
        pianta(tipoBosco(S, tk), bx + Math.cos(ta) * td, bz + Math.sin(ta) * td, s, rot, 0.86 + ti * 0.24);
      }
    }
    const nSp = Math.round(S.q.alberiSparsi * k * fS);
    for (let t = 0; t < nSp; t++) {
      const u = rnd(), v = rnd(), ts = rnd(), rot = rnd() * DUE_PI, ti = rnd(), tk = rnd();
      if (!tieni(t)) continue;
      const [x, z] = pt(angolo(S, u), rI + 1.5 + band * 0.95 * vicino(v));
      pianta(tipoBosco(S, tk), x, z, 0.8 + ts * 0.8, rot, 0.88 + ti * 0.2);
    }
  }

  // --- istanze
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), SU = new THREE.Vector3(0, 1, 0);
  const istanzia = (geo: THREE.BufferGeometry, m: THREE.Material, lista: Ist[], colori = true) => {
    g(geo);
    if (!lista.length) return;
    const im = new THREE.InstancedMesh(geo, m, lista.length);
    lista.forEach((it, i) => {
      im.setMatrixAt(i, M4.compose(V.set(it.x, it.y, it.z), Q.setFromAxisAngle(SU, it.rot), SC.set(it.sx, it.sy, it.sz)));
      if (colori && it.c) im.setColorAt(i, it.c);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = false;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    gruppo.add(im);
    istanze.push(im);
  };
  (Object.keys(alberi) as TipoAlbero[]).forEach((tipo) => {
    if (!alberi[tipo].length) return;
    const { tronco, chioma } = geoAlbero(tipo);
    istanzia(tronco, kit.mat(COLORI_ALBERO[tipo].tronco), alberi[tipo], false);
    istanzia(chioma, kit.mat(COLORI_ALBERO[tipo].chioma), alberi[tipo]);
  });
  const matRoccia = kit.mat(COL.roccia, { flatShading: true }), matNeve = kit.mat(COL.neve, { flatShading: true });
  for (let v = 0; v < VARIANTI_MONTE; v++) {
    const lista: Ist[] = monti.filter((m) => m.v === v).map((m) => ({ x: m.x, y: 0, z: m.z, rot: m.rot, sx: m.rb, sy: m.h, sz: m.rb }));
    if (!lista.length) continue;
    const { roccia, neve } = geoMonte(v);
    istanzia(roccia, matRoccia, lista);
    istanzia(neve, matNeve, lista);
  }
  if (colline.length) istanzia(new THREE.SphereGeometry(1, 9, 5, 0, DUE_PI, 0, Math.PI / 2), kit.mat("#ffffff", { flatShading: true }), colline);
  if (rocce.length) istanzia(new THREE.DodecahedronGeometry(1, 0).translate(0, 0.35, 0), matRoccia, rocce);

  let liberato = false;
  return {
    gruppo,
    occupate,
    aggiorna(t: number) {
      onde.forEach((x, i) => { x.position.y = Math.sin(t * 1.5 + i) * 0.12 + (x.userData.y0 ?? 0); x.rotation.y += 0.002; });
      luci.forEach((l, i) => { l.visible = Math.sin(t * 3 + i) > -0.3; });
    },
    dispose() {
      if (liberato) return;
      liberato = true;
      istanze.forEach((im) => im.dispose());
      geos.forEach((x) => x.dispose());
      propri.forEach((m) => m.dispose());
      gruppo.removeFromParent();
    },
  };
}
