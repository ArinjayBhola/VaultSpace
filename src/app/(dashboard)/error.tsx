'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="card empty">
      <h1>Your vault is temporarily unavailable</h1>
      <p>Check the database and service configuration, then try again.</p>
      <button className="btn primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
