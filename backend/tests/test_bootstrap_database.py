"""Verify clean bootstrap and grade-preserving migration without PostgreSQL writes."""
import sys,unittest,importlib.util
import os
import subprocess
import tempfile
import textwrap
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import create_engine,inspect,text
from alembic.operations import Operations
from alembic.migration import MigrationContext
from bootstrap_database import bootstrap


class BootstrapTests(unittest.TestCase):
    def test_fresh_process_bootstrap_includes_all_models_without_loading_api(self):
        # A shared test process may have imported missing models through API
        # routes already, masking an incomplete app.models registry.
        root = Path(__file__).resolve().parents[1]
        script = textwrap.dedent('''
            import importlib
            import pkgutil
            import runpy
            import sys
            from sqlalchemy import inspect

            runpy.run_path('bootstrap_database.py', run_name='__main__')
            from app.core.database import Base, engine
            import app.models
            assert 'app.main' not in sys.modules
            assert not any(name.startswith('app.api.') for name in sys.modules)
            actual_tables = set(inspect(engine).get_table_names())
            for module in pkgutil.iter_modules(app.models.__path__):
                importlib.import_module('app.models.' + module.name)
            missing = set(Base.metadata.tables) - actual_tables
            assert not missing, f'Bootstrap omitted model tables: {sorted(missing)}'
            engine.dispose()
        ''')
        with tempfile.TemporaryDirectory() as folder:
            url = 'sqlite:///' + (Path(folder) / 'bootstrap.sqlite3').as_posix()
            env = {**os.environ, 'DATABASE_URL': url, 'PYTHONIOENCODING': 'utf-8'}
            result = subprocess.run([sys.executable, '-c', script], cwd=root,
                env=env, capture_output=True, text=True, encoding='utf-8', timeout=60)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            engine = create_engine(url)
            try:
                inspector = inspect(engine)
                table = 'hte_supervisor_companies'
                columns = {row['name']: row for row in inspector.get_columns(table)}
                self.assertFalse(columns['supervisor_id']['nullable'])
                self.assertFalse(columns['company_id']['nullable'])
                self.assertEqual({key['referred_table'] for key in inspector.get_foreign_keys(table)}, {'users', 'companies'})
                self.assertIn(('supervisor_id', 'company_id'),
                    [tuple(key['column_names']) for key in inspector.get_unique_constraints(table)])
                indexed = {tuple(index['column_names']) for index in inspector.get_indexes(table)}
                self.assertTrue({('supervisor_id',), ('company_id',)} <= indexed)
            finally:
                engine.dispose()

    def test_empty_database_registers_all_models_and_is_stamped_at_head(self):
        e=create_engine('sqlite://')
        with e.begin() as c:
            bootstrap(c);self.assertTrue({'internship_deployments','internship_completion_cases','auth_sessions'}<=set(inspect(c).get_table_names()))
            self.assertTrue({'academic_requirements','academic_requirement_events'}<=set(inspect(c).get_table_names()))
            self.assertEqual(c.execute(text('SELECT version_num FROM alembic_version')).scalar_one(),'m93c57ea4fc8')
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



