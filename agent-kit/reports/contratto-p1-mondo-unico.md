# P1 — Contratto (architect) — READY

Checkpoint dell'architect del 2026-11-21, in sola lettura. Nessun file modificato e nessun comando eseguito.

## Fatti verificati nel sorgente
- In `city-scene.ts` c'è un solo `rnd`, con seme fisso 7. Lo usano `facciata()`, `edificio()` (alberi sul lotto) e il paesaggio, che lo consuma dopo gli edifici. Per questo oggi il paesaggio di una città cambia quando le si aggiunge un edificio.
- Tutto il contenuto della città sta entro `estensione`:
  - piazza = r + 4.5
  - anello = r + 7
  - insegna = r + 8.5
  - `estensione = RQ + max(10, r) + 10`
  - Il paesaggio parte da R0 = estensione + 4.
- `distruggi` percorre la scena e copre anche le `InstancedMesh`, che sono una sottoclasse di `Mesh`.
- In `MondoView`, `<main className="pagina">` segue il flusso del documento. `.barra-unione` è sticky (z 5), le modali `.velo` sono a z 50. In `globals.css`, `.scena` è fixed con inset 0 e `.top` è fixed con pointer-events none.
- `unisci` mette la città fusa in coda e rimuove le sorgenti; `eliminaCitta` filtra. Quindi l'ordine cambia, come già accettato in D2.

## 1. `src/components/city-layout.ts` (nuovo; puro, senza three e senza DOM)
```ts
export const FH = 1.25;                        // spostato da city-scene, stesso valore
export const raggioQ: (n: number) => number;   // formula invariata
export interface PosEdificio { x: number; z: number; rotY: number; wBase: number }
export interface QuartiereLayout { q: Quartiere; ps: Progetto[]; cx: number; cz: number; r: number; rPiazza: number; rAnello: number }
export interface LayoutCitta { quartieri: QuartiereLayout[]; RQ: number; estensione: number; pos: Record<string, PosEdificio> }
export function layoutCitta(c: Pick<Citta, "quartieri" | "progetti">): LayoutCitta;
export function zoneCitta(l: LayoutCitta, c: Pick<Citta, "progetti">, dx?: number, dz?: number): Zona[]; // piazze+anelli come cerchi (rAnello + margine), strade dei collegamenti come segmenti con strada: true
export function altezzaSemplice(p: Progetto): number; // progetto: 0.68 + FH*tappe.length (lotto basso se livello 0 o senza tappe); attività: stessa formula dei piani di edificio()
export interface SlotCitta { id: string; x: number; z: number; raggio: number }
export function layoutMondo(citta: Citta[], p?: { gap?: number; quanto?: number }): { slot: SlotCitta[]; raggioMondo: number };
```
Invariante: `layoutCitta` riproduce esattamente le formule attuali: posizioni e rotazioni degli edifici restano identiche.

`layoutMondo` (D2):
- Ogni città ha `raggio_i = ceil((estensione_i + MARGINE_BIOMA) / quanto) * quanto`.
- La prima città va all'origine. Le altre, nell'ordine dell'elenco, seguono una spirale di Archimede con angolo iniziale e passo costanti: ognuna prende il primo punto con `dist ≥ raggio_i + raggio_j + gap` da tutte le città già piazzate.
- Nessuna casualità.
- `raggioMondo = max(|centro| + raggio) + gap`, con il minimo `RAGGIO_MONDO_MIN`.

## 2. `src/components/landscape.ts` (nuovo)
```ts
export type Rng = () => number;
export function hashSeme(s: string): number;   // FNV-1a 32 bit, poi mappato in [1, 2147483646]
export function creaRng(seme: number): Rng;    // Park–Miller 16807, come oggi
export type Zona =
  | { tipo: "cerchio"; x: number; z: number; r: number }
  | { tipo: "rettangolo"; x: number; z: number; w: number; d: number; rot?: number }
  | { tipo: "segmento"; ax: number; az: number; bx: number; bz: number; larghezza: number; strada?: boolean };
export function libero(x: number, z: number, raggio: number, zone: Zona[]): boolean;
export interface Kit {
  mat(c: string, extra?: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial; // con cache, stessa chiave di oggi
  mesh(g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], ombra?: boolean): THREE.Mesh; // default castShadow e receiveShadow true
  box(w: number, h: number, d: number, m: THREE.Material | THREE.Material[]): THREE.Mesh;
  tex(c: HTMLCanvasElement): THREE.CanvasTexture;
  scuro(c: string, k?: number): string;
  etichetta(testo: string, sotto: string, colore: string): THREE.Sprite;
  albero(tipo: DefStile["albero"], x: number, z: number, s?: number): THREE.Group; // singolo, identico a oggi
  dispose(): void;
}
export function creaKit(): Kit;
export const COLORI_PAESAGGIO: { acqua; acquaEmissive; roccia; neve; sabbia; ... };
export interface Quantita { boschi: number; alberiPerBosco: [number, number]; raggioBosco: [number, number]; alberiSparsi: number;
  catene: number; montiPerCatena: [number, number]; laghi: number; fiumi: number; decori: number }
export const QUANTITA_BASE: Quantita;
export const PROFILI: Record<Stile, Partial<Quantita>>;
export const BUDGET: { desktop: number; mobile: number; maxAlberi: number; maxMonti: number };
export interface Lago { x: number; z: number; r: number; lobi: number; fase: number }
export interface Fiume { punti: [number, number][]; larghezza: number; ponti: [number, number, number][] }
export interface OpzioniPaesaggio {
  stili: Stile[]; centro: [number, number]; rInterno: number; rEsterno: number;
  seme: number; zone: Zona[]; quantita?: Partial<Quantita>; scala?: number;
  terreno?: boolean; nucleo?: boolean;    // default true: anelli di terreno per stile; nucleo = almeno 1 lago, 1 fiume, 1 catena
}
export interface Paesaggio { gruppo: THREE.Group; occupate: Zona[]; aggiorna(t: number): void; dispose(): void }
export function generaPaesaggio(kit: Kit, o: OpzioniPaesaggio): Paesaggio;
export function mobile(): boolean;              // window.innerWidth < 760
```
Come costruire gli elementi:
- **Spicchi per stile:** come oggi (C3.2).
- **Montagne:** catene di coni lungo un arco, con altezza decrescente. Due InstancedMesh (roccia e neve) da un cono unitario con base a y=0; la neve è traslata a 0.64h con scala 0.36.
- **Boschi:** un centro del cluster e N alberi distribuiti in un disco. Per ogni tipo di albero, due InstancedMesh (tronco e chioma) unite con `mergeGeometries` da `three/examples/jsm/utils/BufferGeometryUtils.js`. Dimensioni e colori identici a `albero()`.
- **Laghi:** `ShapeGeometry` con raggio modulato a lobi, più una riva di sabbia, a y≈0.04.
- **Fiumi:** un nastro lungo una `CatmullRomCurve3`, con larghezza che cresce a valle.
  - Partono da una montagna e arrivano al lago più vicino o a rEsterno.
  - Se un campione cade in una zona occupata, il fiume devia di un angolo fisso, senza consumare rnd.
  - Dove attraversa un segmento con `strada: true` c'è un ponte (box).
- **`aggiorna(t)`:** anima barche, sculture e luci tech come oggi.
- **`dispose()`:** libera geometrie e materiali propri, non la cache del Kit. È idempotente.

Invarianti:
- Niente `Math.random` e niente `Date`.
- Il consumo di rnd non dipende dai test sulle zone: si genera un numero fisso di candidati e poi si filtra.
- Ogni oggetto rispetta `libero()`.
- Le istanze hanno `castShadow = false` e `receiveShadow = true`.
- Le quantità vengono solo da `QUANTITA_BASE`, `PROFILI` e `BUDGET`.

## 3. RNG (D3)
- **Città:** gli edifici usano `creaRng(hashSeme(citta.id))`, il paesaggio usa `hashSeme(citta.id + "|paesaggio")`. Sono due flussi separati.
- **Mondo:** il paesaggio locale di ogni città usa `hashSeme(id + "|mondo")`, relativo al suo slot. Il paesaggio tra le città usa `hashSeme(ids.slice().sort().join("|"))`.

## 4. `city-scene.ts` (P2)
- Usa `creaKit()`, `layoutCitta()`, i due Rng e `generaPaesaggio(kit, { stili: stileCitta, centro: [0,0], rInterno: estensione + 2, rEsterno: estensione * 3, seme, zone: zoneCitta(...), scala: mobile() ? BUDGET.mobile : BUDGET.desktop })`.
- Il vecchio blocco del paesaggio va rimosso.
- Il loop chiama `paesaggio.aggiorna(t)`.
- `distruggi` chiama nell'ordine: `paesaggio.dispose()`, lo scorrimento attuale della scena, `kit.dispose()`.
- `Scena`, `Vista`, la firma di `creaScena` e il prato restano invariati.
- In `edificio()` NON cambia niente: firma, geometrie, colori, livelli, piani, impalcature, gru, cartelli, lampadine, segnali lacune, `albero()` singolo, i push in crescita/gru/lampeggianti/avvisi, `userData.id`, le ombre degli edifici. Cambiano solo l'origine di mat/box/mesh/albero (il Kit) e il seme di rnd.

## 5. `src/components/world-scene.ts` (nuovo)
```ts
import type { Vista } from "./city-scene";
export interface ScenaMondo { seleziona(id: string | null): void; volaSu(id: string): void; vistaMondo(): void; vista(): Vista; distruggi(): void }
export function creaMondo(host: HTMLElement, mondo: Mondo,
  opz: { onCitta: (id: string) => void; onArrivo?: (id: string) => void; vista?: Vista; anima?: boolean }): ScenaMondo;
```
- **Terreno e cielo:** disco di terreno con raggio `raggioMondo * 3` e colore `STILI.citta.terreno`. Cielo e nebbia da `STILI.citta.cielo`, con `Fog(cielo, raggioMondo*1.2, raggioMondo*2.6)`. Camera con far `raggioMondo*8`.
- **Ogni slot:** `generaPaesaggio` con gli stili della città, `rInterno = estensione + 2`, `rEsterno = slot.raggio + gap/2`, `nucleo: false`. Piazze e anelli vengono da `layoutCitta`, traslati sullo slot.
- **Edifici semplificati (D4):**
  - Una InstancedMesh globale per i corpi: box unitario con base a y=0, altezza da `altezzaSemplice`, colore da `setColorAt(p.colore)`.
  - Una seconda InstancedMesh per i tetti, colorati con `STILI[p.accento ?? stile].coloreTetto`.
  - L'array `istanzaCitta: string[]` dice a quale città appartiene ogni istanza.
  - Solo questi corpi proiettano ombra. Dopo aver scritto le matrici va chiamato `computeBoundingSphere()`.
- **Etichetta di ogni città:** `kit.etichetta(nome, "${AMBITI[ambito].nome} · ${n} edifici · ${punti} punti", AMBITI[ambito].colore)`.
- **Paesaggio tra le città:** su centro [0,0], con `rInterno 0`, `rEsterno raggioMondo`, stili `["citta"]` e `nucleo: true`. Le zone vietate sono i cerchi degli slot più le `occupate` dei paesaggi locali.
- **Budget:** `scala` ridotta su mobile, `pixelRatio` ≤ 2, `shadow.mapSize` 1024 su mobile.
- **Selezione:**
  - Bersagli del raycast: un disco di raggio `estensione` (MeshBasicMaterial trasparente con opacity 0 e depthWrite false), l'etichetta e i corpi degli edifici tramite `instanceId`. Tutti portano `userData.cittaId`.
  - Un clic senza trascinamento (soglia 6px) chiama `onCitta(id)`.
  - `seleziona` mostra un anello pulsante.
  - `volaSu` riusa `vola` e chiama `onArrivo` alla fine del volo, oppure subito se RIDUCI.
  - `vistaMondo` torna alla vista d'insieme.
- **0 città:** solo il terreno e il paesaggio tra le città, con `RAGGIO_MONDO_MIN` e seme `hashSeme("")`.
- **`distruggi`:** come nella scena città, più il dispose dei paesaggi e del Kit.

## 6. Integrazione UI (P4)
- **`MondoView` — struttura:**
  - Un `<div ref={host} className="scena" aria-label="Il tuo mondo 3D…">`.
  - Sopra, un header fixed `.mondo-top` con logo, h1 "Le tue città", numero di città e punti, e i pulsanti Riepilogo, Esporta, Nuova città, Importa.
  - Un pannello `.mondo-lista`, laterale su desktop e a foglio in basso sotto i 760px. Per ogni città: un pulsante con il nome (seleziona e vola), il BadgeAmbito, i punti, la checkbox Unisci (lo stato `scelte` resta com'è) e il link Elimina, che apre la modale esistente.
  - `.barra-unione` diventa fixed con z sotto 50.
- **`MondoView` — selezione:**
  - Lo stato `sel` arriva sia da `onCitta` sia dalla lista. Un effetto chiama `volaSu` e `seleziona`.
  - Un secondo `onCitta` sulla stessa città equivale a `onApri(id)`.
  - Il pulsante `.mondo-entra` "Entra in {nome}" compare dopo `onArrivo`.
  - Escape deseleziona e chiama `vistaMondo()`.
- **`MondoView` — scena e stati:**
  - La scena si crea in `useEffect([mondo])` con `import("./world-scene")` e conserva la `vista`, come fa CittaView.
  - Con 0 città la scena resta visibile, con sopra `.nessuna` e "Importa il tuo second brain".
  - La griglia `.carte` va rimossa. Esporta, unisci, le modali e il Riepilogo restano invariati.
- **`page.tsx`:**
  - CHIAVE, caricamento, salva, Schermata e il flusso dopo l'import restano invariati.
  - Facoltativo: uno stato `ultima?: string` passato come `iniziale` a MondoView, per ripartire dalla città da cui si esce.
- **`CittaView`:** cambia solo l'etichetta del pulsante, che diventa "← Mondo" con aria-label "Torna al mondo".

## Ordine
1. P2a: `city-layout.ts` e il Kit/RNG in `landscape.ts`; `city-scene` usa il paesaggio attuale spostato dentro `generaPaesaggio`.
2. P2b: boschi, catene, laghi, fiumi, PROFILI.
3. P3: `world-scene.ts`.
4. P4: MondoView, CSS, `page.tsx`.

Un solo owner, il frontend, e lavoro sequenziale.

## Rischi
- **D2:** anche la crescita di una città può spostare le città successive. La quantizzazione lo riduce, ma va segnalato all'utente.
- **C1.5 nel mondo:** la stabilità è garantita per il paesaggio locale di ogni città. Il paesaggio tra le città cambia quando cambiano gli id o il layout.
- **D3:** l'aspetto di finestre e alberi dei lotti cambia una volta, con il nuovo seme.
- **D5:** gli alberi non proiettano più ombra.
- **Raycast:** gli oggetti `visible=false` non vanno usati come bersagli. Le InstancedMesh hanno bisogno della bounding sphere aggiornata.
- **CSS:** controllare i pointer-events dei figli di `.top`/`.mondo-top` e l'ordine z tra pannello, barra (sotto 50) e modali (50).
