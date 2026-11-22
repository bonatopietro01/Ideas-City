# Checkpoint frontend — P2, P3, P4 (2026-11-21)

Verifica solo con lettura del codice. Typecheck, build, lint, dev server, test e browser **NON eseguiti** (non autorizzati). Niente git. Non toccati `src/lib/*`, `src/app/api/`, `src/data/`, `agent-kit/`, localStorage.

## File
**Nuovi**
- `src/components/city-layout.ts` (puro):
  - `FH`, `raggioQ`, `layoutCitta`, con le stesse formule di prima.
  - `zoneCitta`: zone vietate (piazze e anelli come cerchi, insegne come rettangoli, strade dei collegamenti come segmenti con `strada`).
  - `altezzaSemplice` (0 per un lotto vuoto).
  - `layoutMondo`: spirale di Archimede con raggio quantizzato (`QUANTO_MONDO`).
  - Costanti `MARGINE_BIOMA`, `GAP_MONDO`, `RAGGIO_MONDO_MIN`.
- `src/components/landscape.ts`:
  - `hashSeme` (FNV-1a), `creaRng` (Park–Miller), `Zona`, `libero`, `mobile`.
  - `creaKit`: mat/mesh/box/tex/scuro/etichetta/albero identici a prima; i colori degli alberi sono in un'unica costante condivisa.
  - Parametri nominati: `COLORI_PAESAGGIO`, `QUANTITA_BASE` (con i campi in più `strade`, `colline`, `rocce`), `PROFILI`, `BUDGET`.
  - `generaPaesaggio`, per ogni spicchio di stile genera:
    - anelli di terreno;
    - catene montuose istanziate (3 varianti irregolari, neve derivata dalla forma della roccia);
    - laghi a lobi con riva;
    - fiumi a nastro su CatmullRom, con deviazioni ad angolo fisso e ponti sulle strade;
    - sentieri radiali, colline e massi istanziati;
    - boschi fitti istanziati (con tinta deterministica per albero) e alberi sparsi;
    - decori per stile: golfo con sabbia, barche, palme, isolotti; campi e balle di fieno; sculture; torri tech con luci.
  - Il consumo di rnd è fisso, non usa `Math.random` né `Date`, il paesaggio non proietta ombre, `dispose` è idempotente.
- `src/components/world-scene.ts` — `creaMondo(host, mondo, { onCitta, onArrivo?, vista?, anima? })` restituisce `ScenaMondo { seleziona, volaSu, vistaMondo, vista, distruggi }`.
  - Per ogni città: base del bioma, anello nel colore dell'ambito, piazze e anelli, strade interne, paesaggio locale con seme `id|mondo`.
  - Tra le città: paesaggio con seme dagli id ordinati e `nucleo` attivo; strade verso la città più vicina.
  - Edifici semplificati istanziati (lotti, corpi, fascia, tetti per tipo, cartelli, antenne); solo gli edifici proiettano ombra.
  - Etichetta: nome · ambito · edifici · punti.
  - Selezione: anello pulsante; il volo chiama `onArrivo` all'arrivo, o subito con reduced motion.
  - Clic: dischi invisibili, etichette e instanceId, soglia di trascinamento 6px.
  - Budget mobile, `pixelRatio` ≤ 2, shadow map 1024 su mobile; `distruggi` completo.

**Esistenti**
- `src/components/city-scene.ts`:
  - Ora usa `creaKit`, `layoutCitta` (`layout.pos`), rnd degli edifici da `hashSeme(citta.id)` e `generaPaesaggio` con seme `id|paesaggio`, `rInterno = estensione + 2`, `rEsterno = estensione * 3`, zone da `zoneCitta`.
  - Rimossi il vecchio blocco del paesaggio, `onde` e gli helper locali; il loop chiama `paesaggio.aggiorna(t)`.
  - `distruggi`: `paesaggio.dispose()` → traverse → `kit.dispose()`.
  - **Invariati**: `edificio()`, `Scena`, `Vista`, firma di `creaScena`, prato.
- `src/components/MondoView.tsx`:
  - La scena `.scena` sostituisce `.carte`.
  - Header fixed `.mondo-top` con logo, titolo, città · punti, Riepilogo, Esporta, Nuova città, Importa.
  - Pannello `.mondo-lista` (sidebar su desktop, foglio in basso sotto 760px). Ogni riga: seleziona/vola, badge, punti, checkbox Unisci, Entra se selezionata, Elimina.
  - `sel` sincronizzato tra scena e lista; secondo clic sulla stessa città = apri; "Entra in {nome}" dopo `onArrivo`.
  - Escape deseleziona, ma non se una modale è aperta.
  - 0 città: il terreno resta visibile con la call to action.
  - Invariati: barra di unione e `unisci`, modali Nuova città ed Elimina, Riepilogo, Esporta. La vista è conservata al rebuild.
- `src/app/mondo.css`:
  - Rimossi `.carte`, `.carta`, `.numeri`; aggiunto il layout del mondo.
  - Livelli z: pannello e header 10, Entra 15, barra di unione fixed 20, modali 50.
  - `globals.css` invariato.
- `src/components/CittaView.tsx`: solo il pulsante, ora "← Mondo" con `aria-label="Torna al mondo"`.
- `src/app/page.tsx`: solo lo stato opzionale `ultima`, passato come `iniziale` (il volo torna sulla città da cui esci). Chiave, caricamento, salvataggio, Schermata e flusso dopo l'import invariati.

## Criteri (verificati solo nel codice)
- **C1.1** DONE. Lago, fiume e catena minimi nella vista città sono best-effort su 6 candidati fissi: se nessuno trova spazio, l'elemento manca.
- **C1.2–C1.4** DONE.
- **C1.5** DONE nella vista città. Nel mondo è stabile solo il paesaggio locale di ogni città.
- **C2.1–C2.4** DONE.
- **C3.1–C3.3** DONE.
- **C4.1** DONE: `edificio()` invariato; finestre e alberi dei lotti cambiano una volta per il nuovo seme (D3).
- **C4.2** DONE.
- **C5.1–C5.4** DONE.

## Scostamenti dal contratto
1. Corretta l'inversione theta/-theta degli spicchi: nelle città fuse gli oggetti cadevano sul bioma sbagliato. Le città a stile singolo non cambiano, quelle fuse sì.
2. `Quantita` ha tre campi in più: `strade`, `colline`, `rocce`.
3. Il mare è un golfo con terra ai lati.
4. Nel mondo:
   - il paesaggio tra le città arriva fino a R*1.8 (anello di montagne che sfuma nella nebbia);
   - la nebbia è calcolata sulla distanza della camera;
   - `near` della camera = 1.
5. Edifici semplificati: corpo `def.muro ?? p.colore` con fascia nel colore del progetto; 5 mesh di tetto, una per tipo; anche lotti, cartelli e antenne istanziati.
6. Etichette del mondo con dimensione fissa sullo schermo, ancorate alla base.
7. Aggiunte strade tra città vicine (ponti sui fiumi) e cursore pointer.
8. Escape controlla anche le modali `.velo` aperte.

## Controlli svolti
- Rilettura dei file toccati.
- Import ed export controllati per nome.
- Firme verificate su `@types/three` 0.170: `mergeGeometries`, `InstancedMesh.computeBoundingSphere`/`dispose`/`setColorAt`, `flatShading`, `ShapeGeometry`, `getSpacedPoints`.
- Orientamento dei triangoli del nastro dei fiumi.
- Nessun identificatore rimasto orfano in `city-scene.ts`.

## Rischi aperti
- **Non compilato.** Punti sospetti per TypeScript: `geoSculture ??= [...].map(g)` e destrutturazione `const [px, pz] = sorg ? [...] : pt(...)`.
- **Prestazioni non misurate:** circa 2200 alberi massimi per paesaggio, ~12 draw call istanziate per paesaggio.
- **D2:** eliminare, unire o far crescere una città sposta gli slot delle città successive. Il paesaggio tra le città cambia con gli id o con il layout.
- **Fiumi:** se bloccati vengono saltati; i ponti compaiono solo sulle strade.
- **Etichette:** con molte città possono sovrapporsi.
- **Mobile:** i pulsanti flottanti presuppongono un foglio alto 42vh.
- **Id duplicati:** due progetti con lo stesso id finiscono nello stesso punto.
