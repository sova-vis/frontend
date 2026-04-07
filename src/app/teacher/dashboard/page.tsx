"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Calendar, CheckCircle2, Clock3, MessageCircle, XCircle, LogOut, UserCircle2 } from "lucide-react";
import {
  MentoringConversation,
  MentoringMeeting,
  deleteMeeting,
  ensureConversation,
  getConversations,
  getMeetings,
  updateMeeting,
} from "@/lib/api";
import ChatModal from "@/components/mentoring/ChatModal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useClerkAuth } from "@/lib/useClerkAuth";

export default function TeacherDashboard() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { profile, signOut } = useClerkAuth();

  const [loading, setLoading] = useState(true);
  const [savingMeetingId, setSavingMeetingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [meetings, setMeetings] = useState<MentoringMeeting[]>([]);
  const [conversations, setConversations] = useState<MentoringConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<MentoringConversation | null>(null);

  const statusTone = useMemo(
    () => ({
      pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      accepted: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      scheduled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      completed: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
      cancelled: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      declined: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    }),
    []
  );

  const refreshData = async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Missing auth token");
    }

    const [meetingRows, conversationRows] = await Promise.all([
      getMeetings(token),
      getConversations(token),
    ]);

    setMeetings(meetingRows);
    setConversations(conversationRows);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        await refreshData();
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load meetings");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenChat = async (studentClerkId: string) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      let conversation = conversations.find((row) => row.student_clerk_id === studentClerkId) || null;
      if (!conversation) {
        conversation = await ensureConversation(token, studentClerkId);
        setConversations((current) => [conversation!, ...current]);
      }

      setSelectedConversation(conversation);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to open chat");
    }
  };

  const handleScheduleMeeting = async (meeting: MentoringMeeting, formData: FormData) => {
    const start = String(formData.get("start_time") || "");
    const end = String(formData.get("end_time") || "");
    const link = String(formData.get("meeting_link") || "");

    if (!start || !end) {
      setError("Start and end time are required");
      return;
    }

    setSavingMeetingId(meeting.id);
    setError("");
    setSuccess("");

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      await updateMeeting(token, meeting.id, {
        status: "scheduled",
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        meeting_link: link || undefined,
        provider: "google_meet",
      });

      await refreshData();
      setSuccess("Meeting scheduled successfully");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to schedule meeting");
    } finally {
      setSavingMeetingId(null);
    }
  };

  const handleStatusOnly = async (meetingId: string, status: string) => {
    setSavingMeetingId(meetingId);
    setError("");
    setSuccess("");

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      await updateMeeting(token, meetingId, { status });
      await refreshData();
      setSuccess(`Meeting ${status}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update meeting status");
    } finally {
      setSavingMeetingId(null);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    const confirmed = window.confirm("Delete this meeting record?");
    if (!confirmed) return;

    setSavingMeetingId(meetingId);
    setError("");
    setSuccess("");

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      await deleteMeeting(token, meetingId);
      await refreshData();
      setSuccess("Meeting deleted");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete meeting");
    } finally {
      setSavingMeetingId(null);
    }
  };

  const pendingMeetings = meetings.filter((meeting) => meeting.status === "pending" || meeting.status === "accepted");
  const scheduledMeetings = meetings.filter((meeting) => meeting.status === "scheduled");
  const eligibleStudentIds = new Set(
    meetings
      .filter((meeting) => ["pending", "accepted", "scheduled", "completed"].includes(meeting.status))
      .map((meeting) => meeting.student_clerk_id)
  );
  const chatEligibleConversations = conversations.filter((conversation) => eligibleStudentIds.has(conversation.student_clerk_id));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white dark:from-slate-950 dark:to-black p-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="h-9 w-72 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-36 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white dark:from-slate-950 dark:to-black px-4 md:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-7">
        <section className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100">Teacher Dashboard</h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">Manage 1:1 requests, schedule sessions, and chat with students.</p>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200">
                <UserCircle2 size={16} />
                {profile?.full_name || user?.primaryEmailAddress?.emailAddress || "Teacher"}
              </div>
              <button
                onClick={() => void signOut()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 text-sm font-semibold"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          </div>

          <div className="mt-5 grid sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800">
              <p className="text-xs uppercase font-semibold text-slate-500">Pending Requests</p>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{pendingMeetings.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800">
              <p className="text-xs uppercase font-semibold text-slate-500">Scheduled</p>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{scheduledMeetings.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800">
              <p className="text-xs uppercase font-semibold text-slate-500">Active Chats</p>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{chatEligibleConversations.length}</p>
            </div>
          </div>
        </section>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>}

        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-4">Incoming Meeting Requests</h2>
          <div className="space-y-4">
            {pendingMeetings.length === 0 && <p className="text-sm text-slate-500">No pending requests.</p>}
            {pendingMeetings.map((meeting) => (
              <article key={meeting.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/70 dark:bg-slate-800/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {meeting.student_profile?.full_name || meeting.student_profile?.email || "Student"}
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{meeting.agenda}</p>
                    {meeting.note_from_student && <p className="text-xs text-slate-500 mt-2">{meeting.note_from_student}</p>}
                  </div>
                  <button
                    onClick={() => void handleOpenChat(meeting.student_clerk_id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <MessageCircle size={14} />
                    Chat
                  </button>
                </div>

                <form
                  className="mt-4 grid md:grid-cols-4 gap-3 items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    void handleScheduleMeeting(meeting, formData);
                  }}
                >
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Start</label>
                    <input
                      name="start_time"
                      type="datetime-local"
                      defaultValue={meeting.start_time ? meeting.start_time.slice(0, 16) : ""}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">End</label>
                    <input
                      name="end_time"
                      type="datetime-local"
                      defaultValue={meeting.end_time ? meeting.end_time.slice(0, 16) : ""}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Meeting Link</label>
                    <input
                      name="meeting_link"
                      type="url"
                      defaultValue={meeting.meeting_link || ""}
                      placeholder="https://meet.google.com/..."
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingMeetingId === meeting.id}
                    className="h-10 rounded-xl bg-slate-900 dark:bg-slate-100 px-4 text-sm font-semibold text-white dark:text-slate-900 disabled:opacity-60"
                  >
                    {savingMeetingId === meeting.id ? "Saving..." : "Schedule"}
                  </button>
                </form>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => void handleStatusOnly(meeting.id, "accepted")}
                    disabled={savingMeetingId === meeting.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 dark:bg-blue-950 dark:text-blue-300 px-3 py-2 text-xs font-semibold text-blue-700"
                  >
                    <CheckCircle2 size={14} />
                    Mark Accepted
                  </button>
                  <button
                    onClick={() => void handleStatusOnly(meeting.id, "declined")}
                    disabled={savingMeetingId === meeting.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950 dark:text-rose-300 px-3 py-2 text-xs font-semibold text-rose-700"
                  >
                    <XCircle size={14} />
                    Decline
                  </button>
                  <button
                    onClick={() => void handleStatusOnly(meeting.id, "cancelled")}
                    disabled={savingMeetingId === meeting.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 px-3 py-2 text-xs font-semibold text-amber-700"
                  >
                    <XCircle size={14} />
                    Abort
                  </button>
                  <button
                    onClick={() => void handleDeleteMeeting(meeting.id)}
                    disabled={savingMeetingId === meeting.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950 dark:text-rose-300 px-3 py-2 text-xs font-semibold text-rose-700"
                  >
                    <XCircle size={14} />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-4">Scheduled and Previous Meetings</h2>
          <div className="space-y-3">
            {meetings.length === 0 && <p className="text-sm text-slate-500">No meetings yet.</p>}
            {meetings.map((meeting) => (
              <div key={meeting.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/70 dark:bg-slate-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {meeting.student_profile?.full_name || meeting.student_profile?.email || "Student"}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{meeting.agenda}</p>
                  </div>
                  <p className={`text-xs px-3 py-1 rounded-full font-semibold ${statusTone[meeting.status as keyof typeof statusTone] || statusTone.pending}`}>{meeting.status}</p>
                </div>
                <div className="mt-2 text-xs text-slate-500 grid sm:grid-cols-2 gap-1">
                  <p className="inline-flex items-center gap-1"><Clock3 size={12} /> Requested: {new Date(meeting.requested_at).toLocaleString()}</p>
                  {meeting.start_time && meeting.end_time ? (
                    <p className="inline-flex items-center gap-1"><Calendar size={12} /> {new Date(meeting.start_time).toLocaleString()} - {new Date(meeting.end_time).toLocaleTimeString()}</p>
                  ) : (
                    <p className="inline-flex items-center gap-1"><XCircle size={12} /> Time not finalized</p>
                  )}
                </div>
                {meeting.meeting_link && (
                  <a href={meeting.meeting_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                    <CheckCircle2 size={14} />
                    Join Meeting
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-4">Chat Inbox</h2>
          <div className="space-y-3">
            {chatEligibleConversations.length === 0 && <p className="text-sm text-slate-500">No conversations yet. Students can start chats after requesting a 1:1 meeting.</p>}
            {chatEligibleConversations.map((conversation) => {
              const studentName = conversation.student_profile?.full_name || conversation.student_profile?.email || "Student";
              return (
                <div key={conversation.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{studentName}</p>
                    <p className="text-xs text-slate-500">Last activity: {new Date(conversation.updated_at).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => setSelectedConversation(conversation)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <MessageCircle size={14} />
                    Open Chat
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {selectedConversation && user && (
        <ChatModal
          isOpen={!!selectedConversation}
          currentClerkId={user.id}
          conversation={selectedConversation}
          onClose={() => setSelectedConversation(null)}
        />
      )}
    </div>
  );
}
