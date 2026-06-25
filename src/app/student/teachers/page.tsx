"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  Calendar,
  MessageCircle,
  Users,
  CheckCircle2,
  Clock3,
  XCircle,
} from "lucide-react";
import {
  MentoringConversation,
  MentoringMeeting,
  MentoringTeacher,
  deleteMeeting,
  ensureConversation,
  getConversations,
  getMeetings,
  getTeachers,
  requestMeeting,
  updateMeeting,
} from "@/lib/api";
import ChatModal from "@/components/mentoring/ChatModal";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/Motion";

interface RequestFormState {
  teacher_clerk_id: string;
  agenda: string;
  note_from_student: string;
  preferred_start_time: string;
  preferred_end_time: string;
}

const statusStyle: Record<string, string> = {
  pending: "bg-gold-soft text-gold-ink",
  accepted: "bg-mint-soft text-mint-ink",
  scheduled: "bg-mint-soft text-mint-ink",
  completed: "bg-ink text-paper",
  declined: "bg-crimson-soft text-crimson-ink",
  cancelled: "bg-surface-soft text-ink-muted",
};

export default function StudentTeachersPage() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [teachers, setTeachers] = useState<MentoringTeacher[]>([]);
  const [meetings, setMeetings] = useState<MentoringMeeting[]>([]);
  const [conversations, setConversations] = useState<MentoringConversation[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<MentoringConversation | null>(null);
  const [selectedTeacherClerkId, setSelectedTeacherClerkId] = useState("");

  const [form, setForm] = useState<RequestFormState>({
    teacher_clerk_id: "",
    agenda: "",
    note_from_student: "",
    preferred_start_time: "",
    preferred_end_time: "",
  });

  const conversationByTeacher = useMemo(() => {
    const map = new Map<string, MentoringConversation>();
    conversations.forEach((conversation) => {
      map.set(conversation.teacher_clerk_id, conversation);
    });
    return map;
  }, [conversations]);

  const eligibleTeacherIds = useMemo(() => {
    const ids = new Set<string>();
    meetings.forEach((meeting) => {
      if (["pending", "accepted", "scheduled", "completed"].includes(meeting.status)) {
        ids.add(meeting.teacher_clerk_id);
      }
    });
    return ids;
  }, [meetings]);

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => teacher.clerk_id === selectedTeacherClerkId) || null,
    [teachers, selectedTeacherClerkId]
  );

  const refreshData = async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Missing auth token");
    }

    const [teacherRows, meetingRows, conversationRows] = await Promise.all([
      getTeachers(token),
      getMeetings(token),
      getConversations(token),
    ]);

    setTeachers(teacherRows);
    setMeetings(meetingRows);
    setConversations(conversationRows);

  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        await refreshData();
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load teacher support data");
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

  useEffect(() => {
    if (teachers.length === 0) {
      setSelectedTeacherClerkId("");
      return;
    }

    const exists = teachers.some((teacher) => teacher.clerk_id === selectedTeacherClerkId);
    if (!selectedTeacherClerkId || !exists) {
      setSelectedTeacherClerkId(teachers[0].clerk_id);
    }
  }, [teachers, selectedTeacherClerkId]);

  const handleMeetingRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      if (!form.preferred_start_time || !form.preferred_end_time) {
        throw new Error("Preferred start and end time are required");
      }

      if (new Date(form.preferred_start_time) >= new Date(form.preferred_end_time)) {
        throw new Error("Preferred end time must be after preferred start time");
      }

      await requestMeeting(token, {
        teacher_clerk_id: form.teacher_clerk_id,
        agenda: form.agenda,
        note_from_student: form.note_from_student || undefined,
        preferred_start_time: form.preferred_start_time
          ? new Date(form.preferred_start_time).toISOString()
          : undefined,
        preferred_end_time: form.preferred_end_time
          ? new Date(form.preferred_end_time).toISOString()
          : undefined,
      });

      await refreshData();
      setSuccess("Meeting request submitted successfully.");
      setForm((current) => ({
        ...current,
        agenda: "",
        note_from_student: "",
        preferred_start_time: "",
        preferred_end_time: "",
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit meeting request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChat = async (teacherClerkId: string) => {
    if (!eligibleTeacherIds.has(teacherClerkId)) {
      setError("Chat opens only after you request a 1:1 meeting with this teacher.");
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      let conversation = conversationByTeacher.get(teacherClerkId) || null;
      if (!conversation) {
        conversation = await ensureConversation(token, teacherClerkId);
        setConversations((current) => [conversation!, ...current]);
      }

      setSelectedConversation(conversation);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to open chat");
    }
  };

  const handleAbortMeeting = async (meetingId: string) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Missing auth token");
      }
      await updateMeeting(token, meetingId, { status: "cancelled" });
      await refreshData();
      setSuccess("Meeting request aborted.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to abort meeting");
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    const confirmed = window.confirm("Delete this meeting record?");
    if (!confirmed) return;

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Missing auth token");
      }
      await deleteMeeting(token, meetingId);
      await refreshData();
      setSuccess("Meeting deleted.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete meeting");
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="h-8 w-72 bg-surface-soft rounded animate-pulse mb-4" />
        <div className="h-28 bg-surface-soft rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-14 min-h-full bg-transparent">
      <div className="max-w-6xl mx-auto space-y-8">
        <Reveal>
        <section className="ed-card p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-ink">
                Teacher <span className="italic text-crimson">Support</span>
              </h1>
              <p className="text-ink-muted">Request one-to-one meetings and chat with your teachers.</p>
            </div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted">
              <Users size={16} />
              {teachers.length} teachers available
            </div>
          </div>

          {error && <p className="mb-3 text-sm text-crimson">{error}</p>}
          {success && <p className="mb-3 text-sm text-mint-ink">{success}</p>}

          <form onSubmit={handleMeetingRequest} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-ink-muted">Teacher</label>
              <select
                value={form.teacher_clerk_id}
                onChange={(event) => {
                  const nextTeacherId = event.target.value;
                  setForm((current) => ({ ...current, teacher_clerk_id: nextTeacherId }));
                  setSelectedTeacherClerkId(nextTeacherId);
                }}
                className="ed-input mt-1 text-sm"
                required
              >
                <option value="" disabled>
                  Select a teacher
                </option>
                {teachers.map((teacher) => (
                  <option value={teacher.clerk_id} key={teacher.clerk_id}>
                    {teacher.full_name || teacher.email || "Teacher"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-ink-muted">Agenda</label>
              <input
                required
                value={form.agenda}
                onChange={(event) => setForm((current) => ({ ...current, agenda: event.target.value }))}
                placeholder="Discuss algebra problem solving"
                className="ed-input mt-1 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-ink-muted">Preferred Start</label>
              <input
                type="datetime-local"
                value={form.preferred_start_time}
                onChange={(event) => setForm((current) => ({ ...current, preferred_start_time: event.target.value }))}
                className="ed-input mt-1 text-sm"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-ink-muted">Preferred End</label>
              <input
                type="datetime-local"
                value={form.preferred_end_time}
                onChange={(event) => setForm((current) => ({ ...current, preferred_end_time: event.target.value }))}
                className="ed-input mt-1 text-sm"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-ink-muted">Notes for Teacher</label>
              <textarea
                value={form.note_from_student}
                onChange={(event) => setForm((current) => ({ ...current, note_from_student: event.target.value }))}
                rows={3}
                className="ed-input mt-1 text-sm"
                placeholder="Mention chapter, assignment details, or exam target"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting || teachers.length === 0}
                className="ed-btn-ink disabled:opacity-60"
              >
                <Calendar size={15} />
                {submitting ? "Submitting..." : "Request 1:1 Meeting"}
              </button>
            </div>
          </form>
        </section>
        </Reveal>

        <Reveal delay={0.1}>
        <section className="grid lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 ed-card p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink mb-3">Teachers List</h2>
            <Stagger className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
              {teachers.map((teacher) => {
                const isActive = teacher.clerk_id === selectedTeacherClerkId;
                return (
                  <StaggerItem key={teacher.clerk_id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTeacherClerkId(teacher.clerk_id);
                      setForm((current) => ({ ...current, teacher_clerk_id: teacher.clerk_id }));
                    }}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                      isActive
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-surface text-ink hover:bg-surface-soft"
                    }`}
                  >
                    <p className="text-sm font-semibold">{teacher.full_name || "Teacher"}</p>
                    <p className={`text-xs ${isActive ? "text-paper/70" : "text-ink-faint"}`}>{teacher.email || "No email"}</p>
                  </button>
                  </StaggerItem>
                );
              })}
              {teachers.length === 0 && <p className="text-sm text-ink-faint">No teachers available.</p>}
            </Stagger>
          </div>

          <div className="lg:col-span-8 ed-card p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink mb-3">Teacher Details</h2>
            {!selectedTeacher ? (
              <p className="text-sm text-ink-faint">Select a teacher to view details.</p>
            ) : (
              <>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-display text-xl font-semibold tracking-tight text-ink">{selectedTeacher.full_name || "Teacher"}</h3>
                    <p className="text-sm text-ink-faint">{selectedTeacher.email || "No email"}</p>
                    {selectedTeacher.headline && <p className="text-sm text-ink-muted mt-2">{selectedTeacher.headline}</p>}
                  </div>
                  {eligibleTeacherIds.has(selectedTeacher.clerk_id) ? (
                    <button
                      onClick={() => void handleOpenChat(selectedTeacher.clerk_id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink-muted hover:bg-surface-soft"
                    >
                      <MessageCircle size={14} />
                      Chat
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-soft px-3 py-2 text-xs font-semibold text-ink-faint">
                      Request meeting to chat
                    </span>
                  )}
                </div>

                {selectedTeacher.bio && <p className="mt-3 text-sm text-ink-muted">{selectedTeacher.bio}</p>}
                {selectedTeacher.subjects.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTeacher.subjects.map((subject) => (
                      <span key={subject} className="text-xs rounded-full bg-surface-soft px-3 py-1 text-ink-muted">
                        {subject}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
        </Reveal>

        <Reveal delay={0.1}>
        <section className="ed-card p-6 md:p-8">
          <h3 className="font-display text-xl font-semibold tracking-tight text-ink mb-4">My Meeting Records</h3>
          <div className="space-y-3">
            {meetings.length === 0 && <p className="text-sm text-ink-faint">No meeting requests yet.</p>}
            {meetings.map((meeting) => (
              <div key={meeting.id} className="rounded-2xl border border-line bg-surface p-4 transition hover:shadow-card-hover">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {meeting.teacher_profile?.full_name || meeting.teacher_profile?.email || "Teacher"}
                    </p>
                    <p className="text-sm text-ink-muted">{meeting.agenda}</p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyle[meeting.status] || statusStyle.pending}`}>
                    {meeting.status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-ink-faint grid sm:grid-cols-2 gap-1">
                  <p className="inline-flex items-center gap-1"><Clock3 size={12} /> Requested: {new Date(meeting.requested_at).toLocaleString()}</p>
                  {meeting.start_time && meeting.end_time ? (
                    <p className="inline-flex items-center gap-1"><Calendar size={12} /> {new Date(meeting.start_time).toLocaleString()} - {new Date(meeting.end_time).toLocaleTimeString()}</p>
                  ) : (
                    <p className="inline-flex items-center gap-1"><XCircle size={12} /> Time pending confirmation</p>
                  )}
                </div>
                {meeting.meeting_link && (
                  <a
                    href={meeting.meeting_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-crimson"
                  >
                    <CheckCircle2 size={14} />
                    Join Meeting Link
                  </a>
                )}
                {meeting.status !== "scheduled" && meeting.status !== "completed" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {meeting.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => void handleAbortMeeting(meeting.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold-soft px-3 py-2 text-xs font-semibold text-gold-ink"
                      >
                        Abort
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDeleteMeeting(meeting.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-crimson/30 bg-crimson-soft px-3 py-2 text-xs font-semibold text-crimson-ink"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
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
