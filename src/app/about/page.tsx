import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About · Agent Room",
  description: "What Agent Room is, and who made it.",
};

export default function AboutPage() {
  return (
    <main className="info-page">
      <p className="info-back">
        <Link href="/">Back to the room</Link>
      </p>
      <h1>About Agent Room</h1>
      <p>
        Agent Room, Apartment 4A, is a local control room for a small team of Cursor agents. You assign one task. The app reads the wording, lines the team up, and runs one person at a time in your project folder.
      </p>
      <p>You do not name who should work. A question stays with the lead. A request to write, build, debug, or check brings in the matching teammates.</p>

      <h2>About the author</h2>
      <p>
        <strong>Neha Sharma</strong> is a solutions architect at Amazon, founder of JSLovers, and a calligraphy artist. She built Agent Room.
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
