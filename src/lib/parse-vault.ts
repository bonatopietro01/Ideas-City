// Analisi "locale" (senza AI) di un second brain in Markdown/Obsidian.
// Regole:
//  - ogni cartella di primo livello è un quartiere (le note in radice vanno in "Centro")
//  - una nota è un edificio se ha checkbox o frontmatter `tipo: progetto | attività`
//  - checkbox: [x] fatto · [/] in corso · [?] o [!] da chiarire · [ ] da fare
//  - l'ambito (lavoro, personale, artistico, tempo libero) viene da `ambito:` o si indovina da cartella e tag
//  - [[wikilink]] verso altre note-edificio diventano strade
import { indovinaAmbito, indovinaStile } from "./stili";
import { Ambito, Lacuna, Nota, PALETTE, Progetto, Proposta, Quartiere, StatoTappa, Tappa } from "./types";

export const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

export function frontmatter(testo: string): { meta: Record<string, string>; corpo: string } {
  const m = testo.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, corpo: testo };
  const meta: Record<string, string> = {};
  for (const riga of m[1].split(/\r?\n/)) {
    const k = riga.match(/^([\w-]+):\s*(.*)$/);
    if (k) meta[k[1].toLowerCase()] = k[2].replace(/^["'[]|["'\]]$/g, "").trim();
  }
  return { meta, corpo: testo.slice(m[0].length) };
}

const STATO: Record<string, StatoTappa> = { x: "fatto", X: "fatto", "/": "parziale", "?": "chiarire", "!": "chiarire", " ": "dafare" };
const senzaLink = (s: string) => s.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_, a, __, b) => b || a);

function tappe(corpo: string): Tappa[] {
  return [...corpo.matchAll(/^\s*[-*+]\s+\[(.)\]\s+(.+)$/gm)].map((m) => ({ t: senzaLink(m[2]).trim(), s: STATO[m[1]] ?? "dafare" }));
}

function livello(meta: Record<string, string>, tp: Tappa[]): Progetto["livello"] {
  const dichiarato = Number(meta.livello ?? meta.level);
  if (Number.isInteger(dichiarato) && dichiarato >= 0 && dichiarato <= 5) return dichiarato as Progetto["livello"];
  const stato = (meta.stato ?? meta.status ?? "").toLowerCase();
  if (/lanciat|live|launched|done|inaugurat/.test(stato)) return 5;
  if (/prototip|beta|mvp/.test(stato)) return 4;
  if (/svilupp|in corso|doing|wip|active/.test(stato)) return 3;
  if (tp.length === 0) return 0;
  const fatte = tp.filter((t) => t.s === "fatto").length;
  const q = fatte / tp.length;
  if (fatte === 0) return tp.some((t) => t.s === "parziale") ? 1 : 0;
  if (q >= 0.9) return 4;
  if (q >= 0.5) return 3;
  if (q >= 0.25) return 2;
  return 1;
}

function breve(corpo: string): string {
  for (const riga of corpo.split(/\r?\n/)) {
    const r = riga.trim();
    if (!r || r.startsWith("#") || /^[-*+]\s+\[.\]/.test(r) || r.startsWith(">") || r.startsWith("|")) continue;
    const pulita = senzaLink(r.replace(/^[-*+]\s+/, ""));
    return pulita.length > 160 ? pulita.slice(0, 157) + "…" : pulita;
  }
  return "";
}

export function livelloAttivita(fatte: number): Progetto["livello"] {
  if (fatte === 0) return 0;
  if (fatte <= 2) return 1;
  if (fatte <= 5) return 2;
  if (fatte <= 10) return 3;
  if (fatte <= 20) return 4;
  return 5;
}

export function lacuneLocali(p: Progetto): Lacuna[] {
  const l: Lacuna[] = [];
  const fatte = p.tappe.filter((t) => t.s === "fatto").length;
  if (p.tipo === "attivita") {
    if (fatte === 0) l.push({ tipo: "passo-mancante", testo: "Non risulta ancora fatta: segna la prima volta che la fai." });
    p.tappe.filter((t) => t.s === "chiarire").forEach((t) => l.push({ tipo: "da-chiarire", testo: t.t }));
    return l;
  }
  if (p.tappe.length === 0) l.push({ tipo: "passo-mancante", testo: "Non ci sono tappe: scrivi almeno il primo passo concreto." });
  p.tappe.filter((t) => t.s === "chiarire").forEach((t) => l.push({ tipo: "da-chiarire", testo: t.t }));
  if (p.tappe.length > 0 && fatte === p.tappe.length && p.livello < 5)
    l.push({ tipo: "passo-mancante", testo: "Tutte le tappe sono fatte ma il progetto non è lanciato: qual è il prossimo passo?" });
  if (p.collegamenti.length === 0) l.push({ tipo: "collegamento", testo: "Nessun collegamento ad altre idee: è isolato nella città." });
  return l;
}

const AMBITO_META: Record<string, Ambito> = {
  lavoro: "lavoro", work: "lavoro", personale: "personale", personal: "personale",
  artistico: "artistico", arte: "artistico", art: "artistico", "tempo-libero": "tempo-libero", "tempo libero": "tempo-libero", hobby: "tempo-libero",
};

export function analisiLocale(note: Nota[], nomeVault = "Vault"): Proposta {
  const quartieri = new Map<string, Quartiere>();
  const progetti: Progetto[] = [];
  const perNome = new Map<string, string>();

  for (const n of note) {
    const { meta, corpo } = frontmatter(n.testo);
    const tp = tappe(corpo);
    const tipoMeta = (meta.tipo ?? meta.type ?? "").toLowerCase();
    const tags = (meta.tags ?? meta.tag ?? "") + " " + [...corpo.matchAll(/(^|\s)#([\p{L}\w/-]+)/gu)].map((m) => m[2]).join(" ");
    const attivita = /attivit|activit|habit|abitudin/.test(tipoMeta + " " + tags + " " + n.path.toLowerCase());
    if (tp.length === 0 && !attivita && !/progett|project|idea/.test(tipoMeta)) continue;

    const parti = n.path.split("/");
    const qNome = parti.length > 1 ? parti[0] : "Centro";
    const qId = slug(qNome);
    if (!quartieri.has(qId)) quartieri.set(qId, { id: qId, nome: qNome, breve: `Note nella cartella ${qNome}` });
    const id = slug(n.path.replace(/\.md$/i, ""));
    perNome.set(slug(n.nome), id);
    const nome = meta.titolo ?? meta.title ?? corpo.match(/^#\s+(.+)$/m)?.[1].trim() ?? n.nome.replace(/[-_]+/g, " ");
    const ambito =
      AMBITO_META[(meta.ambito ?? meta.area ?? "").toLowerCase()] ??
      indovinaAmbito(`${parti.slice(0, -1).join(" ")} ${tags}`) ??
      indovinaAmbito(`${nome} ${breve(corpo)}`) ??
      (attivita ? "personale" : "lavoro");
    const prossimaTappa = tp.find((t) => t.s === "parziale") ?? tp.find((t) => t.s === "chiarire" || t.s === "dafare");
    const p: Progetto = {
      id,
      nome,
      tipo: attivita ? "attivita" : "progetto",
      ambito,
      quartiere: qId,
      colore: PALETTE[progetti.length % PALETTE.length],
      stile: indovinaStile(`${nome} ${tags} ${breve(corpo)}`, ambito),
      livello: livello(meta, tp),
      breve: meta.descrizione ?? meta.description ?? (breve(corpo) || "Nessuna descrizione nella nota."),
      prossimo: meta.prossimo ?? meta.next ?? prossimaTappa?.t ?? (attivita ? "Rifarla presto" : "Definire il primo passo"),
      tappe: tp,
      lacune: [],
      collegamenti: [...corpo.matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1].trim()),
      fonti: [n.path],
      registro: [],
      idee: [],
    };
    if (attivita) p.livello = livelloAttivita(tp.filter((t) => t.s === "fatto").length);
    progetti.push(p);
  }
  for (const p of progetti) {
    p.collegamenti = [...new Set(p.collegamenti.map((c) => perNome.get(slug(c.split("/").pop()!))).filter((x): x is string => !!x && x !== p.id))];
    p.lacune = lacuneLocali(p);
  }
  return { quartieri: [...quartieri.values()], progetti, analisi: "locale", nomeVault };
}
