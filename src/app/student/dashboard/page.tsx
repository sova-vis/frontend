"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  Circle,
  FileText,
  Flame,
  GraduationCap,
  LineChart,
  Pencil,
  Sparkles,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";

const weakSpots = [
  { topic: "Projectile motion", subject: "Physics", score: 44, tone: "red" },
  { topic: "Electrolysis", subject: "Chemistry", score: 38, tone: "teal" },
  { topic: "Trigonometry", subject: "Mathematics", score: 52, tone: "amber" },
  { topic: "Forces and motion", subject: "Physics", score: 55, tone: "red" },
];

const mastery = [
  ["Mathematics", 76, "#16876B"],
  ["Chemistry", 71, "#16876B"],
  ["Physics", 64, "#D9852A"],
  ["English", 66, "#D9852A"],
  ["Islamiyat", 70, "#D9852A"],
  ["Pakistan Studies", 62, "#CF5128"],
] as const;

const goals = [
  { title: "Physics 2022 Paper 1", detail: "Completed / scored 82%", done: true },
  { title: "Chemistry 2021 Paper 2", detail: "Completed / scored 74%", done: true },
  { title: "Physics 2019 MCQs", detail: "In progress / 18 of 40", done: false },
  { title: "Mathematics 2024 Paper 1", detail: "Not started", done: false },
];

const activities = [
  { icon: Check, title: "Chemistry / Atomic structure", detail: "9 of 10 correct", time: "2h ago", color: "text-[#16876B] bg-[#DBEFE8]" },
  { icon: Pencil, title: "Graded a written answer", detail: "Physics, 6 of 8 marks", time: "5h ago", color: "text-[#A8123C] bg-[#F6E1E7]" },
  { icon: Star, title: "Mastered a topic", detail: "Stoichiometry", time: "Yesterday", color: "text-[#8A4F12] bg-[#F8E7CD]" },
  { icon: FileText, title: "Finished a paper", detail: "Physics 2023 Paper 1", time: "2 days ago", color: "text-[#CF5128] bg-[#F9E2D7]" },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function scoreColor(score: number) {
  if (score < 45) return "#CF5128";
  if (score < 60) return "#D9852A";
  return "#16876B";
}

function subjectPill(tone: string) {
  if (tone === "teal") return "bg-[#DBEFE8] text-[#16876B]";
  if (tone === "amber") return "bg-[#F8E7CD] text-[#8A4F12]";
  return "bg-[#F6E1E7] text-[#A8123C]";
}

function ReadinessRing() {
  const score = 64;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * score) / 100;

  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="#FBE9CF"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="font-display text-4xl font-semibold leading-none">64%</b>
        <span className="mt-1 text-[11px] font-bold uppercase tracking-[.12em] text-white/70">Ready</span>
      </div>
    </div>
  );
}

function TrendChart() {
  const points = "10,132 64,118 118,122 172,96 226,86 280,74 334,68 388,54";

  return (
    <div className="mt-4 h-[230px] rounded-lg border border-[#1C1714]/[.08] bg-[#FAF6F0]/60 p-4">
      <svg viewBox="0 0 400 160" className="h-full w-full" preserveAspectRatio="none">
        <path d="M0 70 H400" stroke="#9A8D83" strokeDasharray="6 6" strokeWidth="1.5" opacity=".75" />
        <path d={`M${points}`} fill="none" stroke="#A8123C" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M${points} L388,160 L10,160 Z`} fill="rgba(168,18,60,.08)" />
        {points.split(" ").map((point) => {
          const [x, y] = point.split(",");
          return <circle key={point} cx={x} cy={y} r="4" fill="#A8123C" stroke="#fff" strokeWidth="2" />;
        })}
      </svg>
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useUser();
  const { profile } = useClerkAuth();
  const name = profile?.full_name || user?.firstName || "Student";

  return (
    <div className="min-h-full bg-[#FAF6F0] px-4 py-6 text-[#1C1714] md:px-8 md:py-8">
      <div className="mx-auto max-w-[1180px] space-y-5">
        <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {greeting()}, <span className="italic text-[#A8123C]">{name}</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B5F57]">
              Your dashboard is focused on paper practice, weak topics, and exam readiness.
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-lg bg-[#1C1714] px-5 py-4 text-[#FAF6F0]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#FAF6F0]/60">O Level prep</p>
              <p className="mt-1 text-xs text-[#FAF6F0]/80">Current paper cycle</p>
            </div>
            <div className="text-right">
              <p className="font-display text-3xl font-semibold leading-none">64%</p>
              <p className="mt-1 text-xs text-[#FAF6F0]/75">ready</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-[#A8123C] to-[#760B28] p-6 text-white shadow-sm">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/[.06]" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <ReadinessRing />
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-white/70">
                  <GraduationCap size={15} />
                  Exam readiness
                </div>
                <h2 className="mt-3 font-display text-3xl font-semibold">On track</h2>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-bold">
                  <TrendingUp size={15} />
                  +8% this week
                </div>
                <div className="mt-5 grid grid-cols-3 gap-5">
                  <div>
                    <b className="font-display text-2xl font-semibold">5</b>
                    <p className="text-xs text-white/70">strong subjects</p>
                  </div>
                  <div>
                    <b className="font-display text-2xl font-semibold">3</b>
                    <p className="text-xs text-white/70">need work</p>
                  </div>
                  <div>
                    <b className="font-display text-2xl font-semibold">2</b>
                    <p className="text-xs text-white/70">at risk</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-lg border border-[#1C1714]/[.09] bg-[#FFF6E9] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#D9852A] text-white">
                    <Flame size={22} />
                  </div>
                  <div>
                    <b className="font-display text-3xl font-semibold text-[#8A4F12]">12</b>
                    <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8A4F12]/70">day streak</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#8A4F12]/75">Best: 21</span>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1.5">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                  <div
                    key={`${day}-${index}`}
                    className={`flex h-8 items-center justify-center rounded-md text-[11px] font-bold ${
                      index < 5 ? "bg-[#D9852A] text-white" : index === 5 ? "border-2 border-[#8A4F12] text-[#8A4F12]" : "bg-[#D9852A]/10 text-[#8A4F12]/60"
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm font-medium text-[#8A4F12]">Practice 10 questions today to keep your streak alive.</p>
            </div>

            <div className="rounded-lg border border-[#1C1714]/[.09] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#9A8D83]">Pick up where you left off</p>
              <h3 className="mt-2 font-display text-xl font-semibold">Physics / Paper 1 / 2019</h3>
              <p className="mt-1 text-sm text-[#6B5F57]">14 of 40 questions done / Mechanics and Waves</p>
              <Link
                href="/student/paper-practice"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#A8123C] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#760B28]"
              >
                Resume paper practice <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: FileText, value: "47", label: "Papers solved", change: "+6", color: "bg-[#F6E1E7] text-[#A8123C]" },
            { icon: Pencil, value: "1,284", label: "Questions answered", change: "+142", color: "bg-[#DBEFE8] text-[#16876B]" },
            { icon: Circle, value: "71%", label: "Average accuracy", change: "+3%", color: "bg-[#F8E7CD] text-[#8A4F12]" },
            { icon: Star, value: "38/90", label: "Topics mastered", change: "+4", color: "bg-[#F9E2D7] text-[#CF5128]" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-[#1C1714]/[.09] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.color}`}>
                  <stat.icon size={18} />
                </div>
                <span className="text-xs font-bold text-[#16876B]">+ {stat.change.replace("+", "")}</span>
              </div>
              <p className="mt-4 font-display text-3xl font-semibold">{stat.value}</p>
              <p className="mt-1 text-sm text-[#6B5F57]">{stat.label}</p>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-semibold">Your weak spots</h2>
              <p className="text-sm text-[#6B5F57]">Fixing these first lifts your score the fastest.</p>
            </div>
            <Link href="/student/paper-practice" className="inline-flex items-center gap-2 text-sm font-bold text-[#A8123C]">
              Open paper practice <ArrowRight size={15} />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-lg border border-[#1C1714]/[.09] bg-white p-5 shadow-sm">
              {weakSpots.map((item, index) => (
                <div key={item.topic} className="flex flex-col gap-3 border-t border-[#1C1714]/[.08] py-4 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <div className="w-6 font-display text-lg font-semibold text-[#9A8D83]">{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{item.topic}</p>
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${subjectPill(item.tone)}`}>{item.subject}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1C1714]/[.09]">
                      <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: scoreColor(item.score) }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end">
                    <span className="w-12 text-right font-display text-lg font-semibold" style={{ color: scoreColor(item.score) }}>
                      {item.score}%
                    </span>
                    <Link
                      href="/student/paper-practice"
                      className="inline-flex items-center rounded-lg border border-[#F6E1E7] bg-white px-3 py-2 text-sm font-bold text-[#A8123C] transition hover:bg-[#F6E1E7]"
                    >
                      Practice
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-[#1C1714]/[.09] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.12em] text-[#9A8D83]">
                <LineChart size={15} />
                Accuracy trend / last 8 weeks
              </div>
              <div className="mt-3 flex gap-4 text-xs text-[#6B5F57]">
                <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-sm bg-[#A8123C]" />Your accuracy</span>
                <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-sm bg-[#9A8D83]" />Target 75%</span>
              </div>
              <TrendChart />
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-2xl font-semibold">Subject mastery</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {[mastery.slice(0, 3), mastery.slice(3)].map((group, groupIndex) => (
              <div key={groupIndex} className="rounded-lg border border-[#1C1714]/[.09] bg-white p-5 shadow-sm">
                <div className="space-y-4">
                  {group.map(([subject, score, color]) => (
                    <div key={subject} className="grid grid-cols-[130px_1fr_42px] items-center gap-3">
                      <p className="truncate text-sm font-semibold">{subject}</p>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#1C1714]/[.09]">
                        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
                      </div>
                      <p className="text-right font-display text-sm font-semibold text-[#6B5F57]">{score}%</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[#1C1714]/[.09] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.12em] text-[#9A8D83]">
              <Target size={15} />
              Paper goals / 2 of 4 done
            </div>
            <div className="my-4 h-2.5 overflow-hidden rounded-full bg-[#1C1714]/[.09]">
              <div className="h-full w-1/2 rounded-full bg-[#A8123C]" />
            </div>
            <div>
              {goals.map((goal) => (
                <div key={goal.title} className="flex items-center gap-3 border-t border-[#1C1714]/[.08] py-3 first:border-t-0">
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${goal.done ? "bg-[#16876B] text-white" : "border-2 border-[#1C1714]/20 text-transparent"}`}>
                    <Check size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{goal.title}</p>
                    <p className="text-xs text-[#9A8D83]">{goal.detail}</p>
                  </div>
                  <span className="text-[11px] font-bold text-[#9A8D83]">{goal.done ? "DONE" : "TODO"}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#1C1714]/[.09] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.12em] text-[#9A8D83]">
              <Sparkles size={15} />
              Recent activity
            </div>
            <div className="mt-3">
              {activities.map((activity) => (
                <div key={`${activity.title}-${activity.time}`} className="flex items-center gap-3 border-t border-[#1C1714]/[.08] py-3 first:border-t-0">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${activity.color}`}>
                    <activity.icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{activity.title}</p>
                    <p className="truncate text-xs text-[#6B5F57]">{activity.detail}</p>
                  </div>
                  <span className="text-xs text-[#9A8D83]">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
