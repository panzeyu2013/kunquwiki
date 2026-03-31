import json
import tempfile
import unittest

from bot.importer.json_loader import JsonLoadError, load_json_file


class TestJsonLoader(unittest.TestCase):
    def test_load_json_file(self):
        with tempfile.NamedTemporaryFile("w+", delete=False, encoding="utf-8") as temp:
            json.dump({"items": []}, temp)
            temp.flush()
            data = load_json_file(temp.name)
            self.assertEqual(data, {"items": []})

    def test_invalid_json(self):
        with tempfile.NamedTemporaryFile("w+", delete=False, encoding="utf-8") as temp:
            temp.write("{invalid}")
            temp.flush()
            with self.assertRaises(JsonLoadError):
                load_json_file(temp.name)


if __name__ == "__main__":
    unittest.main()
