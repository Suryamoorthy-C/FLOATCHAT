# Profile photo upload

The Profile page supports JPEG and PNG uploads, local preview, replacement, and removal. On **Save profile**, the selected original file is sent as `multipart/form-data`; the browser does not send the preview data URL as the upload payload.

## API

- `GET /api/users/{user_id}/profile` returns `{ "user_id": "...", "avatarUrl": "/api/users/.../avatar?v=...", "updated_at": "..." }`.
- `POST /api/users/{user_id}/avatar` accepts one multipart field named `file` and returns the updated `avatarUrl`.
- `GET /api/users/{user_id}/avatar` streams the stored, sanitized JPEG or PNG.
- `DELETE /api/users/{user_id}/avatar` removes the stored photo.

Example:

```bash
curl -X POST \
  -F 'file=@profile.jpg;type=image/jpeg' \
  https://your-api.example.com/api/users/usr_demo_001/avatar
```

The API accepts JPEG/PNG only and limits uploads to **4 MiB** to leave multipart overhead below common serverless request-body limits. The backend checks decoded image format (not only the client MIME type), rejects animated/oversized-dimension files, applies EXIF orientation, and re-encodes the image before storage. Original filenames and metadata are not retained.

## Persistence

The `user_profiles` SQLite table stores `user_id`, `avatar_url`, `avatar_data` (BLOB), `avatar_mime_type`, and `avatar_updated_at`. It uses the same `FLOATCHAT_DB_PATH` database as the existing alert store. Locally, install the Python requirements and run the API as described in `REAL_DATA.md`; the default database file is `./data/floatchat.sqlite3` and is git-ignored.

**Deployment note:** standard Vercel serverless functions do not provide a durable writable local filesystem. The SQLite implementation is suitable for local development and a persistent single-host deployment, but Vercel production photos can disappear between instances unless `ProfileAvatarStore` is backed by a managed database/object store. Set up that durable store before relying on long-term profile-photo persistence in production. The app currently has no authentication provider; in a real multi-user deployment, derive `user_id` from a verified session/token instead of trusting the URL parameter.

## Dependencies

`python-multipart` parses multipart requests. Pillow decodes, verifies, normalizes, and re-encodes images. Install both with:

```bash
pip install -r requirements.txt
```
