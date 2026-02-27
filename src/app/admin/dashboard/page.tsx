"use client";

import { useState } from "react";
import { UserPlus, Shield, Check, AlertCircle } from "lucide-react";
import { apiCall } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";

export default function AdminDashboard() {
  const { getToken } = useAuth();
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

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
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-20 px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-red-100 rounded-full mb-4">
            <Shield size={40} className="text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 font-display">Admin Dashboard</h1>
          <p className="text-gray-500">Manage users and platform settings.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="p-8 border-b border-gray-50">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <UserPlus size={24} className="text-primary" />
              Create Teacher Account
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              This will create a new Clerk user with the &apos;teacher&apos; role.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {status === "success" && (
              <div className="p-4 bg-green-50 text-green-700 rounded-xl flex items-center gap-2 text-sm font-medium">
                <Check size={18} /> {message}
              </div>
            )}
            {status === "error" && (
              <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 text-sm font-medium">
                <AlertCircle size={18} /> {message}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Teacher Name</label>
              <input
                type="text"
                required
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                placeholder="e.g. Sarah Williams"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  placeholder="teacher@school.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  required
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {status === "loading" ? "Creating Account..." : "Create Teacher Account"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
