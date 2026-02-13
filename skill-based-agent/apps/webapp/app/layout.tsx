import type { Metadata } from "next";
import { Geist, Geist_Mono, Merriweather } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const merriweather = Merriweather({
  variable: "--font-merriweather-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chat App",
  description: "Chat with almost all the widely knows LLMs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${merriweather.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
