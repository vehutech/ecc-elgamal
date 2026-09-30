#!/usr/bin/env bash
# Start backend (FastAPI, :8000) and frontend (Next.js, :3000) together.
# Ctrl+C stops both.
cd "$(dirname "$0")"
trap 'kill 0' EXIT
(cd backend && venv/bin/python -m uvicorn main:app --reload --port 8000) &
(cd frontend && npm run dev) &
wait
