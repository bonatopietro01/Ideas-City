// Operazioni sul mondo: creare, unire, modificare ed eliminare città ed edifici.
// Tutte le funzioni sono pure: ricevono e restituiscono nuovi oggetti.
import { lacuneLocali, livelloAttivita } from "./parse-vault";
import { AMBITI, ELENCO_STILI } from "./stili";
import { Ambito, Citta, Idea, Mondo, PALETTE, Progetto, Proposta, Stile, Tappa, TipoEdificio } from "./types";

export const oggi = () => new Date().toISOString().slice(0, 10);
const dataIt = () => new Date().toLocaleDateString("it-IT");
export const nuovoId = (p = "x") => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export { livelloAttivita };

// Ricalcola ciò che dipende dalle tappe (livello delle attività, lacune semplici)
export function ricalcola(p: Progetto, lacuneAI = false): Progetto {
  const q = { ...p };
  if (q.tipo === "attivita") q.livello = livelloAttivita(q.tappe.filter((t) => t.s === "fatto").length);
  // se il prossimo passo è appena stato fatto, passa al successivo
  if (q.tappe.some((t) => t.s === "fatto" && t.t === q.prossimo)) {
    q.prossimo = q.tappe.find((t) => t.s === "parziale")?.t ?? q.tappe.find((t) => t.s !== "fatto")?.t ?? (q.tipo === "attivita" ? "Rifarla presto" : "Tutte le tappe fatte: qual è il prossimo traguardo?");
  }
  if (!lacuneAI) q.lacune = lacuneLocali(q);
  return q;
}

// Completa i campi mancanti (dati vecchi, import, AI)
export function normalizzaProgetto(p: Partial<Progetto> & { nome: string }, i = 0, ambito: Ambito = "lavoro"): Progetto {
  return {
    id: p.id ?? nuovoId("p"),
    nome: p.nome,
    tipo: p.tipo ?? "progetto",
    ambito: p.ambito ?? ambito,
    quartiere: p.quartiere ?? "centro",
    colore: p.colore ?? PALETTE[i % PALETTE.length],
    stile: p.stile,
    accento: p.accento,
    livello: (Math.max(0, Math.min(5, p.livello ?? 0)) as Progetto["livello"]),
    breve: p.breve ?? "",
    prossimo: p.prossimo ?? "Definire il primo passo",
    tappe: p.tappe ?? [],
    lacune: p.lacune ?? [],
    collegamenti: p.collegamenti ?? [],
    fonti: p.fonti ?? [],
    registro: p.registro ?? [],
    idee: p.idee ?? [],
  };
}

export function normalizzaCitta(c: Partial<Citta> & { progetti: Progetto[] }): Citta {
  const ambito = c.ambito ?? "lavoro";
  const quartieri = c.quartieri?.length ? c.quartieri : [{ id: "centro", nome: "Centro", breve: "" }];
  const qIds = new Set(quartieri.map((q) => q.id));
  return {
    id: c.id ?? nuovoId("c"),
    nome: c.nome ?? "La mia città",
    ambito,
    stili: c.stili?.length ? c.stili : [AMBITI[ambito].stile],
    aggiornato: c.aggiornato ?? oggi(),
    quartieri,
    analisi: c.analisi ?? "manuale",
    progetti: c.progetti.map((p, i) => {
      const n = normalizzaProgetto(p, i, ambito);
      if (!qIds.has(n.quartiere)) n.quartiere = quartieri[0].id;
      return n;
    }),
  };
}

export function normalizzaMondo(dati: unknown): Mondo {
  const d = dati as Partial<Mondo> & Partial<Citta>;
  if (d && Array.isArray(d.citta)) return { versione: 2, citta: d.citta.map((c) => normalizzaCitta(c)) };
  if (d && Array.isArray(d.progetti)) return { versione: 2, citta: [normalizzaCitta(d as Citta)] };
  return { versione: 2, citta: [] };
}

export function creaCitta(nome: string, ambito: Ambito, stile: Stile): Citta {
  return normalizzaCitta({ nome, ambito, stili: [stile], progetti: [], analisi: "manuale" });
}

// ---------- dalla proposta di import alle città ----------
export interface Gruppo {
  includi: boolean;
  nome: string;
  ambito: Ambito;
  stile: Stile;
  destinazione: string; // "nuova" oppure id di una città esistente
  progetti: string[]; // id dei progetti della proposta
}

export function applicaProposta(m: Mondo, prop: Proposta, gruppi: Gruppo[]): Mondo {
  const citta = [...m.citta];
  const perId = Object.fromEntries(prop.progetti.map((p) => [p.id, p]));
  for (const g of gruppi) {
    if (!g.includi || !g.progetti.length) continue;
    const progetti = g.progetti.map((id) => ({ ...perId[id], ambito: g.ambito }));
    const qUsati = new Set(progetti.map((p) => p.quartiere));
    const quartieri = prop.quartieri.filter((q) => qUsati.has(q.id));
    if (g.destinazione === "nuova") {
      citta.push(normalizzaCitta({ nome: g.nome, ambito: g.ambito, stili: [g.stile], progetti, quartieri, analisi: prop.analisi }));
    } else {
      const i = citta.findIndex((c) => c.id === g.destinazione);
      if (i < 0) continue;
      const c = citta[i];
      const esistenti = new Set(c.quartieri.map((q) => q.id));
      citta[i] = normalizzaCitta({
        ...c,
        aggiornato: oggi(),
        quartieri: [...c.quartieri, ...quartieri.filter((q) => !esistenti.has(q.id))],
        progetti: [...c.progetti, ...progetti.map((p) => ({ ...p, id: c.progetti.some((x) => x.id === p.id) ? nuovoId("p") : p.id }))],
      });
    }
  }
  return { ...m, citta };
}

// ---------- fusione ----------
// I quartieri restano (prefissati con la città d'origine); ogni casa tiene il suo stile
// ma prende tetto e decorazioni (accento) da uno stile di un'altra città: gli stili si mescolano.
export function unisci(m: Mondo, ids: string[], nome: string): Mondo {
  const sorgenti = m.citta.filter((c) => ids.includes(c.id));
  if (sorgenti.length < 2) return m;
  const stili = [...new Set(sorgenti.flatMap((c) => c.stili))];
  const conteggio: Record<string, number> = {};
  sorgenti.forEach((c) => c.progetti.forEach((p) => (conteggio[p.ambito] = (conteggio[p.ambito] ?? 0) + 1)));
  const ambito = (Object.entries(conteggio).sort((a, b) => b[1] - a[1])[0]?.[0] as Ambito) ?? sorgenti[0].ambito;

  let k = 0;
  const progetti: Progetto[] = [];
  const quartieri = sorgenti.flatMap((c) =>
    c.quartieri.map((q) => ({ ...q, id: `${c.id}~${q.id}`, nome: c.quartieri.length > 1 ? `${c.nome} · ${q.nome}` : c.nome })),
  );
  for (const c of sorgenti) {
    const altri = stili.filter((s) => !c.stili.includes(s));
    for (const p of c.progetti) {
      const proprio = p.stile ?? c.stili[0];
      const accento = altri.length ? altri[k++ % altri.length] : p.accento;
      progetti.push({
        ...p,
        stile: proprio,
        accento: accento && accento !== proprio ? accento : undefined,
        quartiere: `${c.id}~${p.quartiere}`,
        registro: [...p.registro, `${dataIt()} · Entrato in ${nome} (fusione)`],
      });
    }
  }
  const fusa = normalizzaCitta({ nome, ambito, stili, quartieri, progetti, analisi: "manuale" });
  return { ...m, citta: [...m.citta.filter((c) => !ids.includes(c.id)), fusa] };
}

// ---------- modifiche ----------
export const aggiornaCitta = (m: Mondo, id: string, f: (c: Citta) => Citta): Mondo => ({
  ...m,
  citta: m.citta.map((c) => (c.id === id ? { ...f(c), aggiornato: oggi() } : c)),
});

export const eliminaCitta = (m: Mondo, id: string): Mondo => ({ ...m, citta: m.citta.filter((c) => c.id !== id) });

export const salvaProgetto = (m: Mondo, cittaId: string, p: Progetto): Mondo =>
  aggiornaCitta(m, cittaId, (c) => {
    const esiste = c.progetti.some((x) => x.id === p.id);
    return { ...c, progetti: esiste ? c.progetti.map((x) => (x.id === p.id ? p : x)) : [...c.progetti, p] };
  });

export const eliminaProgetto = (m: Mondo, cittaId: string, pid: string): Mondo =>
  aggiornaCitta(m, cittaId, (c) => ({
    ...c,
    progetti: c.progetti.filter((p) => p.id !== pid).map((p) => ({ ...p, collegamenti: p.collegamenti.filter((x) => x !== pid) })),
  }));

export function nuovoEdificio(c: Citta, dati: { nome: string; tipo: TipoEdificio; stile: Stile; quartiere: string; breve: string; idee: string[] }): Progetto {
  const p = normalizzaProgetto(
    {
      nome: dati.nome,
      tipo: dati.tipo,
      stile: dati.stile,
      quartiere: dati.quartiere,
      breve: dati.breve,
      idee: dati.idee.filter(Boolean).map((t): Idea => ({ id: nuovoId("i"), testo: t, data: oggi(), usata: false })),
      registro: [`${dataIt()} · Lotto creato`],
    },
    c.progetti.length,
    c.ambito,
  );
  return ricalcola(p);
}

// Senza AI: ogni idea non usata diventa un piano "da fare"
export function ideeInPianiLocale(p: Progetto): Progetto {
  const nuove = p.idee.filter((i) => !i.usata);
  if (!nuove.length) return p;
  const tappe: Tappa[] = [...p.tappe, ...nuove.map((i) => ({ t: i.testo, s: (p.tipo === "attivita" ? "fatto" : "dafare") as Tappa["s"] }))];
  const q = ricalcola({
    ...p,
    tappe,
    idee: p.idee.map((i) => ({ ...i, usata: true })),
    registro: [...p.registro, `${dataIt()} · ${nuove.length} idee trasformate in piani`],
  });
  if (q.tipo === "progetto" && q.livello === 0 && q.tappe.length) q.livello = 1;
  if (!q.prossimo || q.prossimo === "Definire il primo passo") q.prossimo = q.tappe.find((t) => t.s !== "fatto")?.t ?? q.prossimo;
  return q;
}

export const STILI_ORDINE = ELENCO_STILI;
