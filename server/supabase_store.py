"""Small Supabase REST/Storage adapter for the Vercel-hosted FastAPI app.

The backend uses the service-role key only on the server. Local tests and local
runs without Supabase credentials continue to use the existing SQLite stores.
"""
from __future__ import annotations

import os
from typing import Any
from urllib.parse import quote

import requests


class SupabaseStoreError(RuntimeError):
    """Raised when Supabase cannot satisfy a persistence request."""


class SupabaseStore:
    def __init__(self, url: str | None = None, service_role_key: str | None = None):
        self.url = (url or os.getenv("SUPABASE_URL", "")).rstrip("/")
        self.key = service_role_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.bucket = os.getenv("SUPABASE_AVATAR_BUCKET", "avatars")
        self.timeout = float(os.getenv("SUPABASE_TIMEOUT_SECONDS", "12"))

    @property
    def configured(self) -> bool:
        return bool(self.url and self.key)

    @property
    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Accept": "application/json",
        }

    def _request(self, method: str, path: str, **kwargs: Any) -> requests.Response:
        if not self.configured:
            raise SupabaseStoreError("Supabase is not configured.")
        headers = {**self.headers, **kwargs.pop("headers", {})}
        try:
            response = requests.request(method, f"{self.url}{path}", headers=headers, timeout=self.timeout, **kwargs)
        except requests.RequestException as exc:
            raise SupabaseStoreError("Supabase is unavailable.") from exc
        if not response.ok:
            detail = response.text[:300] or response.reason
            raise SupabaseStoreError(f"Supabase request failed ({response.status_code}): {detail}")
        return response

    def select_profile(self, user_id: str) -> dict[str, Any] | None:
        response = self._request(
            "GET",
            "/rest/v1/user_profiles",
            params={"select": "*", "user_id": f"eq.{user_id}", "limit": "1"},
        )
        rows = response.json()
        return rows[0] if rows else None

    def upsert_profile(self, values: dict[str, Any]) -> dict[str, Any]:
        response = self._request(
            "POST",
            "/rest/v1/user_profiles",
            params={"on_conflict": "user_id"},
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
            json=values,
        )
        rows = response.json()
        return rows[0] if rows else values

    def upload_avatar(self, user_id: str, data: bytes, mime_type: str) -> str:
        path = f"profiles/{quote(user_id, safe='')}.{ 'png' if mime_type == 'image/png' else 'jpg' }"
        self._request(
            "POST",
            f"/storage/v1/object/{quote(self.bucket, safe='')}/{quote(path, safe='/')}",
            headers={"Content-Type": mime_type, "x-upsert": "true"},
            data=data,
        )
        return path

    def download_avatar(self, path: str) -> bytes:
        return self._request(
            "GET",
            f"/storage/v1/object/{quote(self.bucket, safe='')}/{quote(path, safe='/')}",
        ).content

    def delete_avatar(self, path: str) -> None:
        self._request(
            "POST",
            "/storage/v1/object/remove",
            json={"prefixes": [f"{self.bucket}/{path}"]},
        )
