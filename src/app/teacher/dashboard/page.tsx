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
import { Reveal, Stagger, StaggerItem } from "@/components/ui/Motion";
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
      pending: "bg-gold-soft text-gold-ink",
      accepted: "bg-mint-soft text-mint-ink",
      scheduled: "bg-mint-soft text-mint-ink",
      completed: "bg-ink text-paper",
      cancelled: "bg-surface-soft text-ink-muted",
      declined: "bg-crimson-soft text-crimson-ink",
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
      <div className="min-h-screen bg-paper p-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="h-9 w-72 rounded bg-surface-soft animate-pulse" />
          <div className="h-36 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper px-4 md:px-8 py-8 text-ink">
      <div className="max-w-6xl mx-auto space-y-7">
        <Reveal>
          <section className="ed-card p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-ink">
                  Teacher <span className="italic text-crimson">Dashboard</span>
                </h1>
                <p className="text-ink-muted mt-1">Manage 1:1 requests, schedule sessions, and chat with students.</p>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border border-line text-sm text-ink-muted">
                  <UserCircle2 size={16} />
                  {profile?.full_name || user?.primaryEmailAddress?.emailAddress || "Teacher"}
                </div>
                <button
                  onClick={() => void signOut()}
                  className="ed-btn-ink px-4 py-2.5"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </div>

            <div className="mt-5 grid sm:grid-cols-3 gap-3">
              <div className="ed-card-soft p-4">
                <p className="ed-label">Pending Requests</p>
                <p className="font-display text-2xl font-semibold text-ink mt-1">{pendingMeetings.length}</p>
              </div>
              <div className="ed-card-soft p-4">
                <p className="ed-label">Scheduled</p>
                <p className="font-display text-2xl font-semibold text-ink mt-1">{scheduledMeetings.length}</p>
              </div>
              <div className="ed-card-soft p-4">
                <p className="ed-label">Active Chats</p>
                <p className="font-display text-2xl font-semibold text-ink mt-1">{chatEligibleConversations.length}</p>
              </div>
            </div>
          </section>
        </Reveal>

        {error && <p className="text-sm text-crimson">{error}</p>}
        {success && <p className="text-sm text-mint-ink">{success}</p>}

        <Reveal delay={0.05}>
        <section className="ed-card p-6 md:p-8">
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink mb-4">Incoming <span className="italic text-crimson">Requests</span></h2>
          <Stagger className="space-y-4">
            {pendingMeetings.length === 0 && <p className="text-sm text-ink-faint">No pending requests.</p>}
            {pendingMeetings.map((meeting) => (
              <StaggerItem key={meeting.id}>
              <article className="ed-card-soft p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-ink">
                      {meeting.student_profile?.full_name || meeting.student_profile?.email || "Student"}
                    </h3>
                    <p className="text-sm text-ink-muted mt-1">{meeting.agenda}</p>
                    {meeting.note_from_student && <p className="text-xs text-ink-faint mt-2">{meeting.note_from_student}</p>}
                  </div>
                  <button
                    onClick={() => void handleOpenChat(meeting.student_clerk_id)}
                    className="ed-btn-ghost px-3 py-2"
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
                    <label className="ed-label">Start</label>
                    <input
                      name="start_time"
                      type="datetime-local"
                      defaultValue={meeting.start_time ? meeting.start_time.slice(0, 16) : ""}
                      className="ed-input mt-1 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="ed-label">End</label>
                    <input
                      name="end_time"
                      type="datetime-local"
                      defaultValue={meeting.end_time ? meeting.end_time.slice(0, 16) : ""}
                      className="ed-input mt-1 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="ed-label">Meeting Link</label>
                    <input
                      name="meeting_link"
                      type="url"
                      defaultValue={meeting.meeting_link || ""}
                      placeholder="https://meet.google.com/..."
                      className="ed-input mt-1 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingMeetingId === meeting.id}
                    className="ed-btn-primary h-10 px-4"
                  >
                    {savingMeetingId === meeting.id ? "Saving..." : "Schedule"}
                  </button>
                </form>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => void handleStatusOnly(meeting.id, "accepted")}
                    disabled={savingMeetingId === meeting.id}
                    className="inline-flex items-center gap-2 rounded-full border border-mint/30 bg-mint-soft px-3 py-2 text-xs font-bold text-mint-ink disabled:opacity-60"
                  >
                    <CheckCircle2 size={14} />
                    Mark Accepted
                  </button>
                  <button
                    onClick={() => void handleStatusOnly(meeting.id, "declined")}
                    disabled={savingMeetingId === meeting.id}
                    className="inline-flex items-center gap-2 rounded-full border border-crimson/30 bg-crimson-soft px-3 py-2 text-xs font-bold text-crimson-ink disabled:opacity-60"
                  >
                    <XCircle size={14} />
                    Decline
                  </button>
                  <button
                    onClick={() => void handleStatusOnly(meeting.id, "cancelled")}
                    disabled={savingMeetingId === meeting.id}
                    className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-soft px-3 py-2 text-xs font-bold text-gold-ink disabled:opacity-60"
                  >
                    <XCircle size={14} />
                    Abort
                  </button>
                  <button
                    onClick={() => void handleDeleteMeeting(meeting.id)}
                    disabled={savingMeetingId === meeting.id}
                    className="inline-flex items-center gap-2 rounded-full border border-crimson/30 bg-crimson-soft px-3 py-2 text-xs font-bold text-crimson-ink disabled:opacity-60"
                  >
                    <XCircle size={14} />
                    Delete
                  </button>
                </div>
              </article>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
        </Reveal>

        <Reveal delay={0.1}>
        <section className="ed-card p-6 md:p-8">
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink mb-4">Scheduled &amp; <span className="italic text-crimson">Previous</span></h2>
          <Stagger className="space-y-3">
            {meetings.length === 0 && <p className="text-sm text-ink-faint">No meetings yet.</p>}
            {meetings.map((meeting) => (
              <StaggerItem key={meeting.id}>
              <div className="ed-card-soft p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {meeting.student_profile?.full_name || meeting.student_profile?.email || "Student"}
                    </p>
                    <p className="text-sm text-ink-muted">{meeting.agenda}</p>
                  </div>
                  <p className={`text-xs px-3 py-1 rounded-full font-bold capitalize ${statusTone[meeting.status as keyof typeof statusTone] || statusTone.pending}`}>{meeting.status}</p>
                </div>
                <div className="mt-2 text-xs text-ink-faint grid sm:grid-cols-2 gap-1">
                  <p className="inline-flex items-center gap-1"><Clock3 size={12} /> Requested: {new Date(meeting.requested_at).toLocaleString()}</p>
                  {meeting.start_time && meeting.end_time ? (
                    <p className="inline-flex items-center gap-1"><Calendar size={12} /> {new Date(meeting.start_time).toLocaleString()} - {new Date(meeting.end_time).toLocaleTimeString()}</p>
                  ) : (
                    <p className="inline-flex items-center gap-1"><XCircle size={12} /> Time not finalized</p>
                  )}
                </div>
                {meeting.meeting_link && (
                  <a href={meeting.meeting_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-2 text-sm font-bold text-crimson hover:text-crimson-deep">
                    <CheckCircle2 size={14} />
                    Join Meeting
                  </a>
                )}
              </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
        </Reveal>

        <Reveal delay={0.15}>
        <section className="ed-card p-6 md:p-8">
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink mb-4">Chat <span className="italic text-crimson">Inbox</span></h2>
          <Stagger className="space-y-3">
            {chatEligibleConversations.length === 0 && <p className="text-sm text-ink-faint">No conversations yet. Students can start chats after requesting a 1:1 meeting.</p>}
            {chatEligibleConversations.map((conversation) => {
              const studentName = conversation.student_profile?.full_name || conversation.student_profile?.email || "Student";
              return (
                <StaggerItem key={conversation.id}>
                <div className="ed-card-soft p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{studentName}</p>
                    <p className="text-xs text-ink-faint">Last activity: {new Date(conversation.updated_at).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => setSelectedConversation(conversation)}
                    className="ed-btn-ghost px-3 py-2"
                  >
                    <MessageCircle size={14} />
                    Open Chat
                  </button>
                </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>
        </Reveal>
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
