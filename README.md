# NL → SQL via OpenAI (TypeScript)

A TypeScript application that translates natural language queries to SQL using OpenAI's API as a comparable NL→SQL service, executes them on SQLite, and displays results with a clean React frontend.

## 🚀 Quick Start with Docker (Recommended)

### Prerequisites
- Docker and Docker Compose
- `.env` file (provided separately)

### Running with Docker

1. **Clone and setup environment**:
   ```bash
   git clone <repository-url>
   cd nl-sql-app
   # Place the provided .env file in the project root
   ```

2. **Build and run**:
   ```bash
   docker-compose up --build
   ```

3. **Access the application**:
   - **Web Interface**: http://localhost:3001

4. **Run tests** (optional):
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

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 18+
- npm 9+

### Installation & Configuration

1. **Install dependencies**:
   ```bash
   npm install
   npm -w server install
   npm -w client install
   ```

2. **Environment setup**:
   ```bash
   # Place the provided .env file in the project root
   ```

3. **Required environment variables** (in `.env`):
   ```bash
   PORT=3001
   CORS_ORIGIN=http://localhost:5173
   OPENAI_API_KEY=your-openai-api-key
   OPENAI_MODEL=gpt-4o-mini                  
   OPENAI_BASE_URL=https://api.openai.com/v1 
   TRANSLATOR=openai                         # 'openai' or 'rulebased'
   ```

4. **Run development servers**:
   ```bash
   npm run dev
   ```
   
   This starts:
   - **Frontend**: http://localhost:5173 (React dev server)
   - **Backend**: http://localhost:3001 (API + logs)

5. **Database setup** (automatic):
   ```bash
   # Database is automatically initialized and seeded on first run
   # To manually reseed:
   npm -w server run seed
   ```

6. **Run production build**:
   ```bash
   npm run build
   npm start
   # Access at: http://localhost:3001 (serves both API and static files)
   ```

### Database Details

- **Type**: SQLite with better-sqlite3
- **Location**: `server/data/app.db`
- **Auto-seeding**: Creates 127 contacts and 5 cases on first run
- **Schema**: 
  - `contacts` table: id, first_name, last_name, created_at
  - `cases` table: id, topic, created_at

## 🤖 NL→SQL Processor Implementation

### Design Decision: OpenAI vs MCP

**Selected**: **OpenAI Chat Completions API** as the primary NL→SQL service

**Why OpenAI Instead of MCP**:

1. **Production-Ready NL→SQL**: OpenAI provides mature, widely-recognized NL→SQL capabilities with GPT-4o-mini
2. **Industry Standard**: Established service with robust error handling and rate limiting
3. **MCP Scope**: MCP (Model Context Protocol) is primarily a protocol for connecting AI assistants to data sources, not a dedicated NL→SQL translation service
4. **Fallback Strategy**: Rule-based translator ensures demo works without API keys

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

## 🎨 UI Features

- **Modern Design**: Glassmorphic design with dark/light theme support
- **Responsive Layout**: Works on desktop and mobile
- **Real-time Results**: Shows SQL, summary, and raw data
- **Error Handling**: Clear error messages with retry capability
- **Accessibility**: Proper ARIA labels and keyboard navigation

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

## 📋 Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3001` | No |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `http://localhost:5173,http://localhost:3001` | No |
| `OPENAI_API_KEY` | OpenAI API key for translation | - | No* |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-4o-mini` | No |
| `OPENAI_BASE_URL` | OpenAI API base URL | `https://api.openai.com/v1` | No |
| `TRANSLATOR` | Force translator type | `openai` | No |
| `NODE_ENV` | Environment mode | `development` | No |

*Required for OpenAI translation; app works with rule-based fallback

---

**Built with**: TypeScript, React, Express, SQLite, OpenAI API, Docker