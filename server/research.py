"""Small, bounded research retriever for scientific context.

The retriever uses a curated set of authoritative ocean references for common
questions and Crossref metadata when the user explicitly asks for research or
published comparisons. It never turns a failed lookup into an invented source.
"""
from __future__ import annotations

from datetime import datetime, timezone
import html
import re
from typing import Any
from urllib.parse import quote

import requests


CURATED_SOURCES = [
    {
        "match": ("argo", "float", "profiling", "2000 m", "2000m"),
        "title": "Argo program",
        "url": "https://www.aoml.noaa.gov/argo/",
        "publisher": "NOAA Atlantic Oceanographic and Meteorological Laboratory",
        "why": "Overview of the international temperature and salinity profiling-float program.",
        "context": "ARGO uses robotic profiling floats to measure ocean properties such as temperature and salinity through the water column, commonly to about 2,000 m.",
    },
    {
        "match": ("salin", "bay of bengal", "arabian sea", "monsoon", "freshwater"),
        "title": "Impacts of the 2019 Strong IOD and Monsoon Events on the Surface Salinity in the Northern Indian Ocean",
        "url": "https://repository.library.noaa.gov/view/noaa/48583",
        "publisher": "NOAA Central Library Repository",
        "why": "Published Indian Ocean context for regional salinity and monsoon-driven variability.",
        "context": "The Bay of Bengal is generally fresher at the surface because monsoon rainfall and river discharge add freshwater, while circulation redistributes that signal; the Arabian Sea is more strongly affected by evaporation and saltier inflow.",
    },
    {
        "match": ("arabian sea", "monsoon", "salin", "heat content"),
        "title": "The Role of Salinity in the Southeastern Arabian Sea in Modulating the Indian Summer Monsoon",
        "url": "https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2019JC015592",
        "publisher": "Journal of Geophysical Research: Oceans",
        "why": "Peer-reviewed context for salinity, freshwater flux, and monsoon variability.",
        "context": "Salinity in the Arabian Sea is tied to freshwater flux, evaporation, and monsoon-related upper-ocean structure, so regional differences are seasonal and variable rather than a single fixed value.",
    },
    {
        "match": ("data quality", "quality control", "qc", "quality-controlled", "missing"),
        "title": "Argo floats",
        "url": "https://argo.ucsd.edu/",
        "publisher": "Argo Program / Scripps Institution of Oceanography",
        "why": "Program documentation for Argo observations and data access.",
        "context": "Argo data should be interpreted with attention to quality control, sampling coverage, timestamps, and which variables a particular float actually measured.",
    },
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _strip_markup(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", " ", value or "")).strip()


def _crossref(question: str) -> list[dict[str, Any]]:
    """Return verified Crossref metadata, or an empty list on any failure."""
    try:
        params = {"query.bibliographic": question[:240], "rows": 3, "select": "DOI,title,author,published,URL"}
        response = requests.get(
            "https://api.crossref.org/works",
            params=params,
            headers={"User-Agent": "FloatChat/0.4 (scientific assistant; mailto:contact@floatchat.example)"},
            timeout=5,
        )
        response.raise_for_status()
        items = response.json().get("message", {}).get("items", [])
    except Exception:
        return []

    citations: list[dict[str, Any]] = []
    for item in items:
        titles = item.get("title") or []
        title = _strip_markup(titles[0]) if titles else "Untitled research record"
        doi = item.get("DOI")
        url = item.get("URL") or (f"https://doi.org/{doi}" if doi else None)
        if not url or not title:
            continue
        authors = []
        for author in item.get("author") or []:
            name = " ".join(part for part in (author.get("given"), author.get("family")) if part)
            if name:
                authors.append(name)
        date_parts = (item.get("published") or {}).get("date-parts") or []
        year = date_parts[0][0] if date_parts and date_parts[0] else None
        citations.append({
            "title": title,
            "url": url,
            "publisher": "Crossref-indexed publication",
            "authors": authors[:4],
            "published": year,
            "why": "Literature metadata retrieved from Crossref for this question.",
            "retrieved_at": _now(),
            "kind": "literature",
        })
    return citations


def retrieve_research(question: str, parsed: dict[str, Any]) -> list[dict[str, Any]]:
    """Return only sources relevant to the question and actually selected."""
    normalized = question.lower()
    citations: list[dict[str, Any]] = []
    for source in CURATED_SOURCES:
        if any(term in normalized for term in source["match"]):
            citations.append({key: value for key, value in {
                "title": source["title"], "url": source["url"], "publisher": source["publisher"],
                "why": source["why"], "selected_at": _now(), "kind": "authoritative_reference",
                "context": source.get("context"),
            }.items() if value is not None})
            if len(citations) >= 3:
                break

    research_requested = any(
        phrase in normalized
        for phrase in ("published", "research", "study", "studies", "paper", "literature", "compare with", "citation", "source")
    )
    if research_requested or parsed.get("intent") == "research":
        for citation in _crossref(question):
            if citation["url"] not in {item["url"] for item in citations}:
                citations.append(citation)
            if len(citations) >= 5:
                break
    return citations[:5]
