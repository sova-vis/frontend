"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function SignupPage() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  function validatePassword(pw: string) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/.test(pw);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters, include upper and lowercase, a number, and a special character.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const res = await fetch("http://localhost:3001/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, school, city, country }),
    });
    if (res.ok) {
      setMessage("Signup successful! Please log in.");
      setTimeout(() => router.push("/login"), 1500);
    } else {
      setError("Signup failed");
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
        <span className="absolute top-20 left-1/2 text-4xl font-black text-brand-burgundy opacity-20 select-none" style={{transform:'rotate(-12deg)'}}>O LEVELS</span>
        <span className="absolute bottom-24 right-1/2 text-3xl font-black text-brand-pink opacity-20 select-none" style={{transform:'rotate(8deg)'}}>O LEVELS</span>
        <span className="absolute top-1/3 right-12 text-2xl font-black text-brand-blue opacity-20 select-none" style={{transform:'rotate(-6deg)'}}>O LEVELS</span>
        <span className="absolute bottom-1/4 left-1/3 text-2xl font-black text-brand-yellow opacity-20 select-none" style={{transform:'rotate(10deg)'}}>O LEVELS</span>
      </div>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md w-full max-w-xl space-y-4 z-10 relative flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold mb-2 text-center">Signup</h2>
        <div className="flex flex-wrap gap-4 w-full">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 min-w-[180px] border p-3 rounded"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="flex-1 min-w-[180px] border p-3 rounded"
            required
          />
        </div>
        <div className="flex flex-wrap gap-4 w-full">
          <input
            type="text"
            placeholder="School"
            value={school}
            onChange={e => setSchool(e.target.value)}
            className="flex-1 min-w-[180px] border p-3 rounded"
            required
          />
          <input
            type="text"
            placeholder="City"
            value={city}
            onChange={e => setCity(e.target.value)}
            className="flex-1 min-w-[180px] border p-3 rounded"
            required
          />
          <input
            type="text"
            placeholder="Country"
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="flex-1 min-w-[180px] border p-3 rounded"
            required
          />
        </div>
        <div className="flex flex-wrap gap-4 w-full">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="flex-1 min-w-[180px] border p-3 rounded"
            required
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="flex-1 min-w-[180px] border p-3 rounded"
            required
          />
        </div>
        {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
        {message && <div className="text-green-600 text-sm mb-2">{message}</div>}
        <Button type="submit" className="w-full bg-brand-red text-white">Signup</Button>
      </form>
    </div>
  );
}
