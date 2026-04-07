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

interface RequestFormState {
  teacher_clerk_id: string;
  agenda: string;
  note_from_student: string;
  preferred_start_time: string;
  preferred_end_time: string;
}

const statusStyle: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-blue-100 text-blue-700",
  scheduled: "bg-emerald-100 text-emerald-700",
  completed: "bg-teal-100 text-teal-700",
  declined: "bg-rose-100 text-rose-700",
  cancelled: "bg-gray-200 text-gray-700",
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
        <div className="h-8 w-72 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-28 bg-gray-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-14 min-h-full">
      <div className="max-w-6xl mx-auto space-y-8">
        <section className="rounded-3xl bg-white border border-gray-200 shadow-sm p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-gray-900">Teacher Support</h1>
              <p className="text-gray-600">Request one-to-one meetings and chat with your teachers.</p>
            </div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600">
              <Users size={16} />
              {teachers.length} teachers available
            </div>
          </div>

          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          {success && <p className="mb-3 text-sm text-emerald-700">{success}</p>}

          <form onSubmit={handleMeetingRequest} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Teacher</label>
              <select
                value={form.teacher_clerk_id}
                onChange={(event) => setForm((current) => ({ ...current, teacher_clerk_id: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
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
              <label className="text-sm font-semibold text-gray-700">Agenda</label>
              <input
                required
                value={form.agenda}
                onChange={(event) => setForm((current) => ({ ...current, agenda: event.target.value }))}
                placeholder="Discuss algebra problem solving"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Preferred Start</label>
              <input
                type="datetime-local"
                value={form.preferred_start_time}
                onChange={(event) => setForm((current) => ({ ...current, preferred_start_time: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Preferred End</label>
              <input
                type="datetime-local"
                value={form.preferred_end_time}
                onChange={(event) => setForm((current) => ({ ...current, preferred_end_time: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-gray-700">Notes for Teacher</label>
              <textarea
                value={form.note_from_student}
                onChange={(event) => setForm((current) => ({ ...current, note_from_student: event.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                placeholder="Mention chapter, assignment details, or exam target"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting || teachers.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Calendar size={15} />
                {submitting ? "Submitting..." : "Request 1:1 Meeting"}
              </button>
            </div>
          </form>
        </section>

        <section className="grid lg:grid-cols-2 gap-5">
          {teachers.map((teacher) => (
            <article key={teacher.clerk_id} className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{teacher.full_name || "Teacher"}</h2>
                  <p className="text-sm text-gray-500">{teacher.email || "No email"}</p>
                  {teacher.headline && <p className="text-sm text-gray-700 mt-2">{teacher.headline}</p>}
                </div>
                <button
                  onClick={() => void handleOpenChat(teacher.clerk_id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <MessageCircle size={14} />
                  Chat
                </button>
              </div>
              {teacher.bio && <p className="mt-3 text-sm text-gray-600 line-clamp-3">{teacher.bio}</p>}
              {teacher.subjects.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {teacher.subjects.map((subject) => (
                    <span key={subject} className="text-xs rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                      {subject}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>

        <section className="rounded-3xl bg-white border border-gray-200 shadow-sm p-6 md:p-8">
          <h3 className="text-xl font-black text-gray-900 mb-4">My Meeting Records</h3>
          <div className="space-y-3">
            {meetings.length === 0 && <p className="text-sm text-gray-500">No meeting requests yet.</p>}
            {meetings.map((meeting) => (
              <div key={meeting.id} className="rounded-2xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {meeting.teacher_profile?.full_name || meeting.teacher_profile?.email || "Teacher"}
                    </p>
                    <p className="text-sm text-gray-600">{meeting.agenda}</p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyle[meeting.status] || statusStyle.pending}`}>
                    {meeting.status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500 grid sm:grid-cols-2 gap-1">
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
                    className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-blue-700"
                  >
                    <CheckCircle2 size={14} />
                    Join Meeting Link
                  </a>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {meeting.status !== "cancelled" && meeting.status !== "completed" && (
                    <button
                      type="button"
                      onClick={() => void handleAbortMeeting(meeting.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"
                    >
                      Abort
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDeleteMeeting(meeting.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
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
