"use client";

// Payments & QR, ported into the Owner console. Reuses the existing, working admin
// component (self-contained; talks to /billing pay-config + QR endpoints).
import PaymentsTab from "@/components/admin/PaymentsTab";

export default function OwnerPaymentsPage() {
  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <span className="eyebrow">Platform Owner</span>
        <h1 className="big-num" style={{ fontSize: 34, marginTop: 6 }}>Payments & QR</h1>
      </div>
      <PaymentsTab />
    </>
  );
}
