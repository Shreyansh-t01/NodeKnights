import os
import sys
from pathlib import Path


def get_port() -> int:
    raw_port = str(os.environ.get("PORT", "8001")).strip().strip('"').strip("'")

    try:
        return int(raw_port)
    except ValueError as error:
        raise RuntimeError(f"Invalid PORT value: {raw_port!r}") from error


def is_railway_runtime() -> bool:
    return any(
        os.environ.get(name)
        for name in (
            "RAILWAY_ENVIRONMENT",
            "RAILWAY_SERVICE_ID",
            "RAILWAY_PROJECT_ID",
        )
    )


def get_host() -> str:
    host = str(os.environ.get("HOST", "0.0.0.0")).strip().strip('"').strip("'")

    if is_railway_runtime() and host.lower() in {"localhost", "127.0.0.1", "::1"}:
        return "0.0.0.0"

    return host or "0.0.0.0"


if __name__ == "__main__":
    service_dir = Path(__file__).resolve().parent
    port = get_port()
    host = get_host()

    if str(service_dir) not in sys.path:
        sys.path.insert(0, str(service_dir))

    try:
        import uvicorn
    except Exception as error:
        raise RuntimeError(
            "Uvicorn is not installed. Ensure Railway installs the requirements.txt "
            "from ML-model-main/ml-service or ML-model-main."
        ) from error

    print(
        f"Starting ML service from {service_dir} on {host}:{port}",
        flush=True,
    )

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        app_dir=str(service_dir),
    )
