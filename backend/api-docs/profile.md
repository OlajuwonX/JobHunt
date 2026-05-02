# Profile API

Manages user job search preferences and resume uploads.

Base path: `/api/v1/profile`

All endpoints require `Authorization: Bearer <accessToken>` header.

---

## GET /api/v1/profile

Returns the current user's profile including their email address.

If the user has not set up their profile yet (newly registered), a safe default shape is returned (no error).

### Request

No body or query params required.

### Response 200 — Profile exists

```json
{
  "success": true,
  "data": {
    "id": "clx_profile001",
    "userId": "clx_user123",
    "roles": ["Frontend Engineer", "React Developer"],
    "skills": ["React", "TypeScript", "Node.js", "PostgreSQL"],
    "location": "Lagos, Nigeria",
    "remotePref": "remote",
    "resumeUrl": "https://res.cloudinary.com/jobhunt/raw/authenticated/...",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-04-01T09:00:00.000Z",
    "user": {
      "email": "user@example.com"
    }
  }
}
```

### Response 200 — Profile not yet created (safe defaults)

```json
{
  "success": true,
  "data": {
    "userId": "clx_user123",
    "roles": [],
    "skills": [],
    "location": null,
    "remotePref": "any",
    "resumeUrl": null
  }
}
```

### Security Note

The response never includes `passwordHash` or session tokens. Only `user.email` is returned from the User relation.

### Error Responses

| Status | Condition |
|--------|-----------|
| `401` | Missing or invalid access token |

---

## PUT /api/v1/profile

Creates or updates the user's profile preferences. All fields are optional — send only the fields you want to update.

This is an **upsert** — if no profile exists, it creates one; if it exists, it updates the provided fields.

### Request Body (all fields optional)

```json
{
  "roles": ["Frontend Engineer", "UI Developer"],
  "location": "Lagos, Nigeria",
  "remotePref": "remote",
  "skills": ["React", "TypeScript", "Tailwind CSS", "Node.js"]
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `roles` | string[] | No | Max 10 items, each min 1 char |
| `location` | string | No | Max 100 chars |
| `remotePref` | string | No | `"remote"`, `"hybrid"`, `"onsite"`, `"any"` |
| `skills` | string[] | No | Max 50 items, each min 1 char |

Only provided fields are updated — omitted fields are left unchanged.

### Response 200

```json
{
  "success": true,
  "data": {
    "id": "clx_profile001",
    "userId": "clx_user123",
    "roles": ["Frontend Engineer", "UI Developer"],
    "skills": ["React", "TypeScript", "Tailwind CSS", "Node.js"],
    "location": "Lagos, Nigeria",
    "remotePref": "remote",
    "resumeUrl": null,
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-04-01T09:00:00.000Z",
    "user": {
      "email": "user@example.com"
    }
  }
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| `400` | Zod validation failed (too many roles/skills, invalid `remotePref` value) |
| `401` | Missing or invalid access token |

---

## POST /api/v1/profile/resume

Uploads a resume file to Cloudinary and stores the private authenticated URL in the user's profile. Overwrites any previously uploaded resume.

### Request

**Content-Type:** `multipart/form-data`

| Form Field | Type | Required | Constraints |
|------------|------|----------|-------------|
| `resume` | file | Yes | PDF, DOC, or DOCX only; max 5MB |

Accepted MIME types:
- `application/pdf`
- `application/msword` (.doc)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx)

### Example (curl)

```bash
curl -X POST https://api.jobhunt.com/api/v1/profile/resume \
  -H "Authorization: Bearer <accessToken>" \
  -F "resume=@/path/to/my-cv.pdf"
```

### Upload Flow

1. Client sends multipart/form-data with the file in the `resume` field
2. Multer middleware intercepts the request and stores the file in memory (no temp files on disk)
3. File type and size are validated (rejects non-PDF/DOCX or files > 5MB)
4. The buffer is uploaded to Cloudinary with `access_mode: authenticated` — the URL is private and cannot be accessed publicly
5. The `secure_url` returned by Cloudinary is saved to the user's profile in the database
6. Only the URL is returned to the client — the raw Cloudinary credentials are never exposed

### Response 200

```json
{
  "success": true,
  "data": {
    "resumeUrl": "https://res.cloudinary.com/jobhunt/raw/authenticated/v1234567890/jobhunt/resumes/clx_user123"
  }
}
```

### Security Notes

- The `resumeUrl` is a Cloudinary **authenticated** URL — it cannot be accessed without a valid signed token
- The `public_id` is set to the `userId` — only one resume file per user is stored in Cloudinary
- `overwrite: true` ensures old files are replaced, not accumulated
- The `api_secret` is never exposed to the client

### Error Responses

| Status | Condition |
|--------|-----------|
| `400` | No file provided in the request |
| `400` | Invalid file type (not PDF/DOC/DOCX) — returned by multer |
| `400` | File exceeds 5MB limit — returned by multer |
| `500` | Cloudinary upload failed (network error, invalid credentials) |
| `401` | Missing or invalid access token |
