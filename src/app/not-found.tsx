import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-black text-brand-burgundy mb-4">404</h1>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Page Not Found</h2>
        <p className="text-slate-600 mb-8 max-w-md">
          Sorry, the page you&apos;re looking for doesn&apos;t exist. Let&apos;s get you back on track.
        </p>
        <Link
          href="/"
          className="inline-block bg-brand-burgundy hover:bg-brand-burgundy/90 text-white font-bold py-3 px-8 rounded-lg transition-all"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
