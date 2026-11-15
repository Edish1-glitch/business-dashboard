export const metadata = { title: "מדיניות פרטיות — FinDash" };

export default function PrivacyPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-5 leading-relaxed">
        <h1 className="text-2xl font-bold">מדיניות פרטיות — FinDash</h1>
        <p className="text-sm text-muted-foreground">עודכן לאחרונה: נובמבר 2026</p>

        <p>
          FinDash היא אפליקציה אישית לניהול חשבוניות והוצאות. מדיניות זו מסבירה אילו נתונים
          האפליקציה אוספת וכיצד היא משתמשת בהם.
        </p>

        <h2 className="text-lg font-semibold pt-2">מידע שנאסף</h2>
        <ul className="list-disc pr-5 space-y-1">
          <li>כתובת הדוא&quot;ל וזהות החשבון דרך התחברות Google.</li>
          <li>
            חשבוניות וקבלות שנמשכות מתיבות ה-Gmail שחיברת (בהרשאת קריאה), לצורך זיהוי ושמירה של
            חשבוניות בלבד.
          </li>
          <li>נתוני ההוצאות, הקטגוריות וההגדרות שאתה יוצר באפליקציה.</li>
        </ul>

        <h2 className="text-lg font-semibold pt-2">שימוש במידע</h2>
        <p>
          המידע משמש אך ורק כדי לספק לך את שירות האפליקציה — ריכוז חשבוניות, ניהול הוצאות ושליחה
          לרואה החשבון שלך לפי בקשתך. המידע אינו נמכר, אינו מושכר ואינו משותף עם צדדים שלישיים.
        </p>

        <h2 className="text-lg font-semibold pt-2">גישה ל-Gmail</h2>
        <p>
          הגישה ל-Gmail ניתנת דרך OAuth של Google ומשמשת לקריאת חשבוניות ולשליחת חשבוניות לרואה
          החשבון בלבד. אפשר לבטל את ההרשאה בכל רגע דרך הגדרות החשבון ב-Google או מתוך האפליקציה.
          השימוש בנתוני Google תואם ל-Google API Services User Data Policy, כולל דרישות ה-Limited Use.
        </p>

        <h2 className="text-lg font-semibold pt-2">אבטחה</h2>
        <p>
          אסימוני הגישה מוצפנים, והגישה לנתונים מוגבלת לחשבון שלך בלבד. חיבורי MCP (למשל עוזר
          אישי) פועלים רק על הנתונים שלך, וכל פעולה נרשמת ביומן.
        </p>

        <h2 className="text-lg font-semibold pt-2">יצירת קשר</h2>
        <p>לשאלות בנושא פרטיות: edishteinberg10@gmail.com</p>

        <p className="pt-4">
          <a href="/" className="text-primary underline">חזרה לאפליקציה</a>
        </p>
      </div>
    </div>
  );
}
