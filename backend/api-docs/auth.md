# Authentication API — Documentation

Base URL: `/api/v1/auth`

All responses follow the envelope pattern:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "message" }
```

## Endpoints

### GET /api/v1/auth/csrf-token

Get a CSRF token. Call this when the app first loads.

**Auth required:** No
**Rate limit:** Global (100/15min)

**Response:**

```json
{
  "success": true
}
```

Also sets the `csrf_token` cookie (readable, not HttpOnly).

**Frontend usage:**

```typescript
const { data } = await api.get('/auth/csrf-token')
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
  "password": "",
  "confirmPassword": "",
}
``

**Required headers:**

```

X-CSRF-Token: <token from csrf_token cookie>

````

**Success (201):**

```json
{
  "success": true,
  "data": {
    "message": "Account created successfully. Please check your email to verify your account."
  }
}
````

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
  "password": ""
}
```

**Required headers:**

```
X-CSRF-Token: <token from csrf_token cookie>
```

**Success (200):**

```json
{
  "success": true
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
  "success": true
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
  "success": true
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
