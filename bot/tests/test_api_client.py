import unittest
from unittest.mock import patch

import requests

from bot.client.api_client import BotApiClient


class TestApiClient(unittest.TestCase):
    def test_headers_include_token(self):
        client = BotApiClient("http://localhost:4000", "token-123", 5, 0)
        headers = client._headers()
        self.assertEqual(headers["X-Bot-Token"], "token-123")

    @patch("requests.post")
    def test_import_batch_post(self, mock_post):
        response = requests.Response()
        response.status_code = 201
        response._content = b"{\"ok\":true}"
        mock_post.return_value = response

        client = BotApiClient("http://localhost:4000", "token-123", 5, 0)
        result = client.import_batch({"items": []})
        self.assertTrue(result["ok"])


if __name__ == "__main__":
    unittest.main()
