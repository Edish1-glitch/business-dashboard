import type { Metadata, Viewport } from "next";
import { Heebo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SyncProvider } from "@/components/providers/SyncProvider";
import { PendingCountProvider } from "@/components/providers/PendingCountProvider";
import { UploadProvider } from "@/components/providers/UploadProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AppHeightVar } from "@/components/AppHeightVar";

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
  manifest: "/manifest.webmanifest",
  applicationName: "FinDash",
  appleWebApp: {
    capable: true,
    title: "FinDash",
    // black-translucent: the iOS standalone PWA status bar goes transparent and
    // the app's own (dark) background shows through with white icons — a dark
    // status bar on the dark app. (theme-color does NOT control this on iOS.)
    // The Header pads env(safe-area-inset-top) so content isn't hidden under it.
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  // Single theme-color meta; ThemeProvider updates its content to match the
  // resolved theme (dark → #0e0f15, light → #f6f6fb) so the iOS PWA status bar
  // never shows a white strip over the dark app. SSR default is light; the
  // effect corrects it on launch. media-query defaults cover the pre-JS frame.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f15" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // no pinch-zoom on the whole app (native feel)
  viewportFit: "cover",
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
        <ServiceWorkerRegister />
        <AppHeightVar />
        <SessionProvider>
          <ThemeProvider>
            <SyncProvider>
              <UploadProvider>
                <PendingCountProvider>
                  {children}
                </PendingCountProvider>
              </UploadProvider>
            </SyncProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
