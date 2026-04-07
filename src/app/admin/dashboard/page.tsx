"use client";

import { useEffect, useMemo, useState } from "react";
import { UserPlus, Shield, Check, AlertCircle, LogOut, Users, UserCog } from "lucide-react";
import {
  AdminUserRecord,
  MentoringMeeting,
  MentoringTeacher,
  apiCall,
  getAdminMeetings,
  getAdminTeachers,
  getAdminUsers,
  updateAdminTeacherProfile,
} from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function AdminDashboard() {
  type AdminView = "overview" | "teacher-accounts" | "users" | "meetings";
  const { getToken } = useAuth();
  const { signOut } = useClerkAuth();
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [teacherEdit, setTeacherEdit] = useState({
    clerk_id: "",
    headline: "",
    bio: "",
    subjects: "",
    meeting_provider: "google_meet",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [teachers, setTeachers] = useState<MentoringTeacher[]>([]);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [meetings, setMeetings] = useState<MentoringMeeting[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeView, setActiveView] = useState<AdminView>("overview");

  const students = useMemo(() => users.filter((user) => user.role === "student"), [users]);
  const confirmedMeetings = useMemo(
    () => meetings.filter((meeting) => ["accepted", "scheduled", "completed"].includes(meeting.status)),
    [meetings]
  );

  const usersByRole = useMemo(
    () => ({
      admin: users.filter((user) => user.role === "admin").length,
      teacher: users.filter((user) => user.role === "teacher").length,
      student: users.filter((user) => user.role === "student").length,
    }),
    [users]
  );

  const refreshData = async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    const [teacherRows, userRows, meetingRows] = await Promise.all([
      getAdminTeachers(token),
      getAdminUsers(token),
      getAdminMeetings(token),
    ]);

    setTeachers(teacherRows);
    setUsers(userRows as AdminUserRecord[]);
    setMeetings(meetingRows);
  };

  const generateStrongPassword = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
    let result = "";
    for (let i = 0; i < 18; i += 1) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    setFormData((current) => ({ ...current, password: result }));
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoadingData(true);
        await refreshData();
      } catch (err: unknown) {
        if (!cancelled) {
          setStatus("error");
          setMessage(err instanceof Error ? err.message : "Failed to load admin data");
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Not authenticated");
      }

      const res = await apiCall("/admin/add-teacher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to create teacher");

      setStatus("success");
      setMessage("Teacher account created successfully!");
      setFormData({ name: "", email: "", password: "" });
      await refreshData();
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message);
    }
  };

  const handleTeacherProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      await updateAdminTeacherProfile(token, teacherEdit.clerk_id, {
        headline: teacherEdit.headline,
        bio: teacherEdit.bio,
        meeting_provider: teacherEdit.meeting_provider,
        subjects: teacherEdit.subjects
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });

      await refreshData();
      setStatus("success");
      setMessage("Teacher profile updated.");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Failed to save teacher profile");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white dark:from-slate-950 dark:to-black px-4 py-10 md:px-8">
      <div className="w-full max-w-7xl mx-auto space-y-8">
        <header className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur p-5 md:p-8 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center p-3 bg-red-100 dark:bg-red-950 rounded-2xl">
                <Shield size={30} className="text-red-600" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 font-display">Admin Control Center</h1>
                <p className="text-slate-500 dark:text-slate-400">Teachers, user profiles, and full meeting records</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={() => void signOut()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveView("overview")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold border transition-colors ${
                activeView === "overview"
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                  : "bg-white text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveView("teacher-accounts")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold border transition-colors ${
                activeView === "teacher-accounts"
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                  : "bg-white text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"
              }`}
            >
              Teacher Accounts
            </button>
            <button
              type="button"
              onClick={() => setActiveView("users")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold border transition-colors ${
                activeView === "users"
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                  : "bg-white text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"
              }`}
            >
              Users
            </button>
            <button
              type="button"
              onClick={() => setActiveView("meetings")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold border transition-colors ${
                activeView === "meetings"
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                  : "bg-white text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"
              }`}
            >
              Meetings
            </button>
          </div>
        </header>

        {activeView === "overview" && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Overview</h3>
            <p className="text-sm text-slate-500 mb-4">Quick summary of your admin workspace.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-xs uppercase text-slate-500">Total Users</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{users.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-xs uppercase text-slate-500">Teachers</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{teachers.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-xs uppercase text-slate-500">Students</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{students.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-xs uppercase text-slate-500">Confirmed Meetings</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{confirmedMeetings.length}</p>
              </div>
            </div>
          </section>
        )}

        {activeView === "teacher-accounts" && <div className="space-y-6">
          <div className="grid xl:grid-cols-2 gap-6">
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <UserPlus size={24} className="text-primary" />
                Create Teacher Account
              </h2>
              <p className="text-sm text-slate-500 mt-1">Creates Clerk user + Supabase profile + teacher role metadata.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {status === "success" && (
                <div className="p-3 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-xl flex items-center gap-2 text-sm font-medium">
                  <Check size={18} /> {message}
                </div>
              )}
              {status === "error" && (
                <div className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-2 text-sm font-medium">
                  <AlertCircle size={18} /> {message}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Teacher Name</label>
                <input
                  type="text"
                  required
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  placeholder="e.g. Sarah Williams"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Email Address</label>
                  <input
                    type="email"
                    required
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    placeholder="teacher@school.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Password</label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    placeholder="Strong password required by Clerk"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={generateStrongPassword}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                >
                  Generate Strong Password
                </button>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold disabled:opacity-60"
                >
                  {status === "loading" ? "Creating..." : "Create Teacher"}
                </button>
              </div>
            </form>
          </section>

          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1 inline-flex items-center gap-2">
              <UserCog size={20} /> Teacher Profiles
            </h3>
            <p className="text-sm text-slate-500 mb-4">Manage subjects, bio, and provider shown to students.</p>

            <form onSubmit={handleTeacherProfileSave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Teacher Account</label>
                <select
                  value={teacherEdit.clerk_id}
                  onChange={(event) => {
                    const selected = teachers.find((teacher) => teacher.clerk_id === event.target.value);
                    setTeacherEdit({
                      clerk_id: event.target.value,
                      headline: selected?.headline || "",
                      bio: selected?.bio || "",
                      subjects: (selected?.subjects || []).join(", "),
                      meeting_provider: selected?.meeting_provider || "google_meet",
                    });
                  }}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="" disabled>
                    Select teacher account
                  </option>
                  {teachers.map((teacher) => (
                    <option key={teacher.clerk_id} value={teacher.clerk_id}>
                      {teacher.full_name || teacher.email || teacher.clerk_id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Headline</label>
                <input
                  value={teacherEdit.headline}
                  onChange={(event) => setTeacherEdit((current) => ({ ...current, headline: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Bio</label>
                <textarea
                  rows={3}
                  value={teacherEdit.bio}
                  onChange={(event) => setTeacherEdit((current) => ({ ...current, bio: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Subjects (comma separated)</label>
                <input
                  value={teacherEdit.subjects}
                  onChange={(event) => setTeacherEdit((current) => ({ ...current, subjects: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Meeting Provider</label>
                <select
                  value={teacherEdit.meeting_provider}
                  onChange={(event) => setTeacherEdit((current) => ({ ...current, meeting_provider: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="google_meet">Google Meet</option>
                  <option value="zoom">Zoom</option>
                  <option value="platform_link">Platform Link</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={status === "loading" || !teacherEdit.clerk_id}
                className="w-full py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold disabled:opacity-60"
              >
                {status === "loading" ? "Saving..." : "Save Teacher Profile"}
              </button>
            </form>
          </section>
        </div>

          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Teacher Details</h3>
            <p className="text-sm text-slate-500 mb-4">Complete list of teachers and profile details.</p>
            {loadingData ? (
              <p className="text-sm text-slate-500">Loading teachers...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-200 dark:border-slate-700 text-slate-500">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Headline</th>
                      <th className="py-2 pr-3">Subjects</th>
                      <th className="py-2 pr-3">Provider</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((teacher) => (
                      <tr key={teacher.clerk_id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-3 text-slate-900 dark:text-slate-100">{teacher.full_name || "-"}</td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{teacher.email || "-"}</td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-300 max-w-[260px] truncate">{teacher.headline || "-"}</td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{teacher.subjects.length ? teacher.subjects.join(", ") : "-"}</td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{teacher.meeting_provider || "google_meet"}</td>
                        <td className="py-2 text-slate-600 dark:text-slate-300">{teacher.is_active ? "Active" : "Inactive"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>}

        {activeView === "users" && <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1 inline-flex items-center gap-2"><Users size={18} /> Students</h3>
            <p className="text-sm text-slate-500 mb-4">Student records only.</p>
            {loadingData ? (
              <p className="text-sm text-slate-500">Loading students...</p>
            ) : (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-200 dark:border-slate-700 text-slate-500">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Role</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((user) => (
                      <tr key={String(user.clerk_id || user.email || Math.random())} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-3 text-slate-900 dark:text-slate-100">{String(user.full_name || "Student")}</td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{String(user.email || "-")}</td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                            student
                          </span>
                        </td>
                        <td className="py-2 text-slate-600 dark:text-slate-300">{user.onboarding_complete ? "Onboarded" : "Pending"}</td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr>
                        <td className="py-3 text-slate-500" colSpan={4}>No students found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>}

        {activeView === "meetings" && <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">All Meeting Records</h3>
          <p className="text-sm text-slate-500 mb-4">Full history of meetings between teachers and students.</p>
          {loadingData ? (
            <p className="text-sm text-slate-500">Loading meetings...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th className="py-2 pr-3">Teacher</th>
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Agenda</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((meeting) => (
                    <tr key={meeting.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 pr-3 text-slate-900 dark:text-slate-100">{meeting.teacher_profile?.full_name || meeting.teacher_profile?.email || "-"}</td>
                      <td className="py-2 pr-3 text-slate-900 dark:text-slate-100">{meeting.student_profile?.full_name || meeting.student_profile?.email || "-"}</td>
                      <td className="py-2 pr-3 text-slate-600 dark:text-slate-300 max-w-[260px] truncate">{meeting.agenda}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{meeting.status}</span>
                      </td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">{meeting.start_time ? new Date(meeting.start_time).toLocaleString() : new Date(meeting.requested_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>}
      </div>
    </div>
  );
}
