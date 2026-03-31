import unittest

from bot.importer.validator import validate_payload


class TestValidator(unittest.TestCase):
    def test_missing_items(self):
        items, errors = validate_payload({})
        self.assertEqual(items, [])
        self.assertTrue(errors)

    def test_duplicate_title(self):
        payload = {
            "items": [
                {"entity_type": "city", "title": "上海"},
                {"entity_type": "city", "title": "上海"},
            ]
        }
        _, errors = validate_payload(payload)
        self.assertTrue(any("duplicate title" in err.message for err in errors))

    def test_excerpt_requires_parent(self):
        payload = {
            "items": [
                {"entity_type": "work", "title": "折子戏", "work_type": "excerpt"}
            ]
        }
        _, errors = validate_payload(payload)
        self.assertTrue(any(err.field == "parent_work_id" for err in errors))


if __name__ == "__main__":
    unittest.main()
