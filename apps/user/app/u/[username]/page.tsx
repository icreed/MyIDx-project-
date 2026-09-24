import { notFound } from "next/navigation";
import type { PublicProfile } from "@myidx/shared";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

async function loadProfile(username: string): Promise<PublicProfile | null> {
  const res = await fetch(`${API_URL}/v1/u/${encodeURIComponent(username)}`, {
    // Public page, but verification state changes — revalidate rather than cache hard.
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`profile lookup failed: ${res.status}`);
  return (await res.json()) as PublicProfile;
}

export default async function PublicProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const profile = await loadProfile(params.username);
  if (!profile) notFound();

  return (
    <article className="card">
      <h1 style={{ marginBottom: "0.25rem" }}>{profile.displayName ?? profile.username}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        @{profile.username}
        {profile.verified ? <span className="badge verified"> Verified</span> : null}
      </p>

      {profile.bio ? <p>{profile.bio}</p> : null}

      <dl className="muted">
        {profile.country ? (
          <>
            <dt>Country</dt>
            <dd>{profile.country}</dd>
          </>
        ) : null}
        <dt>Member since</dt>
        <dd>{new Date(profile.memberSince).toLocaleDateString()}</dd>
        {profile.verifiedAt ? (
          <>
            <dt>Verified on</dt>
            <dd>{new Date(profile.verifiedAt).toLocaleDateString()}</dd>
          </>
        ) : null}
      </dl>
    </article>
  );
}
