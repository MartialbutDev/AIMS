"""Verify clean bootstrap and grade-preserving migration without PostgreSQL writes."""
import sys,unittest,importlib.util
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import create_engine,inspect,text
from alembic.operations import Operations
from alembic.migration import MigrationContext
from bootstrap_database import bootstrap


class BootstrapTests(unittest.TestCase):
    def test_empty_database_registers_all_models_and_is_stamped_at_head(self):
        e=create_engine('sqlite://')
        with e.begin() as c:
            bootstrap(c);self.assertTrue({'internship_deployments','internship_completion_cases','auth_sessions'}<=set(inspect(c).get_table_names()))
            self.assertEqual(c.execute(text('SELECT version_num FROM alembic_version')).scalar_one(),'j60f24b71c95')
        e.dispose()
    def test_existing_database_is_refused_without_stamping_or_changing_records(self):
        e=create_engine('sqlite://')
        with e.begin() as c:
            c.exec_driver_sql('CREATE TABLE preserved (id INTEGER PRIMARY KEY)');c.exec_driver_sql('INSERT INTO preserved VALUES (1)')
            with self.assertRaisesRegex(RuntimeError,'not empty'):bootstrap(c)
            self.assertEqual(c.exec_driver_sql('SELECT id FROM preserved').scalar_one(),1);self.assertFalse(inspect(c).has_table('alembic_version'))
        e.dispose()
    def test_assessment_migration_retains_legacy_rows_and_allows_multiple_terms(self):
        p=Path(__file__).resolve().parents[1]/'alembic/versions/i59e13a60b84_term_specific_assessments.py'
        spec=importlib.util.spec_from_file_location('term_assessment_migration',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        e=create_engine('sqlite://')
        with e.begin() as c:
            c.exec_driver_sql('CREATE TABLE coordinator_evaluations (id TEXT PRIMARY KEY, coordinator_id TEXT, student_id TEXT, academic_year TEXT, semester TEXT, grade NUMERIC, CONSTRAINT uq_coordinator_evaluation_owner UNIQUE(coordinator_id,student_id))')
            c.exec_driver_sql("INSERT INTO coordinator_evaluations VALUES ('legacy','c','s',NULL,NULL,1.25)")
            with patch.object(m,'op',Operations(MigrationContext.configure(c))):m.upgrade()
            for semester,grade in [('1',1.5),('2',2.0)]:
                c.exec_driver_sql('INSERT INTO coordinator_evaluations VALUES (?,?,?,?,?,?)',(semester,'c','s','2026-2027',semester,grade))
            self.assertEqual(c.exec_driver_sql("SELECT grade FROM coordinator_evaluations WHERE id='legacy'").scalar_one(),1.25)
            self.assertEqual(c.exec_driver_sql('SELECT count(*) FROM coordinator_evaluations').scalar_one(),3)
        e.dispose()

    def guard_migration(self):
        p=Path(__file__).resolve().parents[1]/'alembic/versions/j60f24b71c95_academic_integrity_guards.py'
        spec=importlib.util.spec_from_file_location('guard_migration',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        return m
    def guard_tables(self,c):
        for name in ['applications','internship_deployments']:
            c.exec_driver_sql(f'CREATE TABLE {name} (id TEXT PRIMARY KEY, student_id TEXT, academic_year TEXT, semester TEXT, status TEXT)')
    def test_guard_migration_is_idempotent_and_enforces_academic_uniqueness(self):
        from sqlalchemy.exc import IntegrityError
        e=create_engine('sqlite://');m=self.guard_migration()
        with e.begin() as c:
            self.guard_tables(c)
            with patch.object(m,'op',Operations(MigrationContext.configure(c))):m.upgrade();m.upgrade()
            c.exec_driver_sql("INSERT INTO applications VALUES ('a','s','2026-2027','1','ACCEPTED')")
            c.exec_driver_sql("INSERT INTO applications VALUES ('p','s','2026-2027','1','PENDING')")
            with self.assertRaises(IntegrityError),c.begin_nested():c.exec_driver_sql("INSERT INTO applications VALUES ('b','s','2026-2027','1','ACCEPTED')")
            c.exec_driver_sql("INSERT INTO internship_deployments VALUES ('d','s','2026-2027','1','DEPLOYED')")
            with self.assertRaises(IntegrityError),c.begin_nested():c.exec_driver_sql("INSERT INTO internship_deployments VALUES ('e','s','2026-2027','1','PRE_DEPLOYMENT')")
        e.dispose()
    def test_guard_migration_blocks_conflicting_legacy_data_without_deleting_it(self):
        e=create_engine('sqlite://');m=self.guard_migration()
        with e.begin() as c:
            self.guard_tables(c)
            for id in ['a','b']:c.exec_driver_sql("INSERT INTO applications VALUES (?, 's','2026-2027','1','ACCEPTED')",(id,))
            with patch.object(m,'op',Operations(MigrationContext.configure(c))),self.assertRaisesRegex(RuntimeError,'conflicting'):m.upgrade()
            self.assertEqual(c.exec_driver_sql('SELECT count(*) FROM applications').scalar_one(),2)
        e.dispose()


if __name__=='__main__':unittest.main()

