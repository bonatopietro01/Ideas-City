"use client";
// Il mondo: una sola scena 3D con tutte le tue città. Da qui si apre, crea, unisce ed elimina.
// Le azioni restano raggiungibili anche senza canvas dal pannello HTML "Le tue città".
import { useEffect, useRef, useState } from "react";
import type { Vista } from "./city-scene";
import type { ScenaMondo } from "./world-scene";
import { creaCitta, eliminaCitta, unisci } from "@/lib/mondo";
import { punteggio } from "@/lib/score";
import { AMBITI, STILI } from "@/lib/stili";
import { Ambito, Mondo, Stile } from "@/lib/types";
import { BadgeAmbito, Modale, SceltaAmbito, SceltaStile } from "./ui";
import { Riepilogo } from "./Riepilogo";

export function MondoView({ mondo, onMondo, onApri, onImporta, ai, iniziale }: {
  mondo: Mondo;
  onMondo: (m: Mondo) => void;
  onApri: (id: string) => void;
  onImporta: () => void;
  ai: boolean;
  /** città da cui si torna: la camera vola di nuovo su di lei */
  iniziale?: string;
}) {
  const [scelte, setScelte] = useState<string[]>([]);
  const [nomeFusa, setNomeFusa] = useState("");
  const [nuova, setNuova] = useState<null | { nome: string; ambito: Ambito; stile: Stile }>(null);
  const [daEliminare, setDaEliminare] = useState<string | null>(null);
  const [riepilogo, setRiepilogo] = useState(false);
  const [sel, setSel] = useState<string | null>(() => (iniziale && mondo.citta.some((c) => c.id === iniziale) ? iniziale : null));
  const [arrivata, setArrivata] = useState<string | null>(null);

  const host = useRef<HTMLDivElement>(null);
  const scena = useRef<ScenaMondo | null>(null);
  const vista = useRef<Vista | undefined>(undefined);
  const selRef = useRef(sel);
  selRef.current = sel;
  const arrivataRef = useRef(arrivata);
  arrivataRef.current = arrivata;
  const onApriRef = useRef(onApri);
  onApriRef.current = onApri;

  const totale = mondo.citta.reduce((n, c) => n + punteggio(c).totale, 0);
  const tocca = (id: string) => setScelte((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const nomiScelti = mondo.citta.filter((c) => scelte.includes(c.id)).map((c) => c.nome);
  const cittaSel = sel ? mondo.citta.find((c) => c.id === sel) ?? null : null;

  // un clic su una città la seleziona (volo); un secondo clic sulla stessa la apre
  const scegli = (id: string) => {
    if (selRef.current === id) onApriRef.current(id);
    else setSel(id);
  };
  const scegliRef = useRef(scegli);
  scegliRef.current = scegli;

  // ricrea la scena quando cambia il mondo, mantenendo il punto di vista
  useEffect(() => {
    let vivo = true;
    const s = selRef.current;
    const valida = !!s && mondo.citta.some((c) => c.id === s);
    // selezione invalidata (città eliminata o unita): le città possono aver cambiato slot,
    // quindi si riparte dalla vista d'insieme invece che dal punto di vista vecchio
    const prima = s && !valida ? undefined : vista.current;
    if (!prima) vista.current = undefined;
    import("./world-scene").then(({ creaMondo }) => {
      if (!vivo || !host.current) return;
      scena.current = creaMondo(host.current, mondo, {
        onCitta: (id) => scegliRef.current(id),
        onArrivo: (id) => { if (selRef.current === id) setArrivata(id); },
        vista: prima,
        anima: !prima && !s, // niente rotazione automatica se c'è (o c'era) una città selezionata
      });
      const ora = selRef.current;
      if (ora && mondo.citta.some((c) => c.id === ora)) {
        scena.current.seleziona(ora);
        // primo ingresso, oppure ricostruzione durante un volo non ancora arrivato: si rifà il volo
        if (!prima || arrivataRef.current !== ora) scena.current.volaSu(ora);
      }
    });
    return () => {
      vivo = false;
      if (scena.current) vista.current = scena.current.vista();
      scena.current?.distruggi();
      scena.current = null;
    };
  }, [mondo]);

  // la selezione può arrivare dalla scena o dalla lista: la scena vola sulla città
  useEffect(() => {
    setArrivata(null);
    scena.current?.seleziona(sel);
    if (sel) scena.current?.volaSu(sel);
  }, [sel]);

  // città eliminata o unita: la selezione non vale più
  useEffect(() => {
    if (sel && !mondo.citta.some((c) => c.id === sel)) setSel(null);
  }, [mondo, sel]);

  const modaleAperta = !!nuova || !!daEliminare || riepilogo;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      // anche la modale Importa (aperta da page.tsx) gestisce Escape da sola
      if (e.key !== "Escape" || modaleAperta || !selRef.current || document.querySelector(".velo")) return;
      setSel(null);
      scena.current?.vistaMondo();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [modaleAperta]);

  function esporta() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(mondo, null, 2)], { type: "application/json" }));
    a.download = "aideacity-mondo.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className={`mondo${mondo.citta.length ? "" : " vuoto"}`}>
      <div ref={host} className="scena" aria-label="Il tuo mondo 3D. Trascina per ruotare, rotella o pizzico per lo zoom, tocca una città per raggiungerla; le stesse azioni sono nel pannello Le tue città." />

      <header className="mondo-top">
        <div className="marchio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={40} height={40} />
          <div>
            <h1>Le tue città</h1>
            <p className="sotto">{mondo.citta.length} città · <b>{totale} punti</b></p>
          </div>
        </div>
        <div className="azioni-riga">
          <button className="btn" type="button" onClick={() => setRiepilogo(true)} disabled={!mondo.citta.length}>Riepilogo</button>
          <button className="btn" type="button" onClick={esporta} disabled={!mondo.citta.length}>Esporta</button>
          <button className="btn" type="button" onClick={() => setNuova({ nome: "", ambito: "personale", stile: "campagna" })}>Nuova città</button>
          <button className="btn primario" type="button" onClick={onImporta}>Importa second brain</button>
        </div>
      </header>

      {scelte.length > 0 && (
        <div className="barra-unione" role="region" aria-label="Unisci città">
          {scelte.length < 2 ? (
            <span>Seleziona almeno un&apos;altra città da unire a <b>{nomiScelti[0]}</b>.</span>
          ) : (
            <>
              <span>Unisci <b>{nomiScelti.join(" + ")}</b>: le case tengono il loro stile e prendono tetti e paesaggi dalle altre.</span>
              <input aria-label="Nome della città unita" placeholder="Nome della nuova città" value={nomeFusa} onChange={(e) => setNomeFusa(e.target.value)} />
              <button className="btn primario" type="button" onClick={() => {
                const nome = nomeFusa.trim() || nomiScelti.join(" + ");
                onMondo(unisci(mondo, scelte, nome));
                setScelte([]); setNomeFusa("");
              }}>Unisci</button>
            </>
          )}
          <button className="btn" type="button" onClick={() => setScelte([])}>Annulla</button>
        </div>
      )}

      {mondo.citta.length === 0 ? (
        <div className="nessuna">
          <p>Non hai ancora nessuna città.</p>
          <button className="btn primario" type="button" onClick={onImporta}>Importa il tuo second brain</button>
        </div>
      ) : (
        <aside className="mondo-lista" aria-label="Le tue città">
          <h2>Città del mondo</h2>
          <p className="nota">Tocca una città qui o nel mondo per raggiungerla; tocca di nuovo per entrare.</p>
          <ul>
            {mondo.citta.map((c) => {
              const pt = punteggio(c);
              const scelta = sel === c.id;
              return (
                <li key={c.id} className={`${scelta ? "attiva" : ""}${scelte.includes(c.id) ? " scelta" : ""}`} style={{ ["--c" as string]: AMBITI[c.ambito].colore }}>
                  <button className="mondo-citta" type="button" aria-pressed={scelta} onClick={() => scegli(c.id)}
                    aria-label={scelta ? `Entra in ${c.nome}` : `Raggiungi ${c.nome} nel mondo`}>
                    <i aria-hidden="true" />
                    <span className="nome">
                      <b>{c.nome}</b>
                      <small>{c.stili.map((s) => STILI[s].nome).join(" + ")} · {c.progetti.length} edifici</small>
                    </span>
                    <span className="pt">{pt.totale}<small>punti</small></span>
                  </button>
                  <div className="riga">
                    <BadgeAmbito ambito={c.ambito} />
                    <label className="opzione piccola"><input type="checkbox" checked={scelte.includes(c.id)} onChange={() => tocca(c.id)} />Unisci</label>
                    {scelta && <button className="link" type="button" onClick={() => onApri(c.id)}>Entra</button>}
                    <button className="link pericolo" type="button" onClick={() => setDaEliminare(c.id)}>Elimina</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>
      )}

      {cittaSel && arrivata === cittaSel.id && (
        <button className="btn primario mondo-entra" type="button" onClick={() => onApri(cittaSel.id)}>Entra in {cittaSel.nome} →</button>
      )}
      {mondo.citta.length > 0 && (
        <button className="mondo-reset" type="button" onClick={() => { setSel(null); scena.current?.vistaMondo(); }}>Vista mondo</button>
      )}

      {nuova && (
        <Modale titolo="Nuova città" onChiudi={() => setNuova(null)}>
          <form className="modulo" onSubmit={(e) => {
            e.preventDefault();
            onMondo({ ...mondo, citta: [...mondo.citta, creaCitta(nuova.nome.trim() || `Città ${AMBITI[nuova.ambito].nome}`, nuova.ambito, nuova.stile)] });
            setNuova(null);
          }}>
            <label>Nome<input value={nuova.nome} onChange={(e) => setNuova({ ...nuova, nome: e.target.value })} placeholder="Es. Città del mare" /></label>
            <label>Ambito<SceltaAmbito valore={nuova.ambito} onChange={(a) => setNuova({ ...nuova, ambito: a, stile: AMBITI[a].stile })} /></label>
            <div><span className="etichetta">Stile delle case</span><SceltaStile valore={nuova.stile} onChange={(s) => setNuova({ ...nuova, stile: s })} colore={AMBITI[nuova.ambito].colore} /></div>
            <button className="btn primario" type="submit">Crea la città</button>
          </form>
        </Modale>
      )}

      {daEliminare && (
        <Modale titolo="Eliminare la città?" onChiudi={() => setDaEliminare(null)}>
          <div className="modulo">
            <p><b>{mondo.citta.find((c) => c.id === daEliminare)?.nome}</b> e tutti i suoi edifici verranno eliminati. Non si può annullare: se vuoi tenerne una copia, usa prima Esporta.</p>
            <div className="azioni-riga">
              <button className="btn" type="button" onClick={() => setDaEliminare(null)}>Annulla</button>
              <button className="btn pericolo" type="button" onClick={() => { onMondo(eliminaCitta(mondo, daEliminare)); setScelte((s) => s.filter((x) => x !== daEliminare)); setDaEliminare(null); }}>Elimina</button>
            </div>
          </div>
        </Modale>
      )}

      {riepilogo && <Riepilogo citta={mondo.citta} ai={ai} onChiudi={() => setRiepilogo(false)} />}
    </div>
  );
}
