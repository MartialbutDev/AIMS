"""Server-timed, non-overlapping unpaid breaks; shared net-hours calculation."""
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException

LOCAL = timezone(timedelta(hours=8))

def instant(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Timezone required')
    return parsed.astimezone(timezone.utc)

def net_hours(row, time_in, time_out):
    start = datetime.combine(row.date.date(), time_in, tzinfo=LOCAL)
    end = datetime.combine(row.date.date(), time_out, tzinfo=LOCAL)
    previous = start
    seconds = 0
    try:
        for period in row.break_periods or []:
            if not period.get('ended_at'):
                raise HTTPException(409, 'End your break before clocking out')
            began, ended = instant(period['started_at']), instant(period['ended_at'])
            if not start <= began <= ended <= end or began < previous:
                raise ValueError('Break outside attendance or overlapping')
            seconds += int((ended - began).total_seconds())
            previous = ended
    except (KeyError, TypeError, ValueError):
        raise HTTPException(422, 'Attendance times must include all recorded breaks in order')
    if end <= start or seconds > (end - start).total_seconds():
        raise HTTPException(422, 'Invalid attendance duration')
    return round(((end - start).total_seconds() - seconds) / 3600, 2)
