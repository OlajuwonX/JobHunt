# Authentication API — Documentation

Base URL: `/api/v1/auth`

All responses follow the envelope pattern:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "message" }
```

---

## Security Model

```
┌─────────────────────────────────────────────────────────────────────┐
│ Access Token (JWT)                                                  │
│   Lifetime:  5 minutes                                              │
│   Storage:   Memory only (React variable / Zustand store)          │
│   Sent as:   Authorization: Bearer <token>                         │
│   Contains:  { id, email, iat, exp }                               │
├─────────────────────────────────────────────────────────────────────┤
│ Refresh Token                                                       │
│   Lifetime:  30 days (absolute), rotated on every use              │
│   Storage:   HttpOnly cookie (JavaScript cannot read)              │
│   Cookie:    refresh_token                                          │
│   DB:        Stored as SHA-256 hash (never plain text)             │
├─────────────────────────────────────────────────────────────────────┤
│ CSRF Token                                                          │
│   Lifetime:  30 days (matches refresh token)                       │
│   Storage:   Readable cookie (JavaScript reads and sends it)       │
│   Cookie:    csrf_token                                             │
│   Sent as:   X-CSRF-Token: <token> header on mutations             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Honeypot Bot Protection

All forms include a hidden `website` field that real users never see or fill.
Bots that auto-fill all fields will populate it.

**Rule:** If `website` is present and non-empty in the request body → silently return
a fake success response (don't tell the bot it was caught).

---

## Endpoints

### GET /api/v1/auth/csrf-token

Get a CSRF token. Call this when the app first loads.

**Auth required:** No
**Rate limit:** Global (100/15min)

**Response:**

```json
{
  "success": true,
  "data": {
    "csrfToken": "a3f5c2d8e1b7..."
  }
}
```

Also sets the `csrf_token` cookie (readable, not HttpOnly).

**Frontend usage:**

```typescript
// On app load
const { data } = await api.get('/auth/csrf-token')
// Zustand stores csrfToken in memory
// Axios interceptor adds it to every mutation: X-CSRF-Token: <token>
```

---

### POST /api/v1/auth/register

Create a new user account.

**Auth required:** No
**Rate limit:** 10 requests / 15 minutes / IP

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "MyPassword1",
  "confirmPassword": "MyPassword1",
  "website": ""
}
```

| Field           | Type   | Required | Rules                                       |
| --------------- | ------ | -------- | ------------------------------------------- |
| email           | string | yes      | Valid email format                          |
| password        | string | yes      | Min 8 chars, 1 uppercase, 1 number          |
| confirmPassword | string | yes      | Must match password                         |
| website         | string | no       | **Honeypot** — must be empty (hidden field) |

**Required headers:**

```
X-CSRF-Token: <token from csrf_token cookie>
```

**Success (201):**

```json
{
  "success": true,
  "data": {
    "message": "Account created successfully. Please check your email to verify your account."
  }
}
```

**Errors:**
| Status | Error |
|--------|-------|
| 400 | Validation failed (field details in error message) |
| 409 | An account with this email already exists |
| 429 | Too many attempts |

**Side effects:**

- Sends a verification email to the provided address
- Creates an empty Profile record for the user

---

### POST /api/v1/auth/login

Authenticate with email and password.

**Auth required:** No
**Rate limit:** 10 requests / 15 minutes / IP

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "MyPassword1",
  "website": ""
}
```

**Required headers:**

```
X-CSRF-Token: <token from csrf_token cookie>
```

**Success (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": "clx...",
      "email": "user@example.com",
      "verified": true,
      "createdAt": "2026-04-07T12:00:00.000Z"
    }
  }
}
```

**Cookies set:**

```
refresh_token=<token>;  HttpOnly; Secure; SameSite=Strict; Max-Age=2592000
csrf_token=<token>;     Secure; SameSite=Strict; Max-Age=2592000
```

**Errors:**
| Status | Error |
|--------|-------|
| 401 | Invalid email or password |
| 403 | Email not verified |
| 429 | Too many attempts |

**Frontend flow after login:**

1. Store `accessToken` in Zustand/memory
2. Store `user` in Zustand
3. Set up a 4.5-minute interval to call `POST /auth/refresh` before access token expires

---

### POST /api/v1/auth/logout

Revoke the current session and clear auth cookies.

**Auth required:** Yes (Bearer token)
**Rate limit:** Global (100/15min)

**Required headers:**

```
Authorization: Bearer <accessToken>
X-CSRF-Token: <token from csrf_token cookie>
```

**Success (200):**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully."
  }
}
```

**Side effects:**

- Revokes the Session record in the database
- Clears `refresh_token` cookie
- Clears `csrf_token` cookie

---

### POST /api/v1/auth/refresh

Get a new access token using the refresh token cookie.
Called automatically by the frontend every ~4.5 minutes.

**Auth required:** No (uses refresh_token cookie instead)
**Rate limit:** 30 requests / 15 minutes / IP

**Required cookies:**

```
refresh_token=<token>   (HttpOnly — sent automatically by the browser)
```

**Required headers:**

```
X-CSRF-Token: <token from csrf_token cookie>
```

**Success (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "user": { ... }
  }
}
```

**Cookies rotated:** New `refresh_token` and `csrf_token` cookies set.

**Security behaviour:**

- Old refresh token is immediately invalidated (single-use)
- If a previously-used token is detected → all user sessions are revoked → 401 returned
- Frontend should redirect to login page on 401 from this endpoint

**Errors:**
| Status | Error |
|--------|-------|
| 401 | No refresh token / invalid / expired / reused |

---

### GET /api/v1/auth/verify/:token

Activate an account using the token from the verification email.

**Auth required:** No
**Rate limit:** Global (100/15min)

**URL params:**
| Param | Description |
|-------|-------------|
| token | 64-char hex string from the verification email link |

**Success (200):**

```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully. You can now log in."
  }
}
```

**Errors:**
| Status | Error |
|--------|-------|
| 400 | Invalid or expired verification link |
| 400 | Account already verified |

**Frontend flow:**

- Verification email links to: `https://jobhunt.vercel.app/auth/verify?token=<token>`
- The Next.js page reads the token from the query string and calls this endpoint
- On success: redirect to `/auth/login` with a success toast

---

### GET /api/v1/auth/me

Get the currently authenticated user's data.

**Auth required:** Yes (Bearer token)
**Rate limit:** Global (100/15min)

**Required headers:**

```
Authorization: Bearer <accessToken>
```

**Success (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx...",
      "email": "user@example.com",
      "verified": true,
      "createdAt": "2026-04-07T12:00:00.000Z"
    }
  }
}
```

**Errors:**
| Status | Error |
|--------|-------|
| 401 | No token / expired token |
| 404 | User not found (account deleted after token was issued) |

---

## Audit Log Events

Every authentication event is written to the `auth_logs` table:

| Event              | Trigger                                        |
| ------------------ | ---------------------------------------------- |
| `register`         | New account created                            |
| `login_success`    | Successful login                               |
| `login_failed`     | Wrong password                                 |
| `logout`           | User logged out                                |
| `token_refreshed`  | Access token refreshed                         |
| `token_reuse`      | **SECURITY**: rotated refresh token used again |
| `sessions_revoked` | All sessions killed (response to token reuse)  |
| `email_verified`   | Account activated via email link               |

---

## Frontend Integration Example

```typescript
// services/auth.service.ts

const API = process.env.NEXT_PUBLIC_API_URL

// Get CSRF token on app load
export const getCsrfToken = async () => {
  const res = await fetch(`${API}/api/v1/auth/csrf-token`, { credentials: 'include' })
  return res.json() // also sets csrf_token cookie
}

// Login
export const login = async (email: string, password: string) => {
  const csrfToken = getCsrfTokenFromCookie() // read the cookie with js-cookie
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    credentials: 'include', // sends refresh_token cookie
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ email, password, website: '' }),
  })
  return res.json() // { accessToken, user }
}

// Refresh (called every 4.5 min automatically)
export const refreshSession = async () => {
  const csrfToken = getCsrfTokenFromCookie()
  const res = await fetch(`${API}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken },
  })
  return res.json() // { accessToken, user }
}
```
