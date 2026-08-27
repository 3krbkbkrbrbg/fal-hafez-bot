// Integration test for combined bot: mocks env.AI + Telegram fetch.
import worker from './src/index.js';

const env = {
  TG_BOT_TOKEN: 'TEST:token',
  ADMIN_KEY: 'falhafez-admin-2026',
  AI: {
    async run(model, input) {
      if (model === '@cf/openai/whisper') {
        return { text: 'سلام من صدای فارسی هستم و این یک تست است' };
      }
      if (model === '@cf/meta/m2m100-1.2b') {
        return { translated_text: '[translated:' + input.target_lang + '] ' + (input.text || '').slice(0, 12) };
      }
      return {};
    },
  },
};

const tgCalls = [];
globalThis.fetch = async (url, opts) => {
  const body = opts && opts.body ? JSON.parse(opts.body) : {};
  tgCalls.push({ url, method: opts?.method, body });
  // simulate getFile -> file_path
  if (typeof url === 'string' && url.includes('/getFile')) {
    return { async json() { return { ok: true, result: { file_path: 'voice/file_id123.ogg' } }; } };
  }
  if (typeof url === 'string' && url.includes('/file/bot')) {
    return { ok: true, async arrayBuffer() { return new Uint8Array([1, 2, 3]).buffer; } };
  }
  if (typeof url === 'string' && url.includes('/getMe')) {
    return { async json() { return { ok: true, result: { username: 'deeplersazbot_bot' } }; } };
  }
  return { ok: true, async json() { return { ok: true }; } };
};

let pass = 0, fail = 0;
function check(n, c) { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗ FAIL:', n); } }
const pending = [];
const ctx = { waitUntil: (p) => { pending.push(p); return p; } };
async function call(path, method, body) {
  const req = new Request(`https://x.dev${path}`, { method, body: body ? JSON.stringify(body) : undefined, headers: { 'content-type': 'application/json' } });
  const r = await worker.fetch(req, env, ctx);
  // await any deferred update processing
  await Promise.all(pending.splice(0).map((p) => p.catch(() => {})));
  return r;
}

// 1. main menu on /start
console.log('\n[1] /start shows main menu');
tgCalls.length = 0;
await call('/webhook', 'POST', { update_id: 1, message: { message_id: 1, chat: { id: 9, type: 'private' }, text: '/start' } });
const m1 = tgCalls.find(c => c.url.endsWith('/sendMessage'));
check('menu has فال حافظ', m1 && /فال حافظ/.test(m1.body.text));
check('menu has صوت به متن', m1 && /صوت به متن/.test(m1.body.text));
check('menu main button present', m1 && m1.body.reply_markup.inline_keyboard[0][0].callback_data === 'menu_fal');

// 2. menu_fal -> ritual
console.log('\n[2] menu_fal -> ritual');
tgCalls.length = 0;
await call('/webhook', 'POST', { update_id: 2, callback_query: { id: 'c1', data: 'menu_fal', message: { message_id: 2, chat: { id: 9 } } } });
check('editMessageText ritual', tgCalls.some(c => c.url.endsWith('/editMessageText') && /نیت/.test(c.body.text)));

// 3. voice message -> transcribe + translate to en (default)
console.log('\n[3] voice -> persian + english translation');
tgCalls.length = 0;
await call('/webhook', 'POST', { update_id: 3, message: { message_id: 3, chat: { id: 9, type: 'private' }, voice: { file_id: 'FILE123', duration: 3 } } });
const procs = tgCalls.filter(c => c.url.endsWith('/sendMessage'));
check('processing msg sent', procs.length >= 1 && /پردازش صوت/.test(procs[0].body.text));
const result = procs[procs.length - 1];
check('result has فارسی', result && /متن \(فارسی\)/.test(result.body.text));
check('result has translated english', result && /ترجمه \(انگلیسی\)/.test(result.body.text));
check('persian transcript present', result && /صدای فارسی/.test(result.body.text));

// 4. set target to ar via vset then voice
console.log('\n[4] set target arabic then voice');
tgCalls.length = 0;
await call('/webhook', 'POST', { update_id: 4, callback_query: { id: 'c2', data: 'vset:ar', message: { message_id: 4, chat: { id: 9 } } } });
check('vset sets arabic', tgCalls.some(c => c.url.endsWith('/editMessageText') && /عربی/.test(c.body.text)));
tgCalls.length = 0;
await call('/webhook', 'POST', { update_id: 5, message: { message_id: 5, chat: { id: 9, type: 'private' }, voice: { file_id: 'F2', duration: 2 } } });
const r2 = tgCalls.filter(c => c.url.endsWith('/sendMessage')).pop();
check('arabic translation label', r2 && /ترجمه \(عربی\)/.test(r2.body.text));

// 5. voice in group ignored
console.log('\n[5] group voice ignored');
tgCalls.length = 0;
await call('/webhook', 'POST', { update_id: 6, message: { message_id: 6, chat: { id: -100, type: 'group' }, voice: { file_id: 'G1' } } });
check('no sendMessage in group', tgCalls.filter(c => c.url.endsWith('/sendMessage')).length === 0);

// 6. status lists features + ai binding
console.log('\n[6] status');
const st = await (await call('/status', 'GET')).json();
check('features include fal', st.features.includes('fal'));
check('features include voice', st.features.includes('voice-stt-translate'));
check('ai_binding true', st.ai_binding === true);
check('poems 495', st.poems === 495);

// 7. niyat still works
console.log('\n[7] plain text = niyat -> fal');
tgCalls.length = 0;
await call('/webhook', 'POST', { update_id: 7, message: { message_id: 7, chat: { id: 9, type: 'private' }, text: 'امتحانم قبول بشم' } });
const n = tgCalls.filter(c => c.url.endsWith('/sendMessage'));
check('2 msgs (ack+fal)', n.length === 2);
check('fal has غزل', n[1] && /غزل شمارهٔ/.test(n[1].body.text));

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
