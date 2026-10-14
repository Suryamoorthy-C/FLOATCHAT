"""Vercel Python function entrypoint for the FLOATCHAT FastAPI service."""
from server.main import app

__all__ = ["app"]
