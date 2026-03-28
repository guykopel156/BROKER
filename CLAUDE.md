# AI Trading Dashboard — CLAUDE.md

## Project Overview
Full-stack web app connecting to Interactive Brokers (IBKR) that lets Claude AI autonomously trade stocks. User monitors trades, reasoning, P&L, and charts via a React dashboard.

**Project Path:** `C:\Users\guyko\OneDrive\Desktop\BROKER`
**Stack:** React + TypeScript (frontend), Node.js + Express + TypeScript (backend), Socket.io, MongoDB, Anthropic Claude API, IBKR Client Portal API, Polygon.io

## How to Run
```bash
# Install all dependencies
npm run install:all

# Run both frontend and backend
npm run dev

# Or run separately
npm run dev:frontend   # React on port 3000
npm run dev:backend    # Express on port 5000
```

---

## Development Phases & Subtasks

### Phase 1: Project Foundation & Setup ✅
| # | Subtask | Status |
|---|---------|--------|
| 1.1 | Install core dependencies | ✅ |
| 1.2 | Set up folder structure (frontend/ + backend/) | ✅ |
| 1.3 | Configure TailwindCSS v3 with dark mode | ✅ |
| 1.4 | Set up React Router with lazy loading | ✅ |
| 1.5 | Create shared UI components (Button, Card, Table, Toast, Modal, Badge, Input) | ✅ |
| 1.6 | Set up responsive layout with top navbar | ✅ |

### Phase 2: Backend Foundation ✅
| # | Subtask | Status |
|---|---------|--------|
| 2.1 | Initialize Node.js + Express + TypeScript | ✅ |
| 2.2 | Set up MongoDB with Mongoose models | ✅ |
| 2.3 | Create typed config module with env validation | ✅ |
| 2.4 | Set up WebSocket server (Socket.io) | ✅ |
| 2.5 | Create error handling middleware | ✅ |
| 2.6 | Create async error wrapper | ✅ |

### Phase 3: IBKR Integration ✅
| # | Subtask | Status |
|---|---------|--------|
| 3.1 | IBKR Client Portal API connector | ✅ |
| 3.2 | Fetch account summary | ✅ |
| 3.3 | Fetch portfolio positions | ✅ |
| 3.4 | Place orders (buy/sell) | ✅ |
| 3.5 | Fetch order status | ✅ |
| 3.6 | Paper trading mode toggle | ✅ |

### Phase 4: Claude AI Trading Engine ✅
| # | Subtask | Status |
|---|---------|--------|
| 4.1 | Claude API integration (@anthropic-ai/sdk) | ✅ |
| 4.2 | Default trading strategy prompt | ✅ |
| 4.3 | Market data fetcher (Polygon.io) | ✅ |
| 4.4 | Decision engine loop (timer-based) | ✅ |
| 4.5 | Parse Claude JSON response | ✅ |
| 4.6 | Trade validation (cash, limits, loss) | ✅ |
| 4.7 | Execute & log trade via IBKR | ✅ |
| 4.8 | Audit log service | ✅ |

### Phase 5-10: Frontend Pages & Features ✅
| # | Page/Feature | Status |
|---|-------------|--------|
| 5 | Dashboard Home (portfolio bar, kill switch, trades, equity curve, engine health, watchlist) | ✅ |
| 6 | Trade Log (filters, expandable reasoning rows) | ✅ |
| 7 | Positions & P&L (open/closed tables, summary stats) | ✅ |
| 8 | Stock Charts (candlestick, timeframes, entry price line) | ✅ |
| 9 | Settings (loss limit, interval, strategy editor, paper/live toggle) | ✅ |
| 10 | Alerts & Safety (toast system, alert history, kill switch toasts) | ✅ |

### Phase 11: Testing & Polish ✅
| # | Subtask | Status |
|---|---------|--------|
| 11.1 | Error boundary for React | ✅ |
| 11.2 | Loading spinner component | ✅ |
| 11.3 | Build verification (frontend + backend) | ✅ |
| 11.4 | Root package.json with dev scripts | ✅ |

### Phase 12: Deployment — Pending
| # | Subtask | Status |
|---|---------|--------|
| 12.1 | IBKR Gateway setup | ⬜ Needs Java + Gateway download |
| 12.2 | Paper trading validation | ⬜ Needs IBKR Gateway running |
| 12.3 | Go live | ⬜ After paper trading validation |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/portfolio/summary | Account summary from IBKR |
| GET | /api/portfolio/positions | Open positions from IBKR |
| POST | /api/orders | Place a trade |
| POST | /api/orders/:id/confirm | Confirm order |
| GET | /api/orders/:id/status | Order status |
| GET | /api/orders | List live orders |
| GET | /api/settings | Get app settings |
| PATCH | /api/settings | Update settings |
| POST | /api/engine/pause | Pause Claude |
| POST | /api/engine/resume | Resume Claude |
| POST | /api/engine/run-cycle | Manually trigger trading cycle |
| GET | /api/engine/audit-logs | View audit logs |

## Code Rules

- **No `any` type** — always use proper types
- **Typed params & return types** on all functions
- **`interface`** for object shapes, **`type`** for unions
- **camelCase** for variables/functions, **PascalCase** for components/types, **UPPER_SNAKE_CASE** for constants
- **Boolean prefixes**: is/has/can/should
- **`handle` prefix** on event handlers
- **No abbreviations** in names
- **TailwindCSS only** for styling
- **Functional components only** (except ErrorBoundary)
- **No `console.log`** in committed code (except server startup)
- **No magic numbers/strings** — use named constants
- **`const` by default**, no `var`
- **No `==` / `!=`** — use strict equality
- **Functions under 40 lines**
- **Components under 150 lines**
- **Early returns** over nested conditionals
- **Grouped imports**: external → internal → types → styles
- **No circular imports**
- **All UI must be fully responsive**: desktop, tablet, mobile
- **Secrets in `.env` only**, `.env` in `.gitignore`
