# Applications API

Manages job application tracking records for authenticated users.

Base path: `/api/v1/applications`

All endpoints require `Authorization: Bearer <accessToken>` header.

---

## GET /api/v1/applications/stats

Returns aggregate statistics for the current user's applications. Useful for populating dashboard widgets.

**NOTE:** This route must be called as `/stats` — it is registered before `/:id` routes to avoid conflict.

### Request

No body required.

**Query params:** none

### Response 200

```json
{
  "success": true,
  "data": {
    "totals": {
      "applied": 14,
      "saved": 6,
      "rejected": 3,
      "offers": 1
    },
    "appliedToday": 2,
    "appliedThisWeek": 7,
    "topSources": [
      { "source": "greenhouse", "count": 8 },
      { "source": "lever", "count": 5 },
      { "source": "ashby", "count": 2 }
    ]
  }
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `totals.applied` | number | Total applications with status "applied" |
| `totals.saved` | number | Total applications with status "saved" |
| `totals.rejected` | number | Total applications with status "rejected" |
| `totals.offers` | number | Total applications with status "offer" |
| `appliedToday` | number | Applications created today (midnight to now) |
| `appliedThisWeek` | number | Applications created since Monday of current week |
| `topSources` | array | Top 3 job sources by application count, sorted descending |

---

## GET /api/v1/applications

Returns a paginated list of the user's application records with embedded job details.

### Request

**Query params (all optional):**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `applied\|saved\|rejected\|offer` | — | Filter by application status |
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer (max 50) | `20` | Items per page |

### Response 200

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clx_abc123",
        "userId": "clx_user456",
        "jobId": "clx_job789",
        "status": "applied",
        "appliedAt": "2026-04-01T09:30:00.000Z",
        "updatedAt": "2026-04-01T09:30:00.000Z",
        "job": {
          "id": "clx_job789",
          "title": "Senior Backend Engineer",
          "company": "Stripe",
          "source": "greenhouse",
          "location": "Remote, US",
          "remote": true,
          "postedAt": "2026-03-28T00:00:00.000Z",
          "applyUrl": "https://boards.greenhouse.io/stripe/jobs/123",
          "category": "tech",
          "country": "global",
          "salaryRange": "$150,000 - $200,000",
          "techStack": ["Node.js", "TypeScript", "PostgreSQL"]
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

## POST /api/v1/applications

Creates a new application record or updates the status if one already exists for the same job (upsert by `userId + jobId`).

### Request Body

```json
{
  "jobId": "clx_job789",
  "status": "applied"
}
```

| Field | Type | Required | Values | Default |
|-------|------|----------|--------|---------|
| `jobId` | string (cuid) | Yes | — | — |
| `status` | string | No | `"applied"`, `"saved"` | `"applied"` |

### Response 201

```json
{
  "success": true,
  "data": {
    "id": "clx_abc123",
    "userId": "clx_user456",
    "jobId": "clx_job789",
    "status": "applied",
    "appliedAt": "2026-04-01T09:30:00.000Z",
    "updatedAt": "2026-04-01T09:30:00.000Z",
    "job": { ... }
  }
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| `400` | Zod validation failed (invalid `jobId` format, invalid `status`) |
| `404` | Job with the given `jobId` does not exist |
| `401` | Missing or invalid access token |

---

## PATCH /api/v1/applications/:id

Updates the status of an existing application.

### Request

**Path param:** `id` — the application's ID (cuid)

**Body:**

```json
{
  "status": "rejected"
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `status` | string | Yes | `"applied"`, `"saved"`, `"rejected"`, `"offer"` |

### Response 200

```json
{
  "success": true,
  "data": {
    "id": "clx_abc123",
    "userId": "clx_user456",
    "jobId": "clx_job789",
    "status": "rejected",
    "appliedAt": "2026-04-01T09:30:00.000Z",
    "updatedAt": "2026-04-02T14:00:00.000Z",
    "job": { ... }
  }
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| `400` | Zod validation failed (invalid status value) |
| `404` | Application not found, or belongs to a different user |
| `401` | Missing or invalid access token |

---

## DELETE /api/v1/applications/:id

Removes an application record permanently.

### Request

**Path param:** `id` — the application's ID (cuid)

No body required.

### Response 200

```json
{
  "success": true,
  "data": {
    "message": "Application removed"
  }
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| `404` | Application not found, or belongs to a different user |
| `401` | Missing or invalid access token |

---

## Status Lifecycle

```
saved → applied → rejected
              └→ offer
```

- `saved` — user bookmarked the job but hasn't formally applied
- `applied` — user has submitted an application
- `rejected` — employer rejected the application
- `offer` — employer extended a job offer
