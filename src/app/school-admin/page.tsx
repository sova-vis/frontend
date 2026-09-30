"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/propel/Icon";
import { CountUp, Bar } from "@/components/propel/primitives";
import { getHome, type SchoolAdminHome } from "@/lib/schoolAdmin";

export default function SchoolAdminOverview() {
  const [home, setHome] = useState<SchoolAdminHome | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { getHome().then(setHome).catch((e) => setErr(e.message)); }, []);

  if (err) return <p style={{ color: "var(--coral)" }}>{err}</p>;
  if (!home) return <div className="sk" style={{ height: 260, borderRadius: 18 }} />;

  const u = home.usage;
  const m = u.marking;
  const tPct = u.teachers_max ? Math.min(100, Math.round((u.teachers_used / u.teachers_max) * 100)) : 0;
  const sPct = u.students_max ? Math.min(100, Math.round((u.students_used / u.students_max) * 100)) : 0;

  return (
    <>
      <div style={{ marginBottom: 26 }}>
        <span className="eyebrow">School Admin</span>
        <h1 className="big-num" style={{ fontSize: 32, marginTop: 6 }}>{home.school?.name ?? "Your school"}</h1>
        <p className="muted" style={{ marginTop: 4 }}>Seats, marking usage, and your teaching staff at a glance.</p>
      </div>

      <div className="grid stagger" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        <SeatCard icon="users" tone="var(--teal)" label="Teachers" used={u.teachers_used} max={u.teachers_max} pct={tPct} />
        <SeatCard icon="graduation" tone="var(--amber)" label="Students" used={u.students_used} max={u.students_max} pct={sPct} />
        <div className="card card-pad">
          <div className="flex items-center gap-10" style={{ marginBottom: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "color-mix(in srgb, var(--purple) 14%, transparent)", color: "var(--purple)", flex: "none" }}><Icon name="chart" size={17} /></div>
            <div className="eyebrow">Marking · this {home.limits?.quota_period ?? "month"}</div>
          </div>
          <div className="stat-num"><CountUp value={m?.used ?? 0} /><span className="faint" style={{ fontSize: 16 }}>{m ? ` / ${m.quota}` : ""}</span></div>
          <div className="mt-12"><Bar value={m?.pct ?? 0} tone={m?.state === "full" ? "coral" : m?.state === "warn" ? "amber" : "teal"} height={6} /></div>
          <div className="faint mt-6" style={{ fontSize: 12 }}>question-parts marked</div>
        </div>
      </div>

      <div className="card card-pad card-hover mt-24">
        <div className="row-between wrap gap-16">
          <div className="flex items-center gap-16">
            <div style={{ width: 46, height: 46, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--crimson-soft)", color: "var(--crimson)", flex: "none" }}><Icon name="users" size={22} /></div>
            <div>
              <div className="card-title">Manage your teachers</div>
              <div className="muted" style={{ fontSize: 13.5 }}>Add staff, assign subjects and year groups, deactivate leavers.</div>
            </div>
          </div>
          <Link href="/school-admin/teachers" className="btn btn-primary">Open teachers <Icon name="arrow_right" size={16} /></Link>
        </div>
      </div>
    </>
  );
}

function SeatCard({ icon, tone, label, used, max, pct }: { icon: string; tone: string; label: string; used: number; max: number | null; pct: number }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-10" style={{ marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone, flex: "none" }}><Icon name={icon} size={17} /></div>
        <div className="eyebrow">{label}</div>
      </div>
      <div className="stat-num"><CountUp value={used} /><span className="faint" style={{ fontSize: 16 }}>{max != null ? ` / ${max}` : ""}</span></div>
      <div className="mt-12"><Bar value={pct} tone={pct >= 100 ? "coral" : pct >= 80 ? "amber" : "teal"} height={6} /></div>
      <div className="faint mt-6" style={{ fontSize: 12 }}>{max != null ? `${max - used} seat${max - used === 1 ? "" : "s"} left` : "no cap set"}</div>
    </div>
  );
}
