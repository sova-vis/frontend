"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { User, CreditCard } from "lucide-react";

export default function SettingsPage() {
    const [name, setName] = useState("Student");

    useEffect(() => {
        const storedName = localStorage.getItem("studentName");
        if (storedName) setName(storedName);
    }, []);

    return (
        <div className="p-8 max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold font-display text-gray-900 mb-8">Account Settings</h1>

            <div className="space-y-6">
                {/* Profile Section */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <User size={20} className="text-primary" /> Profile
                    </h2>
                    <div className="flex items-center gap-6 mb-6">
                        <div className="w-20 h-20 bg-gray-200 rounded-full border-2 border-white shadow-md overflow-hidden">
                            <Image
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`}
                                alt="Profile"
                                width={80}
                                height={80}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <button className="text-sm font-semibold text-primary border border-primary/20 px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors">
                                Change Avatar
                            </button>
                        </div>
                    </div>
                    <div className="grid gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" defaultValue={`${name.toLowerCase().replace(/\s+/g, '.')}@example.com`} className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                    </div>
                </div>

                {/* Subscription Section */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <CreditCard size={20} className="text-primary" /> Subscription
                    </h2>
                    <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-gray-900">Pro Plan</p>
                            <p className="text-sm text-gray-500">Active until Dec 2026</p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-wide">Active</span>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        onClick={() => {
                            if (typeof window !== "undefined") localStorage.setItem("studentName", name);
                            alert("Settings Saved!");
                        }}
                        className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transition-all hover:-translate-y-0.5"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
