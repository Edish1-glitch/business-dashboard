import type { Metadata } from "next";
import { Rubik, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "600", "700"],
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
      className={`${rubik.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground" suppressHydrationWarning>
        <Sidebar />
        <div className="md:mr-64 min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
