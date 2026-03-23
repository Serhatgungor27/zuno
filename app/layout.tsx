import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "zuno — see what the world is listening to",
  description: "Follow friends and discover music through what people are actually playing right now.",
  applicationName: "zuno",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "zuno",
  },
  openGraph: {
    title: "zuno — see what the world is listening to",
    description: "Follow friends and discover music through what people are actually playing right now.",
    siteName: "zuno",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "zuno — see what the world is listening to",
    description: "Follow friends and discover music through what people are actually playing right now.",
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
