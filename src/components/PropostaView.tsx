"use client";
// Dopo l'analisi: mostra gli edifici trovati, divisi per ambito, e chiede come creare le città.
import { useMemo, useState } from "react";
import { applicaProposta, Gruppo } from "@/lib/mondo";
import { AMBITI, ELENCO_AMBITI, STILI } from "@/lib/stili";
import { Ambito, Mondo, Proposta, Stile } from "@/lib/types";
import { BadgeAmbito, SceltaStile } from "./ui";

export function PropostaView({ proposta, mondo, onFatto, onAnnulla }: { proposta: Proposta; mondo: Mondo; onFatto: (m: Mondo) => void; onAnnulla: () => void }) {
  const [assegna, setAssegna] = useState<Record<string, Ambito | "">>(() => Object.fromEntries(proposta.progetti.map((p) => [p.id, p.ambito])));
  const [gruppi, setGruppi] = useState<Record<Ambito, Omit<Gruppo, "progetti" | "ambito">>>(() => {
    const g = {} as Record<Ambito, Omit<Gruppo, "progetti" | "ambito">>;
    for (const a of ELENCO_AMBITI) {
      const conta: Record<string, number> = {};
      proposta.progetti.filter((p) => p.ambito === a).forEach((p) => p.stile && (conta[p.stile] = (conta[p.stile] ?? 0) + 1));
      const stile = (Object.entries(conta).sort((x, y) => y[1] - x[1])[0]?.[0] as Stile) ?? AMBITI[a].stile;
      g[a] = { includi: true, nome: `${AMBITI[a].nome} · ${proposta.nomeVault}`, stile, destinazione: "nuova" };
    }
    return g;
  });
  const [stileAperto, setStileAperto] = useState<Ambito | null>(null);

  const perAmbito = useMemo(() => {
    const r = {} as Record<Ambito, typeof proposta.progetti>;
    ELENCO_AMBITI.forEach((a) => (r[a] = proposta.progetti.filter((p) => assegna[p.id] === a)));
    return r;
  }, [assegna, proposta]);
  const esclusi = proposta.progetti.filter((p) => !assegna[p.id]);
  const attivi = ELENCO_AMBITI.filter((a) => perAmbito[a].length);
  const daCreare = attivi.filter((a) => gruppi[a].includi);

  const set = (a: Ambito, v: Partial<Omit<Gruppo, "progetti" | "ambito">>) => setGruppi((g) => ({ ...g, [a]: { ...g[a], ...v } }));

  function crea() {
    const lista: Gruppo[] = attivi.map((a) => ({ ...gruppi[a], ambito: a, progetti: perAmbito[a].map((p) => p.id) }));
    onFatto(applicaProposta(mondo, proposta, lista));
  }

  return (
    <main className="pagina">
      <header className="pagina-top">
        <div>
          <h1>Ho trovato {proposta.progetti.length} edifici</h1>
          <p className="sotto">
            {proposta.progetti.filter((p) => p.tipo === "progetto").length} progetti e {proposta.progetti.filter((p) => p.tipo === "attivita").length} attività in {attivi.length} ambiti
            {proposta.analisi === "ai" ? " (analisi AI)" : " (analisi locale)"}. Scegli come costruire le città: puoi spostare un edificio in un altro ambito o escluderlo.
          </p>
        </div>
        <div className="azioni-riga">
          <button className="btn" type="button" onClick={onAnnulla}>Annulla</button>
          <button className="btn primario" type="button" onClick={crea} disabled={!daCreare.length}>Crea {daCreare.length === 1 ? "la città" : `${daCreare.length} città`}</button>
        </div>
      </header>

      <div className="gruppi">
        {attivi.map((a) => {
          const g = gruppi[a];
          return (
            <section key={a} className={`gruppo${g.includi ? "" : " spento"}`} style={{ ["--c" as string]: AMBITI[a].colore }}>
              <header>
                <label className="opzione"><input type="checkbox" checked={g.includi} onChange={(e) => set(a, { includi: e.target.checked })} /><BadgeAmbito ambito={a} /></label>
                <span className="sotto">{perAmbito[a].length} edifici</span>
              </header>
              <div className="campi">
                <label>Dove
                  <select value={g.destinazione} onChange={(e) => set(a, { destinazione: e.target.value })}>
                    <option value="nuova">Nuova città</option>
                    {mondo.citta.map((c) => <option key={c.id} value={c.id}>Aggiungi a: {c.nome}</option>)}
                  </select>
                </label>
                {g.destinazione === "nuova" && <label>Nome della città<input value={g.nome} onChange={(e) => set(a, { nome: e.target.value })} /></label>}
                {g.destinazione === "nuova" && (
                  <div>
                    <span className="etichetta">Stile delle case</span>
                    <button type="button" className="btn piccolo" onClick={() => setStileAperto(stileAperto === a ? null : a)}>{STILI[g.stile].nome} · cambia</button>
                    {stileAperto === a && <SceltaStile valore={g.stile} onChange={(s) => { set(a, { stile: s }); setStileAperto(null); }} />}
                  </div>
                )}
              </div>
              <ul className="righe">
                {perAmbito[a].map((p) => (
                  <li key={p.id}>
                    <i className="pallino" style={{ background: p.colore }} />
                    <span className="nome">{p.nome}<small>{p.tipo === "attivita" ? "Attività" : `Progetto · L${p.livello}`} · {p.tappe.length} tappe</small></span>
                    <select aria-label={`Ambito di ${p.nome}`} value={assegna[p.id]} onChange={(e) => setAssegna((x) => ({ ...x, [p.id]: e.target.value as Ambito | "" }))}>
                      {ELENCO_AMBITI.map((x) => <option key={x} value={x}>{AMBITI[x].nome}</option>)}
                      <option value="">Escludi</option>
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {esclusi.length > 0 && (
          <section className="gruppo spento">
            <header><b>Esclusi</b><span className="sotto">{esclusi.length}</span></header>
            <ul className="righe">
              {esclusi.map((p) => (
                <li key={p.id}>
                  <span className="nome">{p.nome}</span>
                  <button className="btn piccolo" type="button" onClick={() => setAssegna((x) => ({ ...x, [p.id]: p.ambito }))}>Rimetti</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
