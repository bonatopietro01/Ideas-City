# Verifica runtime — full-stack-pack (fase project)

Data: 2026-11-21. Progetto: AIdeaCity. Installazione: generatore `install_agent_pack.py` (anteprima → `--apply` → `--check`), interprete `py -3` (Python 3.14.7).

## Esito dei comandi

| Comando | Esito |
|---|---|
| anteprima | 104 operazioni CREATE, nessun conflitto, exit 0 |
| `--apply` | `APPLY OK: 104 file scritti`, exit 0 |
| `--check` | `CHECK OK: file, formati, dipendenze, hash e copie equivalenti`, exit 0 |

File preesistenti preservati: `.claude/launch.json` (non toccato). `AGENTS.md` e `CLAUDE.md` non esistevano: creati con la sola sezione delimitata `agent-pack`.

## Tabella di consegna

| ambiente | versione | elemento/ID | generato | check statico | riconosciuto | chiamata provata | evidenza/limite |
|---|---|---|---|---|---|---|---|
| Claude Code (app desktop) | 2.1.329 | 8 agenti `.claude/agents/*.md` | SÌ | SÌ | NO (sessione corrente) | NO | Il catalogo dello strumento `Agent` della sessione in cui è avvenuta l'installazione non elenca i nuovi ID: la discovery avviene all'avvio. Serve una nuova sessione (o ricaricamento) prima di delegare. |
| Claude Code (app desktop) | 2.1.329 | 12 skills `.claude/skills/*` | SÌ | SÌ | NO (sessione corrente) | NO | L'elenco skills della sessione non le include ancora; stesso motivo. |
| Claude Code | 2.1.329 | `handoff`, `retro` | SÌ | SÌ | — | NON_VERIFICATO | Solo su invocazione esplicita `/handoff`, `/retro`. |
| Codex | — | 8 agenti `.codex/agents/*.toml` + `.agents/skills` | SÌ | SÌ | NON_VERIFICATO | NON_VERIFICATO | Programma non disponibile in questa sessione. |
| Cursor | — | 8 agenti `.cursor/agents/*.md` + `.agents/skills` | SÌ | SÌ | NON_VERIFICATO | NON_VERIFICATO | Programma non disponibile in questa sessione. |

## Aggiornamento 2026-11-21

Dopo il ricaricamento, il catalogo dello strumento `Agent` della stessa sessione elenca tutti gli 8 ID e le 12 skills risultano disponibili: **RICONOSCIUTO** in Claude Code.
Chiamata provata: `prompt-agent`, delegato con lo strumento `Agent` (subagent_type `prompt-agent`) per scrivere il prompt in `agent-kit/prompts/mondo-unico-paesaggio.md`; ha letto i file in sola lettura e restituito il prompt. Gli altri 7 ruoli non sono ancora stati chiamati: chiamata **NON_VERIFICATA**.

## Prossimo passo per completare la verifica in Claude Code

Aprire una nuova sessione nel progetto, controllare che gli ID `prompt-agent`, `architect`, `backend`, `frontend`, `ai-engineer`, `reviewer`, `diagnostics`, `graphify-agent` compaiano nel catalogo agenti, poi eseguire per ciascuno la delega di sola lettura descritta in `.claude/skills/agent-configuration/references/runtime-check.md` (passo 3). Il lavoro di sviluppo che dipende dalle deleghe resta sospeso fino ad allora.
