export const metadata = { title: "תנאי שימוש — FinDash" };

export default function TermsPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-5 leading-relaxed">
        <h1 className="text-2xl font-bold">תנאי שימוש — FinDash</h1>
        <p className="text-sm text-muted-foreground">עודכן לאחרונה: נובמבר 2026</p>

        <p>
          FinDash היא אפליקציה אישית לניהול חשבוניות והוצאות. השימוש בה כפוף לתנאים הבאים.
        </p>

        <h2 className="text-lg font-semibold pt-2">השירות</h2>
        <p>
          האפליקציה מסייעת לרכז חשבוניות מ-Gmail, לנהל הוצאות, ולשלוח חשבוניות לרואה החשבון שלך.
          השירות ניתן &quot;כפי שהוא&quot; (AS IS) לשימושך האישי.
        </p>

        <h2 className="text-lg font-semibold pt-2">אחריותך</h2>
        <ul className="list-disc pr-5 space-y-1">
          <li>לשמור על פרטי ההתחברות שלך.</li>
          <li>לוודא את נכונות הנתונים לפני הסתמכות עליהם או שליחתם לרואה החשבון.</li>
          <li>להשתמש באפליקציה למטרות חוקיות בלבד.</li>
        </ul>

        <h2 className="text-lg font-semibold pt-2">הגבלת אחריות</h2>
        <p>
          האפליקציה מסופקת ללא אחריות מכל סוג. המפעיל לא יישא באחריות לכל נזק ישיר או עקיף הנובע
          מהשימוש בה. אין באפליקציה משום ייעוץ מס, חשבונאי או משפטי.
        </p>

        <h2 className="text-lg font-semibold pt-2">שינויים</h2>
        <p>ייתכנו עדכונים לתנאים אלה מעת לעת; המשך השימוש מהווה הסכמה לתנאים המעודכנים.</p>

        <h2 className="text-lg font-semibold pt-2">יצירת קשר</h2>
        <p>לשאלות: edishteinberg10@gmail.com</p>

        <p className="pt-4">
          <a href="/" className="text-primary underline">חזרה לאפליקציה</a>
        </p>
      </div>
    </div>
  );
}
