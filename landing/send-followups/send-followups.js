const { createClient } = require("@supabase/supabase-js");

// Netlify Scheduled Function — runs daily at 9:00 AM Israel time (6:00 UTC)
exports.handler = async (event) => {
  const supabase = createClient(
    process.env.SUPABASE_URL || "https://tyjlyfyqwgihbhhxbeqe.supabase.co",
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
  );

  const now = new Date();

  // Get all leads that have email and haven't finished the sequence (stage < 4)
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .not("email", "is", null)
    .neq("email", "")
    .lt("email_stage", 4);

  if (error) {
    console.error("Error fetching leads:", error);
    return { statusCode: 500, body: "DB error" };
  }

  let sent = 0;

  for (const lead of leads || []) {
    const createdAt = new Date(lead.created_at);
    const daysSince = (now - createdAt) / (1000 * 60 * 60 * 24);
    const stage = lead.email_stage || 0;

    // Determine if it's time for the next email
    // Stage 0 → 1: welcome already sent on signup (by notify-lead)
    // Stage 1 → 2: after 1 day — testimonial email
    // Stage 2 → 3: after 3 days — professional tip
    // Stage 3 → 4: after 5 days — final invitation
    let shouldSend = false;
    let nextStage = stage;

    if (stage === 0 && daysSince >= 0) {
      // Lead existed before automation — mark as stage 1 (welcome was sent on signup)
      // For old leads without email automation, skip to stage 1
      nextStage = 1;
      shouldSend = false; // Don't send welcome again, just advance stage
      await supabase.from("leads").update({ email_stage: 1 }).eq("id", lead.id);
      // Check if they're also ready for stage 2
      if (daysSince >= 1) {
        shouldSend = true;
        nextStage = 2;
      }
    } else if (stage === 1 && daysSince >= 1) {
      shouldSend = true;
      nextStage = 2;
    } else if (stage === 2 && daysSince >= 3) {
      shouldSend = true;
      nextStage = 3;
    } else if (stage === 3 && daysSince >= 5) {
      shouldSend = true;
      nextStage = 4;
    }

    if (shouldSend) {
      const template = getEmailTemplate(nextStage, lead.name);
      if (!template) continue;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "שרון שושן | התחלה מדויקת <onboarding@resend.dev>",
            to: lead.email,
            subject: template.subject,
            html: template.html,
          }),
        });

        if (res.ok) {
          await supabase
            .from("leads")
            .update({ email_stage: nextStage })
            .eq("id", lead.id);
          sent++;
        } else {
          console.error(`Failed to send to ${lead.email}:`, await res.text());
        }
      } catch (err) {
        console.error(`Error sending to ${lead.email}:`, err);
      }
    }
  }

  console.log(`Follow-up emails sent: ${sent}`);
  return { statusCode: 200, body: JSON.stringify({ sent }) };
};

// ─── Email Templates ───────────────────────────────────────

function getEmailTemplate(stage, name) {
  const greeting = name ? `היי ${name}!` : "היי!";

  const templates = {
    // Stage 2: Testimonial email (day 1)
    2: {
      subject: "מה אומרות מורות שכבר עשו את הקורס? 🧘‍♀️",
      html: wrapEmail(`
        <p style="font-size:18px;color:#3D3228;font-weight:600;margin-top:0;">${greeting}</p>

        <p style="font-size:15px;color:#6B5E52;line-height:1.7;">
          רציתי לשתף אותך במשהו שקיבלתי מתלמידה שסיימה את הקורס:
        </p>

        <div style="background:#FAF8F4;border-right:3px solid #C4846C;padding:16px 20px;border-radius:8px;margin:20px 0;">
          <p style="font-size:15px;color:#6B5E52;line-height:1.7;margin:0;font-style:italic;">
            "כל שיעור פשוט מדויק, מסוכם בצורה הכי טובה שיש, זה דברים שבתת מודע שלך אתה יודע אבל ברגע שאתה שומע את זה שוב, זה מרגיש כאילו אתה לומד את זה מחדש. והנספחים של הדפים בנוסף לכל שיעור, אין מילים — באמת רציתי להגיד לך שלמדתי מזה בטירוף וזאת ההכוונה הכי טובה שאפשר לקבל גם בתור התחלה ולא רק בתור התחלה."
          </p>
        </div>

        <p style="font-size:15px;color:#6B5E52;line-height:1.7;">
          <strong>מה כלול בקורס:</strong>
        </p>
        <ul style="font-size:15px;color:#6B5E52;line-height:2;padding-right:20px;">
          <li>6 שיעורים מוקלטים שמלווים אותך צעד אחרי צעד</li>
          <li>דפי עבודה מעשיים לכל שיעור</li>
          <li>קבוצת ליווי בוואטסאפ</li>
          <li>גישה למדריכי אסנות אינטראקטיביים</li>
        </ul>

        <div style="text-align:center;margin:28px 0;">
          <a href="https://checkoutyogac.netlify.app" style="display:inline-block;background:#C4846C;color:white;padding:14px 32px;border-radius:50px;text-decoration:none;font-size:15px;font-weight:500;">
            לפרטים נוספים על הקורס
          </a>
        </div>

        <p style="font-size:15px;color:#3D3228;font-weight:600;margin-bottom:0;">שרון 🙏</p>
      `),
    },

    // Stage 3: Professional tip (day 3)
    3: {
      subject: "הטעות הכי נפוצה של מורות יוגה בתחילת הדרך",
      html: wrapEmail(`
        <p style="font-size:18px;color:#3D3228;font-weight:600;margin-top:0;">${greeting}</p>

        <p style="font-size:15px;color:#6B5E52;line-height:1.7;">
          אחרי שליוויתי עשרות מורות בתחילת דרכן, יש טעות אחת שחוזרת שוב ושוב:
        </p>

        <p style="font-size:16px;color:#3D3228;font-weight:600;line-height:1.7;">
          לנסות להעביר שיעור "מושלם" במקום שיעור אמיתי.
        </p>

        <p style="font-size:15px;color:#6B5E52;line-height:1.7;">
          מורות חדשות מכינות רצף ארוך, מנסות לזכור כל תנוחה, ובסוף מפספסות את מה שבאמת חשוב — <strong>לקרוא את הקבוצה</strong> ולהתאים את השיעור לאנשים שמולך.
        </p>

        <p style="font-size:15px;color:#6B5E52;line-height:1.7;">
          בקורס "התחלה מדויקת" יש שיעור שלם שמוקדש בדיוק לזה — איך לבנות שיעור שמתאים את עצמו, איך לקרוא קבוצה, ואיך להרגיש בטוחה גם כשהתוכנית משתנה.
        </p>

        <div style="background:#FAF8F4;border-right:3px solid #C4846C;padding:16px 20px;border-radius:8px;margin:20px 0;">
          <p style="font-size:15px;color:#6B5E52;line-height:1.7;margin:0;font-style:italic;">
            "אני אמנם מלמדת כבר כמעט חצי שנה, אבל זה עדיין מדויק וממש חשוב, בטוחה שאפילו למורות ותיקות חשוב לשאול את השאלות האלו שוב."
          </p>
        </div>

        <div style="text-align:center;margin:28px 0;">
          <a href="https://wa.me/972502018743?text=היי שרון, אשמח לשמוע עוד על הקורס" style="display:inline-block;background:#C4846C;color:white;padding:14px 32px;border-radius:50px;text-decoration:none;font-size:15px;font-weight:500;">
            שלחי לי הודעה, אשמח לענות
          </a>
        </div>

        <p style="font-size:15px;color:#3D3228;font-weight:600;margin-bottom:0;">שרון 🙏</p>
      `),
    },

    // Stage 4: Final invitation (day 5)
    4: {
      subject: `${name ? name + ", " : ""}עדיין חושבת על זה? 🌿`,
      html: wrapEmail(`
        <p style="font-size:18px;color:#3D3228;font-weight:600;margin-top:0;">${greeting}</p>

        <p style="font-size:15px;color:#6B5E52;line-height:1.7;">
          שלחתי לך כמה מיילים בימים האחרונים ורציתי לכתוב לך הודעה אחרונה.
        </p>

        <p style="font-size:15px;color:#6B5E52;line-height:1.7;">
          אני יודעת שהתחלה של משהו חדש זה מפחיד. אחרי הכשרה ארוכה, לפעמים יש תחושה של "אני לא מספיק מוכנה" או "מי אני בכלל ללמד".
        </p>

        <p style="font-size:15px;color:#6B5E52;line-height:1.7;">
          <strong>בדיוק בשביל זה בניתי את הקורס הזה.</strong> לא עוד תיאוריה — אלא כלים מעשיים שעוזרים לך להתחיל ללמד בביטחון.
        </p>

        <p style="font-size:15px;color:#6B5E52;line-height:1.7;">
          הקורס כולל 6 שיעורים מוקלטים, דפי עבודה, קבוצת ליווי, ומדריכי אסנות — הכל במחיר של <strong>₪550</strong> (תשלומים אפשריים).
        </p>

        <div style="text-align:center;margin:28px 0;">
          <a href="https://checkoutyogac.netlify.app" style="display:inline-block;background:#C4846C;color:white;padding:16px 36px;border-radius:50px;text-decoration:none;font-size:16px;font-weight:600;">
            אני רוצה להתחיל
          </a>
        </div>

        <p style="font-size:15px;color:#6B5E52;line-height:1.7;">
          ואם יש שאלות, אני תמיד כאן —
        </p>

        <div style="text-align:center;margin-bottom:20px;">
          <a href="https://wa.me/972502018743" style="color:#C4846C;font-size:14px;text-decoration:none;">הודעה בוואטסאפ</a>
        </div>

        <p style="font-size:15px;color:#3D3228;font-weight:600;margin-bottom:0;">שרון 🙏</p>
      `),
    },
  };

  return templates[stage] || null;
}

// ─── Shared email wrapper ───────────────────────────────────

function wrapEmail(content) {
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
      ${content}
    </div>
    <p style="text-align:center;color:#C8BBAE;font-size:11px;margin-top:32px;">
      קיבלת את המייל הזה כי השארת פרטים באתר התחלה מדויקת
    </p>
  </div>
</body>
</html>`;
}
