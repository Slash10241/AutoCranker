# AutoCranker

The AI layer for car repair shops. Messy customer chat → structured repair case → inspection → owner-approved quote.

**Three apps:** mock WhatsApp chat (`frontendMockWhatsapp`) · garage dashboard (`frontendAutoCranker`) · FastAPI backend (`backend`).

## Start

**Prerequisites:** Node 18+, [uv](https://docs.astral.sh/uv/), Python 3.11+

**1. Backend** (port 8000)

```bash
cd backend
cp .env.example .env   # set GEMINI_API_KEY for AI replies
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**2. Mock WhatsApp** (customer chat → intake agent)

```bash
cd frontendMockWhatsapp
npm install
# .env: VITE_API_BASE_URL=http://127.0.0.1:8000
npm run dev
```

**3. Garage dashboard** (cases, inspections, quotes)

```bash
cd frontendAutoCranker
npm install
# .env: VITE_API_BASE_URL=http://127.0.0.1:8000
npm run dev
```

Run all three. Start with a message in the mock chat; the case appears in the dashboard.

Backend details: [`backend/README.md`](backend/README.md).
