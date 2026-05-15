import type { Metadata } from "next";
import { Heebo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SyncProvider } from "@/components/providers/SyncProvider";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinDash - ניהול פיננסי",
  description: "דאשבורד לניהול הוצאות, חשבוניות ופיננסים",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground" suppressHydrationWarning>
        <SessionProvider>
          <ThemeProvider>
            <SyncProvider>
              {children}
            </SyncProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
