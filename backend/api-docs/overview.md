# JobHunt API — Overview

## Base URL

| Environment | URL                               |
| ----------- | --------------------------------- |
| Development | `http://localhost:4000`           |
| Production  | `https://your-backend.render.com` |

All endpoints are prefixed with `/api/v1/`.

## Response Envelope

Every response follows this shape:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "Human-readable error message" }
```

## Authentication

| Token              | Where stored           | Sent as                          | Lifetime  |
| ------------------ | ---------------------- | -------------------------------- | --------- |
| Access Token (JWT) | Memory (React/Zustand) | `Authorization: Bearer <token>`  | 5 minutes |
| Refresh Token      | HttpOnly cookie        | Automatic (browser sends cookie) | 30 days   |
| CSRF Token         | Readable cookie        | `X-CSRF-Token: <token>` header   | 30 days   |

## CSRF Protection

All state-changing requests (POST, PUT, PATCH, DELETE) require:

```
X-CSRF-Token: <value of csrf_token cookie>
```

Get a CSRF token on app load:

```
GET /api/v1/auth/csrf-token
```

## Rate Limits

| Scope                            | Limit                 |
| -------------------------------- | --------------------- |
| Global                           | 100 req / 15 min / IP |
| Auth endpoints (login, register) | 10 req / 15 min / IP  |
| Token refresh                    | 30 req / 15 min / IP  |

## API Modules

| Module         | Docs                 | Prefix                 |
| -------------- | -------------------- | ---------------------- |
| Authentication | [auth.md](./auth.md) | `/api/v1/auth`         |
| Jobs           | _Phase 2_            | `/api/v1/jobs`         |
| Profile        | _Phase 3_            | `/api/v1/profile`      |
| Applications   | _Phase 3_            | `/api/v1/applications` |
| Dashboard      | _Phase 3_            | `/api/v1/dashboard`    |

## Health Check

```
GET /health

Response: { "success": true, "status": "ok", "uptime": 123.4 }
```

Used by Docker, Render, and monitoring tools.
