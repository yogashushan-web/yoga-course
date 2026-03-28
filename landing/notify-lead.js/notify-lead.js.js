exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { name, phone, email } = JSON.parse(event.body);

    const res = await fetch("https://api.resend.com/emails", {
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

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return { statusCode: 500, body: "Failed to send email" };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: err.message };
  }
};
