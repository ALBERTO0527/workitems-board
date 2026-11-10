# workitems-board

Kanban web per i work item scritti come file `.md` in un repo GitLab. Pensata per team che lavorano
con agenti AI (Claude Code e simili): gli item restano file nel repo, la board è solo un modo di
guardarli e pianificarli.

- Nessun server e nessun database: la pagina parla direttamente con l'API di GitLab.com dal tuo browser.
- Il repo resta l'unica fonte di verità. La board scrive un solo tipo di file, `kanban.md`, e solo
  quando sposti o assegni qualcosa. Ogni azione è un commit.

## Come deve essere fatto il repo

```
nome-stream/                 ← uno stream = una cartella al primo livello
  PIANO-NOME-STREAM.md       ← documenti dello stream (piani, README, note, csv…)
  A01-prima-cosa.md          ← item aperto
  A02-seconda-cosa.md
  done/
    A00-gia-fatto.md         ← item chiuso
  kanban.md                  ← creato dalla board
```

- **Stream**: cartella al primo livello che contiene almeno un item, un `PIANO-*.md` o un `README.md`.
- **Item**: file il cui nome inizia con una lettera maiuscola e almeno due cifre, poi `-`
  (`A01-…md`, `W100-…md`). È aperto se sta nella cartella dello stream, chiuso se sta in `done/`.
  Un file è un item.
- Gli altri file della cartella sono documenti dello stream. Le sottocartelle diverse da `done/` si ignorano.

### Colonne

| Colonna | Quando |
|---|---|
| **Chiusi** | lo stream ha almeno un item e sono tutti in `done/` (calcolato) |
| **In corso** | `kanban.md` dice `stato: in-corso` (lo stream è stato trascinato lì) |
| **Da fare** | tutti gli altri casi, anche senza `kanban.md` |

Uno stream chiuso che riceve nuovi item torna nella colonna scritta nel suo `kanban.md`.

### `kanban.md`

```markdown
---
stato: in-corso          # da-fare | in-corso
assegnato: username      # username GitLab, oppure vuoto
ordine: 1500             # posizione nella colonna
---
File gestito da workitems-board. Modificalo dalla board.
```

## Login e permessi

Si entra con GitLab (OAuth con PKCE, nessun segreto lato server). GitLab chiede lo scope `api`,
l'unico che permette di fare commit dall'API: **dà accesso a tutti i repo del tuo account**. Il token
resta nel `localStorage` del tuo browser e va solo a `gitlab.com`; il codice è tutto qui per
controllarlo. Chi non può fare push sul branch principale del repo vede la board ma riceve un errore
quando prova a spostare qualcosa.

## Sviluppo

```bash
cp .env.example .env   # e metti il client id dell'app OAuth
npm install
npm run dev            # http://localhost:5173/
npm test
```

## Pubblicare una tua istanza

1. Fai un fork del repo.
2. Su GitLab, *Preferenze → Applicazioni*: crea un'app con **Confidential: no**, scope `api` e come
   redirect URI `http://localhost:5173/` più l'indirizzo della pagina pubblicata (una riga ciascuno,
   con la barra finale).

**Su GitLab Pages** (`.gitlab-ci.yml`): metti il tuo Application ID in `VITE_GITLAB_CLIENT_ID` dentro
`.gitlab-ci.yml`. Ogni push su `main` pubblica la pagina; l'indirizzo è in *Deploy → Pages*. Se il
progetto è privato, imposta *Settings → General → Visibility → Pages* su "Everyone".

**Su GitHub Pages** (`.github/workflows/pages.yml`, solo repo pubblici): in *Settings → Secrets and
variables → Actions → Variables* aggiungi `VITE_GITLAB_CLIENT_ID`, poi *Settings → Pages → Source:
GitHub Actions*.

## Licenza

MIT
