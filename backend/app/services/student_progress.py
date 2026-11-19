"""Student-only cumulative hours using the shared attendance credit rules."""
import math
from collections import defaultdict
from datetime import datetime, timezone

from app.services import reporting_scope as reporting
from app.services.academic_requirements import hour_target


def approved_hours_progress(db, student_id):
    year, semester = reporting.get_current_academic_term()
    records = reporting.approved_attendance_records(db, {student_id}, year, semester)
    target = hour_target(db, year, semester, student_id)
    daily = defaultdict(list)
    for row in records:
        # DTR.date is the Philippine work date, not a UTC approval timestamp.
        daily[row.date.date()].append(row.total_hours)
    cumulative = []
    points = []
    for day in sorted(daily):
        cumulative.extend(daily[day])
        points.append({'date': day, 'daily_hours': round(math.fsum(daily[day]), 2),
            'cumulative_hours': round(math.fsum(cumulative), 2)})
    return {**reporting.term_metadata(year, semester),
        'as_of': datetime.now(timezone.utc), 'timezone': 'Asia/Manila',
        'approved_hours': round(math.fsum(cumulative), 2),
        'required_hours': target['required_hours'],
        'hours_status': target['hours_status'], 'points': points}
