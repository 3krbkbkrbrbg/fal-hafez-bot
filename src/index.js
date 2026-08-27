// Fal-e Hafez + Voice-to-Text + Translate Telegram Bot — Cloudflare Worker
// Data: 495 fale-hafez from github.com/m0sen/hafez-poems-json
// Voice: Workers AI Whisper (transcribe, Persian base) + M2M100 (translate)
import { POEMS, randomFal } from './data.js';
import { tg, esc } from './telegram.js';
import { processVoice, VOICE_HELP, LANGS } from './voice.js';

const ADMIN_KEY = ''; // overridden by wrangler.toml [vars]; guarded in setup

function keyboard(rows) { return { inline_keyboard: rows }; }

const BTN_START = keyboard([[{ text: '🍀 گرفتن فال حافظ', callback_data: 'fal_ritual' }]]);
const BTN_RITUAL = keyboard([[{ text: '🔮 فال من را بگیر', callback_data: 'fal_now' }]]);
const BTN_AGAIN = keyboard([[{ text: '🍀 فال دوباره', callback_data: 'fal_again' }]]);

const MENU_MAIN = keyboard([
  [{ text: '🍀 فال حافظ', callback_data: 'menu_fal' }],
  [{ text: '🎙️ صوت به متن + ترجمه', callback_data: 'menu_voice' }],
]);

const LANG_KEYBOARD = (cb) => keyboard([
  [
    { text: '🇬🇧 انگلیسی', callback_data: `${cb}:en` },
    { text: '🇸🇦 عربی', callback_data: `${cb}:ar` },
    { text: '🇩🇪 آلمانی', callback_data: `${cb}:de` },
  ],
  [
    { text: '🇫🇷 فرانسوی', callback_data: `${cb}:fr` },
    { text: '🇪🇸 اسپانیایی', callback_data: `${cb}:es` },
    { text: '🇹🇷 ترکی', callback_data: `${cb}:tr` },
  ],
  [
    { text: '🇷🇺 روسی', callback_data: `${cb}:ru` },
    { text: '🇮🇹 ایتالیایی', callback_data: `${cb}:it` },
    { text: '🇨🇳 چینی', callback_data: `${cb}:zh` },
  ],
  [{ text: '🔙 بازگشت', callback_data: 'menu_main' }],
]);

const MENU_VOICE = keyboard([
  [{ text: '🎙️ ویس بفرست (ترجمه → انگلیسی)', callback_data: 'v_en' }],
  [{ text: '🌐 انتخاب زبان مقصد', callback_data: 'v_lang' }],
  [{ text: '🔙 منوی اصلی', callback_data: 'menu_main' }],
]);

function welcomeText() {
  return [
    '🌟 <b>ربات چندکاره</b>',
    '',
    'سلام دوست من! 🌹 به ربات من خوش آمدی.',
    'دو تا قابلیت داری:',
    '',
    '🍀 <b>فال حافظ</b> — فال تصادفی با معنی و تفسیر',
    '🎙️ <b>صوت به متن</b> — ویس بفرست، متن فارسی + ترجمه بگیر',
    '',
    'از منوی زیر یکی رو انتخاب کن 👇',
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
    head, '', `<b>غزل شمارهٔ ${f.id}</b>`, '',
    esc(f.t), '', '<i>— معنی:</i>', esc(f.m), '', '<i>— تفسیر:</i>', esc(f.i),
    '', '🌹 ان‌شاءالله که خیر باشد و کام‌رونی.',
  ].join('\n');
}

async function sendFal(token, chatId, niyat) {
  const f = randomFal();
  return tg(token, 'sendMessage', {
    chat_id: chatId, text: falText(f, niyat), parse_mode: 'HTML',
    disable_web_page_preview: true, reply_markup: BTN_AGAIN,
  });
}

// Per-user state for selected translate target (in-memory, ephemeral)
const userTarget = new Map();

async function handleUpdate(update, env) {
  const token = env.TG_BOT_TOKEN;
  if (!token) return;

  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const msgId = cb.message.message_id;
    const data = cb.data || '';
    await tg(token, 'answerCallbackQuery', { callback_query_id: cb.id });

    if (data === 'menu_main') {
      await tg(token, 'editMessageText', { chat_id: chatId, message_id: msgId, text: welcomeText(), parse_mode: 'HTML', reply_markup: MENU_MAIN });
    } else if (data === 'menu_fal') {
      await tg(token, 'editMessageText', { chat_id: chatId, message_id: msgId, text: ritualText(), parse_mode: 'HTML', reply_markup: BTN_RITUAL });
    } else if (data === 'menu_voice') {
      await tg(token, 'editMessageText', { chat_id: chatId, message_id: msgId, text: VOICE_HELP, parse_mode: 'HTML', reply_markup: MENU_VOICE });
    } else if (data === 'fal_ritual') {
      await tg(token, 'editMessageText', { chat_id: chatId, message_id: msgId, text: ritualText(), parse_mode: 'HTML', reply_markup: BTN_RITUAL });
    } else if (data === 'fal_now' || data === 'fal_again') {
      await sendFal(token, chatId);
    } else if (data === 'v_en') {
      userTarget.set(chatId, 'en');
      await tg(token, 'editMessageText', { chat_id: chatId, message_id: msgId, text: '🎙️ حالا یه پیام صوتی (ویس) بفرست تا متن فارسی + ترجمه انگلیسی‌اش رو برات بگم.', parse_mode: 'HTML', reply_markup: keyboard([[{ text: '🔙 بازگشت', callback_data: 'menu_voice' }]]) });
    } else if (data === 'v_lang') {
      await tg(token, 'editMessageText', { chat_id: chatId, message_id: msgId, text: '🌐 زبان مقصد ترجمه رو انتخاب کن:', parse_mode: 'HTML', reply_markup: LANG_KEYBOARD('vset') });
    } else if (data.startsWith('vset:')) {
      const lang = data.split(':')[1];
      userTarget.set(chatId, lang);
      const name = LANGS[lang] || lang;
      await tg(token, 'editMessageText', { chat_id: chatId, message_id: msgId, text: `✅ زبان مقصد تنظیم شد: <b>${name}</b>\nحالا ویس بفرست.`, parse_mode: 'HTML', reply_markup: keyboard([[{ text: '🔙 بازگشت', callback_data: 'menu_voice' }]]) });
    }
    return;
  }

  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const isPrivate = msg.chat.type === 'private';

  // Voice message → transcribe + translate
  if (msg.voice || msg.audio) {
    if (!isPrivate) return;
    const file = msg.voice || msg.audio;
    const target = userTarget.get(chatId) || 'en';
    await processVoice(token, chatId, file.file_id, target, env);
    return;
  }

  if (!msg.text) return;
  const text = msg.text.trim();

  if (text.startsWith('/start')) {
    await tg(token, 'sendMessage', { chat_id: chatId, text: welcomeText(), parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: MENU_MAIN });
  } else if (['/fal', '/falehafez', '/hafez', '/فال'].includes(text.toLowerCase()) && isPrivate) {
    await tg(token, 'sendMessage', { chat_id: chatId, text: ritualText(), parse_mode: 'HTML', reply_markup: BTN_RITUAL });
  } else if (['/voice', '/translate', '/صوت'].includes(text.toLowerCase()) && isPrivate) {
    await tg(token, 'sendMessage', { chat_id: chatId, text: VOICE_HELP, parse_mode: 'HTML', reply_markup: MENU_VOICE });
  } else if (text.startsWith('/')) {
    await tg(token, 'sendMessage', { chat_id: chatId, text: '❓ دستور ناشناخته.\nبرای فال: /fal  •  برای صوت به متن: /voice', parse_mode: 'HTML' });
  } else if (isPrivate) {
    // Plain text = a wish (نیت) → give a fal
    await tg(token, 'sendMessage', { chat_id: chatId, text: '🙏 نیت شما را شنیدم. حالا حافظ برایتان فال می‌گیرد… 🍀', parse_mode: 'HTML' });
    await sendFal(token, chatId, text);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'GET' && path === '/setup') {
      const key = url.searchParams.get('key');
      const action = url.searchParams.get('action') || 'set';
      const token = env.TG_BOT_TOKEN;
      if (!token) return resp('{"ok":false,"error":"TG_BOT_TOKEN not set"}');
      if (key !== (env.ADMIN_KEY || ADMIN_KEY)) return resp('{"ok":false,"error":"bad key"}', 403);
      const del = await tg(token, 'deleteWebhook', { drop_pending_updates: false });
      const delJ = await del.json().catch(() => ({}));
      if (action === 'delete') {
        const me = await tg(token, 'getMe', {});
        return resp(JSON.stringify({ ok: true, action: 'delete', deleteWebhook: delJ, getMe: await me.json() }, null, 2));
      }
      const webhookUrl = url.origin + '/webhook';
      const set = await tg(token, 'setWebhook', { url: webhookUrl });
      const me = await tg(token, 'getMe', {});
      return resp(JSON.stringify({ ok: true, webhook_url: webhookUrl, deleteWebhook: delJ, setWebhook: await set.json(), getMe: await me.json() }, null, 2));
    }

    if (request.method === 'GET' && (path === '/status' || path === '/healthz' || path === '/')) {
      const token = env.TG_BOT_TOKEN;
      return resp(JSON.stringify({
        ok: true, service: 'fal-hafez-bot', features: ['fal', 'voice-stt-translate'],
        poems: POEMS.length, ai_binding: !!env.AI, bot_token_set: !!token,
        webhook: path === '/' ? 'use /setup?key=... to register' : 'ok',
      }, null, 2));
    }

    if (request.method === 'POST' && path === '/webhook') {
      const update = await request.json().catch(() => null);
      if (!update) return resp('{"ok":false}', 400);
      ctx.waitUntil(handleUpdate(update, env).catch((e) => console.error('handleUpdate', e)));
      return resp('{"ok":true}');
    }

    return resp('404 Not Found', 404);
  },
};

function resp(body, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}
