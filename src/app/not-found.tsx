import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="text-center">
        <h1 className="font-display text-7xl md:text-8xl font-black tracking-tight text-crimson mb-4">404</h1>
        <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-ink mb-2">Page Not Found</h2>
        <p className="text-ink-muted mb-8 max-w-md mx-auto">
          Sorry, the page you&apos;re looking for doesn&apos;t exist. Let&apos;s get you back on track.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-crimson px-8 py-3 text-sm font-bold text-white shadow-crimson transition-all hover:bg-crimson-deep active:scale-[0.98]"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
