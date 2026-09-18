export default function AdminHome() {
  return (
    <>
      <h1>Operations</h1>
      <p className="muted">
        Commercial settings and market configuration are data, not deployments — changes here take
        effect without shipping code.
      </p>

      <div className="grid">
        <section className="card">
          <h2>Markets</h2>
          <p className="muted">
            Enable a country and map its accepted documents onto generic types. No schema change is
            needed to launch a new market.
          </p>
        </section>

        <section className="card">
          <h2>Pricing &amp; credits</h2>
          <p className="muted">
            Signup bonus, credits per user action, and merchant KYC/KYB unit prices. Defaults seed on
            first boot; this panel is authoritative afterwards.
          </p>
        </section>

        <section className="card">
          <h2>Merchant review</h2>
          <p className="muted">
            Approve KYB before regulated scopes unlock. Suspension immediately invalidates that
            merchant&rsquo;s grants.
          </p>
        </section>

        <section className="card">
          <h2>Audit</h2>
          <p className="muted">
            Vault reveals, consent changes and verification outcomes, with hashed IPs rather than raw
            addresses.
          </p>
        </section>
      </div>
    </>
  );
}
