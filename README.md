# 🍀 ربات فال حافظ (Fal-e Hafez Telegram Bot)

یک ربات تلگرامی برای گرفتن **فال حافظ** به صورت تصادفی — با غزل، معنی و تفسیر عرفانی —
روی **Cloudflare Workers** (بدون سرور، رایگان، همیشه روشن).

## ✨ امکانات
- 🍀 فال حافظ کاملاً تصادفی از بین **۴۹۵ غزل**
- 📜 نمایش غزل + **معنی** + **تفسیر عرفانی**
- 🙏 قابلیت **نیت کردن**: هر متنی که بفرستی، به عنوان نیت در فالت ثبت می‌شود
- 🔮 دکمه‌های inline (شروع → نیت → فال → فال دوباره)
- 🌐 کار می‌کند در چت خصوصی (در گروه‌ها پاسخ نمی‌دهد تا اسپم نشود)

## 🤖 دستورات
| دستور | عملکرد |
|------|---------|
| `/start` | خوش‌آمدگویی + دکمه گرفتن فال |
| `/fal` یا `/falehafez` | شروع آیین فال‌گیری |
| (هر متن دیگر) | به عنوان **نیت** در نظر گرفته شده و فال برایت می‌آورد |

## 🧱 ساختار
```
fal-hafez-bot/
├── src/
│   ├── index.js   # منطق ربات + endpoint های Worker (/webhook, /setup, /status)
│   └── data.js    # ۴۹۵ فال حافظ (poem + meaning + interpretation)
├── wrangler.toml  # تنظیمات Cloudflare Workers
├── test.js        # تست محلی (۲۴ مورد)
└── README.md
```

## 📚 منبع داده
داده‌های فال از ریپازیتوری
[`m0sen/hafez-poems-json`](https://github.com/m0sen/hafez-poems-json)
گرفته شده است (۴۹۵ غزل حافظ با معنی و تفسیر).

## 🚀 استقرار (Deploy)
1. توکن ربات تلگرام را به عنوان secret ست کنید:
   ```bash
   npx wrangler secret put TG_BOT_TOKEN
   ```
2. دیپلوی:
   ```bash
   npx wrangler deploy
   ```
3. وب‌هوک را ثبت کنید (این درخواست از طرف Worker به تلگرام زده می‌شود و همیشه کار می‌کند):
   ```
   https://<your-subdomain>.workers.dev/setup?key=<ADMIN_KEY>
   ```
   (`ADMIN_KEY` در `wrangler.toml` تنظیم شده است — قبل از دیپلوی عمومی حتماً آن را عوض کنید.)

## 🧪 تست محلی
```bash
node --input-type=module -e "import './test.js'"
```

## 🔧 Endpoint ها
- `POST /webhook` — دریافت آپدیت‌های تلگرام
- `GET  /setup?key=...` — ثبت خودکار وب‌هوک + نمایش اطلاعات ربات
- `GET  /status` — وضعیت (تعداد اشعار، ست بودن توکن)

---
ساخته شده با ❤️ روی Cloudflare Workers
