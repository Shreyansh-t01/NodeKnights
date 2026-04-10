from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class AnalyzeRequest(BaseModel):
    text: str


class ClauseResult(BaseModel):
    clause_text: str
    clause_text_full: str
    clause_text_summary: str
    clause_type: str
    risk_label: str
    extracted_values: Dict[str, Any] = {}


class AnalyzeResponse(BaseModel):
    entities: List[Dict[str, Any]]
    clauses: List[ClauseResult]
    summary: Optional[str] = None
