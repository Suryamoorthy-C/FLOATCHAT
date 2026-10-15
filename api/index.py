"""Vercel Python function entrypoint for the FLOATCHAT FastAPI service."""
from fastapi import FastAPI

try:
    from server.main import app
except Exception as exc:  # temporary diagnostic; removed after the import issue is fixed
    app = FastAPI(title="FLOATCHAT API diagnostic")
    _error = f"{type(exc).__name__}: {exc}"

    @app.get("/api/health")
    def import_diagnostic():
        return {"status": "import_error", "error": _error}

__all__ = ["app"]
