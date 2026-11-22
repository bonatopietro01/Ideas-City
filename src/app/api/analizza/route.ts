// Analisi AI del second brain: Claude legge le note e propone gli edifici
// (progetti e attività), divisi per ambito, con tappe, livelli e "cosa manca".
// L'utente poi decide come raggrupparli in città.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { NextResponse } from "next/server";
import { PALETTE, type Nota, type Proposta } from "@/lib/types";
import { lacuneLocali } from "@/lib/parse-vault";
import { erroreAI, MODELLO } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_CARATTERI = 1_500_000;

const Schema = z.object({
  quartieri: z.array(z.object({ id: z.string(), nome: z.string(), breve: z.string() })),
  progetti: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      tipo: z.enum(["progetto", "attivita"]),
      ambito: z.enum(["lavoro", "personale", "artistico", "tempo-libero"]),
      stile: z.enum(["citta", "tech", "mare", "montagna", "campagna", "arte"]),
      quartiere: z.string(),
      livello: z.number().int(),
      breve: z.string(),
      prossimo: z.string(),
      tappe: z.array(z.object({ t: z.string(), s: z.enum(["fatto", "parziale", "dafare", "chiarire"]) })),
      lacune: z.array(z.object({ tipo: z.enum(["passo-mancante", "da-chiarire", "collegamento", "fermo", "rischio"]), testo: z.string() })),
      collegamenti: z.array(z.string()),
      fonti: z.array(z.string()),
    }),
  ),
});

const SYSTEM = `Sei l'urbanista di una "Città delle Idee". Ricevi le note di un second brain (Markdown/Obsidian) e le trasformi in edifici.

Ci sono due tipi di edificio:
- PROGETTO: un'idea, un prodotto o un obiettivo con un punto di arrivo. Cresce verso il lancio.
- ATTIVITÀ: qualcosa che la persona fa o ha fatto con continuità (sport, corsi, lettura, musica, volontariato, routine di lavoro). Le tappe sono le cose fatte (stato "fatto") e quelle in programma.
Unisci note diverse che parlano della stessa cosa; ignora note di puro riferimento a meno che non contengano qualcosa da costruire o un'attività svolta.

AMBITO di ogni edificio: lavoro, personale, artistico, tempo-libero.
STILE della casa, ispirato al contenuto: mare (sport d'acqua, viaggi al mare), montagna (sci, trekking, bici), campagna (orto, cucina, natura, casa), arte (musica, scrittura, arte), tech (software, AI, startup, digitale), citta (tutto il resto: lavoro classico, studio, servizi).
QUARTIERE: raggruppa edifici affini dello stesso ambito (1-8 quartieri in totale).
TAPPE = piani: passi concreti con stato fatto, parziale, dafare, chiarire. Usa le checkbox se ci sono. 2-12 tappe.
LIVELLO 0-5 (solo per i progetti; per le attività metti 0): 0 idea, 1 prime ricerche, 2 decisioni chiave prese, 3 in sviluppo, 4 prototipo provabile, 5 lanciato. Basati su quello che le note dimostrano.
LACUNE = cosa manca, la parte più importante: passi mancanti verso il lancio, decisioni non prese, ipotesi mai verificate (clienti, legale, costi), cose ferme, collegamenti utili tra edifici. Per le attività: costanza, obiettivi mancanti. 1-5 lacune, frasi concrete e specifiche, mai generiche.
PROSSIMO: il singolo passo più utile adesso.
collegamenti: id di altri edifici. fonti: percorsi delle note usate. id in kebab-case univoci. Italiano semplice, frasi brevi.`;

export async function POST(req: Request) {
  const { note, nome } = (await req.json()) as { note: Nota[]; nome?: string };
  if (!Array.isArray(note) || note.length === 0) return NextResponse.json({ errore: "Nessuna nota ricevuta." }, { status: 400 });
  const caratteri = note.reduce((n, x) => n + x.testo.length, 0);
  if (caratteri > MAX_CARATTERI) {
    return NextResponse.json({ errore: `Il vault è troppo grande per una sola analisi (${Math.round(caratteri / 1000)}k caratteri). Scegli una sottocartella.` }, { status: 413 });
  }
  const corpo = note.map((n) => `<nota path="${n.path}">\n${n.testo}\n</nota>`).join("\n\n");

  try {
    const stream = new Anthropic().messages.stream({
      model: MODELLO,
      max_tokens: 64000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: zodOutputFormat(Schema) },
      system: SYSTEM,
      messages: [{ role: "user", content: `Ecco il second brain (${note.length} note). Proponi gli edifici.\n\n${corpo}` }],
    });
    const res = await stream.finalMessage();
    if (res.stop_reason === "refusal") return NextResponse.json({ errore: "Claude ha rifiutato di analizzare queste note." }, { status: 422 });
    if (res.stop_reason === "max_tokens") return NextResponse.json({ errore: "Il vault ha troppi progetti per una sola analisi: scegli una sottocartella." }, { status: 413 });
    const testo = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = Schema.safeParse(JSON.parse(testo));
    if (!parsed.success) return NextResponse.json({ errore: "Risposta dell'AI non valida, riprova." }, { status: 502 });
    const out = parsed.data;

    const ids = new Set(out.progetti.map((p) => p.id));
    const quartieri = out.quartieri.length ? out.quartieri : [{ id: "centro", nome: "Centro", breve: "" }];
    const qIds = new Set(quartieri.map((q) => q.id));
    const proposta: Proposta = {
      nomeVault: nome || "Vault",
      analisi: "ai",
      quartieri,
      progetti: out.progetti.map((p, i) => {
        const x = {
          ...p,
          quartiere: qIds.has(p.quartiere) ? p.quartiere : quartieri[0].id,
          livello: Math.max(0, Math.min(5, p.livello)) as 0 | 1 | 2 | 3 | 4 | 5,
          colore: PALETTE[i % PALETTE.length],
          collegamenti: p.collegamenti.filter((c) => ids.has(c) && c !== p.id),
          registro: [`${new Date().toLocaleDateString("it-IT")} · Analizzato con AI`],
          idee: [],
        };
        if (x.lacune.length === 0) x.lacune = lacuneLocali(x);
        return x;
      }),
    };
    return NextResponse.json(proposta);
  } catch (e) {
    if (e instanceof SyntaxError) return NextResponse.json({ errore: "Risposta dell'AI non valida, riprova." }, { status: 502 });
    return erroreAI(e);
  }
}
