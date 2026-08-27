// Fal-e Hafez Telegram Bot — Cloudflare Worker
// Random Hafez fortune (فال حافظ) with meaning + mystical interpretation.
// Data: 495 fale-hafez from github.com/m0sen/hafez-poems-json
import { POEMS, randomFal } from './data.js';

const TG = 'https://api.telegram.org';
const ADMIN_KEY = 'falhafez-admin-2026'; // also set as var; guarded in setup

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tgApi(token, method, body) {
  return fetch(`${TG}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function keyboard(rows) {
  return { inline_keyboard: rows };
}

const BTN_START = keyboard([[{ text: '🍀 گرفتن فال حافظ', callback_data: 'fal_ritual' }]]);
const BTN_RITUAL = keyboard([[{ text: '🔮 فال من را بگیر', callback_data: 'fal_now' }]]);
const BTN_AGAIN = keyboard([[{ text: '🍀 فال دوباره', callback_data: 'fal_again' }]]);

function welcomeText() {
  return [
    '🍀 <b>فال حافظ</b>',
    '',
    'سلام دوست من! 🌹',
    'به ربات <b>فال حافظ</b> خوش آمدی.',
    '',
    'هر بار که دلت گرفت یا تصمیم مهمی پیش رو داشتی، از حافظ فال بگیر.',
    'لطفاً اول <b>نیت</b> خود را در دل کن، سپس دکمه‌ی زیر را بزن.',
    '',
    '🤲 «بیا تا گل برافشانیم و می در ساغر اندازیم»',
  ].join('\n');
}

function ritualText() {
  return [
    '🔮 <b>آماده‌ای؟</b>',
    '',
    'اول در دل خود <b>نیت</b> کن…',
    'به هر چیزی که می‌خواهی یا به هر تصمیمی که داری فکر کن،',
    'سپس دکمه‌ی زیر را بزن تا حافظ برایت فال بگیرد. 🍀',
  ].join('\n');
}

function falText(f, niyat) {
  const head = niyat
    ? `🙏 <b>نیت شما:</b> ${esc(niyat)}\n\n🍀 <b>فال حافظ</b>`
    : '🍀 <b>فال حافظ</b>';
  return [
    head,
    '',
    `<b>غزل شمارهٔ ${f.id}</b>`,
    '',
    esc(f.t),
    '',
    '<i>— معنی:</i>',
    esc(f.m),
    '',
    '<i>— تفسیر:</i>',
    esc(f.i),
    '',
    '🌹 ان‌شاءالله که خیر باشد و کام‌رونی.',
  ].join('\n');
}

async function sendFal(token, chatId, niyat) {
  const f = randomFal();
  return tgApi(token, 'sendMessage', {
    chat_id: chatId,
    text: falText(f, niyat),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: BTN_AGAIN,
  });
}

async function handleUpdate(update, env) {
  const token = env.TG_BOT_TOKEN;
  if (!token) return;

  // Callback query (inline button presses)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const msgId = cb.message.message_id;
    const data = cb.data || '';
    if (data === 'fal_ritual') {
      await tgApi(token, 'editMessageText', {
        chat_id: chatId,
        message_id: msgId,
        text: ritualText(),
        parse_mode: 'HTML',
        reply_markup: BTN_RITUAL,
      });
      await tgApi(token, 'answerCallbackQuery', { callback_query_id: cb.id });
    } else if (data === 'fal_now' || data === 'fal_again') {
      await tgApi(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'فال شما آماده شد 🍀' });
      await sendFal(token, chatId);
    }
    return;
  }

  // Plain messages
  const msg = update.message;
  if (!msg || !msg.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const isPrivate = msg.chat.type === 'private';

  if (text.startsWith('/start')) {
    await tgApi(token, 'sendMessage', {
      chat_id: chatId, text: welcomeText(), parse_mode: 'HTML',
      disable_web_page_preview: true, reply_markup: BTN_START,
    });
  } else if (['/fal', '/falehafez', '/hafez', '/فال'].includes(text.toLowerCase()) && isPrivate) {
    await tgApi(token, 'sendMessage', {
      chat_id: chatId, text: ritualText(), parse_mode: 'HTML', reply_markup: BTN_RITUAL,
    });
  } else if (text.startsWith('/')) {
    await tgApi(token, 'sendMessage', {
      chat_id: chatId,
      text: '❓ دستور ناشناخته.\nبرای گرفتن فال حافظ، دکمه‌ی 🍀 را بزن یا /fal را بفرست.',
      parse_mode: 'HTML',
    });
  } else if (isPrivate) {
    // Any plain text = a wish (نیت) → give a fal
    await tgApi(token, 'sendMessage', {
      chat_id: chatId,
      text: '🙏 نیت شما را شنیدم. حالا حافظ برایتان فال می‌گیرد… 🍀',
      parse_mode: 'HTML',
    });
    await sendFal(token, chatId, text);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /setup?key=... → register webhook + bot info (Worker→Telegram works)
    if (request.method === 'GET' && path === '/setup') {
      const key = url.searchParams.get('key');
      const token = env.TG_BOT_TOKEN;
      if (!token) {
        return new Response('{"ok":false,"error":"TG_BOT_TOKEN not set"}', { headers: { 'content-type': 'application/json' } });
      }
      if (key !== (env.ADMIN_KEY || ADMIN_KEY)) {
        return new Response('{"ok":false,"error":"bad key"}', { status: 403, headers: { 'content-type': 'application/json' } });
      }
      const webhookUrl = url.origin + '/webhook';
      const set = await tgApi(token, 'setWebhook', { url: webhookUrl });
      const me = await tgApi(token, 'getMe', {});
      const meJ = await me.json();
      const body = { ok: true, webhook_url: webhookUrl, setWebhook: await set.json(), getMe: meJ };
      return new Response(JSON.stringify(body, null, 2), { headers: { 'content-type': 'application/json' } });
    }

    // GET /status or /healthz
    if (request.method === 'GET' && (path === '/status' || path === '/healthz' || path === '/')) {
      const token = env.TG_BOT_TOKEN;
      return new Response(
        JSON.stringify({
          ok: true, service: 'fal-hafez-bot',
          poems: POEMS.length,
          bot_token_set: !!token,
          webhook: path === '/' ? 'use /setup?key=... to register' : 'ok',
        }, null, 2),
        { headers: { 'content-type': 'application/json' } }
      );
    }

    // POST /webhook → Telegram updates
    if (request.method === 'POST' && path === '/webhook') {
      const update = await request.json().catch(() => null);
      if (!update) return new Response('{"ok":false}', { status: 400, headers: { 'content-type': 'application/json' } });
      ctx.waitUntil(handleUpdate(update, env).catch((e) => console.error('handleUpdate', e)));
      return new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
    }

    return new Response('404 Not Found', { status: 404 });
  },
};
