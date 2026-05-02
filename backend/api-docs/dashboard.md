# Dashboard API

Returns all statistics and chart data for the user's job search dashboard in a single call.

Base path: `/api/v1/dashboard`

All endpoints require `Authorization: Bearer <accessToken>` header.

---

## GET /api/v1/dashboard

Returns comprehensive dashboard statistics computed from the user's application history and profile.

All data points are computed in a single request via parallel database queries for performance.

### Request

No body or query params required.

### Response 200

```json
{
  "success": true,
  "data": {
    "totals": {
      "applied": 42,
      "saved": 8,
      "rejected": 12,
      "offers": 2
    },
    "streak": 5,
    "weeklyTrend": "+3 more than last week",
    "dailyChart": [
      { "date": "2026-04-03", "count": 0 },
      { "date": "2026-04-04", "count": 2 },
      { "date": "2026-04-05", "count": 1 },
      "... (30 items total)"
    ],
    "weeklyChart": [
      { "week": "2026-W08", "count": 3 },
      { "week": "2026-W09", "count": 7 },
      { "week": "2026-W10", "count": 5 },
      "... (12 items total)"
    ],
    "bySource": [
      { "source": "greenhouse", "count": 18 },
      { "source": "ashby", "count": 10 },
      { "source": "lever", "count": 8 },
      { "source": "remotive", "count": 4 },
      { "source": "arbeitnow", "count": 2 }
    ],
    "profileScore": {
      "score": 75,
      "missing": ["Remote preference"]
    }
  }
}
```

---

### Response Fields

#### `totals` object

Status breakdown of all the user's applications.

| Field | Type | Description |
|-------|------|-------------|
| `applied` | number | Count of applications with status "applied" |
| `saved` | number | Count of applications with status "saved" |
| `rejected` | number | Count of applications with status "rejected" |
| `offers` | number | Count of applications with status "offer" |

#### `streak` number

Number of consecutive days (ending today) on which the user submitted at least one application.

- If today has no applications, streak is `0`
- Streak breaks on any day with zero applications

#### `weeklyTrend` string

Human-readable comparison of this week vs last week.

Possible values:
- `"+N more than last week"` — positive delta
- `"N fewer than last week"` — negative delta  
- `"Same as last week"` — zero delta

Week boundaries are Monday midnight (ISO 8601 week definition).

#### `dailyChart` array

Daily application counts for the last 30 days, one entry per day.

- Always exactly 30 items
- Missing days (zero applications) are filled with `count: 0`
- Sorted ascending by date (oldest first)
- Dates are ISO 8601 date strings (`"YYYY-MM-DD"`)

```json
[
  { "date": "2026-04-03", "count": 0 },
  { "date": "2026-04-04", "count": 2 }
]
```

#### `weeklyChart` array

Weekly application counts for the last 12 weeks.

- Always exactly 12 items (may be fewer in edge cases if weeks overlap)
- Missing weeks (zero applications) are filled with `count: 0`
- Sorted ascending (oldest week first)
- Week labels use ISO 8601 week notation: `"YYYY-WNN"` (e.g. `"2026-W18"`)

```json
[
  { "week": "2026-W08", "count": 3 },
  { "week": "2026-W09", "count": 7 }
]
```

#### `bySource` array

Applications grouped by job source, sorted by count descending.

- One entry per source the user has applied to
- Sources with zero applications are excluded
- Sorted from most to least applied

```json
[
  { "source": "greenhouse", "count": 18 },
  { "source": "lever", "count": 9 }
]
```

#### `profileScore` object

Measures how complete the user's profile is on a 0–100 scale.

| Field | Type | Description |
|-------|------|-------------|
| `score` | number | 0, 25, 50, 75, or 100 |
| `missing` | string[] | Human-readable labels for unset profile fields |

Scoring breakdown (25 points each):
- **Job roles**: `+25` if `profile.roles.length > 0`
- **Skills**: `+25` if `profile.skills.length > 0`
- **Location**: `+25` if `profile.location` is set (non-null, non-empty)
- **Remote preference**: `+25` if `profile.remotePref !== "any"`

`missing` values: `"Job roles"`, `"Skills"`, `"Location"`, `"Remote preference"`

---

### Error Responses

| Status | Condition |
|--------|-----------|
| `401` | Missing or invalid access token |
| `500` | Unexpected server error (safe message returned, details logged) |

---

### Performance Notes

All 8 database queries in this endpoint run in parallel via `Promise.all()`, minimizing total response time to the duration of the single slowest query.

Data that does not require a separate query (streak calculation, weekly trend comparison, profile score) is computed in-memory after the parallel queries resolve.
