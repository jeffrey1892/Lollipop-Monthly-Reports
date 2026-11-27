import Link from "next/link";
import { DEFAULT_EVENT_SLUG } from "@/lib/env";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-bold text-crimson">Page not found</h1>
      <p className="mt-2 text-gray-600">That link doesn&apos;t match an event.</p>
      <Link className="btn btn-primary mt-6" href={`/e/${DEFAULT_EVENT_SLUG}/register`}>
        Go to the Lead Session
      </Link>
    </main>
  );
}
