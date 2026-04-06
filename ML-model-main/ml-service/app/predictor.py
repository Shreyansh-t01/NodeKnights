import os
import joblib
import spacy
from app.utils import (
    split_into_clauses,
    make_short_clause_text,
    extract_money,
    extract_dates,
    extract_duration,
    extract_percentages
)
from app.config import NER_MODEL_PATH, CLAUSE_MODEL_PATH, RISK_MODEL_PATH

IMPORTANT_TYPES = [
    "payment",
    "termination",
    "penalty",
    "confidentiality",
    "dispute_resolution"
]


def log_status(level: str, message: str):
    print(f"[{level}] {message}")


try:
    if os.path.exists(NER_MODEL_PATH) and os.listdir(NER_MODEL_PATH):
        nlp = spacy.load(NER_MODEL_PATH)
        log_status("OK", "NER model loaded")
    else:
        nlp = spacy.load("en_core_web_sm")
        log_status("OK", "Fallback spaCy model loaded")
except Exception as e:
    log_status("ERROR", f"NER load error: {e}")
    nlp = spacy.load("en_core_web_sm")
    log_status("OK", "Fallback spaCy model loaded after error")

clause_model = None
risk_model = None

if os.path.exists(CLAUSE_MODEL_PATH):
    clause_model = joblib.load(CLAUSE_MODEL_PATH)
    log_status("OK", "Clause model loaded")
else:
    log_status("WARN", "Clause model not found")

if os.path.exists(RISK_MODEL_PATH):
    risk_model = joblib.load(RISK_MODEL_PATH)
    log_status("OK", "Risk model loaded")
else:
    log_status("WARN", "Risk model not found")


def predict_entities(text: str):
    doc = nlp(text)
    entities = []

    for ent in doc.ents:
        if ent.label_ in ["ORG", "PARTY", "LOCATION"]:
            entities.append({
                "text": ent.text,
                "label": ent.label_,
                "start": ent.start_char,
                "end": ent.end_char
            })

    for item in extract_money(text):
        entities.append({
            "text": item,
            "label": "MONEY",
            "start": -1,
            "end": -1
        })

    for item in extract_dates(text):
        entities.append({
            "text": item,
            "label": "DATE",
            "start": -1,
            "end": -1
        })

    for item in extract_duration(text):
        entities.append({
            "text": item,
            "label": "DURATION",
            "start": -1,
            "end": -1
        })

    for item in extract_percentages(text):
        entities.append({
            "text": item,
            "label": "PERCENTAGE",
            "start": -1,
            "end": -1
        })

    return entities


def predict_clause_type(clause_text: str):
    lower = clause_text.lower()

    if any(word in lower for word in [
        "confidential", "non-disclosure", "not disclose", "keep all", "shall keep", "must remain confidential"
    ]):
        return "confidentiality"

    if any(word in lower for word in [
        "terminate", "termination", "without prior notice", "without notice", "immediately terminate"
    ]):
        return "termination"

    if any(word in lower for word in [
        "penalty", "fine", "liquidated damages", "financial sanction"
    ]):
        return "penalty"

    if any(word in lower for word in [
        "dispute", "arbitration", "arbitrator", "jurisdiction", "tribunal", "court"
    ]):
        return "dispute_resolution"

    if any(word in lower for word in [
        "governed by", "governing law", "laws of india", "indian law"
    ]):
        return "governing_law"

    if any(word in lower for word in [
        "pay", "payment", "fee", "fees", "compensation", "remit", "invoice"
    ]):
        return "payment"

    if clause_model:
        return clause_model.predict([clause_text])[0]

    return "other"


def predict_risk(clause_text: str):
    if risk_model:
        return risk_model.predict([clause_text])[0]

    lower = clause_text.lower()

    if "without notice" in lower or "without prior notice" in lower or "immediately" in lower:
        return "high"
    if "penalty" in lower and ("immediate" in lower or "sole discretion" in lower):
        return "high"
    if "may terminate" in lower:
        return "medium"

    return "low"


def analyze_text(text: str):
    entities = predict_entities(text)
    split_clauses = split_into_clauses(text)

    clauses = []

    for clause in split_clauses:
        clause_type = predict_clause_type(clause)
        risk = predict_risk(clause)
        short_text = make_short_clause_text(clause_type, clause)

        clauses.append({
            "clause_text": short_text,
            "clause_type": clause_type,
            "risk_label": risk
        })
        print("analyse hone laga text python model se")

    filtered_clauses = []

    for clause in clauses:
        if clause["clause_type"] in IMPORTANT_TYPES or clause["risk_label"] == "high":
            filtered_clauses.append(clause)

    return {
        "entities": entities,
        "clauses": filtered_clauses,
        "summary": "Text analysis complete"
    }
