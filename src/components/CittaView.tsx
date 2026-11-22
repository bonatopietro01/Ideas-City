"use client";
// Una città: scena 3D, scheda dell'edificio, idee che diventano piani, modifiche.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Scena, Vista } from "./city-scene";
import { eliminaProgetto, ideeInPianiLocale, nuovoEdificio, nuovoId, oggi, ricalcola, salvaProgetto, aggiornaCitta } from "@/lib/mondo";
import { slug } from "@/lib/parse-vault";
import { punteggio } from "@/lib/score";
import { AMBITI, ELENCO_STILI, STILI } from "@/lib/stili";
import { Citta, LIVELLI, LIVELLI_ATTIVITA, Mondo, Progetto, STATI, StatoTappa, TIPI_LACUNA } from "@/lib/types";
import { BadgeAmbito, Campione, Modale, SceltaAmbito } from "./ui";
import { ModificaEdificio, NuovoEdificio } from "./EdificioForm";
import { Riepilogo } from "./Riepilogo";

const CICLO: StatoTappa[] = ["dafare", "parziale", "fatto", "chiarire"];
const dataIt = () => new Date().toLocaleDateString("it-IT");

async function costruisciConAI(p: Progetto, c: Citta): Promise<{ p: Progetto; commento: string }> {
  const r = await fetch("/api/costruisci", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ progetto: p, citta: c.nome, altri: c.progetti.filter((x) => x.id !== p.id).map((x) => x.nome) }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.errore ?? "Costruzione non riuscita.");
  const usate = p.idee.filter((i) => !i.usata).length;
  const q = ricalcola({
    ...p,
    breve: j.breve || p.breve,
    tappe: j.tappe,
    prossimo: j.prossimo,
    lacune: j.lacune,
    livello: p.tipo === "progetto" ? (Math.max(p.livello, Math.min(5, j.livello)) as Progetto["livello"]) : p.livello,
    idee: p.idee.map((i) => ({ ...i, usata: true })),
    registro: [...p.registro, `${dataIt()} · ${usate} idee costruite con AI`],
  }, true);
  return { p: q, commento: j.commento };
}

export function CittaView({ mondo, cittaId, onMondo, onIndietro, ai }: { mondo: Mondo; cittaId: string; onMondo: (m: Mondo) => void; onIndietro: () => void; ai: boolean }) {
  const citta = mondo.citta.find((c) => c.id === cittaId)!;
  const host = useRef<HTMLDivElement>(null);
  const scena = useRef<Scena | null>(null);
  const vista = useRef<Vista | undefined>(undefined);
  const [sel, setSel] = useState<string | null>(null);
  const [modifica, setModifica] = useState(false);
  const [nuovo, setNuovo] = useState(false);
  const [modCitta, setModCitta] = useState(false);
  const [riepilogo, setRiepilogo] = useState(false);
  const [daEliminare, setDaEliminare] = useState<string | null>(null);
  const [idea, setIdea] = useState("");
  const [lavoro, setLavoro] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  const pt = useMemo(() => punteggio(citta), [citta]);
  const perId = useMemo(() => Object.fromEntries(citta.progetti.map((p) => [p.id, p])), [citta]);
  const qNome = useMemo(() => Object.fromEntries(citta.quartieri.map((q) => [q.id, q.nome])), [citta]);

  // ricrea la scena quando cambia la città, mantenendo il punto di vista
  useEffect(() => {
    let vivo = true;
    const prima = vista.current;
    import("./city-scene").then(({ creaScena }) => {
      if (!vivo || !host.current) return;
      scena.current = creaScena(host.current, citta, (id) => { setSel(id); setModifica(false); }, { vista: prima, anima: !prima });
    });
    return () => {
      vivo = false;
      if (scena.current) vista.current = scena.current.vista();
      scena.current?.distruggi();
      scena.current = null;
    };
  }, [citta]);

  useEffect(() => { scena.current?.seleziona(sel); }, [sel]);
  const chiudi = useCallback(() => { setSel(null); setModifica(false); setMessaggio(null); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !nuovo && !modCitta && !riepilogo && !daEliminare) chiudi(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [chiudi, nuovo, modCitta, riepilogo, daEliminare]);

  const salva = (p: Progetto) => onMondo(salvaProgetto(mondo, citta.id, p));

  async function costruisci(p: Progetto, base: Mondo = mondo) {
    setMessaggio(null);
    if (!ai) {
      onMondo(salvaProgetto(base, citta.id, ideeInPianiLocale(p)));
      setMessaggio({ tipo: "ok", testo: "Ogni idea è diventata un piano." });
      return;
    }
    setLavoro("Claude sta costruendo i piani dalle tue idee…");
    try {
      const { p: q, commento } = await costruisciConAI(p, citta);
      onMondo(salvaProgetto(base, citta.id, q));
      setMessaggio({ tipo: "ok", testo: commento });
    } catch (e) {
      onMondo(base);
      setMessaggio({ tipo: "errore", testo: (e as Error).message });
    } finally {
      setLavoro(null);
    }
  }

  const p = sel ? perId[sel] : null;
  const ordinati = [...citta.progetti].sort((a, b) => a.quartiere.localeCompare(b.quartiere));
  const scala = p?.tipo === "attivita" ? LIVELLI_ATTIVITA : LIVELLI;

  return (
    <div className={p ? "con-scheda" : ""}>
      <div ref={host} className="scena" aria-label="Città 3D. Trascina per ruotare, rotella o pizzico per lo zoom, tocca un edificio per aprirne la scheda." />
      <div className="top">
        <div className="titolo">
          <button className="mini" type="button" onClick={onIndietro} aria-label="Torna al mondo">← Mondo</button>
          <h1>{citta.nome}</h1>
          <span className="punti" title={`${pt.tappeFatte} tappe fatte · ${pt.livelli} livelli · ${pt.collegamenti} collegamenti`}>{pt.totale} punti</span>
          <span>{citta.progetti.length} edifici · {pt.lacuneAperte} cose mancanti</span>
          <div className="strumenti">
            <button className="mini" type="button" onClick={() => setRiepilogo(true)}>Riepilogo</button>
            <button className="mini" type="button" onClick={() => setModCitta(true)}>Modifica città</button>
            <button className="mini accento" type="button" onClick={() => setNuovo(true)}>+ Edificio</button>
          </div>
        </div>
        <div className="chips" role="toolbar" aria-label="Vai a un edificio">
          {ordinati.map((x) => (
            <button key={x.id} className="chip" type="button" aria-pressed={sel === x.id} onClick={() => { setSel(x.id); setModifica(false); setMessaggio(null); }}>
              <i style={{ background: x.colore, borderRadius: x.tipo === "attivita" ? "50%" : 3 }} />
              {x.nome}
              <b>{x.tipo === "attivita" ? "att." : `L${x.livello}`}</b>
              {x.lacune.length > 0 && <span className="n">{x.lacune.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {p && (
        <section className="scheda" aria-live="polite">
          <header>
            <h2>{p.nome}</h2>
            {!modifica && <button className="mini" type="button" onClick={() => setModifica(true)}>Modifica</button>}
            <button className="chiudi" type="button" aria-label="Chiudi scheda" onClick={chiudi}>×</button>
          </header>
          {modifica ? (
            <ModificaEdificio
              key={p.id}
              p={p}
              citta={citta}
              onAnnulla={() => setModifica(false)}
              onSalva={(q) => { salva(ricalcola(q, JSON.stringify(q.tappe) === JSON.stringify(p.tappe))); setModifica(false); }}
              onElimina={() => setDaEliminare(p.id)}
            />
          ) : (
            <>
              <div className="pill-riga">
                <span className="pill">{p.tipo === "attivita" ? "Attività" : "Progetto"}</span>
                <span className="pill">{qNome[p.quartiere] ?? "Quartiere"}</span>
                <BadgeAmbito ambito={p.ambito} />
                <span className="pill"><Campione stile={p.stile ?? citta.stili[0]} colore={p.colore} />{STILI[p.stile ?? citta.stili[0]].nome}{p.accento ? ` + ${STILI[p.accento].nome}` : ""}</span>
              </div>
              {p.breve && <p className="breve">{p.breve}</p>}
              <div className="sez">
                <h3>Livello {p.livello} di 5 · {scala[p.livello].nome}</h3>
                <div className="scala" style={{ ["--c" as string]: p.colore }}>
                  {scala.map((l) => <div key={l.n} className={l.n <= p.livello ? "on" : ""} title={l.nome} />)}
                </div>
                <p className="nota">{scala[p.livello].desc}{p.livello < 5 ? ` Prossimo livello: ${scala[p.livello + 1].nome}.` : ""}</p>
              </div>
              <div className="sez"><h3>Prossimo passo</h3><div className="prossimo">{p.prossimo}</div></div>

              <div className="sez idee">
                <h3>Idee · {p.idee.filter((i) => !i.usata).length} da costruire</h3>
                <form className="riga-idea" onSubmit={(e) => {
                  e.preventDefault();
                  if (!idea.trim()) return;
                  salva({ ...p, idee: [...p.idee, { id: nuovoId("i"), testo: idea.trim(), data: oggi(), usata: false }] });
                  setIdea("");
                }}>
                  <input aria-label="Nuova idea" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={p.tipo === "attivita" ? "Cosa hai fatto o vuoi fare?" : "Ti è venuta un'idea per questo progetto?"} />
                  <button className="btn piccolo" type="submit">Aggiungi</button>
                </form>
                {p.idee.length > 0 && (
                  <ul className="lista-idee">
                    {p.idee.map((i) => (
                      <li key={i.id} className={i.usata ? "usata" : ""}>
                        <span>{i.testo}</span>
                        <small>{i.usata ? "costruita" : i.data.split("-").reverse().join("/")}</small>
                        {!i.usata && <button className="icona" type="button" aria-label="Elimina idea" onClick={() => salva({ ...p, idee: p.idee.filter((x) => x.id !== i.id) })}>×</button>}
                      </li>
                    ))}
                  </ul>
                )}
                {p.idee.some((i) => !i.usata) && (
                  <button className="btn primario" type="button" disabled={!!lavoro} onClick={() => costruisci(p)}>
                    {lavoro ? "Costruisco…" : ai ? "Aiutami a costruire i piani" : "Trasforma le idee in piani"}
                  </button>
                )}
                {lavoro && <p className="stato" role="status">{lavoro}</p>}
                {messaggio && <div className={messaggio.tipo === "ok" ? "ok-box" : "errore-box"} role="status">{messaggio.testo}</div>}
              </div>

              {p.lacune.length > 0 && (
                <div className="sez">
                  <h3>Cosa manca · {p.lacune.length}</h3>
                  <ul className="lacune">{p.lacune.map((l, i) => <li key={i}><small>{TIPI_LACUNA[l.tipo]}</small>{l.testo}</li>)}</ul>
                </div>
              )}
              <div className="sez">
                <h3>{p.tipo === "attivita" ? "Fatto e in programma" : "Tappe (piani)"} · {p.tappe.filter((t) => t.s === "fatto").length} di {p.tappe.length} fatte</h3>
                <p className="nota">Tocca lo stato per cambiarlo.</p>
                <ul className="tappe">
                  {p.tappe.map((t, i) => (
                    <li key={i}>
                      <button type="button" className={`st ${t.s}`} title="Cambia stato" onClick={() => {
                        const s = CICLO[(CICLO.indexOf(t.s) + 1) % CICLO.length];
                        const q = { ...p, tappe: p.tappe.map((x, k) => (k === i ? { ...x, s } : x)) };
                        if (s === "fatto") q.registro = [...p.registro, `${dataIt()} · Fatto: ${t.t}`];
                        salva(ricalcola(q, citta.analisi === "ai"));
                      }}>{STATI[t.s]}</button>
                      <span>{t.t}</span>
                    </li>
                  ))}
                </ul>
                {p.tipo === "attivita" && (
                  <button className="btn piccolo" type="button" onClick={() => salva(ricalcola({ ...p, tappe: [...p.tappe, { t: `Fatto il ${dataIt()}`, s: "fatto" }], registro: [...p.registro, `${dataIt()} · Fatto oggi`] }))}>+ Fatto oggi</button>
                )}
              </div>
              {p.collegamenti.length > 0 && (
                <div className="sez">
                  <h3>Collegato a</h3>
                  <div className="collegati">
                    {p.collegamenti.map((c) => perId[c] && (
                      <button key={c} className="chip" type="button" onClick={() => setSel(c)}><i style={{ background: perId[c].colore }} />{perId[c].nome}</button>
                    ))}
                  </div>
                </div>
              )}
              {p.fonti.length > 0 && <div className="sez"><h3>Note</h3><ul className="reg">{p.fonti.map((f) => <li key={f}>{f}</li>)}</ul></div>}
              {p.registro.length > 0 && <div className="sez"><h3>Registro</h3><ul className="reg">{p.registro.slice(-8).map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
            </>
          )}
        </section>
      )}

      {!p && (
        <div className="legenda">
          <strong>Come leggere la città</strong>
          <div className="riga"><span className="sw pieno" />Piano illuminato: tappa fatta</div>
          <div className="riga"><span className="sw vuoto" />Piano spento: tappa in corso</div>
          <div className="riga"><span className="sw impalc" />Impalcatura: da fare · rossa: da chiarire</div>
          <div className="riga"><span className="sw pallino" />Cartello rosso: cose che mancano</div>
          <div className="riga"><span className="sw lampadina" />Luce gialla: idee da costruire</div>
          <div className="riga" style={{ color: "var(--muted)" }}>Palazzi = progetti, case con tetto = attività. Lo stile ({citta.stili.map((s) => STILI[s].nome).join(" + ")}) cambia case e paesaggio.</div>
        </div>
      )}
      <button className="reset" type="button" onClick={() => { chiudi(); scena.current?.vistaCitta(); }}>Vista città</button>

      {nuovo && (
        <Modale titolo="Nuovo edificio" onChiudi={() => setNuovo(false)} largo>
          <NuovoEdificio citta={citta} ai={ai} onCrea={(d, conAI) => {
            let m = mondo;
            let quartiere = d.quartiere;
            if (quartiere === "__nuovo") {
              quartiere = slug(d.nuovoQuartiere) + "-" + Date.now().toString(36).slice(-3);
              m = aggiornaCitta(m, citta.id, (c) => ({ ...c, quartieri: [...c.quartieri, { id: quartiere, nome: d.nuovoQuartiere.trim(), breve: "" }] }));
            }
            const cAgg = m.citta.find((c) => c.id === citta.id)!;
            const q = nuovoEdificio(cAgg, { nome: d.nome.trim(), tipo: d.tipo, stile: d.stile, quartiere, breve: d.breve.trim(), idee: d.idee.split(/\n+/).map((s) => s.trim()) });
            m = salvaProgetto(m, citta.id, q);
            setNuovo(false);
            setSel(q.id);
            setModifica(false);
            if (q.idee.length) {
              if (conAI) costruisci(q, m);
              else { onMondo(salvaProgetto(m, citta.id, ideeInPianiLocale(q))); setMessaggio({ tipo: "ok", testo: "Ogni idea è diventata un piano." }); }
            } else onMondo(m);
          }} />
        </Modale>
      )}

      {modCitta && <ModificaCitta citta={citta} onChiudi={() => setModCitta(false)} onSalva={(c) => { onMondo(aggiornaCitta(mondo, citta.id, () => c)); setModCitta(false); }} />}

      {daEliminare && (
        <Modale titolo="Eliminare l'edificio?" onChiudi={() => setDaEliminare(null)}>
          <div className="modulo">
            <p><b>{perId[daEliminare]?.nome}</b> verrà tolto dalla città con tutte le sue tappe e idee.</p>
            <div className="azioni-riga">
              <button className="btn" type="button" onClick={() => setDaEliminare(null)}>Annulla</button>
              <button className="btn pericolo" type="button" onClick={() => { onMondo(eliminaProgetto(mondo, citta.id, daEliminare)); setDaEliminare(null); chiudi(); }}>Elimina</button>
            </div>
          </div>
        </Modale>
      )}

      {riepilogo && <Riepilogo citta={[citta]} ai={ai} onChiudi={() => setRiepilogo(false)} />}
    </div>
  );
}

function ModificaCitta({ citta, onSalva, onChiudi }: { citta: Citta; onSalva: (c: Citta) => void; onChiudi: () => void }) {
  const [c, setC] = useState(citta);
  const toggle = (s: (typeof ELENCO_STILI)[number]) => {
    const stili = c.stili.includes(s) ? c.stili.filter((x) => x !== s) : [...c.stili, s];
    if (stili.length) setC({ ...c, stili });
  };
  return (
    <Modale titolo="Modifica città" onChiudi={onChiudi} largo>
      <form className="modulo" onSubmit={(e) => { e.preventDefault(); onSalva(c); }}>
        <label>Nome<input required value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} /></label>
        <label>Ambito<SceltaAmbito valore={c.ambito} onChange={(a) => setC({ ...c, ambito: a })} /></label>
        <div>
          <span className="etichetta">Stili della città <small>(più di uno = paesaggi affiancati; il primo è quello delle case senza stile proprio)</small></span>
          <div className="stili">
            {ELENCO_STILI.map((s) => (
              <button key={s} type="button" role="checkbox" aria-checked={c.stili.includes(s)} className="stile" onClick={() => toggle(s)}>
                <Campione stile={s} colore={AMBITI[c.ambito].colore} />
                <span><b>{STILI[s].nome}{c.stili[0] === s ? " · principale" : ""}</b><small>{STILI[s].desc}</small></span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="etichetta">Quartieri</span>
          <ul className="modifica-tappe">
            {c.quartieri.map((q, i) => {
              const usato = c.progetti.some((p) => p.quartiere === q.id);
              return (
                <li key={q.id}>
                  <input aria-label="Nome quartiere" value={q.nome} onChange={(e) => setC({ ...c, quartieri: c.quartieri.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)) })} />
                  <button type="button" className="icona pericolo" disabled={usato || c.quartieri.length === 1} title={usato ? "Ha ancora edifici" : "Elimina quartiere"} aria-label="Elimina quartiere"
                    onClick={() => setC({ ...c, quartieri: c.quartieri.filter((x) => x.id !== q.id) })}>×</button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn piccolo" onClick={() => setC({ ...c, quartieri: [...c.quartieri, { id: nuovoId("q"), nome: "Nuovo quartiere", breve: "" }] })}>+ Quartiere</button>
        </div>
        <div className="azioni-riga"><span style={{ flex: 1 }} /><button className="btn" type="button" onClick={onChiudi}>Annulla</button><button className="btn primario" type="submit">Salva</button></div>
      </form>
    </Modale>
  );
}
