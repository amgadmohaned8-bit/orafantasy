This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
أنا أعمل على مشروع Fantasy Football باستخدام Next.js + TypeScript + Firebase.

أريد منك إصلاح وإكمال نظام اللاعبين في صفحة `/squad`.

### الهدف الأساسي

أريد أن تظهر **لاعبو الدوري المصري موسم 2026/27** داخل Player Picker عند الضغط على `Players`، وليس الفرق فقط.

مهم جدًا:

* لا تستخدم API-Football للحصول على اللاعبين؛ الـFree Plan لا يوفر الموسم المطلوب.
* لا تستخدم FootyStats أو أي مصدر مدفوع.
* لا أريد بيانات وهمية.
* استخدم مصدرًا مجانيًا ومتاحًا حاليًا للحصول على بيانات اللاعبين 2026/27.
* إذا لم يوجد API مجاني واحد، اجمع البيانات من المصادر العامة المتاحة ثم خزّنها محليًا داخل المشروع.
* لا تطلب مني إدخال اللاعبين يدويًا.
* لا تغيّر تصميم صفحة `/squad`.
* لا تغيّر نظام Firebase Authentication أو Firestore.
* لا تغيّر نظام الأسعار `computePrice`.
* لا تغيّر نظام النقاط إلا إذا كان هناك خطأ يمنع اللاعبين من الظهور.

### البيانات المطلوبة لكل لاعب

كل لاعب يجب أن يتحول إلى:

```ts
{
  id: string;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  teamId: string;
  teamName: string;
  teamLogo?: string;
  photo?: string;
  number?: number;
  rating?: number;
  price: number;
}
```

### مهم جدًا بالنسبة للمراكز

حوّل المراكز المختلفة إلى:

```text
Goalkeeper / GK → GK
Defender / DEF → DEF
Midfielder / MID → MID
Attacker / Forward / Striker / FWD → FWD
```

إذا كان المصدر يستخدم أسماء مراكز مختلفة، اعمل mapping واضح لها.

### المطلوب في API

اجعل:

```text
GET /api/players
```

يرجع:

```json
{
  "players": [...],
  "count": 123,
  "season": "2026/27"
}
```

ولا يرجع:

```json
{
  "players": []
}
```

إلا إذا حدث خطأ حقيقي.

في حالة الخطأ، رجّع رسالة واضحة توضّح السبب.

### بنية الملفات

إذا اخترت التخزين المحلي، أنشئ:

```text
data/
  players-2026-27.json
```

ثم اجعل:

```text
app/api/players/route.ts
```

يقرأ الملف ويحوّل البيانات إلى `Player[]`.

استخدم:

```ts
import { computePrice } from "@/src/fantasy/pricing";
import type { Player, Position } from "@/src/fantasy/types";
```

واحسِب السعر لكل لاعب باستخدام:

```ts
computePrice(position, teamName, rating)
```

### الصور

إذا كان المصدر يوفر صورة اللاعب استخدمها.

إذا لم يوفر صورة، لا تجعل اللاعب يختفي. استخدم:

```text
photo: ""
```

لأن صفحة Squad عندي لديها fallback إلى قميص الفريق.

### الفرق

أريد لاعبي جميع أندية الدوري المصري 2026/27 الحالية، وليس قائمة فرق فقط.

اجمع الـsquads الحالية من مصدر مجاني موثوق، وتأكد قدر الإمكان من:

* اسم اللاعب
* المركز
* الفريق
* رقم القميص

ولا تخترع لاعبًا غير موجود.

### توافق المشروع

راجع الملفات الموجودة أولًا:

```text
src/fantasy/types.ts
src/fantasy/pricing.ts
src/fantasy/scoring.ts
app/squad/page.tsx
app/api/players/route.ts
```

وتأكد أن الـimports صحيحة.

إذا كان المشروع يستخدم alias:

```text
@/*
```

فاستخدمه بدل المسارات النسبية الطويلة.

### أهم اختبار

بعد الانتهاء شغّل المشروع واخت
