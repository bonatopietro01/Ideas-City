"use client";
// Riepilogo di tutto quello che hai fatto, diviso per ambito (con riassunto AI opzionale).
import { useState } from "react";
import { AMBITI, ELENCO_AMBITI } from "@/lib/stili";
import { Citta } from "@/lib/types";
import { BadgeAmbito, Modale } from "./ui";

export function Riepilogo({ citta, ai, onChiudi }: { citta: Citta[]; ai: boolean; onChiudi: () => void }) {
  const [testo, setTesto] = useState<string | null>(null);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const edifici = citta.flatMap((c) => c.progetti.map((p) => ({ ...p, citta: c.nome })));

  async function riassumi() {
    setLavoro(true); setErrore(null);
    try {
      const r = await fetch("/api/riassunto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ citta }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.errore);
      setTesto(j.testo);
    } catch (e) {
      setErrore((e as Error).message || "Riassunto non riuscito.");
    } finally {
      setLavoro(false);
    }
  }

  return (
    <Modale titolo="Tutto quello che hai fatto" onChiudi={onChiudi} largo>
      <div className="riepilogo">
        <div className="azioni-riga">
          <button className="btn" type="button" onClick={riassumi} disabled={!ai || lavoro} title={ai ? "" : "Serve la chiave API di Anthropic in .env.local"}>
            {lavoro ? "Claude sta scrivendo…" : "Riassunto scritto con AI"}
          </button>
          {!ai && <span className="sotto">Per il riassunto AI aggiungi ANTHROPIC_API_KEY in .env.local</span>}
        </div>
        {errore && <div className="errore-box">{errore}</div>}
        {testo && <div className="riassunto">{testo.split(/\n+/).map((r, i) => <p key={i}>{r}</p>)}</div>}

        {ELENCO_AMBITI.map((a) => {
          const qui = edifici.filter((p) => p.ambito === a);
          if (!qui.length) return null;
          const fatte = qui.reduce((n, p) => n + p.tappe.filter((t) => t.s === "fatto").length, 0);
          return (
            <section key={a} className="riep-ambito" style={{ ["--c" as string]: AMBITI[a].colore }}>
              <h3><BadgeAmbito ambito={a} /> {qui.length} edifici · {fatte} cose fatte</h3>
              {qui.map((p) => {
                const f = p.tappe.filter((t) => t.s === "fatto");
                const inCorso = p.tappe.filter((t) => t.s === "parziale");
                return (
                  <div key={p.citta + p.id} className="riep-edificio">
                    <h4><i className="pallino" style={{ background: p.colore }} />{p.nome} <small>{p.tipo === "attivita" ? "attività" : `L${p.livello}`} · {p.citta}</small></h4>
                    {f.length || inCorso.length ? (
                      <ul>
                        {f.map((t, i) => <li key={i}>✓ {t.t}</li>)}
                        {inCorso.map((t, i) => <li key={"c" + i} className="in-corso">… {t.t}</li>)}
                      </ul>
                    ) : <p className="nota">Ancora niente di fatto. Prossimo passo: {p.prossimo}</p>}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </Modale>
  );
}
