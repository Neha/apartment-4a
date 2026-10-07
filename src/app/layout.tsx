import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Room · Apartment 4A",
  description: "A control room for a team of Cursor agents in Apartment 4A.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
