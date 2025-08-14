# NL → SQL via MCP (TypeScript)

Tiny app that turns natural language into SQL, runs it on SQLite, and logs results on the server console. Frontend is a minimal React page.

- Language: TypeScript (server + client)
- DB: SQLite (better-sqlite3)
- Processor: Uses OpenAI Responses API if `OPENAI_API_KEY` is set; falls back to a rule-based translator that handles the two sample prompts. You can swap in an MCP client/server easily.

## Run locally

Prereqs: Node 18+.

1. Install deps

```sh
npm i
npm -w server i
npm -w client i
```

2. (Optional) Configure OpenAI

Create `server/.env`:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=...
CORS_ORIGIN=http://localhost:5173
PORT=3001
# TRANSLATOR=openai # or rulebased
```

3. Dev servers

```sh
npm run dev
```

- Server at http://localhost:3001 (logs queries/results to console)
- Client at http://localhost:5173

Quick test (optional):

```sh
curl -s -X POST http://localhost:3001/api/query \
	-H 'Content-Type: application/json' \
	-d '{"prompt":"How many contacts do I have in my database?"}' | jq .
```

Seed data is auto-created on first run so the examples work out-of-the-box.

## Usage

Try prompts like:

- "How many contacts do I have in my database?"
- "How many cases with topic containing 'help' between 2023 and 2025?"

The server enforces SELECT-only as a guardrail. It prints the NL prompt, generated SQL, and a concise summary (e.g., "127 contacts") when applicable.

## Processor details

- Default: Rule-based translator ensures the take-home demos work without external APIs.
- Optional: OpenAI Responses API. Provides more general NL→SQL. We ask for plain SQL (SQLite dialect) and pass a brief schema summary. Only SELECT/WITH allowed.

MCP note: You may replace the translator with an MCP client to a tool-enabled server (e.g., Anthropic MCP). Structure is isolated in `server/src/translator/*`.

## Safety and limitations

- SELECT-only guardrail; rejects non-read queries.
- No parameterization for generated SQL; this is a demo. In production, add a compiler/validator and parameterization.
- OpenAI usage depends on your API key and model availability.

## Scripts

- `npm run dev` – run server and client concurrently
- `npm run start` – run built server only
- `npm -w server run seed` – re-seed if desired

## Project structure

- `server/` – Express API, SQLite db, translators
- `client/` – Vite React minimal UI
