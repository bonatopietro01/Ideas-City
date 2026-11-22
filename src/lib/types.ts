// Modello dati: un "mondo" di città. Ogni città ha un ambito (lavoro, personale…)
// e uno o più stili (mare, montagna…) che decidono l'aspetto delle case.

export type StatoTappa = "fatto" | "parziale" | "dafare" | "chiarire";

export interface Tappa {
  t: string; // testo della tappa (= un piano dell'edificio)
  s: StatoTappa;
}

export type TipoLacuna = "passo-mancante" | "da-chiarire" | "collegamento" | "fermo" | "rischio";

export interface Lacuna {
  tipo: TipoLacuna;
  testo: string;
}

export interface Idea {
  id: string;
  testo: string;
  data: string; // YYYY-MM-DD
  usata: boolean; // già trasformata in piani
}

export type Ambito = "lavoro" | "personale" | "artistico" | "tempo-libero";
export type Stile = "citta" | "tech" | "mare" | "montagna" | "campagna" | "arte";
export type TipoEdificio = "progetto" | "attivita";

export interface Progetto {
  id: string;
  nome: string;
  tipo: TipoEdificio; // progetto = edificio che cresce verso il lancio; attività = casa che cresce con quello che fai
  ambito: Ambito;
  quartiere: string;
  colore: string;
  stile?: Stile; // stile della casa; se manca usa quello della città
  accento?: Stile; // dopo una fusione: tetto e decorazioni presi da un altro stile
  livello: 0 | 1 | 2 | 3 | 4 | 5;
  breve: string;
  prossimo: string;
  tappe: Tappa[];
  lacune: Lacuna[];
  collegamenti: string[];
  fonti: string[];
  registro: string[];
  idee: Idea[];
}

export interface Quartiere {
  id: string;
  nome: string;
  breve: string;
}

export interface Citta {
  id: string;
  nome: string;
  ambito: Ambito;
  stili: Stile[]; // più di uno se la città nasce da una fusione
  aggiornato: string;
  quartieri: Quartiere[];
  progetti: Progetto[];
  analisi: "ai" | "locale" | "manuale";
}

export interface Mondo {
  versione: 2;
  citta: Citta[];
}

export interface Nota {
  path: string;
  nome: string;
  testo: string;
}

// Risultato di un'analisi prima che l'utente decida come dividerlo in città
export interface Proposta {
  quartieri: Quartiere[];
  progetti: Progetto[];
  analisi: "ai" | "locale";
  nomeVault: string;
}

export const LIVELLI = [
  { n: 0, nome: "Terreno", desc: "Idea annotata. Sul lotto c'è solo un cartello." },
  { n: 1, nome: "Fondamenta", desc: "Prime ricerche fatte. Fondamenta e impalcature." },
  { n: 2, nome: "Progetto", desc: "Decisioni chiave prese (per chi, come). Arrivano gli alberi." },
  { n: 3, nome: "Cantiere", desc: "In sviluppo. Arriva la gru." },
  { n: 4, nome: "Prototipo", desc: "Funziona e si può provare. L'edificio ha il tetto." },
  { n: 5, nome: "Inaugurato", desc: "Lanciato e in uso. Antenna accesa e bandiera." },
] as const;

export const LIVELLI_ATTIVITA = [
  { n: 0, nome: "Da iniziare", desc: "Attività annotata, non ancora fatta." },
  { n: 1, nome: "Primi passi", desc: "Fatta qualche volta." },
  { n: 2, nome: "Abitudine", desc: "Fatta con una certa costanza." },
  { n: 3, nome: "Costante", desc: "Parte della tua settimana." },
  { n: 4, nome: "Esperto", desc: "Tanta esperienza accumulata." },
  { n: 5, nome: "Maestro", desc: "Un punto fermo della tua vita." },
] as const;

export const STATI: Record<StatoTappa, string> = {
  fatto: "Fatto",
  parziale: "In corso",
  dafare: "Da fare",
  chiarire: "Da chiarire",
};

export const TIPI_LACUNA: Record<TipoLacuna, string> = {
  "passo-mancante": "Passo mancante",
  "da-chiarire": "Da chiarire",
  collegamento: "Collegamento possibile",
  fermo: "Progetto fermo",
  rischio: "Rischio",
};

export const PALETTE = [
  "#ff6b2c", "#56a3e8", "#9b7bea", "#3fb98a", "#f2994a", "#e0567a",
  "#2bb3a3", "#c9a227", "#5a67d8", "#b4643c", "#d65db1", "#6f8f3a",
];
