import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About · Apartment 4A",
  description: "What Apartment 4A is, and who made it.",
};

export default function AboutPage() {
  return (
    <main className="info-page">
      <p className="info-back">
        <Link href="/">Back to the room</Link>
      </p>
      <h1>About Apartment 4A</h1>
      <p>
        Apartment 4A is a local control room for a small team of Cursor agents. You assign one task. The app reads the wording, lines the team up, and runs one person at a time in your project folder.
      </p>
      <p>You do not name who should work. A question stays with the lead. A request to write, build, debug, or check brings in the matching teammates.</p>

      <h2>About the author</h2>
      <p>
        <strong>Neha Sharma</strong> is a solutions architect at Amazon, founder of JSLovers, and a calligraphy artist. She built Apartment 4A.
      </p>
      <ul className="info-links">
        <li>
          <a href="https://www.linkedin.com/in/nehha/" rel="noreferrer">
            LinkedIn
          </a>
        </li>
        <li>
          <a href="https://x.com/hellonehha" rel="noreferrer">
            X
          </a>
        </li>
      </ul>
      <p className="muted">
        <Link href="/privacy">Privacy policy</Link>
      </p>
    </main>
  );
}
