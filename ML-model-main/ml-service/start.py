import os
from pathlib import Path

import uvicorn


def get_port() -> int:
    raw_port = os.environ.get("PORT", "8001")

    try:
        return int(raw_port)
    except ValueError as error:
        raise RuntimeError(f"Invalid PORT value: {raw_port!r}") from error


if __name__ == "__main__":
    service_dir = Path(__file__).resolve().parent

    uvicorn.run(
        "app.main:app",
        host=os.environ.get("HOST", "0.0.0.0"),
        port=get_port(),
        app_dir=str(service_dir),
    )
