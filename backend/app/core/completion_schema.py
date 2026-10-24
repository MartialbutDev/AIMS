"""Keep existing AIMS features available until the owner migration is applied."""
from fastapi import HTTPException
from sqlalchemy import inspect

COMPLETION_TABLES={'completion_plans','clearance_items','company_final_evaluations','internship_completions','completion_events'}

def require_completion_schema(db):
    inspector=inspect(db.get_bind())
    if not COMPLETION_TABLES.issubset(set(inspector.get_table_names())):
        raise HTTPException(503,'The database owner must apply the internship-completion migration before this feature can be used.')
    names={constraint['name'] for constraint in inspector.get_unique_constraints('coordinator_evaluations')}
    if 'uq_coordinator_evaluation_term' not in names:
        raise HTTPException(503,'The database owner must finish the term-scoped grade migration before completion review can be used.')
