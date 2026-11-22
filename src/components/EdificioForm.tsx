"use client";
// Creazione e modifica di un edificio (progetto o attività), con le idee che diventano piani.
import { useState } from "react";
import { STILI } from "@/lib/stili";
import { Citta, LIVELLI, Progetto, STATI, StatoTappa, Stile, TipoEdificio } from "@/lib/types";
import { SceltaStile } from "./ui";

export interface DatiNuovo { nome: string; tipo: TipoEdificio; stile: Stile; quartiere: string; nuovoQuartiere: string; breve: string; idee: string }

export function NuovoEdificio({ citta, ai, onCrea }: { citta: Citta; ai: boolean; onCrea: (d: DatiNuovo, conAI: boolean) => void }) {
  const [d, setD] = useState<DatiNuovo>({ nome: "", tipo: "progetto", stile: citta.stili[0], quartiere: citta.quartieri[0]?.id ?? "centro", nuovoQuartiere: "", breve: "", idee: "" });
  const [conAI, setConAI] = useState(ai);
  return (
    <form className="modulo" onSubmit={(e) => { e.preventDefault(); if (d.nome.trim()) onCrea(d, conAI && ai); }}>
      <div className="segmenti" role="radiogroup" aria-label="Tipo di edificio">
        <button type="button" role="radio" aria-label="Progetto" aria-checked={d.tipo === "progetto"} onClick={() => setD({ ...d, tipo: "progetto" })}><b>Progetto</b><small>Un palazzo che cresce fino al lancio</small></button>
        <button type="button" role="radio" aria-label="Attività" aria-checked={d.tipo === "attivita"} onClick={() => setD({ ...d, tipo: "attivita" })}><b>Attività</b><small>Una casa che cresce con quello che fai</small></button>
      </div>
      <label>Nome<input required value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} placeholder={d.tipo === "progetto" ? "Es. App per il quartiere" : "Es. Corso di chitarra"} /></label>
      <label>In una frase<input value={d.breve} onChange={(e) => setD({ ...d, breve: e.target.value })} placeholder="Di cosa si tratta" /></label>
      <label>Quartiere
        <select value={d.quartiere} onChange={(e) => setD({ ...d, quartiere: e.target.value })}>
          {citta.quartieri.map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
          <option value="__nuovo">+ Nuovo quartiere…</option>
        </select>
      </label>
      {d.quartiere === "__nuovo" && <label>Nome del nuovo quartiere<input required value={d.nuovoQuartiere} onChange={(e) => setD({ ...d, nuovoQuartiere: e.target.value })} /></label>}
      <div><span className="etichetta">Che palazzo vuoi?</span><SceltaStile valore={d.stile} onChange={(s) => setD({ ...d, stile: s })} /></div>
      <label>Idee che ti vengono in mente <small>(una per riga: diventano i piani)</small>
        <textarea rows={5} value={d.idee} onChange={(e) => setD({ ...d, idee: e.target.value })}
          placeholder={d.tipo === "progetto" ? "Parlare con 5 possibili clienti\nFare una pagina di prova\nCapire quanto costa" : "Prima lezione fatta\nImparare 3 accordi\nSuonare con un amico"} />
      </label>
      <label className="opzione">
        <input type="checkbox" checked={conAI && ai} disabled={!ai} onChange={(e) => setConAI(e.target.checked)} />
        <span><b>Aiutami a costruirlo (AI).</b> {ai ? "Claude trasforma le idee in piani concreti e ti dice cosa manca." : "Serve ANTHROPIC_API_KEY in .env.local; senza, ogni idea diventa un piano."}</span>
      </label>
      <button className="btn primario" type="submit">Costruisci</button>
    </form>
  );
}

// Modifica completa di un edificio esistente
export function ModificaEdificio({ p, citta, onSalva, onAnnulla, onElimina }: { p: Progetto; citta: Citta; onSalva: (p: Progetto) => void; onAnnulla: () => void; onElimina: () => void }) {
  const [x, setX] = useState<Progetto>(p);
  const [stileAperto, setStileAperto] = useState(false);
  const setTappa = (i: number, v: Partial<Progetto["tappe"][number]>) => setX({ ...x, tappe: x.tappe.map((t, k) => (k === i ? { ...t, ...v } : t)) });
  const sposta = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= x.tappe.length) return;
    const t = [...x.tappe];
    [t[i], t[j]] = [t[j], t[i]];
    setX({ ...x, tappe: t });
  };
  return (
    <form className="modulo" onSubmit={(e) => { e.preventDefault(); onSalva({ ...x, tappe: x.tappe.filter((t) => t.t.trim()) }); }}>
      <label>Nome<input required value={x.nome} onChange={(e) => setX({ ...x, nome: e.target.value })} /></label>
      <label>Descrizione<textarea rows={2} value={x.breve} onChange={(e) => setX({ ...x, breve: e.target.value })} /></label>
      <div className="due">
        <label>Tipo
          <select value={x.tipo} onChange={(e) => setX({ ...x, tipo: e.target.value as TipoEdificio })}>
            <option value="progetto">Progetto</option><option value="attivita">Attività</option>
          </select>
        </label>
        {x.tipo === "progetto" && (
          <label>Livello
            <select value={x.livello} onChange={(e) => setX({ ...x, livello: Number(e.target.value) as Progetto["livello"] })}>
              {LIVELLI.map((l) => <option key={l.n} value={l.n}>{l.n} · {l.nome}</option>)}
            </select>
          </label>
        )}
      </div>
      <label>Quartiere
        <select value={x.quartiere} onChange={(e) => setX({ ...x, quartiere: e.target.value })}>
          {citta.quartieri.map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
        </select>
      </label>
      <div>
        <span className="etichetta">Stile della casa</span>
        <button type="button" className="btn piccolo" onClick={() => setStileAperto(!stileAperto)}>{STILI[x.stile ?? citta.stili[0]].nome}{x.accento ? ` con tetto ${STILI[x.accento].nome}` : ""} · cambia</button>
        {stileAperto && <SceltaStile valore={x.stile ?? citta.stili[0]} colore={x.colore} onChange={(s) => { setX({ ...x, stile: s, accento: x.accento === s ? undefined : x.accento }); setStileAperto(false); }} />}
        {x.accento && <button type="button" className="link" onClick={() => setX({ ...x, accento: undefined })}>Togli il tetto {STILI[x.accento].nome}</button>}
      </div>
      <label>Colore<input type="color" value={x.colore} onChange={(e) => setX({ ...x, colore: e.target.value })} /></label>
      <label>Prossimo passo<input value={x.prossimo} onChange={(e) => setX({ ...x, prossimo: e.target.value })} /></label>
      <div className="sez">
        <span className="etichetta">Piani (tappe)</span>
        <ul className="modifica-tappe">
          {x.tappe.map((t, i) => (
            <li key={i}>
              <select aria-label="Stato" value={t.s} onChange={(e) => setTappa(i, { s: e.target.value as StatoTappa })}>
                {(Object.keys(STATI) as StatoTappa[]).map((s) => <option key={s} value={s}>{STATI[s]}</option>)}
              </select>
              <input aria-label="Tappa" value={t.t} onChange={(e) => setTappa(i, { t: e.target.value })} />
              <button type="button" className="icona" aria-label="Sposta su" onClick={() => sposta(i, -1)}>↑</button>
              <button type="button" className="icona" aria-label="Sposta giù" onClick={() => sposta(i, 1)}>↓</button>
              <button type="button" className="icona pericolo" aria-label="Elimina tappa" onClick={() => setX({ ...x, tappe: x.tappe.filter((_, k) => k !== i) })}>×</button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn piccolo" onClick={() => setX({ ...x, tappe: [...x.tappe, { t: "", s: x.tipo === "attivita" ? "fatto" : "dafare" }] })}>+ Aggiungi piano</button>
      </div>
      <div className="azioni-riga">
        <button className="btn pericolo" type="button" onClick={onElimina}>Elimina edificio</button>
        <span style={{ flex: 1 }} />
        <button className="btn" type="button" onClick={onAnnulla}>Annulla</button>
        <button className="btn primario" type="submit">Salva</button>
      </div>
    </form>
  );
}
