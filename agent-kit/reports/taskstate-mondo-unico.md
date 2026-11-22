# TaskState — Mondo unico con paesaggio ricco

Prompt: `agent-kit/prompts/mondo-unico-paesaggio.md` (requisiti R1–R5, criteri C*, decisioni D1–D7, pacchetti P0–P4).
Coordinatore: chat principale. Aggiornato: 2026-11-21.

## Decisioni (P0 — DONE)
Confermate dall'utente il 2026-11-21 ("tutto come consigliato"): D1–D7 tutte nell'opzione consigliata.
- D1 vista mondo sostituisce le card; clic = volo sulla città; "Entra" apre CittaView.
- D2 posizioni calcolate deterministicamente dall'ordine di `mondo.citta`, nessun campo nuovo.
- D3 seme da hash di `citta.id` (città) e degli id (mondo).
- D4 edifici semplificati/istanziati nella vista mondo.
- D5 istanziazione, budget ridotto sotto 760 px, ombre solo edifici, nebbia al bordo; nessun obiettivo numerico dichiarato.
- D6 modulo paesaggio condiviso (`src/components/landscape.ts`), firma confermata da architect.
- D7 tema = ambito + stili.

## Autorizzazioni
Nessuna autorizzazione esplicita a eseguire dev server, build, lint, typecheck o test: non eseguirli. Nessuna dipendenza npm nuova.

## Requisiti
| ID | Owner | Pacchetto | Stato | Evidenze |
|---|---|---|---|---|
| R1 Paesaggio ricco | frontend | P2, P3 | DONE (solo codice, non compilato) | checkpoint-frontend-p2-p4.md |
| R2 Un solo mondo | frontend | P3, P4 | DONE (solo codice, non compilato) | checkpoint-frontend-p2-p4.md |
| R3 Tema riconoscibile | frontend | P2, P3 | DONE (solo codice, non compilato) | checkpoint-frontend-p2-p4.md |
| R4 Edifici = progetti della città | frontend | P2, P3 | DONE (solo codice, non compilato) | checkpoint-frontend-p2-p4.md |
| R5 Preservare funzioni e dati | frontend | P4 | DONE (solo codice, non compilato) | checkpoint-frontend-p2-p4.md |

## Pacchetti
| Pacchetto | Owner | Dipende da | Stato | Checkpoint |
|---|---|---|---|---|
| P1 Contratto | architect | P0 | READY | agent-kit/reports/contratto-p1-mondo-unico.md |
| P2 Paesaggio condiviso | frontend | P1 | DONE (solo codice) | checkpoint-frontend-p2-p4.md |
| P3 Scena del mondo | frontend | P2 | DONE (solo codice) | checkpoint-frontend-p2-p4.md |
| P4 Integrazione UI | frontend | P3 | DONE (solo codice) | checkpoint-frontend-p2-p4.md |
| Review finale | reviewer | P4 | TODO | |

## Ownership dei file
frontend: `src/components/city-scene.ts`, `src/components/landscape.ts` (nuovo), `src/components/world-scene.ts` (nuovo), `src/components/MondoView.tsx`, `src/components/CittaView.tsx` (solo ritorno al mondo), `src/app/page.tsx`, `src/app/mondo.css`, `src/app/globals.css`.
Fuori perimetro: `src/app/api/`, `src/lib/ai.ts`, `src/lib/parse-vault.ts`, `src/lib/import-legacy.ts`, `src/data/`, `src/lib/types.ts`, `src/lib/mondo.ts` (salvo helper puri approvati).
