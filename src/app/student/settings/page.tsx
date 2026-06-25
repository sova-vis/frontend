"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { User, CreditCard } from "lucide-react";
import { Reveal } from "@/components/ui/Motion";

export default function SettingsPage() {
    const [name, setName] = useState("Student");

    useEffect(() => {
        const storedName = localStorage.getItem("studentName");
        if (storedName) setName(storedName);
    }, []);

    return (
        <div className="min-h-full bg-transparent p-4 py-6 md:p-8 max-w-3xl mx-auto">
            <Reveal>
                <header className="mb-8">
                    <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-ink">
                        Account <span className="italic text-crimson">Settings</span>
                    </h1>
                    <p className="mt-1 text-sm text-ink-muted">Manage your profile and subscription.</p>
                </header>
            </Reveal>

            <div className="space-y-6">
                {/* Profile Section */}
                <Reveal delay={0.05}>
                    <div className="ed-card p-5 md:p-6">
                        <h2 className="font-display text-lg font-semibold tracking-tight text-ink mb-4 flex items-center gap-2">
                            <User size={20} className="text-crimson" /> Profile
                        </h2>
                        <div className="flex items-center gap-6 mb-6">
                            <div className="w-20 h-20 bg-surface-soft rounded-full border-2 border-surface shadow-card overflow-hidden">
                                <Image
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`}
                                    alt="Profile"
                                    width={80}
                                    height={80}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div>
                                <button className="text-sm font-semibold text-crimson border border-crimson/20 px-4 py-2 rounded-lg hover:bg-crimson/5 transition-colors">
                                    Change Avatar
                                </button>
                            </div>
                        </div>
                        <div className="grid gap-4">
                            <div>
                                <label className="ed-label block mb-1.5">Full Name</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="ed-input" />
                            </div>
                            <div>
                                <label className="ed-label block mb-1.5">Email</label>
                                <input type="email" defaultValue={`${name.toLowerCase().replace(/\s+/g, '.')}@example.com`} className="ed-input" />
                            </div>
                        </div>
                    </div>
                </Reveal>

                {/* Subscription Section */}
                <Reveal delay={0.1}>
                    <div className="ed-card p-5 md:p-6">
                        <h2 className="font-display text-lg font-semibold tracking-tight text-ink mb-4 flex items-center gap-2">
                            <CreditCard size={20} className="text-crimson" /> Subscription
                        </h2>
                        <div className="ed-card-soft p-4 flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-ink">Pro Plan</p>
                                <p className="text-sm text-ink-muted">Active until Dec 2026</p>
                            </div>
                            <span className="ed-pill-mint uppercase tracking-wide">Active</span>
                        </div>
                    </div>
                </Reveal>

                <div className="flex justify-end pt-4">
                    <button
                        onClick={() => {
                            if (typeof window !== "undefined") localStorage.setItem("studentName", name);
                            alert("Settings Saved!");
                        }}
                        className="ed-btn-primary px-8 py-3 hover:-translate-y-0.5"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
