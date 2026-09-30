"use client";

// Pro Requests, ported into the Owner console. Reuses the existing, working admin
// component (self-contained; talks to /admin pro-request endpoints).
import ProRequestsTab from "@/components/admin/ProRequestsTab";

export default function OwnerProRequestsPage() {
  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <span className="eyebrow">Platform Owner</span>
        <h1 className="big-num" style={{ fontSize: 34, marginTop: 6 }}>Pro Requests</h1>
      </div>
      <ProRequestsTab />
    </>
  );
}
