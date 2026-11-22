// Ambiti di vita e stili delle case. Ogni ambito ha uno stile predefinito;
// lo stile decide muri, finestre, tetto, terreno e decorazioni intorno alla città.
import { Ambito, Stile } from "./types";

export const AMBITI: Record<Ambito, { nome: string; colore: string; stile: Stile; desc: string }> = {
  lavoro: { nome: "Lavoro", colore: "#5a67d8", stile: "tech", desc: "Progetti, carriera, aziende, studio" },
  personale: { nome: "Personale", colore: "#3fb98a", stile: "campagna", desc: "Casa, salute, famiglia, crescita" },
  artistico: { nome: "Artistico", colore: "#d65db1", stile: "arte", desc: "Musica, scrittura, disegno, foto" },
  "tempo-libero": { nome: "Tempo libero", colore: "#2bb3a3", stile: "mare", desc: "Sport, viaggi, hobby, amici" },
};

export type Tetto = "piatto" | "terrazza" | "spiovente" | "cupola" | "vetro";

export interface DefStile {
  nome: string;
  desc: string;
  muro: string | null; // null = usa il colore del progetto
  bordo: string; // fasce e cornici
  finestraAccesa: string;
  finestraSpenta: string;
  tetto: Tetto;
  coloreTetto: string;
  terreno: string;
  piazza: string;
  cielo: string;
  albero: "cono" | "palma" | "pino" | "tondo";
}

export const STILI: Record<Stile, DefStile> = {
  citta: {
    nome: "Città", desc: "Palazzi colorati, tetti piatti con giardino",
    muro: null, bordo: "#3a4651", finestraAccesa: "#ffd779", finestraSpenta: "#3c4a57",
    tetto: "piatto", coloreTetto: "#3a4651", terreno: "#9cc283", piazza: "#e4d7bd", cielo: "#bcd7ea", albero: "cono",
  },
  tech: {
    nome: "Tech", desc: "Vetro scuro, luci al neon, tetti di vetro",
    muro: "#2c3a55", bordo: "#58e1ff", finestraAccesa: "#7fe9ff", finestraSpenta: "#1a2333",
    tetto: "vetro", coloreTetto: "#58e1ff", terreno: "#8fb38a", piazza: "#cfd6de", cielo: "#b9cde6", albero: "tondo",
  },
  mare: {
    nome: "Mare", desc: "Case bianche, fasce blu, terrazze e palme",
    muro: "#f7f4ec", bordo: "#2f7fc1", finestraAccesa: "#7cc4f0", finestraSpenta: "#2f5f86",
    tetto: "terrazza", coloreTetto: "#e9e2d2", terreno: "#e8d9a8", piazza: "#f3ead3", cielo: "#a9dcf2", albero: "palma",
  },
  montagna: {
    nome: "Montagna", desc: "Legno e pietra, tetti spioventi con neve",
    muro: "#8a5a36", bordo: "#9a9a94", finestraAccesa: "#ffcf73", finestraSpenta: "#3d2a1c",
    tetto: "spiovente", coloreTetto: "#4a3a30", terreno: "#86a97a", piazza: "#d8d2c4", cielo: "#c4d8ea", albero: "pino",
  },
  campagna: {
    nome: "Campagna", desc: "Casali color ocra, tegole rosse, campi",
    muro: "#e8c98f", bordo: "#a0522d", finestraAccesa: "#ffe08a", finestraSpenta: "#5a4630",
    tetto: "spiovente", coloreTetto: "#b5482f", terreno: "#a9c779", piazza: "#e6d6ad", cielo: "#c7e0ee", albero: "tondo",
  },
  arte: {
    nome: "Arte", desc: "Muri vivaci, cupole e sculture nelle piazze",
    muro: null, bordo: "#1f2a33", finestraAccesa: "#fff3a6", finestraSpenta: "#2e2440",
    tetto: "cupola", coloreTetto: "#f2b632", terreno: "#a6c98d", piazza: "#efe1f0", cielo: "#d3d6f0", albero: "tondo",
  },
};

export const ELENCO_AMBITI = Object.keys(AMBITI) as Ambito[];
export const ELENCO_STILI = Object.keys(STILI) as Stile[];

// Indovina l'ambito da un testo (nome cartella, tag, frontmatter)
export function indovinaAmbito(testo: string): Ambito | null {
  const t = testo.toLowerCase();
  if (/lavor|work|job|carrier|azienda|business|client|progett|startup|uni|studio|ricerca/.test(t)) return "lavoro";
  if (/arte|art|music|scritt|writing|poesi|disegn|pittur|foto|video|design|crea/.test(t)) return "artistico";
  if (/hobby|sport|viagg|travel|libero|svago|palestra|gym|gioc|game|amici|mare|montagn|cucin/.test(t)) return "tempo-libero";
  if (/personal|vita|life|salute|health|casa|home|famigli|diario|journal|abitudin|habit/.test(t)) return "personale";
  return null;
}

// Suggerisce uno stile da hobby/lavoro descritti nel testo (mare, montagna…)
export function indovinaStile(testo: string, ambito: Ambito): Stile {
  const t = testo.toLowerCase();
  if (/mare|surf|vela|nuot|spiaggia|barca|sub|kite/.test(t)) return "mare";
  if (/montagn|sci|trekking|arrampic|escursion|neve|bici|mtb|hiking/.test(t)) return "montagna";
  if (/orto|giardin|campagna|agricol|cucin|vino|animali|irrigaz/.test(t)) return "campagna";
  if (/arte|music|pittur|foto|museo|scritt|teatro|cinema|design/.test(t)) return "arte";
  if (/software|app|codice|coding|\bai\b|tech|digital|web|dati|startup/.test(t)) return "tech";
  return AMBITI[ambito].stile;
}
