import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Houspire Budget Generator",
  description: "Internal tool — BOQ + vendor list from client renders",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
