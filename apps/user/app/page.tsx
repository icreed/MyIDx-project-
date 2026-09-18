export default function HomePage() {
  return (
    <>
      <h1>Your identity, verified once.</h1>
      <p className="muted">
        Store your documents in an encrypted vault, verify your identity a single time, then reuse
        that verification anywhere that accepts MyIDx — without handing over your documents again.
      </p>

      <div className="grid">
        <section className="card">
          <h2>Identity vault</h2>
          <p className="muted">
            Documents are encrypted with a key derived for your account alone. Full document numbers
            require re-authentication and every access is recorded.
          </p>
        </section>

        <section className="card">
          <h2>Public profile</h2>
          <p className="muted">
            Share a verified badge at <code>/u/your-username</code>. You decide what appears; nothing
            is published by default.
          </p>
        </section>

        <section className="card">
          <h2>Connections</h2>
          <p className="muted">
            See every business with access to your data, the exact scopes they hold, and revoke any
            of them instantly.
          </p>
        </section>
      </div>
    </>
  );
}
