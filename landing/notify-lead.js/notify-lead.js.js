exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { name, phone, email } = JSON.parse(event.body);

    // 1. Send notification to Sharon (existing behavior)
    const notifyPromise = fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "התחלה מדויקת <onboarding@resend.dev>",
        to: process.env.NOTIFY_EMAIL,
        subject: `ליד חדש 🎉 — ${name || "לא צוין"}`,
        html: `
          <div dir="rtl" style="font-family:Arial,sans-serif;padding:20px;max-width:500px">
            <h2 style="color:#1F3D34">נכנס ליד חדש! 🎉</h2>
            <table style="width:100%;border-collapse:collapse;margin-top:16px">
              <tr style="background:#f4efe6">
                <td style="padding:10px;font-weight:bold">שם</td>
                <td style="padding:10px">${name || "לא צוין"}</td>
              </tr>
              <tr>
                <td style="padding:10px;font-weight:bold">טלפון</td>
                <td style="padding:10px">${phone || "לא צוין"}</td>
              </tr>
              <tr style="background:#f4efe6">
                <td style="padding:10px;font-weight:bold">מייל</td>
                <td style="padding:10px">${email || "לא צוין"}</td>
              </tr>
            </table>
          </div>
        `,
      }),
    });

    // 2. Send welcome email to lead (only if email provided)
    let welcomePromise = Promise.resolve();
    if (email) {
      welcomePromise = fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "שרון שושן | התחלה מדויקת <onboarding@resend.dev>",
          to: email,
          subject: `היי ${name || ""} — שמחה שנרשמת 🙏`,
          html: welcomeEmailTemplate(name),
        }),
      });
    }

    await Promise.all([notifyPromise, welcomePromise]);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: err.message };
  }
};

function welcomeEmailTemplate(name) {
  const greeting = name ? `היי ${name}!` : "היי!";
  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF8F4;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">

    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#3D3228;font-size:26px;font-weight:700;margin:0;">התחלה מדויקת</h1>
      <p style="color:#9B8E82;font-size:14px;margin-top:4px;">קורס למורות יוגה בתחילת הדרך</p>
    </div>

    <div style="background:white;border-radius:16px;padding:32px 28px;border:1px solid #E8DFD0;">

      <p style="font-size:18px;color:#3D3228;font-weight:600;margin-top:0;">${greeting}</p>

      <p style="font-size:15px;color:#6B5E52;line-height:1.7;">
        שמחה שהשארת פרטים! אני שרון, ואני רוצה לספר לך קצת עלי ולמה הקורס הזה הוא בדיוק מה שצריך בתחילת הדרך.
      </p>

      <!-- VIDEO PLACEHOLDER: Replace YOUR_VIDEO_URL with YouTube link -->
      <div style="text-align:center;margin:24px 0;">
        <a href="YOUR_VIDEO_URL" style="display:inline-block;background:#C4846C;color:white;padding:14px 32px;border-radius:50px;text-decoration:none;font-size:15px;font-weight:500;">
          צפי בסרטון ההיכרות שלי
        </a>
      </div>

      <p style="font-size:15px;color:#6B5E52;line-height:1.7;">
        בינתיים, דבר אחד שחשוב לי שתדעי — הקורס הזה נבנה בדיוק בשביל הרגע שאחרי ההכשרה. הרגע שבו יש המון ידע אבל לא ברור איך להתחיל ללמד.
      </p>

      <p style="font-size:15px;color:#6B5E52;line-height:1.7;">
        אני כאן לכל שאלה — פשוט תשלחי לי הודעה.
      </p>

      <p style="font-size:15px;color:#3D3228;font-weight:600;margin-bottom:0;">שרון 🙏</p>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <a href="https://wa.me/972502018743" style="color:#C4846C;font-size:14px;text-decoration:none;">שלחי לי הודעה בוואטסאפ</a>
    </div>

    <p style="text-align:center;color:#C8BBAE;font-size:11px;margin-top:32px;">
      קיבלת את המייל הזה כי השארת פרטים באתר התחלה מדויקת
    </p>
  </div>
</body>
</html>`;
}
