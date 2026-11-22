// Punteggio della città: anticipa la classifica annuale (fase 2).
// Premia il costruire (tappe fatte, livelli) e il chiarire (meno lacune aperte).
import { Citta } from "./types";

export interface Punteggio {
  totale: number;
  tappeFatte: number;
  tappeInCorso: number;
  livelli: number;
  collegamenti: number;
  lacuneAperte: number;
}

export function punteggio(c: Citta): Punteggio {
  let tappeFatte = 0, tappeInCorso = 0, livelli = 0, collegamenti = 0, lacuneAperte = 0;
  for (const p of c.progetti) {
    tappeFatte += p.tappe.filter((t) => t.s === "fatto").length;
    tappeInCorso += p.tappe.filter((t) => t.s === "parziale").length;
    livelli += p.livello;
    collegamenti += p.collegamenti.length;
    lacuneAperte += p.lacune.length;
  }
  const totale = tappeFatte * 10 + tappeInCorso * 4 + livelli * 25 + collegamenti * 3;
  return { totale, tappeFatte, tappeInCorso, livelli, collegamenti, lacuneAperte };
}
