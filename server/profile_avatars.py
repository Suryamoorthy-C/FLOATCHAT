"""Profile avatar validation with Supabase Storage in production.

When Supabase credentials are absent, the SQLite implementation remains
available for local development and unit tests.
"""
from __future__ import annotations

import io
import os
import re
import sqlite3
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from PIL import Image, ImageOps, UnidentifiedImageError

from .supabase_store import SupabaseStore

MAX_AVATAR_BYTES = 4 * 1024 * 1024
MAX_AVATAR_PIXELS = 16_000_000
ALLOWED_IMAGE_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png"}
_USER_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$")


class AvatarUploadError(ValueError):
    """An avatar file is invalid or exceeds configured limits."""


def validate_user_id(user_id: str) -> str:
    if not isinstance(user_id, str) or not _USER_ID_RE.fullmatch(user_id):
        raise AvatarUploadError("Invalid user ID.")
    return user_id


def sanitize_avatar(data: bytes) -> tuple[bytes, str]:
    if not data:
        raise AvatarUploadError("Choose a JPEG or PNG image.")
    if len(data) > MAX_AVATAR_BYTES:
        raise AvatarUploadError("Image must be 4 MiB or smaller.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                image_format = image.format
                if image_format not in ALLOWED_IMAGE_FORMATS:
                    raise AvatarUploadError("Only JPEG and PNG images are supported.")
                if image.width < 1 or image.height < 1 or image.width * image.height > MAX_AVATAR_PIXELS:
                    raise AvatarUploadError("Image dimensions are too large. Use an image under 16 megapixels.")
                if getattr(image, "n_frames", 1) != 1:
                    raise AvatarUploadError("Animated images are not supported.")
                image.verify()
            with Image.open(io.BytesIO(data)) as image:
                image = ImageOps.exif_transpose(image)
                if image_format == "JPEG":
                    cleaned, output_format, save_options = image.convert("RGB"), "JPEG", {"quality": 88, "optimize": True, "progressive": True}
                else:
                    cleaned, output_format, save_options = image.convert("RGBA" if "A" in image.getbands() else "RGB"), "PNG", {"optimize": True}
                output = io.BytesIO()
                cleaned.save(output, format=output_format, **save_options)
                cleaned.close()
                sanitized = output.getvalue()
    except AvatarUploadError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning, ValueError) as exc:
        raise AvatarUploadError("That image could not be decoded. Choose a valid JPEG or PNG.") from exc
    if len(sanitized) > MAX_AVATAR_BYTES:
        raise AvatarUploadError("Image must be 4 MiB or smaller after processing.")
    return sanitized, ALLOWED_IMAGE_FORMATS[output_format]


class ProfileAvatarStore:
    def __init__(self, db_path: str | None = None):
        self.use_supabase = db_path is None and bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
        self.db_path = db_path or os.getenv("FLOATCHAT_DB_PATH", "./data/floatchat.sqlite3")
        self.supabase = SupabaseStore() if self.use_supabase else None
        if not self.use_supabase:
            self._initialize()

    def _connect(self) -> sqlite3.Connection:
        if self.db_path != ":memory:":
            Path(self.db_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.db_path, timeout=10)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as db:
            db.execute("""CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY, avatar_url TEXT, avatar_data BLOB,
                avatar_mime_type TEXT, avatar_updated_at TEXT,
                display_name TEXT, email TEXT, role TEXT
            )""")
            for column in ("display_name", "email", "role"):
                try:
                    db.execute(f"ALTER TABLE user_profiles ADD COLUMN {column} TEXT")
                except sqlite3.OperationalError:
                    pass

    @staticmethod
    def _avatar_url(user_id: str, updated_at: str | None) -> str | None:
        if not updated_at:
            return None
        return f"/api/users/{quote(user_id, safe='')}/avatar?v={quote(updated_at, safe='')}"

    def get_profile(self, user_id: str) -> dict[str, Any]:
        validate_user_id(user_id)
        if self.use_supabase:
            row = self.supabase.select_profile(user_id)
            updated_at = row.get("avatar_updated_at") if row else None
        else:
            with self._connect() as db:
                row = db.execute("SELECT avatar_updated_at, display_name, email, role FROM user_profiles WHERE user_id = ?", (user_id,)).fetchone()
            updated_at = row["avatar_updated_at"] if row else None
        return {
            "user_id": user_id,
            "avatarUrl": self._avatar_url(user_id, updated_at),
            "updated_at": updated_at,
            "name": row.get("display_name") if isinstance(row, dict) else (row["display_name"] if row else None),
            "email": row.get("email") if isinstance(row, dict) else (row["email"] if row else None),
            "role": row.get("role") if isinstance(row, dict) else (row["role"] if row else None),
        }

    def save_profile(self, user_id: str, values: dict[str, Any]) -> dict[str, Any]:
        validate_user_id(user_id)
        display_name = str(values.get("display_name") or "").strip()
        email = str(values.get("email") or "").strip()
        role = str(values.get("role") or "Ocean research operator").strip()
        if self.use_supabase:
            row = self.supabase.upsert_profile({"user_id": user_id, "display_name": display_name, "email": email, "role": role})
            return {"user_id": user_id, "name": row.get("display_name", display_name), "email": row.get("email", email), "role": row.get("role", role), "avatarUrl": self._avatar_url(user_id, row.get("avatar_updated_at")), "updated_at": row.get("updated_at")}
        with self._connect() as db:
            db.execute("""INSERT INTO user_profiles (user_id, display_name, email, role)
                VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,
                email=excluded.email, role=excluded.role""", (user_id, display_name, email, role))
            row = db.execute("SELECT avatar_updated_at FROM user_profiles WHERE user_id = ?", (user_id,)).fetchone()
        return {"user_id": user_id, "name": display_name, "email": email, "role": role, "avatarUrl": self._avatar_url(user_id, row["avatar_updated_at"] if row else None), "updated_at": None}

    def get_avatar(self, user_id: str) -> tuple[bytes, str, str] | None:
        validate_user_id(user_id)
        if self.use_supabase:
            row = self.supabase.select_profile(user_id)
            if not row or not row.get("avatar_path"):
                return None
            return self.supabase.download_avatar(row["avatar_path"]), row["avatar_mime_type"], row["avatar_updated_at"]
        with self._connect() as db:
            row = db.execute("SELECT avatar_data, avatar_mime_type, avatar_updated_at FROM user_profiles WHERE user_id = ?", (user_id,)).fetchone()
        return (bytes(row["avatar_data"]), row["avatar_mime_type"], row["avatar_updated_at"]) if row and row["avatar_data"] is not None else None

    def save_avatar(self, user_id: str, data: bytes, mime_type: str) -> dict[str, Any]:
        validate_user_id(user_id)
        if mime_type not in ALLOWED_IMAGE_FORMATS.values():
            raise AvatarUploadError("Only JPEG and PNG images are supported.")
        updated_at = datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")
        avatar_url = self._avatar_url(user_id, updated_at)
        if self.use_supabase:
            path = self.supabase.upload_avatar(user_id, data, mime_type)
            self.supabase.upsert_profile({"user_id": user_id, "avatar_path": path, "avatar_mime_type": mime_type, "avatar_updated_at": updated_at})
        else:
            with self._connect() as db:
                db.execute("""INSERT INTO user_profiles (user_id, avatar_url, avatar_data, avatar_mime_type, avatar_updated_at)
                    VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET avatar_url=excluded.avatar_url,
                    avatar_data=excluded.avatar_data, avatar_mime_type=excluded.avatar_mime_type,
                    avatar_updated_at=excluded.avatar_updated_at""", (user_id, avatar_url, sqlite3.Binary(data), mime_type, updated_at))
        return {"user_id": user_id, "avatarUrl": avatar_url, "updated_at": updated_at}

    def delete_avatar(self, user_id: str) -> dict[str, Any]:
        validate_user_id(user_id)
        if self.use_supabase:
            row = self.supabase.select_profile(user_id)
            if row and row.get("avatar_path"):
                self.supabase.delete_avatar(row["avatar_path"])
            if row:
                self.supabase.upsert_profile({"user_id": user_id, "avatar_path": None, "avatar_mime_type": None, "avatar_updated_at": None})
        else:
            with self._connect() as db:
                db.execute("DELETE FROM user_profiles WHERE user_id = ?", (user_id,))
        return {"user_id": user_id, "avatarUrl": None, "updated_at": None}
