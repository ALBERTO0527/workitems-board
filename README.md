# workitems-board

A web kanban for work items written as `.md` files in a GitLab repo. Built for teams that work with
AI agents (Claude Code and the like): the items stay files in the repo, and the board is just a way
to look at them and plan them.

- No server and no database: the page talks straight to the GitLab.com API from your browser.
- The repo stays the single source of truth. The board writes only one kind of file, `kanban.md`,
  and only when you move or assign something. Every action is a commit.

Try it at https://workitems-board-99a740.gitlab.io/ with any GitLab.com repo you can access.
The interface is in Italian.

## How the repo must be laid out

```
stream-name/                 ← a stream = a top-level folder
  PIANO-STREAM-NAME.md       ← stream documents (plans, README, notes, csv…)
  A01-first-thing.md         ← open item
  A02-second-thing.md
  done/
    A00-already-done.md      ← closed item
  kanban.md                  ← created by the board
```

- **Stream**: a top-level folder that contains at least one item, a `PIANO-*.md` or a `README.md`.
- **Item**: a file whose name starts with an uppercase letter and at least two digits, then `-`
  (`A01-…md`, `W100-…md`). It is open if it sits in the stream folder, closed if it sits in `done/`.
  One file is one item.
- The other files in the folder are stream documents. Subfolders other than `done/` are ignored.

### Columns

| Column | When |
|---|---|
| **Chiusi** (closed) | the stream has at least one item and all of them are in `done/` (computed) |
| **In corso** (in progress) | `kanban.md` says `stato: in-corso` (the stream was dragged there) |
| **Da fare** (to do) | every other case, including streams without `kanban.md` |

A closed stream that gets new items goes back to the column written in its `kanban.md`.

### `kanban.md`

```markdown
---
stato: in-corso          # da-fare | in-corso
assegnato: username      # GitLab username, or empty
ordine: 1500             # position in the column
---
File gestito da workitems-board. Modificalo dalla board.
```

The keys and values are in Italian: `stato` is the status, `assegnato` the assignee, `ordine` the order.

## Login and permissions

You sign in with GitLab (OAuth with PKCE, no server-side secret). GitLab asks for the `api` scope,
the only one that allows commits through the API: **it gives access to every repo of your account**.
The token stays in your browser's `localStorage` and only goes to `gitlab.com`; all the code is here
for you to check. People who cannot push to the repo's default branch see the board but get an error
when they try to move something.

## Development

```bash
cp .env.example .env   # and put the OAuth app client id in it
npm install
npm run dev            # http://localhost:5173/
npm test
```

## Publishing your own instance

1. Fork the repo.
2. On GitLab, *Preferences → Applications*: create an app with **Confidential: no**, scope `api` and
   as redirect URIs `http://localhost:5173/` plus the address of the published page (one per line,
   with the trailing slash).

**On GitLab Pages** (`.gitlab-ci.yml`): put your Application ID in `VITE_GITLAB_CLIENT_ID` inside
`.gitlab-ci.yml`. Every push to `main` publishes the page; the address is under *Deploy → Pages*. If
the project is private, set *Settings → General → Visibility → Pages* to "Everyone".

**On GitHub Pages** (`.github/workflows/pages.yml`, public repos only): under *Settings → Secrets and
variables → Actions → Variables* add `VITE_GITLAB_CLIENT_ID`, then *Settings → Pages → Source:
GitHub Actions*. Without the variable the workflow does not run.

## License

MIT
