// Importa il data.json dell'artefatto originale "Città delle Idee",
// una città o un mondo esportati da questa app.
import { lacuneLocali } from "./parse-vault";
import { normalizzaCitta, normalizzaMondo } from "./mondo";
import { Ambito, Citta, Mondo, Stile, Tappa } from "./types";

interface Legacy {
  aggiornato?: string;
  quartiere?: { id: string; nome: string; breve: string };
  progetti: { id: string; nome: string; colore: string; livello: number; quartiere?: boolean | string; breve: string; prossimo: string; tappe: Tappa[]; registro?: string[] }[];
}

export function daLegacy(d: Legacy, nome = "Città delle Idee", ambito: Ambito = "lavoro", stile: Stile = "tech"): Citta {
  const q = d.quartiere ?? { id: "centro", nome: "Centro", breve: "" };
  const c = normalizzaCitta({
    nome,
    ambito,
    stili: [stile],
    aggiornato: d.aggiornato,
    quartieri: [q, { id: "indipendenti", nome: "Progetti indipendenti", breve: "Progetti a sé" }],
    analisi: "manuale",
    progetti: d.progetti.map((p) => ({
      id: p.id,
      nome: p.nome,
      quartiere: p.quartiere ? q.id : "indipendenti",
      colore: p.colore,
      livello: Math.max(0, Math.min(5, p.livello)) as 0,
      breve: p.breve,
      prossimo: p.prossimo,
      tappe: p.tappe,
      registro: p.registro ?? [],
      tipo: "progetto",
      ambito,
      lacune: [],
      collegamenti: [],
      fonti: [],
      idee: [],
    })),
  });
  c.progetti.forEach((p) => (p.lacune = lacuneLocali(p)));
  return c;
}

// Restituisce sempre un elenco di città da aggiungere al mondo
export function importaJson(dati: unknown): Citta[] {
  const d = dati as Partial<Mondo> & Partial<Citta> & Legacy;
  if (!d || typeof d !== "object") throw new Error("File non valido.");
  if (Array.isArray(d.citta)) return normalizzaMondo(d).citta;
  if (!Array.isArray(d.progetti)) throw new Error("File non valido: manca l'elenco dei progetti.");
  if (Array.isArray(d.quartieri)) return [normalizzaCitta(d as Citta)];
  return [daLegacy(d)];
}
