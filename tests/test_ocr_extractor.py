import unittest

from ocr_service.extractor import OcrLine, extract_candidates


class ExtractCandidatesTest(unittest.TestCase):
    def test_extracts_deduplicates_and_preserves_original(self):
        lines = [
            OcrLine("Learning English, one WORD at a time.", 0.91),
            OcrLine("word isn't difficult — learning works!", 0.97),
        ]
        result = extract_candidates(lines)
        self.assertEqual(
            [item["normalized"] for item in result],
            ["learning", "english", "one", "word", "at", "a", "time", "isn't", "difficult", "works"],
        )
        word = next(item for item in result if item["normalized"] == "word")
        self.assertEqual(word["word"], "word")
        self.assertEqual(word["confidence"], 0.97)

    def test_filters_low_confidence_noise_and_single_letters(self):
        lines = [
            OcrLine("x 2026 http A I useful", 0.88),
            OcrLine("ignored text", 0.2),
        ]
        result = extract_candidates(lines)
        self.assertEqual([item["normalized"] for item in result], ["a", "i", "useful"])


if __name__ == "__main__":
    unittest.main()
