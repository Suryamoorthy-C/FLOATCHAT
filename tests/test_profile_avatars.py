import io
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from server.profile_avatars import (
    MAX_AVATAR_BYTES,
    AvatarUploadError,
    ProfileAvatarStore,
    sanitize_avatar,
    validate_user_id,
)


def make_image(fmt="PNG", size=(24, 24)):
    image = Image.new("RGBA" if fmt == "PNG" else "RGB", size, (33, 160, 150, 255) if fmt == "PNG" else (33, 160, 150))
    output = io.BytesIO()
    image.save(output, format=fmt)
    return output.getvalue()


class ProfileAvatarTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.store = ProfileAvatarStore(str(Path(self.tempdir.name) / "profiles.sqlite3"))

    def tearDown(self):
        self.tempdir.cleanup()

    def test_sanitizes_and_stores_png_avatar_with_profile_url(self):
        sanitized, mime_type = sanitize_avatar(make_image("PNG"))
        self.assertEqual(mime_type, "image/png")
        saved = self.store.save_avatar("usr_demo_001", sanitized, mime_type)
        self.assertIn("/api/users/usr_demo_001/avatar?v=", saved["avatarUrl"])
        self.assertEqual(self.store.get_profile("usr_demo_001")["avatarUrl"], saved["avatarUrl"])
        self.assertEqual(self.store.get_avatar("usr_demo_001"), (sanitized, "image/png", saved["updated_at"]))

    def test_sanitizes_jpeg_and_returns_correct_mime_type(self):
        sanitized, mime_type = sanitize_avatar(make_image("JPEG"))
        self.assertEqual(mime_type, "image/jpeg")
        with Image.open(io.BytesIO(sanitized)) as saved:
            self.assertEqual(saved.format, "JPEG")

    def test_rejects_invalid_image_bytes(self):
        with self.assertRaises(AvatarUploadError):
            sanitize_avatar(b"not an image")

    def test_rejects_unsupported_format_even_when_decodable(self):
        with self.assertRaisesRegex(AvatarUploadError, "Only JPEG and PNG"):
            sanitize_avatar(make_image("GIF"))

    def test_rejects_oversized_upload_before_decoding(self):
        with self.assertRaisesRegex(AvatarUploadError, "4 MiB"):
            sanitize_avatar(b"x" * (MAX_AVATAR_BYTES + 1))

    def test_rejects_path_like_user_ids(self):
        for user_id in ("../user", "user/name", "", " spaces "):
            with self.subTest(user_id=user_id), self.assertRaises(AvatarUploadError):
                validate_user_id(user_id)

    def test_delete_clears_avatar(self):
        sanitized, mime_type = sanitize_avatar(make_image())
        self.store.save_avatar("usr_demo_001", sanitized, mime_type)
        deleted = self.store.delete_avatar("usr_demo_001")
        self.assertIsNone(deleted["avatarUrl"])
        self.assertIsNone(self.store.get_avatar("usr_demo_001"))
        self.assertIsNone(self.store.get_profile("usr_demo_001")["avatarUrl"])


if __name__ == "__main__":
    unittest.main()
