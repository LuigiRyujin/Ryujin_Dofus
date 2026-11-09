"""Loopback-only browser service. No database access; secrets never logged."""
import asyncio, base64, json, os, re, threading, time, urllib.request, urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
SERIAL = threading.Lock()
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from playwright.async_api import async_playwright

TOKEN = os.environ['RYUJIN_LOCAL_TOKEN']
_base_url = urllib.parse.urlparse(os.environ['RYUJIN_API_URL'])
BASE = urllib.parse.urlunparse((_base_url.scheme, _base_url.netloc, '', '', '', ''))
ACCESS = os.environ['RYUJIN_OPERATOR_TOKEN']

def api(path, body):
    request = urllib.request.Request(BASE + '/api/' + path, json.dumps(body).encode(), {'Authorization': 'Bearer ' + ACCESS, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)

def extract_code(messages, started):
    for message in messages:
        sender = message.get('from', {}).get('emailAddress', {}).get('address', '').lower()
        received = message.get('receivedDateTime', '')
        if not sender.endswith('@ankama.com') or not received or received < started: continue
        content = message.get('body', {}).get('content', '') + message.get('subject', '')
        match = re.search(r'(?<!\d)(\d{6})(?!\d)', content)
        if match: return match.group(1)
    return None

def require_lease(stopped):
    if stopped.is_set(): raise RuntimeError('LEASE_LOST')

def callback_code(url, expected_state):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'dofustouch' or parsed.netloc != 'authorized': return None
    query = urllib.parse.parse_qs(parsed.query)
    if query.get('state') != [expected_state]: return None
    return query.get('code', [None])[0]

async def register(data):
    operation = data['operation']; owner = data['owner']; stage = ['validating_email']; stopped = threading.Event()
    def beat(**extra):
        return api('creation-worker/' + operation['id'] + '/heartbeat', {**owner, 'stage': stage[0], **extra})
    def heartbeat():
        while not stopped.wait(20):
            try: beat()
            except Exception: stopped.set()
    beat(); threading.Thread(target=heartbeat, daemon=True).start()
    started = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    credentials = operation.get('emailCredentials', {})
    access = None
    try:
        if credentials.get('refreshToken') and credentials.get('clientId'):
            encoded = urllib.parse.urlencode({'client_id': credentials['clientId'], 'refresh_token': credentials['refreshToken'], 'grant_type': 'refresh_token', 'scope': 'https://graph.microsoft.com/.default'}).encode()
            request = urllib.request.Request('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', encoded)
            with urllib.request.urlopen(request, timeout=20) as response: access = json.load(response)['access_token']
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=False)
            try:
                page = await browser.new_page()
                await page.goto('https://auth.ankama.com/register/ankama', wait_until='domcontentloaded', timeout=60000)
                await page.locator("input[name='login'],input[type='email'],#ankama-registration-login").first.fill(operation['email'])
                await page.locator("input[name='password'],input[type='password']").first.fill(operation['password'])
                # Optional fields/challenges stay visible for the operator. Do not fabricate identity.
                stage[0] = 'registration_ready'
                beat(submitted=True)
                require_lease(stopped)
                await page.locator("button[type='submit'],input[type='submit']").first.click()
                code_input = page.locator("input[name='code'],#ankama-code,input[id*='code']").first
                await code_input.wait_for(state='visible', timeout=300000)
                stage[0] = 'waiting_code'; deadline = time.monotonic() + 300; code = None
                while time.monotonic() < deadline and not stopped.is_set():
                    code = beat().get('code')
                    if not code and access:
                        request = urllib.request.Request('https://graph.microsoft.com/v1.0/me/messages?$top=15&$orderby=receivedDateTime%20desc&$filter=receivedDateTime%20ge%20' + urllib.parse.quote(started) + '', headers={'Authorization': 'Bearer ' + access})
                        with urllib.request.urlopen(request, timeout=20) as response: messages = json.load(response).get('value', [])
                        code = extract_code(messages, started)
                    if code: break
                    await asyncio.sleep(3)
                if not code: raise RuntimeError('CODE_TIMEOUT')
                await code_input.fill(code); stage[0] = 'confirming'; beat()
                require_lease(stopped)
                await page.locator("button[type='submit'],input[type='submit']").first.click()
                # A click is not evidence of success: wait for official account destination.
                await page.wait_for_url(re.compile(r'^https://(account\.ankama\.com|auth\.ankama\.com/authorized)(/|\?|$)'), timeout=60000)
                result = {'login': operation['email']}
                journal(operation['id'], {**owner, 'state': 'completed', 'result': result})
                return result
            finally: await browser.close()
    finally: stopped.set()

async def authenticate(data):
    url = data['authorizeUrl']
    if not url.startswith('https://auth.ankama.com/'): raise ValueError('INVALID_AUTH_ORIGIN')
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        try:
            page = await browser.new_page(); captured = []
            async def capture(route):
                parsed = urllib.parse.urlparse(route.request.url)
                code = callback_code(route.request.url, data['state'])
                if code: captured.append(code)
                return await route.abort()
            await page.route('dofustouch://**', capture)
            page.on('request', lambda request: captured.append(callback_code(request.url, data['state'])) if callback_code(request.url, data['state']) else None)
            await page.goto(url, wait_until='domcontentloaded')
            await page.locator("input[name='login'],input[type='email']").first.fill(data['login'])
            await page.locator("input[name='password'],input[type='password']").first.fill(data['password'])
            await page.locator("button[type='submit'],input[type='submit']").first.click()
            for _ in range(180):
                if captured: return {'code': captured[0]}
                await asyncio.sleep(1)
            raise RuntimeError('AUTH_CODE_TIMEOUT')
        finally: await browser.close()

def journal(identifier, result):
    directory = Path(os.environ['RYUJIN_SPOOL_DIRECTORY']); directory.mkdir(parents=True, exist_ok=True)
    iv = os.urandom(12); key = base64.b64decode(os.environ['RYUJIN_SPOOL_KEY'])
    encrypted = AESGCM(key).encrypt(iv, json.dumps(result).encode(), None)
    payload = {'iv': base64.b64encode(iv).decode(), 'tag': base64.b64encode(encrypted[-16:]).decode(), 'data': base64.b64encode(encrypted[:-16]).decode()}
    temporary = directory / (identifier + '.python.tmp')
    with open(temporary, 'w') as output:
        json.dump(payload, output); output.flush(); os.fsync(output.fileno())
    os.replace(temporary, directory / (identifier + '.json'))

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def do_POST(self):
        if self.headers.get('X-Ryujin-Local-Token') != TOKEN:
            self.send_error(403); return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 65536: raise ValueError()
            data = json.loads(self.rfile.read(length))
            if self.path not in ('/register', '/auth'): self.send_error(404); return
            if not SERIAL.acquire(blocking=False): self.send_error(409); return
            try:
                result = asyncio.run(register(data) if self.path == '/register' else authenticate(data))
            finally: SERIAL.release()
            encoded = json.dumps(result).encode(); self.send_response(200)
        except Exception:
            encoded = b'{"error":"BROWSER_FLOW_FAILED"}'; self.send_response(409)
        self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(encoded))); self.end_headers(); self.wfile.write(encoded)

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('RYUJIN_LOCAL_PORT', '3139'))), Handler).serve_forever()
