// "Aiutami a costruire": Claude trasforma le idee raccolte per un edificio in piani (tappe),
// aggiorna il prossimo passo e dice cosa manca ancora.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { NextResponse } from "next/server";
import type { Progetto } from "@/lib/types";
import { erroreAI, MODELLO } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 120;

const Schema = z.object({
  breve: z.string(),
  tappe: z.array(z.object({ t: z.string(), s: z.enum(["fatto", "parziale", "dafare", "chiarire"]) })),
  prossimo: z.string(),
  lacune: z.array(z.object({ tipo: z.enum(["passo-mancante", "da-chiarire", "collegamento", "fermo", "rischio"]), testo: z.string() })),
  livello: z.number().int(),
  commento: z.string(),
});

const SYSTEM = `Aiuti una persona a costruire un edificio della sua "Città delle Idee". Ogni piano è una tappa concreta.
Ricevi l'edificio attuale e le idee nuove che la persona ha annotato. Il tuo compito:
- Tieni tutte le tappe esistenti con il loro stato (puoi solo riformularle se sono vaghe).
- Trasforma le idee nuove in tappe concrete e verificabili (una idea può diventare 1-3 tappe, o unirsi a una tappa esistente). Per un PROGETTO le tappe nuove sono "dafare" o "chiarire" (se sono decisioni o dubbi). Per un'ATTIVITÀ un'idea che descrive qualcosa di già fatto è "fatto".
- Ordina le tappe in modo logico, massimo 14.
- breve: una frase che descrive l'edificio aggiornata con le idee.
- prossimo: il singolo passo più utile adesso.
- lacune: 1-4 cose che mancano ancora, specifiche.
- livello 0-5 (progetti): 0 idea, 1 prime ricerche, 2 decisioni chiave prese, 3 in sviluppo, 4 prototipo, 5 lanciato. Non alzarlo solo perché ci sono idee nuove. Per le attività metti 0.
- commento: 1-2 frasi incoraggianti e concrete su come hai costruito i piani.
Italiano semplice, frasi brevi.`;

export async function POST(req: Request) {
  const { progetto, citta, altri } = (await req.json()) as { progetto: Progetto; citta: string; altri: string[] };
  const nuove = progetto.idee.filter((i) => !i.usata);
  if (!nuove.length) return NextResponse.json({ errore: "Nessuna idea nuova da costruire." }, { status: 400 });

  const descr = {
    nome: progetto.nome,
    tipo: progetto.tipo,
    ambito: progetto.ambito,
    breve: progetto.breve,
    livello: progetto.livello,
    tappe: progetto.tappe,
    prossimo: progetto.prossimo,
  };
  try {
    const res = await new Anthropic().messages.parse({
      model: MODELLO,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: zodOutputFormat(Schema) },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Città: ${citta}. Altri edifici della città: ${altri.join(", ") || "nessuno"}.\n\nEdificio attuale:\n${JSON.stringify(descr, null, 2)}\n\nIdee nuove:\n${nuove.map((i) => `- ${i.testo}`).join("\n")}`,
      }],
    });
    if (res.stop_reason === "refusal") return NextResponse.json({ errore: "Claude ha rifiutato questa richiesta." }, { status: 422 });
    if (!res.parsed_output) return NextResponse.json({ errore: "Risposta dell'AI non valida, riprova." }, { status: 502 });
    return NextResponse.json(res.parsed_output);
  } catch (e) {
    return erroreAI(e);
  }
}
