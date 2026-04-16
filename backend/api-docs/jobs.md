# Jobs API — Documentation

Base path: `/api/v1/jobs`

All responses follow the envelope pattern:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "message" }
```

---

## GET /api/v1/jobs

Returns a paginated, filtered list of job listings.

**Auth required:** Yes (Bearer token)
**Rate limit:** Global (100/15min)

**Required headers:**

```
Authorization: Bearer <accessToken>
```

**Query parameters:**

| Parameter  | Type    | Default | Constraints                    | Description                              |
| ---------- | ------- | ------- | ------------------------------ | ---------------------------------------- |
| `page`     | integer | `1`     | min: 1                         | Page number                              |
| `limit`    | integer | `20`    | min: 1, max: 50                | Results per page                         |
| `source`   | string  | —       | See valid values               | Filter by source platform                |
| `remote`   | boolean | —       | `true` or `false`              | Filter by remote status                  |
| `q`        | string  | —       | max 100 chars                  | Search on title and company name         |
| `category` | string  | —       | max 50 chars, see valid values | Filter by job role category              |
| `country`  | string  | —       | `nigeria` or `global`          | Filter by job market                     |
| `since`    | date    | —       | ISO 8601                       | Only jobs posted on or after this date   |
| `minScore` | integer | —       | 0–100                          | Only jobs with match score at this value |

**Valid `source` values:**
`greenhouse`, `lever`, `remotive`, `arbeitnow`, `jobicy`, `themuse`, `weworkremotely`, `jobberman`, `myjobmag`, `hotnigerianjobs`, `ngcareers`

**Valid `category` values:**
`tech`, `finance`, `sales`, `marketing`, `healthcare`, `design`, `operations`, `hr`, `legal`, `education`, `other`

**`country` values:**
`nigeria` — jobs from Nigerian job boards (Jobberman, MyJobMag, HotNigerianJobs, NGCareers) or jobs with a Nigerian city in their location.
`global` — all other international job listings.

**Success (200):**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clx1234abcd",
        "title": "Senior Backend Engineer",
        "company": "Stripe",
        "source": "greenhouse",
        "location": "Remote, US",
        "remote": true,
        "description": "...",
        "requirements": ["5+ years of backend experience"],
        "techStack": ["Go", "PostgreSQL", "Redis"],
        "applyUrl": "https://...",
        "sourceUrl": "https://...",
        "salaryRange": "$180,000 - $250,000",
        "category": "tech",
        "country": "global",
        "postedAt": "2024-01-15T09:00:00.000Z",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "matchScore": 85
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 342,
      "totalPages": 18,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Field notes:**

| Field         | Description                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matchScore`  | Only present if user has roles or skills set. Range 0–100. Scoring: role(30) + skills(40) + remote(15) + country(10) + recency(5).                                            |
| `category`    | Detected from title+description during ingestion. One of: `tech`, `finance`, `sales`, `marketing`, `healthcare`, `design`, `operations`, `hr`, `legal`, `education`, `other`. |
| `country`     | `nigeria` for Nigerian-market jobs (detected from source name or location); `global` for all others. Lowercase always.                                                        |
| `salaryRange` | `null` if source did not include salary information.                                                                                                                          |
| `sourceUrl`   | Original listing page URL. May equal `applyUrl` or differ.                                                                                                                    |
| `description` | Plain text, max 12,000 characters. May contain `\n` line breaks.                                                                                                              |

**Errors:**

| Status | Error                      | When                                |
| ------ | -------------------------- | ----------------------------------- |
| 400    | `Invalid query parameters` | Validation failed (e.g. limit > 50) |
| 401    | `Unauthorized`             | No valid access token               |

---

## GET /api/v1/jobs/:id

Returns full detail for a single job including the user's cached ATS score and application status.

**Auth required:** Yes (Bearer token)
**Rate limit:** Global (100/15min)

**Required headers:**

```
Authorization: Bearer <accessToken>
```

**Path parameters:**

| Parameter | Type   | Description                    |
| --------- | ------ | ------------------------------ |
| `id`      | string | The job's CUID (e.g. `clx...`) |

**Success (200):**

```json
{
  "success": true,
  "data": {
    "job": {
      "id": "",
      "title": "",
      "company": "",
      "source": "",
      "location": "",
      "remote": true,
      "description": "",
      "requirements": [],
      "techStack": [],
      "applyUrl": "",
      "sourceUrl": "",
      "salaryRange": null,
      "postedAt": "",
      "createdAt": "",
      "matchScore": 85,
      "atsScore": {
        "score": 72,
        "suggestions": [],
        "scoredAt": ""
      }
    },
    "application": {
      "id": "",
      "status": "applied",
      "appliedAt": ""
    }
  }
}
```

**Field notes:**

| Field         | Type                | Description                                               |
| ------------- | ------------------- | --------------------------------------------------------- |
| `atsScore`    | object \| null      | `null` if AI scoring has not run for this user+job yet.   |
| `application` | object \| null      | `null` if the user has not applied or saved this job.     |
| `matchScore`  | number \| undefined | Absent if user has no profile roles or skills configured. |

**Application status values:** `applied`, `saved`, `rejected`, `offer`

**Errors:**

| Status | Error                | When                  |
| ------ | -------------------- | --------------------- |
| 400    | `Job ID is required` | No ID in path         |
| 401    | `Unauthorized`       | No valid access token |
| 404    | `Job not found`      | Job ID does not exist |

---

## POST /api/v1/jobs/fetch

Manually triggers an immediate job ingestion run from all configured sources. Responds immediately — ingestion runs in the background.

**Auth required:** Yes (Bearer token)
**Rate limit:** Global (100/15min)

**Required headers:**

```
Authorization: Bearer <accessToken>
X-CSRF-Token: <token from csrf_token cookie>
```

**Request body:** None

**Success (202):**

```json
{
  "success": true,
  "data": {
    "message": "Job fetch started in background. New jobs will appear within 5 minutes.",
    "triggeredAt": ""
  }
}
```

**Errors:**

| Status | Error          | When                  |
| ------ | -------------- | --------------------- |
| 401    | `Unauthorized` | No valid access token |
