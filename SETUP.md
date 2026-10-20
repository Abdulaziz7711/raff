# تشغيل «رفّ» على الإنترنت — خطوة بخطوة

تحتاج حسابات مجانية: **IGDB عن طريق Twitch** (أو **RAWG**) للألعاب، و**TMDB** للأفلام والمسلسلات، و**Supabase** و**Vercel**. الوقت المتوقع: 20–30 دقيقة.

> لا تحط أي مفتاح داخل الكود أو في GitHub. كلها تنحط في إعدادات Vercel (الخطوة 4).

---

## 1) مفاتيح الألعاب — IGDB (موصى فيه) أو RAWG

### IGDB — نفس قاعدة البيانات اللي يستخدمها Backloggd (أغلفة الألعاب الطولية ونبذتها)
1. سوّ حساب Twitch في <https://www.twitch.tv/signup> وفعّل **التحقق بخطوتين** (Two-Factor) من إعدادات الأمان — Twitch يطلبه.
2. افتح <https://dev.twitch.tv/console/apps> ← **Register Your Application**:
   - Name: `raff` (أي اسم)
   - OAuth Redirect URLs: `http://localhost`
   - Category: **Website Integration**، و Client Type: **Confidential**
3. افتح التطبيق: انسخ **Client ID** → `IGDB_CLIENT_ID`، واضغط **New Secret** وانسخه → `IGDB_CLIENT_SECRET`.

إذا حطيت مفاتيح IGDB، الألعاب تجي منه. إذا ما حطيتها، تجي من RAWG (تحت).

### RAWG (بديل)
1. افتح <https://rawg.io/apidocs> واضغط **Get API Key**.
2. سوّ حساب (أو سجّل دخول)، وعبّي النموذج القصير (اسم الموقع: رفّ، الرابط: تقدر تحط رابط GitHub الحين وتغيّره بعدين).
3. انسخ الـ **API Key** واحفظه عندك → هذا `RAWG_API_KEY`.

## 2) مفتاح TMDB (للأفلام والمسلسلات والأنمي)
1. سوّ حساب في <https://www.themoviedb.org/signup> وأكّد إيميلك.
2. افتح **Settings → API** (<https://www.themoviedb.org/settings/api>) واطلب مفتاح **Developer**، وعبّي النموذج (الاستخدام: موقع شخصي لتتبّع الأفلام والمسلسلات).
3. انسخ **API Read Access Token** (الطويل اللي يبدأ بـ `eyJ`) → هذا `TMDB_TOKEN`.
   (لو نسخت الـ API Key القصير بداله، يشتغل بعد.)

## 3) Supabase (تسجيل الدخول + قاعدة البيانات)
1. افتح <https://supabase.com> وسجّل بحساب GitHub، واضغط **New project**.
   - الاسم: `raff`، واختر كلمة مرور للقاعدة (احفظها)، والمنطقة: الأقرب لك (مثلاً Frankfurt أو Mumbai).
2. لما يجهز المشروع: افتح **SQL Editor → New query**، والصق محتوى الملف [`supabase/schema.sql`](supabase/schema.sql) كامل، واضغط **Run**. لازم يطلع لك `Success`.
3. افتح **Project Settings → API** وانسخ:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key (اضغط Reveal) → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ هذا سرّي، لا تشاركه.
4. (بعد الخطوة 4) افتح **Authentication → URL Configuration**:
   - **Site URL**: رابط موقعك من Vercel، مثل `https://raff.vercel.app`
   - **Redirect URLs**: أضف `https://raff.vercel.app/**`

## 4) Vercel (النشر والرابط)
1. افتح <https://vercel.com> وسجّل بحساب GitHub.
2. **Add New → Project** واختر المستودع `raff` واضغط **Import**.
3. قبل ما تضغط Deploy، افتح **Environment Variables** وأضف هذي:

   | الاسم | القيمة |
   |---|---|
   | `VITE_SUPABASE_URL` | من Supabase |
   | `VITE_SUPABASE_ANON_KEY` | من Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | من Supabase (سرّي) |
   | `IGDB_CLIENT_ID` | من Twitch (للألعاب) |
   | `IGDB_CLIENT_SECRET` | من Twitch (للألعاب) |
   | `RAWG_API_KEY` | من RAWG (اختياري إذا عندك IGDB) |
   | `TMDB_TOKEN` | من TMDB |
   | `VITE_ENABLE_GOOGLE` | `false` (غيّرها لـ `true` إذا فعّلت Google تحت) |

4. اضغط **Deploy**. بعد دقيقة يعطيك رابط مثل `https://raff-xxxx.vercel.app`. تقدر تغيّره من **Settings → Domains** لاسم أحلى (مثل `raff-abdulaziz.vercel.app`) أو تربطه بدومين خاص.
5. ارجع لـ Supabase وكمّل الخطوة 3.4 بالرابط النهائي.

أي تعديل يندفع للفرع الرئيسي في GitHub ينشر تلقائياً.
إذا غيّرت أي متغيّر في Vercel، سوّ **Redeploy** عشان ينطبق.

## 5) أول مرة
1. افتح الموقع → **حساب جديد** → اسم المستخدم `Abdulaziz771`.
2. أكّد إيميلك من الرابط اللي يوصلك، وسجّل دخول.
3. افتح **الإعدادات → نقل بياناتي القديمة** (أو `/import`). يطابق كل عنوان من النسخة القديمة مع RAWG/TMDB؛ شيك المطابقة، حدّد اللي تبيه، واضغط **انقل لحسابي**.
4. صفحتك العامة تصير: `https://رابطك/u/Abdulaziz771`.

---

## اختياري: الدخول بحساب Google
1. في Google Cloud Console سوّ **OAuth Client ID** نوعه *Web application*، وحط في Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback` (تلقاه في صفحة Google داخل Supabase).
2. في Supabase: **Authentication → Providers → Google** فعّله وحط Client ID و Secret.
3. في Vercel غيّر `VITE_ENABLE_GOOGLE` إلى `true` وسوّ Redeploy.

## ملاحظات
- **إيميلات التأكيد**: خدمة الإيميل المجانية في Supabase محدودة (كم رسالة بالساعة). إذا كثروا المستخدمين، اربط SMTP خاص من **Authentication → Emails → SMTP Settings** (مثل Resend أو Brevo المجانية)، أو وقّف تأكيد الإيميل من **Authentication → Providers → Email → Confirm email**.
- **الحدود المجانية**: Supabase المجاني يوقّف المشروع إذا ما أحد فتحه أسبوع كامل (ترجّعه بضغطة من لوحة التحكم). Vercel المجاني يكفي لموقع شخصي.
- **المصادر**: IGDB وRAWG وTMDB يشترطون ذكرهم؛ الموقع يذكرهم بسطر صغير أسفل الصفحة وفي «الإعدادات ← عن رفّ».
- **Backloggd وLetterboxd وSerializd** ما عندهم API عام، فما ينربط عليهم مباشرة. لكن Backloggd ياخذ بياناته من IGDB، وLetterboxd وSerializd ياخذون من TMDB — نفس المصادر اللي يستخدمها رفّ.

## التشغيل على جهازك (للمطورين)
```bash
npm install
cp .env.example .env    # وعبّي القيم
npx vercel dev          # يشغّل الموقع مع دوال /api
```
