# AutoCranker Backend

FastAPI backend that receives WhatsApp messages via Make.com and returns AI replies.

```text
WhatsApp → Make.com → ngrok (HTTPS) → FastAPI (this repo) → Make.com → WhatsApp
```

## Setup

```powershell
cd C:\Users\adria\Desktop\Hackathons\AutoCranker\backend

if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env: set MAKE_WEBHOOK_SECRET and optionally GEMINI_API_KEY

uv sync
```

## Run

```powershell
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Verify:

```powershell
curl.exe http://127.0.0.1:8000/health
```

## Test webhook locally (PowerShell)

```powershell
$body = @{
  wa_id      = "34600000000"
  name       = "Test"
  message    = "hola"
  message_id = "wamid.test1"
} | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/webhooks/make/whatsapp" `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Headers @{ "X-Bot-Secret" = "super_secret_test_123" } `
  -Body $body
```

## Expose with ngrok

With uvicorn running, in another terminal:

```powershell
ngrok http 8000
# or static domain:
ngrok http --url=https://your-domain.ngrok-free.app 8000
```

Public webhook URL:

```text
https://<your-ngrok-domain>/webhooks/make/whatsapp
```

## Make.com scenario

```text
[1] WhatsApp Business Cloud — Watch Events
       ↓
[2] HTTP — Make a request
       ↓
[3] WhatsApp Business Cloud — Send a Message
```

### HTTP module

- **URL**: `https://<your-ngrok-domain>/webhooks/make/whatsapp`
- **Method**: POST
- **Headers**: `Content-Type: application/json`, `X-Bot-Secret: <same as MAKE_WEBHOOK_SECRET>`
- **Body**:

```json
{
  "wa_id": "{{1.messages[].from}}",
  "name": "{{1.contacts[].profile.name}}",
  "message": "{{1.messages[].text.body}}",
  "message_id": "{{1.messages[].id}}",
  "timestamp": "{{1.messages[].timestamp}}"
}
```

- **Parse response**: Yes

### Send a Message module

- **Receiver**: `{{1.messages[].from}}`
- **Body**: `{{2.reply}}`

Add a filter between HTTP and Send: continue only if `{{2.reply}}` exists and length > 0.

## Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/` | — | Service info |
| GET | `/health` | — | Healthcheck |
| POST | `/webhooks/make/whatsapp` | X-Bot-Secret | Make webhook |
| POST | `/debug/echo` | — (DEBUG only) | Inspect raw request body |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MAKE_WEBHOOK_SECRET` | Yes | Shared secret for X-Bot-Secret header |
| `DEBUG` | No | Enables /debug/echo when true |
| `APP_NAME` | No | Bot name used in prompts and fallbacks |
| `GEMINI_API_KEY` | No | Google Gemini API key |
| `GEMINI_MODEL` | No | Model name (default: gemini-2.0-flash) |
| `LLM_ENABLED` | No | Set false to force fallback replies |

Without `GEMINI_API_KEY`, the bot returns a friendly fallback message instead of AI replies.
