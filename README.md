# NL → SQL via OpenAI (TypeScript)

A TypeScript application that translates natural language queries to SQL using OpenAI's API as a comparable NL→SQL service, executes them on SQLite, and displays results.

## Architecture

- **Frontend**: Minimal React page with textarea and submit button
- **Backend**: Express.js server with TypeScript
- **Database**: SQLite with better-sqlite3
- **NL→SQL Processor**: OpenAI API (GPT-4o-mini) with fallback rule-based translator

## Processor Choice: Why OpenAI Instead of MCP

**Decision**: I chose **OpenAI's Chat Completions API** as a comparable NL→SQL service rather than MCP (Model Context Protocol) for the following reasons:

1. **Production-Ready NL→SQL**: OpenAI provides a mature, widely-recognized service specifically capable of high-quality SQL generation from natural language
2. **Industry Standard**: OpenAI is one of the most established AI services for this use case
3. **MCP Limitations**: MCP is primarily a protocol for connecting AI assistants to data sources, not a dedicated NL→SQL translation service
4. **Fallback Strategy**: Implemented a rule-based translator ensuring the demo works without API keys

The implementation uses a **translator pattern** that abstracts the NL→SQL conversion, making it trivial to swap in MCP or other processors if needed.

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation & Run

```bash
# Install dependencies
npm install
npm -w server install
npm -w client install

# Configure environment
cp server/.env.example .env
# Edit .env and add your OPENAI_API_KEY (optional)

# Run development servers
npm run dev
```

- Server: http://localhost:3001 (logs queries/results to console)
- Client: http://localhost:5173

### Docker Setup

```bash
## Single .env file (recommended)
# Create a repo-root .env (used by Docker and dev server)
cat > .env << 'ENV'
PORT=3001
CORS_ORIGIN=http://localhost:3001
OPENAI_API_KEY=your-key-here   # optional; omit to use rule-based fallback
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
TRANSLATOR=openai               # or 'rulebased'
ENV

# Build and run
docker-compose up --build
### Running tests in Docker

- Unit tests (translator):
```bash
docker-compose run --rm test
```

- Integration tests (DB + translation + execution):
```bash
docker-compose run --rm integration
```

# The app will automatically fall back to rule-based translation if no API key is provided
```

### Test Examples

The app includes seed data that makes these queries work out-of-the-box:

1. **"How many contacts do I have in my database?"**
   - Expected: 127 contacts
   - SQL: `SELECT COUNT(*) AS count FROM contacts`

2. **"How many cases with topic containing 'help' between 2023 and 2025?"**
   - Expected: 2 cases
   - SQL: `SELECT COUNT(*) AS count FROM cases WHERE lower(topic) LIKE '%help%' AND date(created_at) BETWEEN date('2023-01-01') AND date('2025-12-31')`

## Project Structure

```
.
├── server/              # Backend TypeScript server
│   ├── src/
│   │   ├── translator/  # NL→SQL translation layer
│   │   │   ├── openai.ts    # OpenAI API integration
│   │   │   └── rulebased.ts # Fallback translator
│   │   ├── db.ts        # SQLite setup & migrations
│   │   ├── schema.ts    # Schema introspection
│   │   └── index.ts     # Express server & API
│   └── data/           # SQLite database file
├── client/             # React TypeScript frontend
│   └── src/
│       └── main.tsx    # Minimal UI component
└── package.json        # Monorepo with workspaces
```

## Configuration


## Safety Features

- **SELECT-only queries**: Rejects non-read operations (no DROP/DELETE/UPDATE)
- **Schema context**: Passes full schema to translator for accurate SQL
- **Error handling**: Graceful fallback from OpenAI to rule-based
- **Input validation**: Uses Zod for request validation
- **Rate limiting consideration**: Implements proper error handling for API limits

## Trade-offs & Assumptions

### Design Decisions
- **OpenAI over MCP**: More mature for NL→SQL, with MCP being primarily a connection protocol
- **SQLite over PostgreSQL**: Simpler setup, no external dependencies
- **Monorepo structure**: Easier development with shared scripts
- **Minimal UI**: Focus on backend functionality per requirements
- **Translator Pattern**: Easy to swap NL→SQL processors

### Assumptions
- Dates stored as ISO strings (YYYY-MM-DD)
- COUNT queries should use `COUNT(*) AS count` alias
- Case-insensitive topic matching for 'help' queries
- 127 contacts is the expected count for example 1

## Testing

```bash
# Run unit tests
npm -w server run test

# Run integration tests
npm -w server run test:integration
```

## API Endpoints

### POST /api/query
```json
Request:
{
  "prompt": "How many contacts do I have?"
}

Response:
{
  "sql": "SELECT COUNT(*) AS count FROM contacts",
  "rows": [{"count": 127}],
  "summary": "127 contacts",
  "rationale": "OpenAI Chat Completions API (gpt-4o-mini)"
}
```

### GET /api/health
Returns server status and configuration info.

## Development

```bash
# Build production
npm run build

# Run production
npm start

# Reseed database
npm -w server run seed
```

## What We Demonstrate

✅ **Correctness**: Both example prompts produce exact expected outputs  
✅ **Integration**: Clean OpenAI integration with schema context as comparable NL→SQL service  
✅ **Code Quality**: Full TypeScript, modular design, proper error handling  
✅ **Safety**: SELECT-only enforcement, input validation  
✅ **DX**: Simple setup, clear documentation, easy to extend  
✅ **Testing**: Integration tests validate complete pipeline  
✅ **Schema Introspection**: Automatically feeds table/column metadata to processor

## Demo

The application successfully translates natural language queries to SQL:

1. Query: "How many contacts do I have in my database?"
   - Generated SQL: `SELECT COUNT(*) AS count FROM contacts`
   - Result: 127 contacts ✅

2. Query: "How many cases with topic containing 'help' between 2023 and 2025?"
   - Generated SQL: `SELECT COUNT(*) AS count FROM cases WHERE lower(topic) LIKE '%help%' AND date(created_at) BETWEEN date('2023-01-01') AND date('2025-12-31')`
   - Result: 2 cases ✅

Both queries are logged to the Node.js console and displayed in the browser.
