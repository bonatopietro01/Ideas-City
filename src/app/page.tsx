"use client";

import { useEffect, useState } from "react";
import { analisiLocale } from "@/lib/parse-vault";
import { daLegacy, importaJson } from "@/lib/import-legacy";
import { normalizzaMondo } from "@/lib/mondo";
import { Mondo, Nota, Proposta } from "@/lib/types";
import { MondoView } from "@/components/MondoView";
import { CittaView } from "@/components/CittaView";
import { PropostaView } from "@/components/PropostaView";
import { Modale } from "@/components/ui";
import miaCitta from "@/data/mia-citta.json";

const CHIAVE = "aideacity:mondo";

type Schermata = { tipo: "mondo" } | { tipo: "citta"; id: string } | { tipo: "proposta"; proposta: Proposta };

function mondoIniziale(): Mondo {
  // id stabile: il paesaggio (seme da citta.id) resta uguale a ogni reload anche prima del primo salvataggio
  return { versione: 2, citta: [{ ...daLegacy(miaCitta as Parameters<typeof daLegacy>[0], "Città delle Idee", "lavoro", "tech"), id: "citta-delle-idee" }] };
}

async function leggiCartella(files: FileList): Promise<{ note: Nota[]; radice: string }> {
  const note: Nota[] = [];
  let radice = "";
  for (const f of Array.from(files)) {
    const rel = (f as File & { webkitRelativePath: string }).webkitRelativePath || f.name;
    const parti = rel.split("/");
    radice ||= parti.length > 1 ? parti[0] : "";
    const path = parti.length > 1 ? parti.slice(1).join("/") : rel;
    if (!/\.md$/i.test(path) || parti.some((p) => p.startsWith(".") || p === "node_modules")) continue;
    note.push({ path, nome: path.split("/").pop()!.replace(/\.md$/i, ""), testo: await f.text() });
  }
  return { note, radice };
}

export default function Home() {
  const [mondo, setMondo] = useState<Mondo | null>(null);
  const [schermata, setSchermata] = useState<Schermata>({ tipo: "mondo" });
  const [ai, setAi] = useState(false);
  const [importa, setImporta] = useState(false);
  const [ultima, setUltima] = useState<string | undefined>(undefined); // città da cui si torna al mondo

  useEffect(() => {
    let m: Mondo | null = null;
    try {
      const s = localStorage.getItem(CHIAVE);
      if (s) m = normalizzaMondo(JSON.parse(s));
    } catch {}
    setMondo(m ?? mondoIniziale());
    fetch("/api/stato").then((r) => r.json()).then((j) => setAi(!!j.ai)).catch(() => setAi(false));
  }, []);

  const salva = (m: Mondo) => {
    setMondo(m);
    try { localStorage.setItem(CHIAVE, JSON.stringify(m)); } catch {}
  };

  if (!mondo) return null;

  if (schermata.tipo === "citta" && mondo.citta.some((c) => c.id === schermata.id)) {
    const id = schermata.id;
    return <CittaView key={id} mondo={mondo} cittaId={id} onMondo={salva} onIndietro={() => { setUltima(id); setSchermata({ tipo: "mondo" }); }} ai={ai} />;
  }
  if (schermata.tipo === "proposta") {
    return (
      <PropostaView
        proposta={schermata.proposta}
        mondo={mondo}
        onAnnulla={() => setSchermata({ tipo: "mondo" })}
        onFatto={(m) => {
          salva(m);
          const nuove = m.citta.filter((c) => !mondo.citta.some((x) => x.id === c.id));
          setSchermata(nuove.length === 1 ? { tipo: "citta", id: nuove[0].id } : { tipo: "mondo" });
        }}
      />
    );
  }
  return (
    <>
      <MondoView mondo={mondo} onMondo={salva} onApri={(id) => setSchermata({ tipo: "citta", id })} onImporta={() => setImporta(true)} ai={ai} iniziale={ultima} />
      {importa && (
        <Importa
          ai={ai}
          onChiudi={() => setImporta(false)}
          onProposta={(p) => { setImporta(false); setSchermata({ tipo: "proposta", proposta: p }); }}
          onCitta={(c) => { setImporta(false); salva({ ...mondo, citta: [...mondo.citta, ...c] }); }}
        />
      )}
    </>
  );
}

function Importa({ ai, onChiudi, onProposta, onCitta }: { ai: boolean; onChiudi: () => void; onProposta: (p: Proposta) => void; onCitta: (c: Mondo["citta"]) => void }) {
  const [usaAI, setUsaAI] = useState(ai);
  const [lavoro, setLavoro] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function analizza(note: Nota[], nome: string) {
    if (!note.length) throw new Error("Nella cartella non ci sono file .md.");
    if (!usaAI || !ai) {
      const p = analisiLocale(note, nome);
      if (!p.progetti.length) throw new Error("Non ho trovato edifici: aggiungi checkbox (- [ ] …) o `tipo: progetto` / `tipo: attività` nel frontmatter, oppure usa l'analisi AI.");
      return onProposta(p);
    }
    setLavoro(`Claude sta leggendo ${note.length} note e cerca progetti e attività… (può richiedere qualche minuto)`);
    const r = await fetch("/api/analizza", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note, nome }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.errore ?? "Analisi non riuscita.");
    onProposta(j as Proposta);
  }

  async function prova(f: () => Promise<void>) {
    setErrore(null);
    setLavoro("Leggo…");
    try { await f(); } catch (e) { setErrore((e as Error).message); } finally { setLavoro(null); }
  }

  return (
    <Modale titolo="Importa il tuo second brain" onChiudi={onChiudi}>
      <div className="modulo">
        <p className="sotto">Scegli la cartella del vault (Obsidian o note Markdown). Troverò progetti e attività, li dividerò per ambito (lavoro, personale, artistico, tempo libero) e ti chiederò come costruire le città.</p>
        <label className="opzione">
          <input type="checkbox" checked={usaAI && ai} disabled={!ai} onChange={(e) => setUsaAI(e.target.checked)} />
          <span><b>Analisi con AI (Claude).</b> {ai ? "Capisce progetti e attività anche senza checkbox e trova cosa manca." : "Non attiva: aggiungi ANTHROPIC_API_KEY in .env.local e riavvia. Ora uso checkbox, cartelle, tag e [[link]]."}</span>
        </label>
        <div className="azioni">
          <label className="btn primario" aria-disabled={!!lavoro}>
            <input type="file" multiple disabled={!!lavoro}
              // @ts-expect-error attributo non standard ma supportato dai browser
              webkitdirectory=""
              onChange={(e) => { const f = e.target.files; if (f?.length) prova(async () => { const { note, radice } = await leggiCartella(f); await analizza(note, radice || "Vault"); }); }} />
            Scegli la cartella del vault
          </label>
          <label className="btn">
            <input type="file" accept="application/json,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) prova(async () => onCitta(importaJson(JSON.parse(await f.text())))); }} />
            Importa un file .json (città esportata o data.json dell&apos;artefatto)
          </label>
          <button className="btn" type="button" disabled={!!lavoro} onClick={() => prova(async () => {
            const indice: string[] = await (await fetch("/esempio/indice.json")).json();
            const note = await Promise.all(indice.map(async (path) => ({ path, nome: path.split("/").pop()!.replace(/\.md$/, ""), testo: await (await fetch(`/esempio/${path}`)).text() })));
            await analizza(note, "Esempio");
          })}>Prova con un vault di esempio</button>
        </div>
        {lavoro && <p className="stato" role="status">{lavoro}</p>}
        {errore && <div className="errore-box" role="alert">{errore}</div>}
        <p className="nota">Le note vengono lette nel browser. Con l&apos;analisi AI il loro testo viene inviato a Claude tramite il server dell&apos;app.</p>
      </div>
    </Modale>
  );
}
