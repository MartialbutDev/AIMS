"""Explicit two-stage approval fixtures for reporting/completion tests.

These tests do not exercise capture/review endpoints; attendance workflow tests
exercise the real authorization and transition gates without these helpers.
"""
from datetime import datetime

def approved_attendance_fields(company='hte', coordinator='c1'):
    return dict(attendance_revision=1, company_status='confirmed',company_reviewed_by=company,
        company_reviewed_at=datetime(2026,1,1),company_review_revision=1,
        coordinator_reviewed_by=coordinator,coordinator_review_revision=1,approved_date=datetime(2026,1,1))
