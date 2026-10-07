import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy · Apartment 4A",
  description: "What Apartment 4A stores on your machine and what it sends to Cursor.",
};

export default function PrivacyPage() {
  return (
    <main className="info-page">
      <p className="info-back">
        <Link href="/">Back to the room</Link>
      </p>
      <h1>Privacy policy</h1>
      <p>Apartment 4A runs on your computer. It does not have its own account, and it does not sell data.</p>

      <h2>What stays on this machine</h2>
      <ul>
        <li>The project name and folder path.</li>
        <li>The tasks you assign, each agent’s status, and the notes they write. These live in a local data file.</li>
        <li>Your Cursor API key, if you set one. It stays in a local env file and is never included in the page.</li>
      </ul>

      <h2>What is sent to Cursor</h2>
      <p>
        When you assign a task, the prompt and the files an agent reads in your project folder are sent to Cursor with your own Cursor credentials. Cursor’s handling of that data is covered by your Cursor account, not by this app.
      </p>

      <h2>Links</h2>
      <p>
        The About page links to Neha Sharma on LinkedIn and X. Those sites have their own privacy policies. Apartment 4A does not receive data from them.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy: Neha Sharma, via the links on the <Link href="/about">About page</Link>.
      </p>
      <p className="muted">Last updated 7 October 2026.</p>
    </main>
  );
}
