"""Shared MOA rules for internship placement."""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException


MOA_RENEWAL_REQUIRED = 'Applications paused — MOA renewal required'
MOA_REQUIRED = 'Applications paused — valid MOA required'


def moa_state(company):
    today = datetime.now(timezone(timedelta(hours=8))).date()
    expired = bool(company and company.is_moa_signed and company.moa_expires_at and company.moa_expires_at < today)
    checks = [
        ('Company is active', bool(company and company.is_active)),
        ('Signed MOA is recorded', bool(company and company.is_moa_signed)),
        ('MOA reference and signing date are recorded', bool(
            company and company.moa_reference and company.moa_reference.strip()
            and company.moa_signed_at and company.moa_signed_at <= today
        )),
        (MOA_RENEWAL_REQUIRED if expired else 'MOA is effective and has not expired', bool(
            company and company.moa_effective_at and company.moa_expires_at
            and company.moa_effective_at <= today <= company.moa_expires_at
        )),
    ]
    return {
        'ready': all(passed for _, passed in checks),
        'expired': expired,
        'checks': [{'label': label, 'passed': passed} for label, passed in checks],
    }


def require_valid_moa(company):
    state = moa_state(company)
    if not state['ready']:
        raise HTTPException(409, MOA_RENEWAL_REQUIRED if state['expired'] else MOA_REQUIRED)
