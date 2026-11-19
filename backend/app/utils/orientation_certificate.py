"""Certificate wording supports orientation checks; it does not prove authenticity."""
import re


def _certificate_heading(text, include_generic):
    lines = [re.sub(r"[^A-Z0-9]", "", line.upper())
             for line in (text or "")[:2400].splitlines() if line.strip()]
    titles = {"CERTIFICATEOFPARTICIPATION",
              "CERTIFICATEOFATTENDANCE", "CERTIFICATEOFCOMPLETION"}
    if include_generic:
        titles.add("CERTIFICATE")
    return any("".join(lines[start:start + count]) in titles
               for start in range(len(lines)) for count in (1, 2, 3))


def generic_certificate_heading(text):
    return _certificate_heading(text, include_generic=True)


def qualified_certificate_heading(text):
    return _certificate_heading(text, include_generic=False)


def orientation_participation(text):
    normalized = re.sub(r"\s+", " ", text or "").upper()
    event = re.search(
        r"\b(?:OJT|ON[ -]THE[ -]JOB[ -]TRAINING|INTERNSHIP)\s+ORIENTATION\b",
        normalized,
    )
    participation = re.search(
        r"\b(?:PARTICIPATION|PARTICIPATED|ATTENDANCE|ATTENDED|COMPLETION|COMPLETED)\b",
        normalized,
    )
    compact = re.sub(r"[^A-Z0-9]", "", normalized)
    certificate_type = any(
        "CERTIFICATEOF" + kind in compact
        for kind in ("PARTICIPATION", "ATTENDANCE", "COMPLETION")
    )
    return bool(event and (participation or certificate_type))
