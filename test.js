// Local test harness: simulates Telegram by mocking global fetch.
import worker from './src/index.js';

const env = { TG_BOT_TOKEN: 'TEST:token', ADMIN_KEY: 'falhafez-admin-2026' };

// Collect outgoing Telegram calls
const tgCalls = [];
globalThis.fetch = async (url, opts) => {
  tgCalls.push({ url, body: JSON.parse(opts.body) });
  return {
    async json() { return { ok: true, result: { id: 1 } }; },
    ok: true,
  };
};

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗ FAIL:', name); }
}

const ctx = { waitUntil: (p) => p };

async function call(path, method, body) {
  const req = new Request(`https://fal-hafez-bot.vickfmr.workers.dev${path}`, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  });
  return worker.fetch(req, env, ctx);
}

// --- Test 1: status endpoint ---
console.log('\n[1] status');
const st = await (await call('/status', 'GET')).json();
check('status ok=true', st.ok === true);
check('poems=495', st.poems === 495);
check('bot_token_set=true', st.bot_token_set === true);

// --- Test 2: /start message ---
console.log('\n[2] /start');
tgCalls.length = 0;
await call('/webhook', 'POST', { update_id: 1, message: { message_id: 10, chat: { id: 111, type: 'private' }, text: '/start' } });
check('sendMessage called', tgCalls.some(c => c.url.endsWith('/sendMessage')));
const startCall = tgCalls.find(c => c.url.endsWith('/sendMessage'));
check('welcome has main menu', startCall && startCall.body.reply_markup && startCall.body.reply_markup.inline_keyboard.flat().some((b) => /فال|صوت/.test(b.text)));
check('welcome HTML', startCall && startCall.body.parse_mode === 'HTML');

// --- Test 3: /fal ritual ---
console.log('\n[3] /fal');
tgCalls.length = 0;
await call('/webhook', 'POST', { update_id: 2, message: { message_id: 11, chat: { id: 111, type: 'private' }, text: '/fal' } });
const falCall = tgCalls.find(c => c.url.endsWith('/sendMessage'));
check('/fal sends ritual prompt', falCall && /نیت/.test(falCall.body.text));
check('ritual button = fal_now', falCall && falCall.body.reply_markup.inline_keyboard[0][0].callback_data === 'fal_now');

// --- Test 4: callback fal_ritual → edit to ritual ---
console.log('\n[4] callback fal_ritual');
tgCalls.length = 0;
await call('/webhook', 'POST', { update_id: 3, callback_query: { id: 'c1', data: 'fal_ritual', message: { message_id: 20, chat: { id: 111 } } } });
check('editMessageText called', tgCalls.some(c => c.url.endsWith('/editMessageText')));
check('answerCallbackQuery called', tgCalls.some(c => c.url.endsWith('/answerCallbackQuery')));

// --- Test 5: callback fal_now → real fal ---
console.log('\n[5] callback fal_now');
tgCalls.length = 0;
await call('/webhook', 'POST', { update_id: 4, callback_query: { id: 'c2', data: 'fal_now', message: { message_id: 21, chat: { id: 111 } } } });
const falMsg = tgCalls.find(c => c.url.endsWith('/sendMessage'));
check('fal message sent', !!falMsg);
check('fal contains poem text', falMsg && /غزل شمارهٔ/.test(falMsg.body.text));
check('fal has معنی', falMsg && /معنی/.test(falMsg.body.text));
check('fal has تفسیر', falMsg && /تفسیر/.test(falMsg.body.text));
check('fal again button', falMsg && falMsg.body.reply_markup.inline_keyboard[0][0].callback_data === 'fal_again');
check('fal HTML has no stray tags', falMsg && (falMsg.body.text.match(/</g) || []).length >= (falMsg.body.text.match(/<b>|<\/b>|<i>|<\/i>/g) || []).length);

// --- Test 6: plain text = نیت → fal with niyat ---
console.log('\n[6] plain text niyat');
tgCalls.length = 0;
await call('/webhook', 'POST', { update_id: 5, message: { message_id: 12, chat: { id: 111, type: 'private' }, text: 'دلم برای امتحانم تنگ شده' } });
const niyatCalls = tgCalls.filter(c => c.url.endsWith('/sendMessage'));
check('2 messages (ack + fal)', niyatCalls.length === 2);
check('ack has نیت', niyatCalls[0] && /نیت/.test(niyatCalls[0].body.text));
check('fal echoes niyat', niyatCalls[1] && /امتحانم/.test(niyatCalls[1].body.text));

// --- Test 7: group message ignored ---
console.log('\n[7] group chat');
tgCalls.length = 0;
await call('/webhook', 'POST', { update_id: 6, message: { message_id: 13, chat: { id: -100, type: 'group' }, text: 'سلام' } });
check('no reply in group', tgCalls.filter(c => c.url.endsWith('/sendMessage')).length === 0);

// --- Test 8: setup requires key ---
console.log('\n[8] setup');
let r = await call('/setup?key=wrong', 'GET');
check('bad key → 403', r.status === 403);
r = await call('/setup?key=falhafez-admin-2026', 'GET');
check('good key → 200', r.status === 200);
const sj = await r.json();
check('setWebhook called', tgCalls.some(c => c.url.endsWith('/setWebhook')));
check('getMe called', tgCalls.some(c => c.url.endsWith('/getMe')));

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
