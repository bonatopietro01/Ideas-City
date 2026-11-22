// Riassunto narrativo di tutto quello che la persona ha fatto nelle sue città.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Citta } from "@/lib/types";
import { erroreAI, MODELLO } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const { citta } = (await req.json()) as { citta: Citta[] };
  const dati = citta.map((c) => ({
    citta: c.nome,
    ambito: c.ambito,
    edifici: c.progetti.map((p) => ({
      nome: p.nome,
      tipo: p.tipo,
      livello: p.livello,
      fatto: p.tappe.filter((t) => t.s === "fatto").map((t) => t.t),
      inCorso: p.tappe.filter((t) => t.s === "parziale").map((t) => t.t),
      prossimo: p.prossimo,
    })),
  }));
  try {
    const res = await new Anthropic().messages.create({
      model: MODELLO,
      max_tokens: 8000,
      output_config: { effort: "low" },
      system:
        "Scrivi un riassunto in italiano di tutto quello che la persona ha fatto, diviso per ambito (Lavoro, Personale, Artistico, Tempo libero; salta quelli vuoti). " +
        "Per ogni ambito: 2-4 frasi su cosa ha costruito e completato, citando i risultati concreti. Chiudi con 'Dove stai andando': 2-3 frasi sui prossimi passi più importanti. " +
        "Tono caldo ma sobrio, niente elenchi puntati, niente titoli Markdown: usa solo righe che iniziano con il nome dell'ambito seguito da due punti.",
      messages: [{ role: "user", content: JSON.stringify(dati) }],
    });
    if (res.stop_reason === "refusal") return NextResponse.json({ errore: "Claude ha rifiutato questa richiesta." }, { status: 422 });
    const testo = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return NextResponse.json({ testo });
  } catch (e) {
    return erroreAI(e);
  }
}
