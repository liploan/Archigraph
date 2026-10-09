import unittest
from unittest.mock import patch, MagicMock

import app as app_module
from src import security
from src.security import UnsafeURLError, validate_public_url, safe_get

# example.com's address; a public IP literal avoids needing DNS in tests
PUBLIC_URL = "http://93.184.216.34/team"


class AppTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()
        app_module._rate_hits.clear()
        app_module._budget.update({"day": None, "used": 0})

    def post(self, payload, headers=None):
        return self.client.post("/api/extract", json=payload, headers=headers or {})


class TestDemos(AppTestCase):
    def test_illustrative_demo_is_labelled_and_has_timeline(self):
        body = self.client.get("/api/demo/google").get_json()
        self.assertEqual(body["sample_data"], "illustrative")
        self.assertIn("Illustrative", body["note"])
        self.assertEqual(body["snapshots_processed"], 2)
        stamps = [s["snapshot_timestamp"] for s in body["data"]]
        self.assertEqual(stamps, sorted(stamps))

    def test_extracted_demo_is_labelled_differently(self):
        body = self.client.get("/api/demo/replit").get_json()
        self.assertEqual(body["sample_data"], "extracted")

    def test_unknown_and_traversal_keys_404(self):
        self.assertEqual(self.client.get("/api/demo/nope").status_code, 404)
        self.assertEqual(self.client.get("/api/demo/..%2Fmanifest").status_code, 404)

    def test_all_demo_people_have_real_names(self):
        for key in ("google", "meta", "spacex", "palantir", "replit"):
            for snap in self.client.get(f"/api/demo/{key}").get_json()["data"]:
                for e in snap["entities"]:
                    self.assertNotEqual(e["full_name"], e["job_title"], f"{key}: {e['id']}")
                    self.assertNotIn("\x00", e["full_name"])


class TestExtractGating(AppTestCase):
    def test_disabled_by_default(self):
        with patch.object(app_module, "ENABLE_LIVE_EXTRACTION", False):
            self.assertEqual(self.post({"url": PUBLIC_URL}).status_code, 403)

    def test_token_required_when_configured(self):
        with patch.object(app_module, "ENABLE_LIVE_EXTRACTION", True), \
             patch.object(app_module, "ACCESS_TOKEN", "s3cret"):
            self.assertEqual(self.post({"url": PUBLIC_URL}).status_code, 401)
            self.assertEqual(
                self.post({"url": PUBLIC_URL}, {"X-Access-Token": "wrong"}).status_code, 401)

    def test_rejects_non_object_body_and_bad_limit(self):
        with patch.object(app_module, "ENABLE_LIVE_EXTRACTION", True), \
             patch.object(app_module, "ACCESS_TOKEN", None):
            r = self.client.post("/api/extract", data="not json", content_type="text/plain")
            self.assertEqual(r.status_code, 400)
            self.assertEqual(self.post({"url": PUBLIC_URL, "limit": "abc"}).status_code, 400)

    def test_limit_is_clamped(self):
        seen = {}

        def fake_snapshots(url, limit):
            seen["limit"] = limit
            return []

        with patch.object(app_module, "ENABLE_LIVE_EXTRACTION", True), \
             patch.object(app_module, "ACCESS_TOKEN", None), \
             patch.object(app_module, "verify_credentials", lambda: None), \
             patch.object(app_module, "get_wayback_snapshots", fake_snapshots):
            self.post({"url": PUBLIC_URL, "limit": 999})
            self.assertEqual(seen["limit"], app_module.MAX_SNAPSHOTS_PER_REQUEST)
            self.post({"url": PUBLIC_URL, "limit": -4})
            self.assertEqual(seen["limit"], 1)

    def test_rate_limit_kicks_in(self):
        with patch.object(app_module, "ENABLE_LIVE_EXTRACTION", True), \
             patch.object(app_module, "ACCESS_TOKEN", None):
            codes = [self.post({"url": "ftp://x"}).status_code
                     for _ in range(app_module.RATE_LIMIT_REQUESTS + 1)]
            self.assertEqual(codes[:-1], [400] * app_module.RATE_LIMIT_REQUESTS)
            self.assertEqual(codes[-1], 429)

    def test_daily_budget_is_enforced(self):
        with patch.object(app_module, "MAX_EXTRACTIONS_PER_DAY", 2):
            self.assertTrue(app_module._reserve_extraction())
            self.assertTrue(app_module._reserve_extraction())
            self.assertFalse(app_module._reserve_extraction())

    def test_cache_ids_differ_by_path(self):
        a = app_module._cache_id("https://example.com/about", "example.com")
        b = app_module._cache_id("https://example.com/careers", "example.com")
        self.assertNotEqual(a, b)

    def test_security_headers_present(self):
        r = self.client.get("/healthz")
        self.assertEqual(r.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(r.headers["X-Frame-Options"], "DENY")


class TestSSRF(AppTestCase):
    def test_blocked_targets_via_api(self):
        with patch.object(app_module, "ENABLE_LIVE_EXTRACTION", True), \
             patch.object(app_module, "ACCESS_TOKEN", None):
            for bad in ("http://127.0.0.1/", "http://localhost:5001/", "http://169.254.169.254/latest/meta-data",
                        "http://10.0.0.5/", "http://[::1]/", "file:///etc/passwd", "ftp://example.com",
                        "http://user:pw@93.184.216.34/", ""):
                app_module._rate_hits.clear()
                self.assertEqual(self.post({"url": bad}).status_code, 400, bad)

    def test_validate_accepts_public_ip(self):
        self.assertEqual(validate_public_url(PUBLIC_URL), PUBLIC_URL)

    def test_redirect_to_internal_address_is_blocked(self):
        redirect = MagicMock()
        redirect.is_redirect = True
        redirect.status_code = 302
        redirect.headers = {"Location": "http://127.0.0.1/admin"}
        with patch.object(security.requests, "get", return_value=redirect):
            with self.assertRaises(UnsafeURLError):
                safe_get(PUBLIC_URL)


if __name__ == "__main__":
    unittest.main()
