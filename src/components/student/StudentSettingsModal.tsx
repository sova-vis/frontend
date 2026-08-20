"use client";

import { useEffect, useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, ClipboardCheck, LogOut, Moon, Save, Settings as SettingsIcon, Sun, Trash2, User, X } from "lucide-react";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { usePaperLevel } from "@/lib/paperLevel";
import { resolveName } from "@/lib/displayName";
import { subjectSlug } from "@/lib/studentSubjects";
import { LevelSubject, loadLevelSubjects } from "@/lib/librarySubjects";
import { loadSelectedSubjects, saveSelectedSubjectsForUser } from "@/lib/studentPersonalization";
import DeleteAccountModal from "@/components/DeleteAccountModal";

const THEME_KEY = "propel_theme";
type Section = "account" | "profile" | "appearance";

// Central settings modal: account, profile (name + subjects), appearance (theme),
// logout, and the danger zone. Everything here works live.
export default function StudentSettingsModal({ onClose, initialSection = "account" }: { onClose: () => void; initialSection?: Section }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { profile } = useClerkAuth();
  const { signOut } = useClerk();
  const { level, setLevel } = usePaperLevel();
  const [section, setSection] = useState<Section>(initialSection);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showDelete, setShowDelete] = useState(false);

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [levelSubjects, setLevelSubjects] = useState<LevelSubject[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [switching, setSwitching] = useState<"olevel" | "alevel" | null>(null);

  // Subjects offered = the paper library for the currently-active level.
  const levelChoice = level === "alevel" ? "A Level" : "O Level";
  useEffect(() => {
    let active = true;
    loadLevelSubjects(levelChoice).then((ls) => { if (active) setLevelSubjects(ls); });
    // Selected subjects are per level — reload this level's saved selection.
    setSubjects(loadSelectedSubjects().map((s) => s.name));
    return () => { active = false; };
  }, [levelChoice]);

  useEffect(() => {
    setTheme((window.localStorage.getItem(THEME_KEY) as "light" | "dark" | null) || "light");
  }, []);
  useEffect(() => {
    if (user) { setFirstName(user.firstName || ""); setLastName(user.lastName || ""); }
  }, [user]);

  // Switch O ⇄ A with a brief animation; each level keeps its own subjects.
  const switchLevel = (next: "olevel" | "alevel") => {
    if (next === level) return;
    setSwitching(next);
    window.setTimeout(() => { setLevel(next); }, 350);
    window.setTimeout(() => setSwitching(null), 850);
  };

  const setThemeAndApply = (t: "light" | "dark") => {
    setTheme(t);
    window.localStorage.setItem(THEME_KEY, t);
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  const toggleSubject = (name: string) =>
    setSubjects((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));

  const saveProfile = async () => {
    setSaving(true);
    setSaved(false);
    try {
      if (user) await user.update({ firstName: firstName.trim(), lastName: lastName.trim() || undefined });
      const items = subjects.map((name) => ({ id: subjectSlug(name), name }));
      await saveSelectedSubjectsForUser(items, getToken, user?.id);
      if (typeof window !== "undefined" && user?.id) window.localStorage.removeItem(`propel_profile_${user.id}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const name = resolveName({ full_name: profile?.full_name, firstName: user?.firstName, username: user?.username, email: user?.primaryEmailAddress?.emailAddress, fallback: "Student" });
  const email = user?.primaryEmailAddress?.emailAddress || "";

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="ed-card w-full max-w-2xl h-[min(600px,90vh)] flex overflow-hidden p-0" onClick={(e) => e.stopPropagation()}>
          {/* Left rail */}
          <aside className="w-44 shrink-0 border-r border-line bg-paper-soft p-3 hidden sm:flex flex-col">
            <p className="ed-label px-2 mb-2">Settings</p>
            <RailItem active={section === "account"} icon={User} label="Account" onClick={() => setSection("account")} />
            <RailItem active={section === "profile"} icon={BookOpen} label="Profile & subjects" onClick={() => setSection("profile")} />
            <RailItem active={section === "appearance"} icon={SettingsIcon} label="Appearance" onClick={() => setSection("appearance")} />
            <div className="flex-1" />
            <button onClick={() => void signOut({ redirectUrl: "/" })} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold text-crimson hover:bg-crimson-soft text-left">
              <LogOut size={15} /> Log out
            </button>
          </aside>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h2 className="font-display text-lg font-semibold">{section === "profile" ? "Profile & subjects" : section === "appearance" ? "Appearance" : "Account"}</h2>
              <button onClick={onClose} className="ed-btn-ghost p-2"><X size={16} /></button>
            </div>

            <div className="p-5">
              {section === "account" && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-crimson text-paper text-lg font-bold overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {user?.imageUrl ? <img src={user.imageUrl} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink truncate">{name}</p>
                      <p className="text-sm text-ink-muted truncate">{email}</p>
                    </div>
                  </div>

                  <button onClick={() => setSection("profile")} className="ed-card-soft p-3 w-full flex items-center justify-between hover:shadow-sm">
                    <span className="text-sm text-ink">Manage subjects &amp; profile</span>
                    <span className="text-crimson text-sm">→</span>
                  </button>

                  <div className="ed-card p-4 border border-crimson/30">
                    <p className="font-semibold text-crimson text-sm">Danger zone</p>
                    <p className="text-xs text-ink-muted mt-0.5">Permanently delete your account and all your Propel data.</p>
                    <button onClick={() => setShowDelete(true)} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-crimson/40 text-crimson px-3 py-2 text-sm font-semibold hover:bg-crimson-soft">
                      <Trash2 size={14} /> Delete account
                    </button>
                  </div>

                  <button onClick={() => void signOut({ redirectUrl: "/" })} className="sm:hidden w-full ed-btn-ghost justify-center py-2.5 text-crimson">
                    <LogOut size={15} /> Log out
                  </button>
                </div>
              )}

              {section === "profile" && (
                <div className="space-y-5 relative">
                  {/* Level switch animation overlay */}
                  <AnimatePresence>
                    {switching && (
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
                        className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-paper/90 backdrop-blur-sm"
                      >
                        <motion.div initial={{ scale: 0.8, y: 8 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 240, damping: 18 }} className="text-center">
                          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-crimson-soft text-crimson-ink"><ClipboardCheck size={32} /></div>
                          <p className="font-display text-lg font-semibold mt-3">Switching to {switching === "alevel" ? "A Level" : "O Level"}</p>
                          <motion.div className="h-1 rounded-full bg-crimson mt-3 mx-auto" initial={{ width: 0 }} animate={{ width: 90 }} transition={{ duration: 0.6 }} />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div><label className="ed-label">First name</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="ed-input mt-1 px-3 py-2.5 text-sm" /></div>
                    <div><label className="ed-label">Last name</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} className="ed-input mt-1 px-3 py-2.5 text-sm" /></div>
                  </div>

                  {/* Level switch — O and A each keep their own subjects & progress */}
                  <div>
                    <label className="ed-label mb-2 block">Your level</label>
                    <div className="inline-flex rounded-xl border border-line p-1 bg-surface-soft">
                      {(["olevel", "alevel"] as const).map((lv) => (
                        <button
                          key={lv}
                          onClick={() => switchLevel(lv)}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${level === lv ? "bg-crimson text-white shadow-sm" : "text-ink-muted hover:text-ink"}`}
                        >
                          {lv === "olevel" ? "O Level" : "A Level"}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-ink-faint mt-1.5">Switching keeps each level&apos;s subjects & progress saved separately.</p>
                  </div>

                  <div>
                    <label className="ed-label mb-2 block">Your {levelChoice} subjects <span className="text-ink-faint">({subjects.length} selected)</span></label>
                    <div className="flex flex-wrap gap-2">
                      {levelSubjects.map((s) => {
                        const on = subjects.includes(s.name);
                        return (
                          <button key={s.name} onClick={() => toggleSubject(s.name)} className={`rounded-full px-3.5 py-2 text-sm font-medium border transition-colors ${on ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted hover:bg-surface-soft"}`}>
                            {on && <Check size={13} className="inline mr-1 -mt-0.5" />}{s.name}
                          </button>
                        );
                      })}
                      {/* Selected subjects not in the current level's library (e.g. legacy) — so they can be removed */}
                      {subjects.filter((s) => !levelSubjects.some((ls) => ls.name.toLowerCase() === s.toLowerCase())).map((s) => (
                        <button key={s} onClick={() => toggleSubject(s)} className="rounded-full px-3.5 py-2 text-sm font-medium border border-crimson bg-crimson-soft text-crimson-ink transition-colors">
                          <Check size={13} className="inline mr-1 -mt-0.5" />{s}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-ink-faint mt-2">Only {levelChoice} subjects we have papers for. These drive your Practice, Papers and datesheet.</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button onClick={() => void saveProfile()} disabled={saving} className="ed-btn-primary px-5 py-2.5">
                      <Save size={15} /> {saving ? "Saving…" : "Save changes"}
                    </button>
                    {saved && <span className="text-sm text-mint-ink">Saved</span>}
                  </div>
                </div>
              )}

              {section === "appearance" && (
                <div>
                  <p className="ed-label mb-2">Theme</p>
                  <div className="grid grid-cols-2 gap-2 max-w-xs">
                    <ThemeCard active={theme === "light"} icon={Sun} label="Light" onClick={() => setThemeAndApply("light")} />
                    <ThemeCard active={theme === "dark"} icon={Moon} label="Dark" onClick={() => setThemeAndApply("dark")} />
                  </div>
                  <p className="text-xs text-ink-faint mt-2">Applies instantly across Propel.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} />}
    </>
  );
}

function RailItem({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof User; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold text-left transition-colors ${active ? "bg-crimson-soft text-crimson-ink" : "text-ink-muted hover:bg-surface-soft"}`}>
      <Icon size={15} /> {label}
    </button>
  );
}

function ThemeCard({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Sun; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-colors ${active ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted hover:bg-surface-soft"}`}>
      <Icon size={20} />
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}
