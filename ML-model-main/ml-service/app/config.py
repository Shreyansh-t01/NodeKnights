import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NER_MODEL_PATH = os.path.join(BASE_DIR, "models", "ner")
CLAUSE_MODEL_PATH = os.path.join(BASE_DIR, "models", "clause_classifier", "clause_model.pkl")
RISK_MODEL_PATH   = os.path.join(BASE_DIR, "models", "risk_detector", "risk_model.pkl")