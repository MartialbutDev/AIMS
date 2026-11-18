"""Regression coverage for avatar upload, replacement, and public serving."""

from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from PIL import Image, PngImagePlugin

import test_direct_placements as fixtures
from app.api.v1.endpoints import users
from app.core import avatar_images
from app.models.user import User


class AvatarTests(TestCase):
    def setUp(self):
        self.fixtures = fixtures.DirectPlacementTests()
        self.fixtures.setUp()
        self.addCleanup(self.fixtures.tearDown)
        self.db = self.fixtures.db
        self.client = self.fixtures.client
        self.root = Path(self.enterContext(TemporaryDirectory()))
        self.avatars = self.root / "avatars"
        self.avatars.mkdir()
        self.enterContext(patch.object(users.settings, "ASSET_DIR", str(self.root)))
        app = self.client.app
        app.include_router(users.router, prefix="/users")
        app.dependency_overrides[users.get_current_user] = lambda: self.db.get(User, "s1")
        app.mount("/static/avatars", avatar_images.AvatarStaticFiles(directory=self.avatars))

    def upload(self, content, name="avatar.png", mime="image/png"):
        return self.client.post("/users/avatar", files={"file": (name, content, mime)})

    def test_reencodes_real_image_and_ignores_client_filename(self):
        original = BytesIO()
        metadata = PngImagePlugin.PngInfo()
        metadata.add_text("description", "Synthetic private metadata")
        Image.new("RGBA", (1200, 600), (255, 0, 0, 128)).save(
            original, format="PNG", pnginfo=metadata
        )
        response = self.upload(original.getvalue() + b"extra data", "arbitrary.txt")
        self.assertEqual(response.status_code, 200, response.text)
        path = response.json()["avatar_url"]
        self.assertRegex(path, r"^avatars/avatar_s1_[a-f0-9]{32}\.png$")
        stored = self.client.get(f"/static/{path}")
        self.assertEqual(stored.status_code, 200)
        self.assertEqual(stored.headers["content-type"], "image/png")
        self.assertEqual(stored.headers["x-content-type-options"], "nosniff")
        self.assertIn("sandbox", stored.headers["content-security-policy"])
        self.assertNotIn(b"extra data", stored.content)
        with Image.open(BytesIO(stored.content)) as image:
            self.assertEqual(image.size, (1024, 512))
            self.assertNotIn("description", image.info)
            self.assertEqual(image.getpixel((0, 0))[3], 128)

    def test_rejects_invalid_and_excessive_uploads_without_replacing_avatar(self):
        photo = BytesIO()
        Image.new("RGB", (30, 30)).save(photo, format="JPEG")
        prior = self.upload(photo.getvalue())
        self.assertEqual(prior.status_code, 200, prior.text)
        path = prior.json()["avatar_url"]

        self.assertEqual(self.upload(b"Plain text fixture").status_code, 400)
        self.assertEqual(self.upload(photo.getvalue()[:30]).status_code, 400)
        with patch.object(avatar_images, "MAX_AVATAR_PIXELS", 899):
            self.assertEqual(self.upload(photo.getvalue()).status_code, 400)
        self.assertEqual(self.upload(b"x" * (users.MAX_AVATAR_BYTES + 1)).status_code, 413)
        self.assertEqual(self.db.get(User, "s1").avatar_url, path)
        self.assertEqual(list(self.avatars.iterdir()), [self.root / path])

    def test_replacement_and_legacy_delete_route(self):
        photo = BytesIO()
        Image.new("RGB", (30, 30)).save(photo, format="WEBP")
        first = self.upload(photo.getvalue(), "avatar.webp", "image/webp")
        self.assertEqual(first.status_code, 200, first.text)
        first_path = self.root / first.json()["avatar_url"]

        with patch.object(self.db, "commit", side_effect=RuntimeError("Fixture commit failed")):
            self.assertEqual(self.upload(photo.getvalue()).status_code, 500)
        self.assertEqual(list(self.avatars.iterdir()), [first_path])

        second = self.upload(photo.getvalue(), "avatar.webp", "image/webp")
        self.assertEqual(second.status_code, 200, second.text)
        second_path = self.root / second.json()["avatar_url"]
        self.assertNotEqual(first_path, second_path)
        self.assertFalse(first_path.exists())
        self.assertTrue(second_path.exists())
        self.assertEqual(self.client.post("/users/avatar/delete").status_code, 200)
        self.assertFalse(second_path.exists())
        self.assertIsNone(self.db.get(User, "s1").avatar_url)

    def test_coordinator_can_delete_own_profile_photo(self):
        self.client.app.dependency_overrides[users.get_current_user] = (
            lambda: self.db.get(User, "c1")
        )
        photo = BytesIO()
        Image.new("RGB", (30, 30)).save(photo, format="PNG")

        uploaded = self.upload(photo.getvalue())
        self.assertEqual(uploaded.status_code, 200, uploaded.text)
        avatar_path = self.root / uploaded.json()["avatar_url"]
        self.assertTrue(avatar_path.is_file())

        removed = self.client.delete("/users/avatar")
        self.assertEqual(removed.status_code, 200, removed.text)
        self.assertIsNone(self.db.get(User, "c1").avatar_url)
        self.assertFalse(avatar_path.exists())

    def test_public_mount_blocks_legacy_non_image_extensions(self):
        (self.avatars / "legacy.html").write_text("Plain text fixture", encoding="utf-8")
        self.assertEqual(self.client.get("/static/avatars/legacy.html").status_code, 404)
