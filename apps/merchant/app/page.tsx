export default function MerchantHome() {
  return (
    <>
      <h1>Verify customers without collecting their documents.</h1>
      <p className="muted">
        Add &ldquo;Continue with MyIDx&rdquo; and receive verified identity attributes the customer
        has already proven — only the fields they consent to share.
      </p>

      <div className="grid">
        <section className="card">
          <h2>1. Register a client</h2>
          <p className="muted">
            Create an OAuth client with exact redirect URIs. The secret is shown once.
          </p>
        </section>
        <section className="card">
          <h2>2. Request scopes</h2>
          <p className="muted">
            Basic profile and verification status are self-serve. Regulated scopes unlock once your
            KYB is approved.
          </p>
        </section>
        <section className="card">
          <h2>3. Read the result</h2>
          <p className="muted">
            Exchange the code for a token and read verified attributes. Billing is per verification.
          </p>
        </section>
      </div>

      <section className="card">
        <h2>Integration</h2>
        <pre>
          <code>{`import { MyIDxClient } from "@myidx/sdk";

const client = new MyIDxClient({
  clientId: process.env.MYIDX_CLIENT_ID!,
  clientSecret: process.env.MYIDX_CLIENT_SECRET!,
  redirectUri: "https://example.com/callback",
});`}</code>
        </pre>
        <p className="muted">
          Authorization code flow with PKCE. Treat a <code>401</code> as consent withdrawn — users
          can revoke access at any time.
        </p>
      </section>
    </>
  );
}
