from importlib import import_module

from fastapi import FastAPI, HTTPException
from app.schemas import AnalyzeRequest

app = FastAPI(title="Legal Contract Text Analysis Service")

_analyze_text = None
_predictor_error = None


def get_analyze_text():
    global _analyze_text, _predictor_error

    if _analyze_text is not None:
        return _analyze_text

    if _predictor_error is not None:
        raise _predictor_error

    try:
        predictor = import_module("app.predictor")
        _analyze_text = predictor.analyze_text
        return _analyze_text
    except Exception as error:
        _predictor_error = error
        raise error


@app.get("/")
def root():
    predictor_ready = _analyze_text is not None
    error_message = None

    if _analyze_text is None and _predictor_error is None:
        try:
            get_analyze_text()
            predictor_ready = True
        except Exception as error:
            predictor_ready = False
            error_message = str(error)
    elif _predictor_error is not None:
        predictor_ready = False
        error_message = str(_predictor_error)

    return {
        "message": "Legal text ML service is running",
        "predictorReady": predictor_ready,
        "mode": "lazy-load",
        "error": error_message,
    }


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    try:
        analyze_text = get_analyze_text()
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"ML predictor is unavailable: {error}"
        ) from error

    return analyze_text(request.text)
