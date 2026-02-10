<<<<<<< HEAD
import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect("/sign-in");
=======
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("http://localhost:3001/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const data = await res.json();

      // Store user info in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("userRole", data.role);
        localStorage.setItem("studentName", data.name || "User");
        localStorage.setItem("userSession", JSON.stringify(data.session));
      }

      // Route based on role
      if (data.role === "teacher") {
        router.push("/teacher/dashboard");
      } else if (data.role === "admin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/student/dashboard");
      }
    } else {
      setError("Invalid credentials");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden">
      {/* Scattered geometric shapes and A/O Levels text */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Top left circle */}
        <div className="absolute top-8 left-8 w-24 h-24 bg-brand-light rounded-full opacity-60" />
        {/* Top right triangle */}
        <div className="absolute top-4 right-24 w-0 h-0 border-l-[32px] border-l-transparent border-r-[32px] border-r-transparent border-b-[56px] border-b-brand-blue/30 opacity-70" />
        {/* Bottom left diamond */}
        <div className="absolute bottom-16 left-16 w-16 h-16 bg-brand-red rotate-45 opacity-60" />
        {/* Bottom right quarter circle */}
        <div className="absolute bottom-8 right-8 w-24 h-24 bg-brand-yellow rounded-tl-[80px] opacity-60" />
        {/* Center left pink block */}
        <div className="absolute top-1/2 left-8 w-20 h-40 bg-brand-pink rounded-tr-[60px] rounded-br-[60px] opacity-50 -translate-y-1/2" />
        {/* Center right outlined square */}
        <div className="absolute top-1/2 right-24 w-16 h-16 border-[6px] border-brand-pink bg-white opacity-60 -translate-y-1/2" />
        {/* Random O Levels text */}
        <span className="absolute top-20 left-1/2 text-4xl font-black text-brand-burgundy opacity-20 select-none" style={{ transform: 'rotate(-12deg)' }}>O LEVELS</span>
        <span className="absolute bottom-24 right-1/2 text-3xl font-black text-brand-pink opacity-20 select-none" style={{ transform: 'rotate(8deg)' }}>O LEVELS</span>
        <span className="absolute top-1/3 right-12 text-2xl font-black text-brand-blue opacity-20 select-none" style={{ transform: 'rotate(-6deg)' }}>O LEVELS</span>
        <span className="absolute bottom-1/4 left-1/3 text-2xl font-black text-brand-yellow opacity-20 select-none" style={{ transform: 'rotate(10deg)' }}>O LEVELS</span>
      </div>
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-full max-w-md space-y-6 z-10 relative">
        <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>
        <input
          type="email"
          placeholder="Email"
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
