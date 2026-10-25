# تفعيل تسجيل SpakTok بعد حذف Supabase

**التسجيل لا يعمل حتى تُنشئ قاعدة D1 وتربطها بتطبيق Vercel.** تعديل GitHub لا ينشئ قاعدة بيانات داخل حساب Cloudflare.

## إنشاء D1 مرة واحدة
1. افتح [Cloudflare Dashboard](https://dash.cloudflare.com/) وسجل الدخول بحسابك.
2. Workers & Pages → D1 SQL Database → Create database.
3. الاسم المقترح: `spaktok-primary`. احتفظ بـ Account ID وDatabase UUID.
4. نفّذ بالترتيب على قاعدة جديدة فارغة فقط:
   - `migrations/native/0001.sql`
   - `migrations/native/0002_recovery.sql`
   باستخدام **D1 Console** أو `npx wrangler d1 execute spaktok-primary --remote --file=migrations/native/0001.sql`
   ثم `npx wrangler d1 execute spaktok-primary --remote --file=migrations/native/0002_recovery.sql`.
5. من Cloudflare → My Profile → API Tokens أنشئ رمزًا محدود الصلاحيات لخدمة D1 فقط.

## مفاتيح الخادم داخل Vercel (Production)
أضف القيم التالية من Vercel → Project → Settings → Environment Variables:

- `CLOUDFLARE_ACCOUNT_ID`: معرّف حساب Cloudflare.
- `CLOUDFLARE_D1_DATABASE_ID`: UUID الخاص بقاعدة D1.
- `CLOUDFLARE_D1_API_TOKEN`: رمز D1 محدود الصلاحيات، سري.
- `SPAKTOK_AUTH_PEPPER`: سرّ عشوائي قوي، 32 بايت على الأقل.
- `SPAKTOK_REGISTRATION_CODE`: رمز دعوة عشوائي قوي للتجربة المغلقة.

من PowerShell يمكنك إنشاء السرّين محليًا (ولا تشاركهما):
```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes).ToLower()
```
شغّل الأمر مرتين للحصول على قيمتين مختلفتين. احتفظ بـ AUTH_PEPPER في مدير أسرار موثوق وبنسخة احتياطية مشفرة؛ فقدانه قد يعطّل التحقق من كلمات المرور السابقة.

## كيف تتحقق؟
- أعد نشر Production على Vercel بعد حفظ المتغيرات.
- `/api/auth/health` يجب أن يُرجع `status: available` و`registration: invite_only`.
- `/api/native/auth` يجب أن يُرجع `configured: true`.
- أنشئ حساب اختبار بدعوة، احفظ رمز الاسترداد، سجّل خروجًا ثم ادخل.
- جرّب استعادة كلمة المرور برمز الاسترداد وتأكد من توقف الجلسات القديمة.

لا تضع رموز API أو كلمات المرور في GitHub أو في المحادثة. إذا فشل الاتصال تحقق من صلاحيات D1 أو من تطبيق الترحيلين. حسابات Supabase القديمة لا تنتقل دون نسخة احتياطية.

**ملاحظة تقنية:** هذه مرحلة جسر مؤقت من Vercel إلى D1 عبر HTTP. ليست البنية النهائية لمليار مستخدم. نقل API إلى Workers bindings يقلل زمن الاتصالات وتكلفتها مستقبلاً.
