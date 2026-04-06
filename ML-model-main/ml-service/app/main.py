from fastapi import FastAPI
from app.schemas import AnalyzeRequest
from app.predictor import analyze_text

app = FastAPI(title="Legal Contract Text Analysis Service")


@app.get("/")
def root():
    return {"message": "Legal text ML service is running"}


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    
    return analyze_text(request.text)
