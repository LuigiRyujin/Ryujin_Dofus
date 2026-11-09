import base64, importlib.util, json, os, tempfile, threading, unittest
from pathlib import Path
os.environ.update(RYUJIN_LOCAL_TOKEN='test', RYUJIN_API_URL='http://localhost', RYUJIN_OPERATOR_TOKEN='test')
spec=importlib.util.spec_from_file_location('browser_service',Path(__file__).parents[1]/'browser_service.py'); browser=importlib.util.module_from_spec(spec);spec.loader.exec_module(browser)
class BrowserTests(unittest.TestCase):
    def test_code_rejects_stale_and_wrong_sender(self):
        def message(sender,date,code): return {'from':{'emailAddress':{'address':sender}},'receivedDateTime':date,'subject':code}
        start='2026-11-05T12:00:00Z'
        messages=[message('no-reply@ankama.com','2026-11-04T12:00:00Z','111111'),message('bad@elsewhere.com','2026-11-05T13:00:00Z','222222'),message('no-reply@ankama.com','2026-11-05T13:00:00Z','333333')]
        self.assertEqual(browser.extract_code(messages,start),'333333');self.assertIsNone(browser.extract_code(messages[:2],start))
    def test_expired_lease_blocks_submission(self):
        stopped=threading.Event();browser.require_lease(stopped);stopped.set()
        with self.assertRaisesRegex(RuntimeError,'LEASE_LOST'): browser.require_lease(stopped)
    def test_oauth_callback_validates_state_and_destination(self):
        self.assertEqual(browser.callback_code('dofustouch://authorized?code=abc&state=correct','correct'),'abc')
        self.assertIsNone(browser.callback_code('dofustouch://authorized?code=abc&state=wrong','correct'))
        self.assertIsNone(browser.callback_code('https://elsewhere/?code=abc&state=correct','correct'))
    def test_journal_is_authenticated_and_durable(self):
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        with tempfile.TemporaryDirectory() as directory:
            key=os.urandom(32);os.environ.update(RYUJIN_SPOOL_DIRECTORY=directory,RYUJIN_SPOOL_KEY=base64.b64encode(key).decode())
            browser.journal('test',{'state':'completed','result':{'login':'private@example.com'}})
            raw=(Path(directory)/'test.json').read_text();self.assertNotIn('private@example.com',raw)
            payload=json.loads(raw);value=AESGCM(key).decrypt(base64.b64decode(payload['iv']),base64.b64decode(payload['data'])+base64.b64decode(payload['tag']),None)
            self.assertEqual(json.loads(value)['state'],'completed')
if __name__=='__main__': unittest.main()
