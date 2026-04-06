import re


CLAUSE_HEADING_WORDS = [
    "payment",
    "fees",
    "compensation",
    "term",
    "duration",
    "termination",
    "confidentiality",
    "non-disclosure",
    "penalty",
    "liability",
    "indemnity",
    "dispute resolution",
    "arbitration",
    "governing law",
    "jurisdiction",
    "obligations",
    "renewal",
    "notice",
    "intellectual property",
    "force majeure",
    "warranty",
    "breach",
]


def normalize_text(text: str) -> str:
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def is_heading_line(line: str) -> bool:
    clean = line.strip().lower().rstrip(":")
    if not clean:
        return False

    if clean in CLAUSE_HEADING_WORDS:
        return True

    for word in CLAUSE_HEADING_WORDS:
        if clean == word:
            return True

    return False


def split_numbered_sections(text: str):
    pattern = re.compile(
        r'(?=(?:^|\n)\s*(?:'
        r'(?:clause|section)\s+\d+'
        r'|'
        r'\d+(?:\.\d+)*[.)]?'
        r')\s+)',
        flags=re.IGNORECASE
    )

    parts = pattern.split(text)
    parts = [p.strip() for p in parts if p.strip()]
    return parts if parts else [text]


def split_long_chunk(chunk: str, max_sentences: int = 2):
    sentences = re.split(r'(?<=[.;])\s+(?=[A-Z])', chunk.strip())
    sentences = [s.strip() for s in sentences if s.strip()]

    if len(sentences) <= max_sentences:
        return [chunk.strip()]

    grouped = []
    current = []

    for sentence in sentences:
        current.append(sentence)
        if len(current) >= max_sentences:
            grouped.append(" ".join(current).strip())
            current = []

    if current:
        grouped.append(" ".join(current).strip())

    return grouped


def split_into_clauses(text: str):
    text = normalize_text(text)

    if not text:
        return []

    top_sections = split_numbered_sections(text)
    final_chunks = []

    for section in top_sections:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", section) if p.strip()]

        if not paragraphs:
            paragraphs = [section]

        buffer = ""

        for para in paragraphs:
            lines = [line.strip() for line in para.split("\n") if line.strip()]

            if not lines:
                continue

            if len(lines) == 1 and is_heading_line(lines[0]):
                if buffer:
                    final_chunks.append(buffer.strip())
                buffer = lines[0]
                continue

            para_text = " ".join(lines).strip()

            if buffer:
                para_text = buffer + " " + para_text
                buffer = ""

            smaller_chunks = split_long_chunk(para_text, max_sentences=2)
            final_chunks.extend(smaller_chunks)

        if buffer:
            final_chunks.append(buffer.strip())

    cleaned = []
    for chunk in final_chunks:
        chunk = re.sub(r"\s+", " ", chunk).strip()
        if len(chunk) > 10:
            cleaned.append(chunk)

    return cleaned


def extract_money(text: str):
    return re.findall(
        r"(₹\s?[\d,]+|Rs\.?\s?[\d,]+|\$[\d,]+|\b\d+\s?(?:rupees|rs|usd|dollars)\b)",
        text,
        flags=re.I
    )


def extract_dates(text: str):
    return re.findall(
        r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|"
        r"\d{4}-\d{2}-\d{2}|"
        r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b",
        text,
        flags=re.I,
    )


def extract_duration(text: str):
    return re.findall(r"\b(\d+\s+(?:days?|months?|years?))\b", text, flags=re.I)


def extract_percentages(text: str):
    return re.findall(r"\b\d+(?:\.\d+)?%\b", text)


def clean_clause_text(text: str):
    text = text.strip()

    text = re.sub(r'^\d+(?:\.\d+)*[.)]?\s*', '', text)
    text = re.sub(r'^(clause|section)\s+\d+\s*[:.-]?\s*', '', text, flags=re.I)

    text = re.sub(
        r"^(the\s+)?(sponsor|player|company|franchise|team|party|parties)\s+(shall|may|agrees?\s+to|will)\s+",
        "",
        text,
        flags=re.I
    )

    text = re.sub(r"\b(this agreement|hereby|thereof|therein|hereto)\b", "", text, flags=re.I)
    text = re.sub(r"\b(shall|may|will|agrees?|agree)\b", "", text, flags=re.I)

    text = re.sub(r"\s+", " ", text).strip(" .,:;")
    return text


def make_short_clause_text(clause_type: str, raw_text: str):
    raw_lower = raw_text.lower()

    money_match = extract_money(raw_text)
    date_match = extract_dates(raw_text)
    duration_match = extract_duration(raw_text)
    percentage_match = extract_percentages(raw_text)

    money_txt = ", ".join(money_match) if money_match else ""
    date_txt = ", ".join(date_match) if date_match else ""
    duration_txt = ", ".join(duration_match) if duration_match else ""
    percentage_txt = ", ".join(percentage_match) if percentage_match else ""

    if clause_type == "payment":
        if money_txt and duration_txt and date_txt:
            return f"Payment of {money_txt} for {duration_txt}, due by {date_txt}"
        if money_txt and duration_txt:
            return f"Payment of {money_txt} for {duration_txt}"
        if money_txt:
            return f"Payment of {money_txt}"
        return "Payment obligation"

    if clause_type == "termination":
        parts = ["Termination"]
        if "immediately" in raw_lower:
            parts.append("immediate")
        if "without notice" in raw_lower or "without prior notice" in raw_lower:
            parts.append("without prior notice")
        if len(parts) > 1:
            return " | ".join(parts)
        return "Termination conditions defined"

    if clause_type == "penalty":
        if percentage_txt and money_txt:
            return f"Penalty of {percentage_txt} or {money_txt} may be imposed"
        if percentage_txt:
            return f"Penalty of {percentage_txt} may be imposed"
        if money_txt:
            return f"Penalty of {money_txt} may be imposed"
        return "Penalty clause defined"

    if clause_type == "confidentiality":
        if "financial" in raw_lower or "commercial" in raw_lower or "strategic" in raw_lower:
            return "Commercial and financial information must remain confidential"
        return "Confidential information must not be disclosed"

    if clause_type == "dispute_resolution":
        if "arbitration" in raw_lower:
            location = ""
            for city in ["mumbai", "delhi", "new delhi", "bengaluru", "chennai", "hyderabad", "kolkata", "pune"]:
                if city in raw_lower:
                    location = city.title()
                    break

            if location:
                return f"Disputes to be resolved by arbitration in {location}"
            return "Disputes to be resolved by arbitration"

        return "Dispute resolution mechanism defined"

    if clause_type == "governing_law":
        if "india" in raw_lower or "indian law" in raw_lower:
            return "Agreement governed by Indian law"
        return "Governing law defined"

    cleaned = clean_clause_text(raw_text)
    words = cleaned.split()
    if len(words) > 12:
        cleaned = " ".join(words[:12]) + "..."

    return cleaned if cleaned else "General clause"