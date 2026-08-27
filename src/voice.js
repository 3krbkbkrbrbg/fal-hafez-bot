// Voice → Text → Translate module (Workers AI: Whisper + M2M100)
// Persian is the base language: Whisper runs with language='fa' so Persian
// speech is transcribed correctly. M2M100 then translates.
import { tg, TG } from './telegram.js';

// Languages M2M100-1.2b supports (subset we expose)
export const LANGS = {
  fa: 'فارسی', en: 'انگلیسی', ar: 'عربی', fr: 'فرانسوی', de: 'آلمانی',
  es: 'اسپانیایی', ru: 'روسی', tr: 'ترکی', it: 'ایتالیایی', zh: 'چینی',
  ja: 'ژاپنی', ko: 'کره‌ای', hi: 'هندی', ur: 'اردو',
};

// Download the voice file bytes from Telegram (uses file_path)
async function downloadVoice(token, fileId) {
  const info = await (await fetch(`${TG}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`)).json();
  if (!info.ok) throw new Error('getFile failed: ' + JSON.stringify(info));
  const path = info.result.file_path;
  const url = `${TG}/file/bot${token}/${path}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('download voice failed: ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}

async function transcribe(audioBytes, env) {
  // Force Persian for correct recognition of the base language.
  // Whisper on this account expects `audio` as an array of byte values.
  const res = await env.AI.run('@cf/openai/whisper', {
    audio: Array.from(audioBytes),
    task: 'transcribe',
    language: 'fa',
  });
  // Whisper returns { text } (and maybe segments). Some models return text in .text or .transcript.
  let text = '';
  if (typeof res === 'string') text = res;
  else text = res?.text || res?.transcript || res?.output || '';
  return text.trim();
}

async function translate(text, target, env) {
  if (target === 'fa') return text; // already Persian
  const res = await env.AI.run('@cf/meta/m2m100-1.2b', {
    text,
    source_lang: 'fa',
    target_lang: target,
  });
  return (res?.translated_text || '').trim();
}

const LANG_KEYBOARD = (cb) => ({
  inline_keyboard: [
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
  ],
});

const MENU_VOICE = {
  inline_keyboard: [
    [{ text: '🎙️ فایل صوتی بفرست (ترجمه به انگلیسی)', callback_data: 'v_en' }],
    [{ text: '🌐 انتخاب زبان مقصد ترجمه', callback_data: 'v_lang' }],
    [{ text: '🔙 منوی اصلی', callback_data: 'menu_main' }],
  ],
};

export const VOICE_HELP = [
  '🎙️ <b>تبدیل صوت به متن + ترجمه</b>',
  '',
  'یه پیام صوتی (ویس) بفرست — من متنش رو به <b>فارسی</b> می‌نویسم،',
  'بعد به زبانی که می‌خوای ترجمه‌اش می‌کنم (پیش‌فرض: انگلیسی).',
  '',
  '• دکمه اول: ویس بفرست → متن فارسی + ترجمه انگلیسی',
  '• دکمه دوم: زبان مقصد رو عوض کن',
].join('\n');

export async function handleVoiceMenu(token, chatId, action) {
  if (action === 'v_lang') {
    await tg(token, 'sendMessage', { chat_id: chatId, text: '🌐 زبان مقصد ترجمه رو انتخاب کن:', parse_mode: 'HTML', reply_markup: LANG_KEYBOARD('vset') });
  } else {
    await tg(token, 'sendMessage', { chat_id: chatId, text: VOICE_HELP, parse_mode: 'HTML', reply_markup: MENU_VOICE });
  }
}

// Process an incoming voice message: transcribe + translate to target (default en)
export async function processVoice(token, chatId, fileId, target, env) {
  await tg(token, 'sendMessage', { chat_id: chatId, text: '🎧 در حال پردازش صوت… لطفاً صبر کنید', parse_mode: 'HTML' });
  try {
    const audio = await downloadVoice(token, fileId);
    const persian = await transcribe(audio, env);
    if (!persian) {
      await tg(token, 'sendMessage', { chat_id: chatId, text: '❌ متنی از صوت استخراج نشد. لطفاً با صدای واضح‌تر دوباره بفرست.', parse_mode: 'HTML' });
      return;
    }
    let out = '🗣️ <b>متن (فارسی):</b>\n' + persian;
    if (target && target !== 'fa') {
      const tr = await translate(persian, target, env);
      const langName = LANGS[target] || target;
      out += '\n\n🌐 <b>ترجمه (' + langName + '):</b>\n' + tr;
    }
    await tg(token, 'sendMessage', { chat_id: chatId, text: out, parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (e) {
    console.error('processVoice', e);
    await tg(token, 'sendMessage', { chat_id: chatId, text: '⚠️ خطا در پردازش صوت: ' + (e.message || e), parse_mode: 'HTML' });
  }
}
