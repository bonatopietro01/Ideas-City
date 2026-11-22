# AIdeaCity

Trasforma un second brain (cartella Markdown/Obsidian) in una **città delle idee** 3D da esplorare.
Ogni progetto è un edificio, ogni tappa un piano, e i cartelli rossi mostrano **cosa manca**.

## Avvio

```powershell
npm install
copy .env.local.example .env.local   # poi inserisci la tua ANTHROPIC_API_KEY
npm run dev
```

Apri http://localhost:3000.

## Come legge le note

| Nel Markdown | Nella città |
|---|---|
| cartella di primo livello | quartiere |
| nota con checkbox o `tipo: progetto` | edificio |
| `- [x]` / `- [/]` / `- [ ]` / `- [?]` | piano illuminato / spento / impalcatura / impalcatura rossa |
| `livello: 0-5` o `stato:` nel frontmatter | livello (cartello → gru → tetto → antenna) |
| `[[link]]` a un'altra nota-progetto | strada tra i due edifici |

Con **Analisi AI** attiva, Claude (`claude-opus-5-5`) legge tutte le note, raggruppa i progetti anche senza checkbox
e scrive le lacune: passi mancanti, decisioni da prendere, ipotesi mai verificate, collegamenti utili.
Senza AI le lacune vengono da regole semplici (nessuna tappa, tappe "da chiarire", progetto isolato…).

Si può anche importare il `data.json` dell'artefatto originale.

## Struttura

- `src/lib/parse-vault.ts` — analisi locale del vault
- `src/app/api/analizza/route.ts` — analisi AI con Claude (output strutturato)
- `src/components/city-scene.ts` — motore 3D (three.js)
- `src/lib/score.ts` — punteggio della città
- `public/esempio/` — vault di esempio

## Roadmap

1. **MVP personale** (fatto): import → analisi → città esplorabile con "cosa manca".
2. **Città condivise**: account, città pubblicate con link, visita alle città degli altri (es. Supabase).
3. **Punteggi e classifica annuale**: punti per tappe completate, livelli saliti e lacune risolte, con storico per
   evitare che si gonfino i numeri. I premi di fine anno in Italia rientrano nei *concorsi a premio* (DPR 430/2001):
   va verificato con un consulente prima del lancio.
