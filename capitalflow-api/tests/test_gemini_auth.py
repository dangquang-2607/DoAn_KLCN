"""Regression coverage for standard and authorization Gemini API keys."""
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang import gemini


class GeminiAuthenticationTests(unittest.IsolatedAsyncioTestCase):
    async def test_both_key_formats_use_api_key_header_on_generation_request(self):
        for key in ("AIzaSy-test-only", "AQ.test-only"):
            with self.subTest(key_type=key[:2]):
                response = httpx.Response(
                    200,
                    request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
                    json={"candidates": [{"content": {"parts": [{"text": '{"items": []}'}]}}]},
                )
                client = AsyncMock()
                client.post.return_value = response
                client.__aenter__.return_value = client
                with patch.object(gemini.settings, "google_ai_api_key", key), patch.object(
                    gemini.httpx, "AsyncClient", return_value=client
                ):
                    result = await gemini._call_gemini_model("test-model", b"test-image", "image/jpeg")
                headers = client.post.call_args.kwargs["headers"]
                self.assertEqual(headers["x-goog-api-key"], key)
                self.assertNotIn("Authorization", headers)
                self.assertEqual(result, {"items": []})


if __name__ == "__main__":
    unittest.main()
