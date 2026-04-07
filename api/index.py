"""
Vercel serverless entry point for the FastAPI backend.

Vercel's Python runtime looks for a callable named `app` in this file.
We add the backend directory to sys.path so all existing imports work
without modification.
"""
import sys
import os

# Make the backend package importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app  # noqa: E402 — must come after sys.path manipulation

__all__ = ["app"]
