import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto min-h-[60vh] max-w-3xl px-6 py-24">
      <p className="mb-4 font-mono text-sm text-gray-900">404</p>
      <h1 className="mb-4 text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="mb-8 text-gray-900">That page is not part of the issue-graph documentation.</p>
      <Link href="/docs" className="underline underline-offset-4">
        Browse the documentation
      </Link>
    </main>
  );
}
