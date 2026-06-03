import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Houspire Budget Generator",
  description: "Internal tool — BOQ + vendor list from client renders",
  manifest: "/manifest.json",
  themeColor: "#1B4D3E",
  appleWebApp: { capable: true, title: "Houspire", statusBarStyle: "black-translucent" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="antialiased">
        {children}
        <script dangerouslySetInnerHTML={{__html: `if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')`}} />
      </body>
    </html>
  );
}
