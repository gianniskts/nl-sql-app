# NL → SQL Web App

A TypeScript application that translates natural language queries to SQL using OpenAI's API as a comparable NL→SQL service, executes them on SQLite, and displays results with a clean React frontend.

## 🚀 Quick Start with Docker (Recommended)

### Prerequisites
- Docker and Docker Compose
- `.env` file (provided separately)

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 18+
- npm 9+

### Installation & Configuration

1. **Install dependencies**:
   ```bash
   # Option 1(Better): Use the setup script
   source ./setup.sh

   # Option 2: Manual install
   npm install
   npm -w server install
   npm -w client install
   ```

2. **Environment setup**:
   ```bash
   # Place the provided .env file in the project root
   ```

3. **Run development servers**:
   ```bash
   npm run dev
   ```

   This starts:
   - **Frontend**: http://localhost:5173 (React dev server)
   - ***Backend***: http://localhost:3001 (API + logs)

4. **Access the application**:
   - **Web Interface**: http://localhost:5173

5. **Run tests**:
   ```bash
   # Unit tests (translator logic)
   npm -w server run test

   # Integration tests (full pipeline)
   npm -w server run test:integration
   ```

6. ***Database setup*** (automatic):
   ```bash
   # Database is automatically initialized and seeded on first run
   # To manually reseed:
   npm -w server run seed
   ```

### Running with Docker (Option 2)

1. **Clone and setup environment**:
   ```bash
   git clone https://github.com/gianniskts/nl-sql-app.git
   cd nl-sql-app
   ```

2. **Environment setup**:
   ```bash
   # Place the provided .env file in the project root
   ```

3. **Build and run**:
   ```bash
   source ./setup.sh
   docker-compose up --build
   ```

4. **Access the application**:
   - **Web Interface**: http://localhost:3001

5. **Run tests** (optional):
   ```bash
   # Unit tests
   docker-compose run --rm test
   
   # Integration tests
   docker-compose run --rm integration
   ```

The Docker setup automatically:
- Builds both server and client
- Serves the React app via Express in production mode
- Initializes and seeds the SQLite database
- Handles all dependencies and environment configuration


## 🎬 Demo Flow

1. **Start Application**: 
   ```bash
   docker-compose up --build
   # OR for development:
   npm run dev
   ```

2. **Access Interface**: Open http://localhost:3001 (Docker) or http://localhost:5173 (dev)

3. **Test Query 1**: Enter "How many contacts do I have in my database?"
   - Generates: `SELECT COUNT(*) AS count FROM contacts`
   - Returns: `127 contacts`

4. **Test Query 2**: Enter "How many cases with topic containing 'help' between 2023 and 2025?"
   - Generates: Complex WHERE clause with date filtering
   - Returns: `2 cases`

5. **View Results**: See SQL, summary, and raw JSON data
   - Server logs show translator used (OpenAI vs Rule-based)
   - Console output includes query execution details

### Database Details

- **Type**: SQLite with better-sqlite3
- **Location**: `server/data/app.db`
- **Auto-seeding**: Creates 127 contacts and 5 cases on first run
- **Schema**: 
  - `contacts` table: id, first_name, last_name, created_at
  - `cases` table: id, topic, created_at

## 🤖 NL→SQL Processor Implementation

### Design Decision: OpenAI vs MCP

Selected: OpenAI Chat Completions API as the primary NL→SQL service; MCP is acknowledged as a protocol-level alternative for orchestration and interoperability.

Why OpenAI Instead of MCP (technical rationale)
- Role distinction: MCP (Model Context Protocol) standardizes tool discovery, auth, and streaming; it is not itself an NL→SQL model. NL→SQL is a semantic parsing task that benefits from a capable LLM conditioned on schema/context.
- Task fit: For a small, static schema and single-turn prompts, a single forward pass with explicit schema context achieves high accuracy without multi-step tool planning.
- Latency/cost:
  - Single-call LLM: T_openai ≈ t_net + t_model; Cost_openai ≈ tokens_in + tokens_out.
  - MCP multi-hop (planner + tools): T_mcp ≈ t_orch + Σ(t_net_i + t_model_i) + Σ(t_tool_j); Cost_mcp ≈ Σ tokens_i.
  - With short prompts and concise SQL outputs, single-pass minimizes both latency and token spend.
- Reliability surface: Each extra hop (tool discovery, schema tools, planners) adds failure modes (timeouts, partial state). Single-call + validation reduces surface area and raises end-to-end success for this scope.
- Operations maturity: OpenAI provides predictable rate limits, usage metrics, and retry semantics; simpler SLOs for a demo.

Scientific framing (what the model solves)
- Problem: Given natural-language query q and schema S, produce an SQL program s for dialect D=SQLite that maximizes execution accuracy under constraints C (SELECT-only).
- Subtasks:
  - Schema linking: map mentions to tables/columns in S (via lexical/semantic cues in the prompt).
  - Value grounding: normalize literals (dates → ISO), case-insensitive text filters.
  - Aggregation/join inference: infer COUNT/GROUP BY and minimal join paths consistent with S.
  - Temporal reasoning: translate intervals (“between 2023 and 2025”) into concrete predicates on created_at.
- Strategy in this app:
  - Prompt includes full schema and safety rules; temperature ≤ 0.2 for stability.
  - Post-generation validators enforce SELECT-only and basic SQL sanity; parameterized execution via better-sqlite3.

Safety and guardrails
- Disallow non-SELECT statements; reject on detection.
- Normalize identifiers and enforce COUNT(*) AS count alias for consistent consumption.
- Schema-scoped prompting to mitigate hallucinated columns/tables.

When MCP is preferable
- Dynamic/multi-source schemas that must be discovered at runtime via tools.
- Enterprise needs: unified auth/auditing/logging across assistants and datasets.
- Model heterogeneity or on-prem requirements behind a standardized protocol.
- Multi-step workflows (catalog lookup → policy check → NL→SQL → post-processing).

Evaluation methodology (reproducible)
- Metrics: execution accuracy, latency p50/p95, token cost/query, safety block rate.
- Protocol: fixed seed dataset and test set (includes the two required prompts), fixed prompts with low temperature; log SQL, outcomes, and timing; optional A/B against rule-based fallback.

Interoperability plan
- Future: expose schema introspection and read-only query execution as MCP tools while retaining OpenAI as the NL→SQL model; optionally add grammar-constrained decoding or function-calling for tighter outputs.

### Architecture & Integration

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Client  │───▶│  Express Server  │───▶│ SQLite Database │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Translator Layer │
                       │                  │
                       │ ┌──────────────┐ │
                       │ │ OpenAI API   │ │ ← Primary
                       │ │ (gpt-4o-mini)│ │
                       │ └──────────────┘ │
                       │        │         │
                       │        ▼ (fallback)
                       │ ┌──────────────┐ │
                       │ │ Rule-based   │ │ ← Backup
                       │ │ Translator   │ │
                       │ └──────────────┘ │
                       └──────────────────┘
```

### Translator Implementation

The system uses a **translator pattern** with automatic fallback:

1. **Primary**: OpenAI Chat Completions API
   - Model: `gpt-4o-mini` (configurable)
   - System prompt with full schema context
   - Retry logic for rate limits
   - SQL validation and cleaning

2. **Fallback**: Rule-based pattern matching
   - Handles the two required example queries
   - Ensures demo works offline
   - Safe SELECT-only query generation

3. **Integration Points**:
   ```typescript
   // server/src/translator/index.ts
   export function chooseTranslator(): Translator {
     const fallback = ruleBasedTranslator();
     
     if (process.env.OPENAI_API_KEY) {
       const primary = openAITranslator();
       // Returns wrapper with automatic fallback on error
     }
     
     return fallback;
   }
   ```

## 🎯 Test Examples

The application includes seed data for these validated examples:

### Example 1: Contact Count
```
Query: "How many contacts do I have in my database?"
Expected SQL: SELECT COUNT(*) AS count FROM contacts
Expected Result: 127 contacts ✅
```

### Example 2: Filtered Case Count
```
Query: "How many cases with topic containing 'help' between 2023 and 2025?"
Expected SQL: SELECT COUNT(*) AS count FROM cases WHERE lower(topic) LIKE '%help%' AND date(created_at) BETWEEN date('2023-01-01') AND date('2025-12-31')
Expected Result: 2 cases ✅
```

## 🧪 Testing

```bash
# Unit tests (translator logic)
npm -w server run test

# Integration tests (full pipeline)
npm -w server run test:integration

# Docker testing
docker-compose run --rm test
docker-compose run --rm integration
```

Integration tests verify:
- Database seeding (127 contacts, 5 cases)
- SQL generation accuracy
- Query execution safety
- Expected result validation

## 🔒 Safety Features

- **SELECT-only queries**: Automatically rejects non-read operations
- **Schema introspection**: Provides full context to translator
- **Input validation**: Zod schemas for request validation
- **Error handling**: OpenAI → rule-based fallback
- **CORS configuration**: Configurable origin restrictions
- **SQL injection protection**: Parameterized queries via better-sqlite3

## ⚙️ API Endpoints

### POST `/api/query`
```json
// Request
{
  "prompt": "How many contacts do I have?"
}

// Response
{
  "sql": "SELECT COUNT(*) AS count FROM contacts",
  "rows": [{"count": 127}],
  "summary": "127 contacts",
  "rationale": "OpenAI Chat Completions API (gpt-4o-mini)"
}
```

### GET `/api/health`
```json
{
  "ok": true,
  "translator": "openai",
  "database": "sqlite",
  "tables": ["contacts", "cases"]
}
```

## 🏗️ Project Structure

```
.
├── server/                 # TypeScript Express backend
│   ├── src/
│   │   ├── translator/     # NL→SQL translation layer
│   │   │   ├── openai.ts       # OpenAI API integration
│   │   │   ├── rulebased.ts    # Fallback translator
│   │   │   └── index.ts        # Translator factory
│   │   ├── db.ts           # SQLite setup & migrations
│   │   ├── schema.ts       # Schema introspection
│   │   └── index.ts        # Express server & API
│   └── data/              # SQLite database file
├── client/                # React TypeScript frontend
│   └── src/
│       ├── main.tsx       # React app with modern UI
│       └── styles.css     # Modern CSS with dark/light themes
├── docker-compose.yml     # Production deployment
├── dockerfile            # Multi-stage build
└── package.json          # Monorepo with workspaces
```

## ⚖️ Trade-offs & Design Decisions

### Architectural Choices

1. **OpenAI over MCP**: More mature NL→SQL capabilities vs. connection protocol
2. **SQLite over PostgreSQL**: Simpler setup, no external dependencies
3. **Monorepo structure**: Easier development with shared scripts
4. **Express serving React**: Simplified production deployment
5. **TypeScript throughout**: Type safety and better developer experience

### Known Limitations

1. **OpenAI Dependency**: Primary translator requires API key and internet
2. **Simple Schema**: Demo focuses on 2 tables;
3. **Rule-based Fallback**: Limited to predefined patterns
4. **No Query Optimization**: Doesn't handle complex JOINs or subqueries optimally
5. **SQLite Constraints**: Not suitable for high-concurrency production use

### Assumptions

- **Date Format**: Stored as ISO strings (YYYY-MM-DD)
- **Text Matching**: Case-insensitive using `lower()` function
- **Count Queries**: Always return `COUNT(*) AS count` for consistency
- **Row Limits**: Rule-based queries limited to 50 rows for safety
- **API Stability**: OpenAI API structure remains consistent

---

**Built with**: TypeScript, React, Express, SQLite, OpenAI API, Docker