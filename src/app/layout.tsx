import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Room",
  description: "A control room for a team of Cursor agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
