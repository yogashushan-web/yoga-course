# EmailJS Template Spec — הרגע היומי (21-Day Meditation)

Post-purchase confirmation email, triggered after PayMe confirms payment for the 21-day meditation course (₪259).

---

## Suggested EmailJS template name

`template_meditation21`

(Alternative: `template_meditation_21days` — match the naming style of the existing `template_o3kxtq3` used in `course/netlify/functions/payme-callback.js`.)

## Service

Reuse the existing EmailJS service: **`yoga_service`** (service ID already in use by the precise-start course — see `course/netlify/functions/payme-callback.js` line 6).

Use the same public key: `e68o52Ief_mCyAZIa`.

## Subject line (Hebrew)

```
ברוכה הבאה למסע 21 ימי המדיטציה שלך 🙏
```

Alternatives to A/B if desired:
- `{{name}}, המסע שלך מתחיל עכשיו 🕯️`
- `הרגע היומי — כל מה שצריך כדי להתחיל`

## Template variables

| Variable | Description | Example |
|---|---|---|
| `{{name}}` | First name of the buyer (from PayMe `sale_buyer_name` or pending_purchases) | `שרון` |
| `{{to_email}}` | Destination (EmailJS uses this to send) | `buyer@example.com` |
| `{{course_url}}` | Link to the course site (use final URL once live) | `https://21days-course.netlify.app` |
| `{{support_phone}}` | WhatsApp support number (display) | `050-201-8743` |
| `{{support_whatsapp_url}}` | Clickable wa.me link | `https://wa.me/972502018743` |

Only `{{name}}`, `{{course_url}}`, and `{{support_phone}}` are strictly required by the brief — the extras keep the template flexible.

## Body template (paste into EmailJS editor — Content type: HTML)

```html
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F4EFE6;font-family:'Heebo','Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="color:#1F3D34;font-size:26px;font-weight:700;margin:0;">הרגע היומי</h1>
      <p style="color:#6f7f78;font-size:14px;margin-top:4px;letter-spacing:1px;">מסע 21 ימי מדיטציה</p>
    </div>

    <div style="background:white;border-radius:18px;padding:36px 30px;border:1px solid #e3dccf;box-shadow:0 6px 24px rgba(31,61,52,0.05);">

      <p style="font-size:18px;color:#1F3D34;font-weight:700;margin-top:0;">היי {{name}} 🙏</p>

      <p style="font-size:15.5px;color:#3a4a44;line-height:1.8;">
        הרכישה שלך הושלמה בהצלחה — ברוכה הבאה למסע.
      </p>

      <p style="font-size:15.5px;color:#3a4a44;line-height:1.8;">
        21 מדיטציות מחכות לך באתר הקורס. אפשר להתחיל מתי שירגיש לך נכון, בקצב שלך. אין לחץ — רק את, הנשימה, והרגע הזה.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="{{course_url}}" style="display:inline-block;background:#1F3D34;color:white;padding:18px 40px;border-radius:50px;text-decoration:none;font-size:16px;font-weight:700;box-shadow:0 8px 22px rgba(31,61,52,0.25);">
          כניסה למסע ▶
        </a>
      </div>

      <div style="background:#FBF8F2;border-radius:12px;padding:18px 20px;border:1px solid #e3dccf;margin:24px 0;">
        <p style="font-size:14.5px;color:#1F3D34;font-weight:700;margin:0 0 6px;">איך נכנסים?</p>
        <p style="font-size:14.5px;color:#3a4a44;line-height:1.7;margin:0;">
          כתובת המייל הזו היא שם המשתמש שלך. פשוט היכנסי לאתר הקורס בקישור למעלה.
        </p>
      </div>

      <p style="font-size:15px;color:#1F3D34;font-weight:700;margin:24px 0 10px;">טיפים קטנים לדרך:</p>
      <ul style="font-size:14.5px;color:#3a4a44;line-height:2;padding-right:20px;margin:0;">
        <li>אוזניות — החוויה עמוקה יותר</li>
        <li>מקום שקט ונעים, אם אפשר אותה פינה כל יום</li>
        <li>10-15 דקות ביום, זה מספיק</li>
        <li>התחילי מיום 1 — המסע בנוי הדרגתית</li>
      </ul>

      <hr style="border:none;border-top:1px solid #e3dccf;margin:28px 0;">

      <p style="font-size:14.5px;color:#3a4a44;line-height:1.7;margin:0;">
        יש שאלה? משהו לא עובד? אני כאן.<br>
        וואטסאפ: <a href="{{support_whatsapp_url}}" style="color:#2a5c4a;font-weight:700;text-decoration:none;">{{support_phone}}</a>
      </p>

      <p style="font-size:15px;color:#1F3D34;font-weight:700;margin:24px 0 0;">נשימה עמוקה,<br>שרון 🕯️</p>
    </div>

    <p style="text-align:center;color:#9a8e82;font-size:11px;margin-top:28px;">
      קיבלת את המייל הזה כי רכשת את "הרגע היומי" באתר של שרון שושן.
    </p>
  </div>
</body>
</html>
```

## When it's triggered

Immediately after the PayMe webhook confirms a successful payment for the 21-day meditation product. Same trigger point as the existing flow in `/Users/sharonshushan/Desktop/yoga-course/course/netlify/functions/payme-callback.js` — inside the handler, right after verifying `payme_status === 'completed' || 'success'` and resolving the buyer email (from either the PayMe callback or the `pending_purchases` table).

Recommended: create a dedicated Netlify function `meditation-21/netlify/functions/payme-callback.js` (or branch by product in the existing one) so the right template is used per product.

## Sample JS snippet (Netlify function)

Drop this into the Netlify function that handles the PayMe callback for this product. It mirrors the existing pattern in `course/netlify/functions/payme-callback.js`.

```js
const EMAILJS_SERVICE_ID  = 'yoga_service';
const EMAILJS_TEMPLATE_ID = 'template_meditation21';
const EMAILJS_PUBLIC_KEY  = 'e68o52Ief_mCyAZIa';
const EMAILJS_ACCESS_TOKEN = 'whdrm0tpmW_JfEc6GVuvZ'; // same as existing course

async function sendMeditationWelcomeEmail({ name, email }) {
  const payload = {
    service_id:  EMAILJS_SERVICE_ID,
    template_id: EMAILJS_TEMPLATE_ID,
    user_id:     EMAILJS_PUBLIC_KEY,
    accessToken: EMAILJS_ACCESS_TOKEN,
    template_params: {
      to_email: email,
      to_name:  name || 'חברה יקרה',
      name:     name || 'חברה יקרה',
      course_url: 'https://21days-course.netlify.app', // TODO: final URL
      support_phone: '050-201-8743',
      support_whatsapp_url: 'https://wa.me/972502018743',
    },
  };

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`EmailJS failed: ${res.status} ${errorText}`);
  }

  return res.text();
}

// Call from inside the PayMe callback handler, after payment is verified:
//
//   if (paymentStatus === 'completed' || paymentStatus === 'success') {
//     await sendMeditationWelcomeEmail({ name: buyerName, email: buyerEmail });
//   }
```

## Notes

- The existing precise-start course uses EmailJS with `yoga_service` + `template_o3kxtq3`. Create a new template in the same EmailJS account — do not reuse `template_o3kxtq3` (it contains login-password wording that doesn't apply here, since the meditation course uses email-only login).
- Make sure the EmailJS "To email" field in the template is bound to `{{to_email}}`.
- Once the real course URL is live, update `course_url` both in `index.html` (CTA button) and in the Netlify function default.
