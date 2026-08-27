# 🍀🌟 ربات چندکاره (فال حافظ + صوت به متن + ترجمه)

یک ربات تلگرامی چندمنظوره روی **Cloudflare Workers** (بدون سرور، رایگان، همیشه روشن):

1. 🍀 **فال حافظ** — فال تصادفی از ۴۹۵ غزل، با معنی و تفسیر عرفانی
2. 🎙️ **صوت به متن + ترجمه** — ویس بفرست → متن **فارسی** (با تشخیص دقیق زبان پایه) + ترجمه به زبان مقصد

## ✨ امکانات
- 🍀 فال حافظ کاملاً تصادفی از ۴۹۵ غزل (poem + meaning + interpretation)
- 🎙️ تبدیل گفتار به متن با **Whisper** (Workers AI) — زبان پایه **فارسی** به‌صورت اجباری تنظیم شده تا تشخیص دقیق باشد
- 🌐 ترجمه با **M2M100** (Workers AI) به ۱۳ زبان: انگلیسی، عربی، آلمانی، فرانسوی، اسپانیایی، ترکی، روسی، ایتالیایی، چینی و…
- 🙏 **نیت کردن**: هر متنی در چت خصوصی = نیت → فال
- 🔘 منوی دکمه‌ای (شروع → فال / صوت → زبان مقصد → فال دوباره)

## 🤖 دستورات
| دستور | عملکرد |
|------|---------|
| `/start` | منوی اصلی |
| `/fal` یا `/فال` | شروع فال‌گیری |
| `/voice` | راهنمای صوت به متن |
| (ویس) | متن فارسی + ترجمه |
| (هر متن) | نیت → فال |

## 🧱 ساختار
```
fal-hafez-bot/
├── src/
│   ├── index.js    # روتر اصلی + منوی فارسی + endpoint ها
│   ├── data.js     # ۴۹۵ فال حافظ
│   ├── voice.js    # صوت→متن (Whisper) + ترجمه (M2M100)
│   └── telegram.js # کلاینت مشترک تلگرام
├── wrangler.toml   # تنظیمات Worker + [ai] binding
├── deploy.sh       # دیپلوی یک‌پارچه
├── test.js / test2.js # تست محلی
└── README.md
```

## 📚 منابع
- داده فال: [`m0sen/hafez-poems-json`](https://github.com/m0sen/hafez-poems-json)
- مدل‌ها (رایگان روی Cloudflare):
  - `@cf/openai/whisper` — تبدیل گفتار به متن
  - `@cf/meta/m2m100-1.2b` — ترجمه چندزبانه

## 🚀 استقرار
```bash
export CLOUDFLARE_API_TOKEN=...   # توکن CF (حساب 987cc653)
export TG_BOT_TOKEN=...           # توکن ربات تلگرام
./deploy.sh
```
وب‌هوک خودکار ست می‌شود. برای حذف وب‌هوک (برگشت به حالت قبل):
```
https://fal-hafez-bot.vickfmr.workers.dev/setup?key=<ADMIN_KEY>&action=delete
```

## 🧪 تست محلی
```bash
node --input-type=module -e "import './test.js'"   # فال (۲۴ مورد)
node --input-type=module -e "import './test2.js'"  # ترکیبی (۱۷ مورد)
```

## 🔧 Endpoint ها
- `POST /webhook` — آپدیت‌های تلگرام
- `GET  /setup?key=...&action=set|delete` — ثبت/حذف وب‌هوک
- `GET  /status` — وضعیت (امکانات، تعداد اشعار، AI binding)

---
ساخته شده با ❤️ روی Cloudflare Workers
