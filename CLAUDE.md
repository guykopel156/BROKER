# AI Trading Dashboard — CLAUDE.md

## Project Overview
Full-stack web app connecting to Interactive Brokers (IBKR) that lets Claude AI autonomously trade stocks. User monitors trades, reasoning, P&L, and charts via a React dashboard.

**Project Path:** `C:\Users\guyko\OneDrive\Desktop\BROKER`
**Stack:** React + TypeScript (frontend), Node.js + Express + TypeScript (backend), Socket.io, PostgreSQL/SQLite, Anthropic Claude API, IBKR Client Portal API, Polygon.io/Yahoo Finance

---

## Development Phases & Subtasks

Every agent must follow this plan. Check current progress before starting work.

### Phase 1: Project Foundation & Setup
| # | Subtask | Details | Status |
|---|---------|---------|--------|
| 1.1 | Install core dependencies | React Router, TailwindCSS, Socket.io-client, Axios, Recharts/Lightweight Charts | ⬜ |
| 1.2 | Set up folder structure | Components, pages, hooks, services, types, utils, context | ⬜ |
| 1.3 | Configure TailwindCSS | Theming, dark mode, custom colors (green/red for P&L) | ⬜ |
| 1.4 | Set up React Router | Page routing for Dashboard, Trade Log, Positions, Charts, Settings | ⬜ |
| 1.5 | Create shared UI components | Button, Card, Table, Toast, Modal, Badge, Input | ⬜ |
| 1.6 | Set up responsive layout shell | Sidebar nav, top bar, main content area (desktop/tablet/mobile) | ⬜ |

### Phase 2: Backend Foundation
| # | Subtask | Details | Status |
|---|---------|---------|--------|
| 2.1 | Initialize Node.js + Express server | TypeScript, folder structure (controllers, services, routes, middleware) | ⬜ |
| 2.2 | Set up database | PostgreSQL or SQLite, schema for trades, positions, settings, audit log | ⬜ |
| 2.3 | Create config module | Environment variables (.env), validation, typed config object | ⬜ |
| 2.4 | Set up WebSocket server | Socket.io for real-time push to frontend | ⬜ |
| 2.5 | Create error handling middleware | Standard error format `{error: {code, message, details}}` | ⬜ |
| 2.6 | Create async error wrapper | Catch all async route errors | ⬜ |

### Phase 3: IBKR Integration
| # | Subtask | Details | Status |
|---|---------|---------|--------|
| 3.1 | IBKR Client Portal API connector | Auth, session management, auto re-authentication | ⬜ |
| 3.2 | Fetch account summary | Total account value, cash available | ⬜ |
| 3.3 | Fetch portfolio positions | Open positions, avg cost, market value | ⬜ |
| 3.4 | Place orders (buy/sell) | Market/limit orders via IBKR API | ⬜ |
| 3.5 | Fetch order status | Track pending/filled/failed | ⬜ |
| 3.6 | Paper trading mode toggle | Switch between paper and live accounts | ⬜ |

### Phase 4: Claude AI Trading Engine
| # | Subtask | Details | Status |
|---|---------|---------|--------|
| 4.1 | Claude API integration | Connect to Anthropic API, manage API key | ⬜ |
| 4.2 | Design trading strategy system prompt | Configurable strategy (growth, value, momentum) | ⬜ |
| 4.3 | Market data fetcher | Pull prices, headlines, indicators from Polygon.io / Yahoo Finance | ⬜ |
| 4.4 | Decision engine loop | Timer-based (configurable interval), fetches context, calls Claude | ⬜ |
| 4.5 | Parse Claude response | Extract action, symbol, quantity, reasoning | ⬜ |
| 4.6 | Trade validation layer | Validate Claude's decision before execution (position limits, cash check) | ⬜ |
| 4.7 | Execute & log trade | Send order to IBKR, save decision + result to database | ⬜ |
| 4.8 | Audit log service | Store every Claude response, reasoning, and outcome | ⬜ |

### Phase 5: Frontend — Dashboard Home
| # | Subtask | Details | Status |
|---|---------|---------|--------|
| 5.1 | Portfolio Summary Bar | Total value, today's P&L ($/%), total P&L, open positions count, cash available | ⬜ |
| 5.2 | Kill Switch button | Pause/resume Claude trading, persists across refreshes | ⬜ |
| 5.3 | Recent trades widget | Last 5-10 trades with symbol, action, price, status | ⬜ |
| 5.4 | WebSocket connection | Live updates for P&L and trades | ⬜ |
| 5.5 | Responsive layout | Cards stack on mobile, grid on desktop | ⬜ |

### Phase 6: Frontend — Trade Log
| # | Subtask | Details | Status |
|---|---------|---------|--------|
| 6.1 | Full trade history table | Timestamp, symbol, action, qty, price, reasoning, status | ⬜ |
| 6.2 | Expandable reasoning rows | Click to see Claude's full reasoning text | ⬜ |
| 6.3 | Filters | By date range, symbol, action (buy/sell), outcome | ⬜ |
| 6.4 | Pagination / infinite scroll | Handle large trade history | ⬜ |
| 6.5 | Real-time new trade insertion | New trades appear at top via WebSocket | ⬜ |

### Phase 7: Frontend — Positions & P&L
| # | Subtask | Details | Status |
|---|---------|---------|--------|
| 7.1 | Open positions table | Symbol, shares, avg entry, current price, unrealized P&L ($, %) | ⬜ |
| 7.2 | Closed positions table | Realized P&L, hold duration, entry/exit prices | ⬜ |
| 7.3 | Color coding | Green for profit, red for loss | ⬜ |
| 7.4 | Live price updates | P&L refreshes every 30 seconds via WebSocket | ⬜ |
| 7.5 | Portfolio breakdown | Summary stats at top | ⬜ |

### Phase 8: Frontend — Stock Charts
| # | Subtask | Details | Status |
|---|---------|---------|--------|
| 8.1 | Candlestick/line chart component | Using Lightweight Charts or Recharts | ⬜ |
| 8.2 | Timeframe selector | 1D, 1W, 1M, 3M | ⬜ |
| 8.3 | Entry price marker | Horizontal line at avg entry price | ⬜ |
| 8.4 | Trade markers | Buy/sell arrows on chart timeline | ⬜ |
| 8.5 | Chart per position | Navigate between charts for each held stock | ⬜ |
| 8.6 | Market data API integration | Fetch OHLCV data from Polygon.io / Yahoo Finance | ⬜ |

### Phase 9: Frontend — Settings
| # | Subtask | Details | Status |
|---|---------|---------|--------|
| 9.1 | Max loss limit input | User sets threshold (e.g. -10%), saves to DB | ⬜ |
| 9.2 | Trading interval selector | 15 min, 30 min, 1 hour, etc. | ⬜ |
| 9.3 | Claude strategy prompt editor | User can view/edit the system prompt | ⬜ |
| 9.4 | Paper/live trading toggle | Switch modes with confirmation | ⬜ |
| 9.5 | Account connection status | Show IBKR connection health | ⬜ |

### Phase 10: Alerts & Safety Controls
| # | Subtask | Details | Status |
|---|---------|---------|--------|
| 10.1 | Toast notifications | In-app alert on every trade execution | ⬜ |
| 10.2 | Max loss auto-pause | Backend checks P&L against threshold, pauses Claude if hit | ⬜ |
| 10.3 | Kill switch backend logic | API endpoint to pause/resume engine, state in DB | ⬜ |
| 10.4 | Alert history log | Record of all alerts triggered | ⬜ |

### Phase 11: Testing & Polish
| # | Subtask | Details | Status |
|---|---------|---------|--------|
| 11.1 | Unit tests | Components, services, utils | ⬜ |
| 11.2 | Integration tests | API routes, IBKR connector, Claude engine | ⬜ |
| 11.3 | Paper trading end-to-end test | Full loop: Claude decides → order placed → dashboard updates | ⬜ |
| 11.4 | Performance optimization | Dashboard load < 2s, trade execution < 5s | ⬜ |
| 11.5 | Error handling & edge cases | API timeouts, session expiry, network failures | ⬜ |
| 11.6 | Security audit | No exposed secrets, CORS config, HTTPS, input validation | ⬜ |

### Phase 12: Deployment & Go Live
| # | Subtask | Details | Status |
|---|---------|---------|--------|
| 12.1 | Hosting setup | VPS / cloud provider | ⬜ |
| 12.2 | CI/CD pipeline | Auto-deploy on push to main | ⬜ |
| 12.3 | Environment config | Production .env, database, SSL | ⬜ |
| 12.4 | Paper trading validation | Run full system in paper mode, verify all features | ⬜ |
| 12.5 | Go live | Switch to real IBKR account | ⬜ |

---

## Code Rules

- **No `any` type** — always use proper types
- **Typed params & return types** on all functions
- **`interface`** for object shapes, **`type`** for unions
- **camelCase** for variables/functions, **PascalCase** for components/types, **UPPER_SNAKE_CASE** for constants
- **Boolean prefixes**: is/has/can/should
- **`handle` prefix** on event handlers
- **No abbreviations** in names
- **TailwindCSS only** for styling
- **Functional components only**
- **No `console.log`** in committed code
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

## Testing
- Run: `npm test`
- Test files next to source files

## Git
- Always create feature branches before making changes
- Branch naming: `feature/<phase>-<description>` (e.g. `feature/phase1-setup`)
