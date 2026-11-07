import sys,unittest,tempfile
from pathlib import Path
from unittest.mock import patch
sys.path[:0]=[str(Path(__file__).resolve().parents[1]),str(Path(__file__).resolve().parent)]
import test_direct_placements as fixtures
import pymupdf
from app.api.v1.endpoints import moa_files
from app.models.user import UserRole

class MoaFileTests(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.DirectPlacementTests();self.f.setUp()
        self.client=self.f.client;self.client.app.include_router(moa_files.router)
        self.tmp=tempfile.TemporaryDirectory();self.storage=patch.object(moa_files,'folder',return_value=Path(self.tmp.name));self.storage.start()
        self.as_user('career',UserRole.CAREER_CENTER)
        pdf=pymupdf.open();pdf.new_page();self.pdf=pdf.tobytes();pdf.close()
    def as_user(self,id,role):
        self.f.as_user(id,role);self.f.actor.is_active=True
    def tearDown(self):self.storage.stop();self.tmp.cleanup();self.f.tearDown()
    def upload(self,data=None):return self.client.post('/companies/partner/moa-files',files={'file':('signed.pdf',data or self.pdf,'application/pdf')},data={'note':'Signed agreement received'})
    def test_retains_replacements_and_dean_can_download(self):
        first=self.upload();self.assertEqual(first.status_code,201,first.text)
        self.assertEqual(self.upload().status_code,201)
        self.as_user('dean1',UserRole.DEAN)
        rows=self.client.get('/companies/partner/moa-files').json();self.assertEqual(len(rows),2)
        self.assertEqual(self.client.get('/companies/partner/moa-files/'+first.json()['id']).content,self.pdf)
        self.assertEqual(self.upload().status_code,403)
    def test_other_roles_denied_and_company_scope_enforced(self):
        response=self.upload();id=response.json()['id']
        self.assertEqual(self.client.get('/companies/other/moa-files/'+id).status_code,404)
        for actor,role in [('s1',UserRole.STUDENT),('hte',UserRole.HTE_SUPERVISOR),('c1',UserRole.COORDINATOR)]:
            self.as_user(actor,role)
            self.assertEqual(self.client.get('/companies/partner/moa-files').status_code,403)
            self.assertEqual(self.upload().status_code,403)
    def test_rejects_invalid_and_oversized_files(self):
        self.assertEqual(self.upload(b'not a pdf').status_code,422)
        self.assertEqual(self.upload(b'x'*(10*1024*1024+1)).status_code,413)
        self.assertEqual(list(Path(self.tmp.name).iterdir()),[])

    def test_retained_files_prevent_company_deletion(self):
        import asyncio
        from fastapi import HTTPException
        from app.api.v1.endpoints.companies import delete_company
        self.assertEqual(self.upload().status_code,201)
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(delete_company('partner',self.f.db,self.f.actor))
        self.assertEqual(raised.exception.status_code,409)

if __name__=='__main__':unittest.main()

