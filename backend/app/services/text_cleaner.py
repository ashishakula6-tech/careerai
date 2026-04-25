"""
Stage 2 of the resume pipeline: Text Cleaning.

Cleans raw OCR/extracted text before it reaches the LLM:
- Fixes encoding artifacts
- Normalises whitespace and line breaks
- Removes noise characters, headers/footers, page numbers
- Deduplicates repeated lines
- Reports a text-quality score so the orchestrator can decide
  whether to retry OCR or warn the candidate.
"""
import re
import unicodedata


# Common encoding corruption patterns and their correct replacements
ENCODING_FIXES = [
    (r"â€™",  "'"),   (r"â€œ",  '"'),   (r"â€\x9d", '"'),
    (r"â€"",  "—"),   (r"â€¢",  "•"),   (r"â€¦",  "…"),
    (r"Ã©",   "é"),   (r"Ã¨",   "è"),   (r"Ã ",   "à"),
    (r"Ã¢",   "â"),   (r"Ã®",   "î"),   (r"Ã´",   "ô"),
    (r"Ã»",   "û"),   (r"Ã§",   "ç"),   (r"\x92", "'"),
    (r"\x93", '"'),   (r"\x94", '"'),   (r"\x96", "–"),
    (r"\x97", "—"),   (r"", "•"), (r"", "✓"),
]

# Patterns that are pure noise in a resume context
NOISE_PATTERNS = [
    r"page\s+\d+\s*(of\s*\d+)?",          # "Page 2 of 5"
    r"^\s*\d+\s*$",                         # lone page numbers
    r"curriculum\s+vitae",                  # redundant header
    r"resume\s*[-–—]\s*\w+",               # "Resume - John"
    r"confidential\s*[-–—]?\s*do\s+not",   # confidentiality notices
    r"[\-_=]{5,}",                          # long separator lines
    r"\.{5,}",                              # long dot runs
    r"\s{3,}",                              # collapsed later but flag first
]


def clean_text(raw: str) -> tuple[str, float]:
    """Clean extracted resume text and return (cleaned_text, quality_score 0-1).

    quality_score reflects how much usable text survived cleaning.
    < 0.3 → likely a failed OCR; warn the user.
    """
    if not raw or not raw.strip():
        return "", 0.0

    text = raw

    # 1. Fix encoding artifacts
    for pattern, replacement in ENCODING_FIXES:
        text = text.replace(pattern, replacement)

    # 2. Normalise unicode (NFC — composed form, removes combining chars)
    text = unicodedata.normalize("NFC", text)

    # 3. Remove non-printable control characters (keep \n \r \t)
    text = re.sub(r"[^\x09\x0a\x0d\x20-\x7e -￿]", " ", text)

    # 4. Remove OCR noise: isolated single characters on their own line
    text = re.sub(r"(?m)^\s*[^\w\s]\s*$", "", text)

    # 5. Remove page numbers and separator lines
    text = re.sub(r"(?im)^\s*page\s+\d+(\s*of\s*\d+)?\s*$", "", text)
    text = re.sub(r"(?m)^\s*\d{1,3}\s*$", "", text)
    text = re.sub(r"[-=_]{6,}", "", text)
    text = re.sub(r"\.{6,}", "", text)

    # 6. Collapse excessive blank lines (max 2 consecutive)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # 7. Normalise horizontal whitespace (tabs → spaces, collapse spaces)
    text = re.sub(r"[ \t]+", " ", text)

    # 8. Trim each line
    lines = [line.strip() for line in text.splitlines()]

    # 9. Deduplicate consecutive identical lines (OCR/PDF column artefact)
    deduped = []
    prev = None
    for line in lines:
        if line and line == prev:
            continue
        deduped.append(line)
        prev = line if line else prev

    # 10. Drop very short lines that are likely OCR fragments (< 2 chars)
    deduped = [l for l in deduped if len(l) != 1]

    cleaned = "\n".join(deduped).strip()

    # --- Quality score ---
    quality = _quality_score(raw, cleaned)

    return cleaned, quality


def _quality_score(original: str, cleaned: str) -> float:
    """Estimate text quality on a 0-1 scale.

    Factors:
    - Ratio of alphanumeric characters in the cleaned text
    - Length survival rate (how much text remains after cleaning)
    - Presence of recognisable resume keywords
    """
    if not cleaned:
        return 0.0

    # Alphanumeric ratio
    alnum = sum(c.isalnum() or c.isspace() for c in cleaned)
    alnum_ratio = alnum / max(len(cleaned), 1)

    # Length survival (cleaned should be >20% of original)
    survival = min(len(cleaned) / max(len(original), 1), 1.0)

    # Keyword presence (any of these → looks like a real resume)
    keywords = [
        "experience", "education", "skills", "email", "phone",
        "university", "college", "bachelor", "master", "degree",
        "worked", "developed", "managed", "project", "engineer",
        "linkedin", "github", "summary", "objective",
    ]
    text_lower = cleaned.lower()
    keyword_hits = sum(1 for kw in keywords if kw in text_lower)
    keyword_score = min(keyword_hits / 5, 1.0)

    score = (alnum_ratio * 0.4) + (survival * 0.2) + (keyword_score * 0.4)
    return round(min(score, 1.0), 3)
