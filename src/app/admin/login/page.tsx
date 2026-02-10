<<<<<<< HEAD
import { redirect } from "next/navigation";

export default function AdminLoginPage() {
  redirect("/sign-in");
=======
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("http://localhost:3001/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const data = await res.json();
      // Store the admin token for future requests
      if (typeof window !== "undefined") {
        localStorage.setItem("adminToken", data.token);
      }
      router.push("/admin/dashboard");
    } else {
      setError("Invalid credentials");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-full max-w-md space-y-6">
        <h2 className="text-2xl font-bold mb-4 text-center">Admin Login</h2>
        <input
          type="email"
          placeholder="Admin Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border p-3 rounded mb-2"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border p-3 rounded mb-2"
          required
        />
        {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
        <Button type="submit" className="w-full bg-brand-red text-white">Login</Button>
      </form>
    </div>
  );
>>>>>>> c74dca7 (Initial foundation for an O/A Level exam-prep platform combining structured past papers, practice workflows, progress tracking, and future-ready AI evaluation and teacher support features)
}
