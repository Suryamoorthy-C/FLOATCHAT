# FLOATCHAT

FLOATCHAT is an ocean intelligence dashboard for exploring ARGO float observations in plain language. This hackathon MVP includes a filterable float network, depth profile visualization, anomaly signals, provenance table, and a grounded chat experience.

## Run the frontend

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Run the API

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install fastapi uvicorn
uvicorn server.main:app --reload --port 8000
```

The UI has a local demo dataset so it works without credentials. The API is ready for the next step: replacing the demo records with `argopy` / DuckDB ingestion.
