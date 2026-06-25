export default function DashboardPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="ed-card p-8 w-full max-w-md space-y-4 text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Welcome!</h2>
        <p className="text-ink-muted">You are logged in. This is your dashboard.</p>
      </div>
    </div>
  );
}
