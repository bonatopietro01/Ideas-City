"use client";
// Piccoli componenti condivisi: finestra modale, scelta dello stile e dell'ambito.
import { useEffect, useRef } from "react";
import { AMBITI, ELENCO_AMBITI, ELENCO_STILI, STILI } from "@/lib/stili";
import { Ambito, Stile } from "@/lib/types";

export function Modale({ titolo, onChiudi, children, largo }: { titolo: string; onChiudi: () => void; children: React.ReactNode; largo?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onChiudi(); };
    window.addEventListener("keydown", k);
    ref.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
    return () => window.removeEventListener("keydown", k);
  }, [onChiudi]);
  return (
    <div className="velo" onMouseDown={(e) => { if (e.target === e.currentTarget) onChiudi(); }}>
      <div ref={ref} className={`modale${largo ? " largo" : ""}`} role="dialog" aria-modal="true" aria-label={titolo}>
        <header><h2>{titolo}</h2><button className="chiudi" type="button" aria-label="Chiudi" onClick={onChiudi}>×</button></header>
        {children}
      </div>
    </div>
  );
}

export function Campione({ stile, colore = "#ff6b2c" }: { stile: Stile; colore?: string }) {
  const d = STILI[stile];
  const tetto =
    d.tetto === "spiovente" ? <polygon points="4,16 20,4 36,16" fill={d.coloreTetto} /> :
    d.tetto === "cupola" ? <path d="M8 16 A12 12 0 0 1 32 16 Z" fill={d.coloreTetto} /> :
    d.tetto === "vetro" ? <polygon points="8,16 20,6 32,16" fill={d.coloreTetto} opacity=".7" /> :
    d.tetto === "terrazza" ? <><rect x="6" y="13" width="28" height="3" fill={d.coloreTetto} /><rect x="10" y="7" width="20" height="2" fill="#c9a46a" /></> :
    <rect x="6" y="13" width="28" height="3" fill={d.coloreTetto} />;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="0" y="34" width="40" height="6" fill={d.terreno} />
      <rect x="8" y="16" width="24" height="19" fill={d.muro ?? colore} />
      <rect x="8" y="32" width="24" height="3" fill={d.muro ? colore : d.bordo} />
      {[0, 1].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={11 + c * 7} y={19 + r * 6} width="4" height="4" fill={d.finestraAccesa} />))}
      {tetto}
    </svg>
  );
}

export function SceltaStile({ valore, onChange, colore }: { valore: Stile; onChange: (s: Stile) => void; colore?: string }) {
  return (
    <div className="stili" role="radiogroup" aria-label="Stile delle case">
      {ELENCO_STILI.map((s) => (
        <button key={s} type="button" role="radio" aria-checked={valore === s} aria-label={STILI[s].nome} className="stile" onClick={() => onChange(s)}>
          <Campione stile={s} colore={colore} />
          <span><b>{STILI[s].nome}</b><small>{STILI[s].desc}</small></span>
        </button>
      ))}
    </div>
  );
}

export function SceltaAmbito({ valore, onChange }: { valore: Ambito; onChange: (a: Ambito) => void }) {
  return (
    <select value={valore} onChange={(e) => onChange(e.target.value as Ambito)}>
      {ELENCO_AMBITI.map((a) => <option key={a} value={a}>{AMBITI[a].nome}</option>)}
    </select>
  );
}

export function BadgeAmbito({ ambito }: { ambito: Ambito }) {
  return <span className="badge" style={{ ["--c" as string]: AMBITI[ambito].colore }}>{AMBITI[ambito].nome}</span>;
}
