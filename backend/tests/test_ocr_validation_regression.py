
"""Isolated regression checks; avoids importing the database engine."""
import ast
import unittest
from pathlib import Path
import re
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'app/services/document_service.py').read_text(encoding='utf-8')
tree = ast.parse(source)
functions = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in {'_name_tokens','_name_in_context','_edit_distance_one','_fuzzy_contains'}]
klass = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'DocumentService')
methods = [n for n in klass.body if isinstance(n, ast.FunctionDef) and n.name in {'_name_match_bonus','_can_auto_verify','_determine_status','_identity_decision'}]
service_class = ast.ClassDef(name='DocumentService', bases=[], keywords=[], body=[ast.Assign(targets=[ast.Name(id='AUTO_VERIFY_TYPES',ctx=ast.Store())],value=ast.Set(elts=[ast.Constant(value=v) for v in ['resume','application_letter','internship_plan']]))]+methods, decorator_list=[])
module = ast.fix_missing_locations(ast.Module(body=functions+[service_class],type_ignores=[]))
namespace = {'re':re,'VERIFY_THRESHOLD':80}
exec(compile(module, '<isolated_document_service>', 'exec'),namespace)
Service=namespace['DocumentService']

class OCRValidationTests(unittest.TestCase):
    def match(self, text, first='Juan Miguel', last='Dela Cruz', middle='Santos'):
        return Service._name_match_bonus(text, first, last, middle)[1]

    def test_full_name(self):
        info=self.match('JUAN MIGUEL SANTOS DELA CRUZ')
        self.assertTrue(info['name_in_context'])
        self.assertTrue(info['middle_present'])

    def test_optional_middle_name(self):
        self.assertTrue(self.match('JUAN MIGUEL DELA CRUZ')['name_in_context'])

    def test_short_surname(self):
        self.assertTrue(self.match('ANA LI', 'Ana','Li',None)['name_in_context'])

    def test_separated_names_do_not_auto_verify(self):
        info=self.match('JUAN MIGUEL '+('OTHER WORDS '*20)+'DELA CRUZ')
        self.assertTrue(info['first_exact'])
        self.assertFalse(info['name_in_context'])
        self.assertFalse(Service._can_auto_verify('resume',{'is_valid':True,'confidence':100},'X'*150,info))

    def test_fuzzy_is_not_auto_verified(self):
        info=self.match('JUAN MIGUEL DELA CRVZ')
        self.assertFalse(info['last_exact'])
        self.assertFalse(Service._can_auto_verify('resume',{'is_valid':True,'confidence':100},'X'*150,info))

    def test_official_document_requires_review(self):
        info=self.match('JUAN MIGUEL DELA CRUZ')
        self.assertFalse(Service._can_auto_verify('endorsement_letter',{'is_valid':True,'confidence':100},'X'*150,info))

    def test_insufficient_text_requires_review(self):
        info=self.match('JUAN MIGUEL DELA CRUZ')
        self.assertFalse(Service._can_auto_verify('resume',{'is_valid':True,'confidence':100},'X'*50,info))

    def identity(self, text):
        info = self.match(text)
        info.update(Service._identity_decision(text, info))
        return info

    def test_explicit_different_owner_rejected(self):
        text = 'FULL NAME: Kenneth Ampolitod\n' + 'EDUCATION SKILLS CONTACT ' * 12
        info = self.identity(text)
        self.assertEqual(info['identity_status'], 'mismatched')
        self.assertEqual(Service._determine_status('resume', {'is_valid':True,'confidence':85}, text, info)[0], 'rejected')

    def test_unlabeled_name_stays_uncertain(self):
        text = 'Kenneth Ampolitod\n' + 'EDUCATION SKILLS CONTACT ' * 12
        info = self.identity(text)
        self.assertEqual(info['identity_status'], 'uncertain')
        self.assertEqual(Service._determine_status('resume', {'is_valid':True,'confidence':85}, text, info)[0], 'pending')

    def test_exact_name_verified(self):
        text = 'Juan Miguel Santos Dela Cruz\n' + 'EDUCATION SKILLS CONTACT ' * 12
        info = self.identity(text)
        self.assertEqual(info['identity_status'], 'matched')
        self.assertEqual(Service._determine_status('resume', {'is_valid':True,'confidence':85}, text, info)[0], 'verified')

    def test_official_mismatch_remains_pending(self):
        text = 'NAME: Kenneth Ampolitod\n' + 'EDUCATION SKILLS CONTACT ' * 12
        info = self.identity(text)
        self.assertEqual(Service._determine_status('endorsement_letter', {'is_valid':True,'confidence':85}, text, info)[0], 'pending')

    def test_partial_name_does_not_reject(self):
        text = 'NAME: Juan Ampolitod\n' + 'EDUCATION SKILLS CONTACT ' * 12
        info = self.identity(text)
        self.assertEqual(info['identity_status'], 'uncertain')

    def test_phrase_punctuation(self):
        import importlib.util
        path=ROOT/'app/utils/document_keywords.py'
        spec=importlib.util.spec_from_file_location('aims_document_keywords_test',path)
        mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        self.assertTrue(mod._matches('TECHNICAL-SKILLS', 'TECHNICAL SKILLS'))
        self.assertFalse(mod._matches('NETWORK', 'WORK'))
        self.assertFalse(mod.validate_resume('EDUCATION SKILLS CONTACT ' * 12)['is_valid'])

if __name__=='__main__':
    unittest.main()
