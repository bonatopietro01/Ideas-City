// Layout puro (niente three, niente DOM) di una città e del mondo.
// Usato sia dalla scena della città sia dalla scena del mondo, così le due viste
// mettono quartieri, piazze ed edifici negli stessi punti.
import type { Citta, Progetto, Quartiere } from "@/lib/types";
import type { Zona } from "./landscape";

export const FH = 1.25; // altezza di un piano

/** Raggio dell'anello di edifici di un quartiere con n edifici (formula originale di city-scene). */
export const raggioQ = (n: number) => (n <= 1 ? 0 : Math.max(5.5, n * 2.3));

/** Margine oltre l'anello stradale di un quartiere in cui il paesaggio non entra. */
export const MARGINE_ZONA = 1.5;
/** Spazio di bioma (paesaggio locale) intorno al nucleo di una città nella vista mondo. */
export const MARGINE_BIOMA = 22;
/** Distanza minima tra i bordi di due città nel mondo. */
export const GAP_MONDO = 14;
/** Quantizzazione del raggio di una città: piccole crescite non spostano le altre. */
export const QUANTO_MONDO = 6;
/** Raggio minimo del mondo (anche con 0 o 1 città). */
export const RAGGIO_MONDO_MIN = 70;

export interface PosEdificio { x: number; z: number; rotY: number; wBase: number }
export interface QuartiereLayout { q: Quartiere; ps: Progetto[]; cx: number; cz: number; r: number; rPiazza: number; rAnello: number }
export interface LayoutCitta { quartieri: QuartiereLayout[]; RQ: number; estensione: number; pos: Record<string, PosEdificio> }

/** Quartieri su un cerchio, edifici ad anello nel quartiere. Formule identiche alla versione precedente. */
export function layoutCitta(c: Pick<Citta, "quartieri" | "progetti">): LayoutCitta {
  const perQ = c.quartieri.map((q) => ({ q, ps: c.progetti.filter((p) => p.quartiere === q.id) })).filter((x) => x.ps.length);
  const RQ = perQ.length <= 1 ? 0 : Math.max(...perQ.map((x) => raggioQ(x.ps.length))) * 2 + 14;
  const pos: Record<string, PosEdificio> = {};
  const quartieri = perQ.map((x, i) => {
    const a = (i / perQ.length) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(a) * RQ, cz = Math.sin(a) * RQ;
    const r = raggioQ(x.ps.length);
    x.ps.forEach((p, k) => {
      const wBase = x.ps.length === 1 ? 5 : 4;
      const b = (k / x.ps.length) * Math.PI * 2 - Math.PI / 2;
      pos[p.id] = { x: cx + Math.cos(b) * r, z: cz + Math.sin(b) * r, rotY: r ? -b + Math.PI / 2 : 0, wBase };
    });
    return { ...x, cx, cz, r, rPiazza: r + 4.5, rAnello: r + 7 };
  });
  const estensione = RQ + Math.max(10, ...quartieri.map((q) => q.r)) + 10;
  return { quartieri, RQ, estensione, pos };
}

/** Zone vietate al paesaggio: piazze + anelli (cerchi), insegne (rettangoli), strade tra collegamenti (segmenti). */
export function zoneCitta(l: LayoutCitta, c: Pick<Citta, "progetti">, dx = 0, dz = 0): Zona[] {
  const zone: Zona[] = [];
  for (const q of l.quartieri) {
    zone.push({ tipo: "cerchio", x: q.cx + dx, z: q.cz + dz, r: q.rAnello + MARGINE_ZONA });
    zone.push({ tipo: "rettangolo", x: q.cx + dx, z: q.cz + dz + q.r + (q.r ? 5.7 : 8.5), w: 10.5, d: 3.2 });
  }
  const fatti = new Set<string>();
  for (const p of c.progetti) for (const k of p.collegamenti) {
    const chiave = [p.id, k].sort().join("|");
    const a = l.pos[p.id], b = l.pos[k];
    if (fatti.has(chiave) || !a || !b) continue;
    fatti.add(chiave);
    zone.push({ tipo: "segmento", ax: a.x + dx, az: a.z + dz, bx: b.x + dx, bz: b.z + dz, larghezza: 0.9 + MARGINE_ZONA, strada: true });
  }
  return zone;
}

/**
 * Altezza del corpo semplificato (vista mondo). 0 = lotto vuoto (solo cartello), come in edificio().
 * Progetto: 0.68 + FH per tappa. Attività: stessa regola dei piani di edificio().
 */
export function altezzaSemplice(p: Progetto): number {
  if (p.tipo === "attivita") {
    const f = p.tappe.filter((t) => t.s === "fatto").length;
    if (!f) return 0;
    const piani = Math.min(6, Math.max(1, Math.ceil(f / Math.max(1, Math.ceil(f / 6)))));
    const daFare = p.tappe.some((t) => t.s !== "fatto");
    return 0.68 + piani * 1.0 + (daFare ? 0.9 : 0);
  }
  if (p.livello === 0 || p.tappe.length === 0) return 0;
  return 0.68 + FH * p.tappe.length;
}

export interface SlotCitta { id: string; x: number; z: number; raggio: number }

/**
 * Posizioni deterministiche delle città (D2): la prima all'origine, le altre nell'ordine
 * dell'elenco sul primo punto libero di una spirale di Archimede. Nessuna casualità.
 */
export function layoutMondo(citta: Citta[], p: { gap?: number; quanto?: number } = {}): { slot: SlotCitta[]; raggioMondo: number } {
  const gap = p.gap ?? GAP_MONDO, quanto = p.quanto ?? QUANTO_MONDO;
  const A0 = 0.6; // angolo iniziale della spirale
  const B = 4; // crescita del raggio per radiante
  const slot: SlotCitta[] = [];
  citta.forEach((c, i) => {
    const raggio = Math.ceil((layoutCitta(c).estensione + MARGINE_BIOMA) / quanto) * quanto;
    if (i === 0) { slot.push({ id: c.id, x: 0, z: 0, raggio }); return; }
    let t = A0;
    for (let k = 0; k < 400000; k++) {
      const r = B * t;
      const x = Math.cos(t) * r, z = Math.sin(t) * r;
      if (slot.every((s) => Math.hypot(x - s.x, z - s.z) >= raggio + s.raggio + gap)) { slot.push({ id: c.id, x, z, raggio }); return; }
      t += Math.min(0.3, 2.5 / Math.max(r, 1));
    }
    // ripiego (mai raggiunto in pratica): in fila sull'asse x
    const lontano = Math.max(...slot.map((s) => Math.abs(s.x) + s.raggio)) + raggio + gap;
    slot.push({ id: c.id, x: lontano, z: 0, raggio });
  });
  const raggioMondo = Math.max(RAGGIO_MONDO_MIN, ...slot.map((s) => Math.hypot(s.x, s.z) + s.raggio + gap));
  return { slot, raggioMondo };
}
