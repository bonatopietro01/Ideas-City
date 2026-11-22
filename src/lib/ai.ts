// Utilità condivise dalle rotte che usano Claude (solo lato server).
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const MODELLO = "claude-opus-5-5";

export const aiDisponibile = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export function erroreAI(e: unknown) {
  if (e instanceof Anthropic.AuthenticationError) {
    return NextResponse.json({ errore: "Chiave API di Anthropic mancante o non valida (ANTHROPIC_API_KEY in .env.local)." }, { status: 401 });
  }
  if (e instanceof Anthropic.RateLimitError) {
    return NextResponse.json({ errore: "Troppe richieste all'AI, riprova tra poco." }, { status: 429 });
  }
  if (e instanceof Anthropic.APIError) {
    return NextResponse.json({ errore: `Errore dell'AI (${e.status}): ${e.message}` }, { status: 502 });
  }
  return NextResponse.json({ errore: "Errore di rete verso l'AI." }, { status: 502 });
}
