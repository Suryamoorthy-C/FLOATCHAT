# FloatChat AI behavior

FloatChat is a scientific data assistant, not a generic chatbot. Every analytical request follows:

**ASK → UNDERSTAND → RETRIEVE → ANALYZE → VISUALIZE → EXPLAIN**

## Current implementation

- Natural-language intent extraction is deterministic and allow-listed.
- Supported intents include map, profile, anomaly, comparison clarification, explanation, and lookup.
- Regions currently recognized: Global Ocean, Indian Ocean, Bay of Bengal, and Arabian Sea.
- Queries can identify WMO/float IDs, temperature, salinity, pressure/depth, anomaly language, and basic depth filters.
- Numerical summaries are calculated by backend code, not generated from language-model memory.
- Responses are available as a structured JSON contract at `POST /api/query` and as grounded text streaming from `POST /api/chat`.

## Evidence contract

Successful and partial responses include:

- `status`
- `interpreted_question`
- `summary`
- `data_sources`
- `query_parameters`
- `observations`
- `analysis.method`
- `analysis.results`
- `analysis.assumptions`
- `analysis.limitations`
- `visualizations`
- `uncertainty`
- `suggested_followups`

Each result reports its unit and source retrieval time when available. Float profiles include WMO ID, cycle, observation time, pressure in dbar, and explicit QC-field availability. Pressure is not silently renamed as metres.

## Honesty rules

- A failed retrieval returns `no_data` or `error`; it never becomes a fabricated answer.
- Ambiguous comparisons and depth-boundary questions request one concise clarification.
- An anomaly is labelled a **potential statistical signal**, not a confirmed event, cause, pollution incident, ecological diagnosis, or forecast.
- Missing variables, sparse sampling, incomplete trajectories, and unavailable QC metadata are stated as limitations.
- Demo fallback records are labelled as demo fallback and are never described as live observations.
- BGC variables such as oxygen, chlorophyll, nitrate, and pH are reported only when the retrieved source actually provides them.

## Example requests

```text
Show available ARGO floats in the Bay of Bengal
Show the temperature and salinity profile for WMO 2902746
Are any observations unusual globally?
What data supports this result?
```

A thermocline request without a selected WMO/profile asks for clarification because the current fleet index is a recent surface-position feed and cannot support a depth-boundary calculation by itself.
