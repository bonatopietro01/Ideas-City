# Incarico: AIdeaCity — un solo mondo 3D con paesaggio ricco (montagne, laghi, fiumi, alberi)

<!-- Prompt scritto da prompt-agent il 2026-11-21. Le decisioni D1-D7 vanno confermate prima dei pacchetti che ne dipendono. -->

## Contesto (istruzioni stabili)
Lavori sull'app AIdeaCity nella cartella corrente: Next.js 15, React 19, TypeScript, three.js 0.170. Non c'è un backend dati: lo stato vive in localStorage alla chiave `aideacity:mondo`.
Prima di iniziare leggi `CLAUDE.md` e `agent-kit/WORKFLOW.md`. La chat principale coordina i ruoli installati (architect, frontend, reviewer, diagnostics…) e mantiene un solo TaskState con R-ID, criteri, owner, stato ed evidenze. Ogni owner legge solo i file della propria consegna, verifica le conclusioni nel sorgente, conserva le modifiche già presenti nei file che tocca (il working tree ha molte modifiche non committate: non sovrascriverle e non fare revert) e riporta solo i controlli realmente svolti.

## Richiesta dell'utente (parole sue, riassunte)
"Attorno alle città ci sono pochi alberi: migliora il layout del mondo con montagne, laghi, fiumi, sempre con questo tema, fallo ben fatto. Una persona ha un solo mondo in cui ci sono più città e ogni città ha un tema; non ci sono più mondi, il mondo è uno solo. Dentro al mondo ci sono le città, che vanno per argomenti, e ogni città ha degli edifici che sono i progetti che si riferiscono a quella tipologia."

## Obiettivo
Sostituire la griglia di card "Le tue città" con una vista 3D unica del mondo dell'utente. In questa vista tutte le città sono aree distinte, immerse in un paesaggio low-poly ricco (boschi, montagne, laghi, fiumi). Arricchire nello stesso stile anche il paesaggio intorno alla singola città. Non perdere nessuna funzione e nessun dato esistente.

## Requisiti e criteri di accettazione
R1 — Paesaggio ricco intorno e tra le città
- C1.1 Intorno a ogni città e negli spazi tra le città ci sono boschi densi (gruppi di alberi, non solo esemplari sparsi), montagne con neve, almeno un lago e almeno un fiume che collega rilievi, laghi o bordo del mondo. Le quantità vengono da parametri nominati, non da numeri sparsi nel codice.
- C1.2 Lo stile resta quello attuale: low-poly, Lambert, colori piatti, palette di `STILI` in `src/lib/stili.ts`, tipi di albero `cono | palma | pino | tondo`. Ogni area segue gli stili della città: mare (sabbia, acqua, palme, barche), montagna (rilievi innevati, pini), campagna (campi, alberi tondi), arte (sculture), tech (torri luminose), città (alberi a cono).
- C1.3 Fiumi, laghi, montagne e alberi non coprono lotti, piazze, anelli stradali, etichette o strade tra progetti collegati. Gli edifici restano cliccabili.
- C1.4 Il paesaggio è deterministico: a parità di dati, ricaricando la pagina si vede lo stesso mondo (vedi D3).
- C1.5 Il paesaggio di una città resta stabile quando si aggiunge o modifica un edificio di un'altra città.

R2 — Un solo mondo per persona
- C2.1 La schermata principale è una scena 3D del mondo intero con tutte le città di `mondo.citta`, ognuna come area distinta con la propria etichetta (nome, ambito, numero di edifici, punti).
- C2.2 Nell'interfaccia non compare mai il concetto di "più mondi" (nessun selettore, nessun testo "mondi"). Il modello resta `Mondo { versione: 2, citta: Citta[] }`.
- C2.3 Con 0 città la scena mostra il terreno vuoto e la chiamata ad azione "Importa il tuo second brain" che c'è oggi.
- C2.4 Le città nuove (create, importate, unite) compaiono in una posizione libera, senza sovrapporsi alle altre (vedi D2).

R3 — Ogni città ha un tema riconoscibile
- C3.1 Il tema di una città è `ambito` più `stili[]`, come oggi. Nel mondo ogni città è distinguibile per colore dell'ambito (`AMBITI[ambito].colore`), bioma degli stili e etichetta.
- C3.2 Una città fusa (più `stili`) mostra un paesaggio misto, coerente con la logica a spicchi di oggi.
- C3.3 Non si aggiungono nuovi campi tema senza conferma (vedi D7).

R4 — Gli edifici di una città sono i suoi progetti e attività
- C4.1 Nella vista città, edifici, livelli, piani, gru, cartelli, lampadine idee, segnali lacune e strade tra collegamenti funzionano come oggi (`edificio()` in `city-scene.ts`).
- C4.2 Nella vista mondo ogni città mostra i propri edifici, almeno come versioni semplificate di altezza e colore coerenti con livello e colore del progetto (vedi D4).

R5 — Preservare funzioni e dati
- C5.1 Restano disponibili e funzionanti: Importa second brain (cartella, file .json, vault di esempio) con la proposta di gruppi (`PropostaView`), Nuova città, Unisci (selezione di 2 o più città, nome), Elimina città con conferma, Esporta JSON, Riepilogo, punteggio totale e per città, apertura di una città con modifica di città ed edifici, nuovi edifici, idee che diventano piani (locale e AI).
- C5.2 I dati salvati in `aideacity:mondo` si caricano senza perdite: stesse città, edifici, id e campi dopo la modifica. Se serve un campo nuovo è opzionale, `normalizzaMondo` lo gestisce se assente e `versione` resta 2, salvo decisione confermata.
- C5.3 Il flusso dopo l'import resta invariato: con una sola città nuova si apre quella città, altrimenti si torna al mondo.
- C5.4 Restano rispettati `prefers-reduced-motion` e le etichette accessibili, e la scena viene liberata (`distruggi`) quando si cambia schermata. Le azioni sulle città sono raggiungibili anche senza mouse sul canvas (pannello o lista HTML).

## Decisioni (consigliate, DA CONFERMARE dall'utente prima del pacchetto interessato)
D1 Navigazione. Consigliata: la vista mondo sostituisce la griglia di card. Un clic su una città fa volare la camera su di essa; poi "Entra" (o un secondo clic) apre l'attuale `CittaView` con la sua scena dettagliata. Motivo: riusa intatta la vista città (R4, R5), è a basso rischio di regressione e facilmente reversibile. Alternativa: una sola scena continua con zoom fino ai singoli edifici. È più immersiva, ma richiede di rifare selezione, schede e prestazioni con tutti gli edifici in dettaglio.
D2 Posizione delle città. Consigliata: layout calcolato e deterministico, senza salvare posizioni. Slot su spirale o anelli, nell'ordine di `mondo.citta`, con raggio ricavato dall'estensione di ogni città. Motivo: nessuna modifica allo schema dati (C5.2). Effetto da accettare: se si elimina o si unisce una città, le altre possono spostarsi di slot. Alternativa: campo opzionale `pos?: [x, z]` in `Citta`, assegnato alla creazione. Le città restano ferme, ma va toccato `types.ts`/`mondo.ts`.
D3 Seme del terreno. Consigliato: un seme derivato da un hash di `citta.id` per il paesaggio della città, e un hash degli id ordinati per il mondo, al posto di `seme = 7` fisso. Motivo: stabilità (C1.4, C1.5).
D4 Città nella vista mondo. Consigliate: versioni semplificate degli edifici (blocchi con altezza dal livello o dalle tappe, colore del progetto, tetto dallo stile) disegnate con `InstancedMesh` o geometrie unite. Motivo: prestazioni con molte città. Alternativa: riusare `edificio()` completo, con più dettaglio ma molto più pesante.
D5 Prestazioni e mobile. Consigliati: alberi, rocce e coni-montagna istanziati; un budget massimo di oggetti ridotto quando `window.innerWidth < 760`; ombre solo dagli edifici; `pixelRatio` limitato a 2 come oggi; nebbia per nascondere il bordo del mondo. Gli obiettivi numerici (fps, numero di istanze) vanno fissati con l'utente: non dichiararli raggiunti senza misure.
D6 Codice condiviso. Consigliato: un nuovo modulo del paesaggio usato sia dalla scena città sia dalla scena mondo, insieme agli helper oggi interni a `creaScena` (`albero`, `mat`, `mesh`, `box`, `etichetta`). Motivo: un solo stile e nessuna duplicazione. L'architect conferma il confine e la firma prima dell'implementazione.
D7 Tema. Consigliato: il tema resta `ambito` più `stili` (nessun campo nuovo). Un "argomento" testuale libero è fuori scope finché l'utente non lo chiede.

## Pacchetti di lavoro (ordine e dipendenze)
P0 — Conferma decisioni D1-D7 (chat principale con l'utente). Blocca P1-P4.
P1 — Contratto (owner: architect, solo proposta). R1, R2, R4. Dipende da P0.
  Propone moduli e firme. Per esempio il file nuovo proposto `src/components/landscape.ts`, con helper condivisi e una funzione che genera il paesaggio in base a stili, centro, raggio, seme e "zone vietate" (lotti, piazze, strade). Il file nuovo proposto `src/components/world-scene.ts`, con `creaMondo(host, mondo, { onCitta, vista?, anima? })` e un'interfaccia simile a `Scena` (seleziona/vola su città, vista, distruggi). Il file nuovo proposto `src/components/MondoScena.tsx`, se serve un wrapper React. Indica come calcolare e condividere l'estensione di una città tra le due scene. Nessuna modifica ai dati salvo D2-alternativa confermata.
P2 — Paesaggio condiviso (owner: frontend). R1, R3, R4. Dipende da P1.
  Estrae gli helper e il paesaggio da `city-scene.ts` nel modulo concordato. Arricchisce boschi, montagne, laghi e fiumi per stile. Fa usare il modulo a `creaScena` senza cambiare il comportamento degli edifici. Applica il seme di D3.
P3 — Scena del mondo (owner: frontend). R1, R2, R3, R4. Dipende da P2.
  Implementa la scena unica: piazzamento delle città (D2), paesaggio tra le città, città in versione semplificata (D4), etichette, selezione e volo, gestione di 0 città, prestazioni (D5).
P4 — Integrazione UI (owner: frontend). R2, R5. Dipende da P3.
  `MondoView` mostra la scena 3D al posto delle card e mantiene in HTML intestazione, punti, azioni, barra di unione, modali Nuova città ed Elimina, Riepilogo ed Esporta. La selezione per l'unione e l'eliminazione passano da un pannello o lista HTML delle città, sincronizzato con la selezione nella scena. `page.tsx` conserva la chiave, il caricamento e il salvataggio, e il routing mondo / città / proposta.
Review finale: la chat principale avvia una sola review (reviewer) sul lavoro integrato, con TaskState e checkpoint.
Backend e AI Engineer: non applicabili (nessuna API o prompt AI toccati). Le route in `src/app/api/` restano invariate.

## Punti di partenza nel codice (percorsi relativi alla radice; righe verificate al momento della stesura, ricontrollale prima di modificare)
R2/R5 — flusso dati e navigazione
1. `src/app/page.tsx`: `CHIAVE = "aideacity:mondo"` (r.14); tipo `Schermata` (r.16); caricamento con `normalizzaMondo` (r.42-50); `salva` (r.52-55); routing a `CittaView` (r.59-61); `PropostaView.onFatto`, che apre la città nuova se è una sola (r.68-72); render di `MondoView` e `Importa` (r.76-88). Osserva: qui si collega la nuova vista mondo senza cambiare chiave né salvataggio.
2. `src/components/MondoView.tsx`: `MondoView` (r.11). Griglia di card `.carte` (r.80-107): è la parte da sostituire con la scena. Da preservare: `esporta` (r.28-34), barra unione e `unisci` (r.55-72), punti totali con `punteggio` (r.24, r.44), modale Nuova città con `creaCitta` (r.110-123), modale Elimina con `eliminaCitta` (r.125-135), `Riepilogo` (r.137), stato vuoto (r.74-78).
3. `src/lib/types.ts`: `Citta` (r.55-64), `Mondo` (r.66-69). Non cambiare la forma senza la conferma di D2.
4. `src/lib/mondo.ts`: `normalizzaCitta` (r.48-66), `normalizzaMondo` (r.68-73), `creaCitta` (r.75), `applicaProposta` (r.89), `unisci` (r.118, aggiunge la città fusa in coda e rimuove le sorgenti), `eliminaCitta` (r.155). Osserva come cambia l'ordine di `mondo.citta`: incide su D2.
R1/R3/R4 — scena 3D attuale
5. `src/components/city-scene.ts`: interfacce `Vista` / `Scena` (r.11-18); `creaScena` (r.20); layout dei quartieri ed `estensione` (r.36-45), che decide camera, nebbia e ombre (r.45-71); RNG con `seme = 7` fisso (r.86-87, vedi D3); helper `mat` / `mesh` / `box` / `etichetta` / `albero` (r.74-164, candidati all'estrazione D6); terreno `prato` (r.212-214); `edificio()` (r.219-354, da non alterare per R4); posizionamento edifici, piazze e anelli (r.356-394, sono le zone vietate di C1.3); strade tra collegamenti (r.396-409); sezione "paesaggio" a spicchi per stile (r.411-467): è il punto da arricchire per R1; animazioni `onde` / `lampeggianti` e `RIDUCI` (r.21-22, r.517-541); `distruggi` (r.547-561), da estendere a geometrie e materiali istanziati.
6. `src/components/CittaView.tsx`: creazione e distruzione della scena con `import("./city-scene")` e conservazione della `vista` (r.58-72); pulsante "← Città" `onIndietro` (r.113). Osserva: è lo schema da replicare per la scena mondo, e il ritorno deve tornare alla vista mondo.
7. `src/lib/stili.ts`: `AMBITI` (r.5-10, colori dell'ambito), `DefStile` (r.14-27), `STILI` (r.29-60: terreno, cielo, albero per stile). Riusa questi valori e non introdurre una palette nuova.
8. Stili CSS: `src/app/mondo.css` (`.carte`, r.18) e `src/app/globals.css` (`.scena` fixed a tutto schermo, r.36-37). Va verificato come sovrapporre un pannello HTML alla scena del mondo.
Test: nel repository non ci sono test automatici. Il comportamento da verificare è quello elencato in C1-C5. Non creare test senza una richiesta esplicita.

## Vincoli
- Aree modificabili: `src/components/` (city-scene.ts, MondoView.tsx, CittaView.tsx solo se serve per il ritorno al mondo, file nuovi proposti), `src/app/page.tsx`, `src/app/mondo.css` / `globals.css` per il layout. `src/lib/*` solo se D2-alternativa è confermata o per helper puri. Non toccare `src/app/api/`, `src/lib/ai.ts`, `src/lib/parse-vault.ts`, `src/lib/import-legacy.ts`, `src/data/`.
- Non perdere né riscrivere i dati dell'utente in localStorage. Nessuna migrazione distruttiva, nessun cambio della chiave.
- Nessuna dipendenza npm nuova senza approvazione.
- Non eseguire `npm run dev`, `build`, `lint`, typecheck o test senza un'autorizzazione esplicita dell'utente: la parola "verifica" da sola non basta (WORKFLOW.md). Se l'autorizzazione manca, consegna un elenco di controlli manuali da far eseguire all'utente.
- Non modificare l'istanza dell'app in esecuzione.

## Fuori scope
Più mondi o profili; account o backend; nuovi campi tema (D7); modifiche all'analisi AI o all'import; nuovi tipi di edificio; audio; editor manuale del terreno.

## Comportamento per input incompleto
Se una decisione D1-D7 non è confermata, il pacchetto che ne dipende resta BLOCKED nel TaskState con il motivo. Non applicare l'opzione consigliata in silenzio. Se un riferimento di riga non corrisponde più, cerca il simbolo per nome e segnala la differenza.

## Checkpoint finale (per ogni owner, poi integrato dalla chat principale)
- Pacchetto e R-ID coperti; stato READY / DONE / BLOCKED per ogni criterio C.
- File toccati (esistenti / nuovi), con una sintesi per file e le personalizzazioni preesistenti preservate.
- Decisioni applicate (D-ID e opzione).
- Controlli svolti: comando o metodo ed esito. Dichiara esplicitamente cosa non è stato eseguito per mancanza di autorizzazione.
- Rischi residui (prestazioni, ordine delle città dopo unione o eliminazione, compatibilità dei dati), blocker e prossimo destinatario.
