# MiroFish + FloatChat integration

FloatChat now includes an optional **Argo scenario bridge** for [MiroFish](https://github.com/666ghj/MiroFish). The bridge sends a current FloatChat fleet snapshot and the user’s scenario requirement to MiroFish’s ontology-generation endpoint. MiroFish then owns graph building, agent preparation, simulation, report generation, and deep interaction.

## Why MiroFish runs separately

MiroFish is a Flask service with Zep Cloud, OASIS, and long-running simulation workers. The existing FloatChat Vercel deployment is a Vite site with a small FastAPI function, so embedding the full MiroFish runtime there would be unreliable and would not preserve its required worker lifecycle.

Run MiroFish using its official source or Docker instructions, then expose its backend and frontend through a protected HTTPS deployment. MiroFish’s official repository is the source of truth for its required `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL_NAME`, and `ZEP_API_KEY` configuration.

## FloatChat environment variables

Add these variables to the Vercel project:

```dotenv
MIROFISH_API_BASE_URL=https://your-mirofish-api.example.com
MIROFISH_APP_URL=https://your-mirofish-app.example.com
```

`MIROFISH_API_BASE_URL` is server-side only. It is used by the FastAPI bridge and is never sent to the browser. `MIROFISH_APP_URL` is optional; when set, successful seeding returns a direct MiroFish project link.

## User flow

1. Open the FloatChat Home page.
2. Use **MiroFish · Argo scenario lab** below the fishing-community section.
3. Enter a scenario requirement and optional Argo region.
4. FloatChat submits `floatchat-argo-context.txt` plus the requirement to `POST /api/graph/ontology/generate` on MiroFish.
5. Continue the graph, simulation, report, and interaction workflow in MiroFish.

The submitted snapshot includes source, fetch time, live-versus-cached state, platform number, region, coordinates, temperature, salinity, pressure, status, and last-seen fields. A simulation is exploratory and must not be presented as an observation, forecast, fish finder, or official safety warning.

## Bridge endpoints

- `GET /api/mirofish/status` — reports whether the bridge is configured and reachable.
- `POST /api/mirofish/seed` — accepts `{ "requirement": "...", "region": "..." }` and creates a MiroFish graph project from the Argo snapshot.

When the bridge variables are absent or the service is offline, FloatChat remains usable and the Home panel explains how to configure the optional connection.
