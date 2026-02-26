import React from 'react';

export default function StudyPortfolio() {
  return (
    <div className="relative w-full h-full">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-pink/5 via-transparent to-brand-burgundy/5 rounded-3xl" />

      {/* Top Right - Pink Shape */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-brand-pink to-brand-red rounded-3xl shadow-lg shadow-brand-pink/30" />

      {/* Center - Purple Shape */}
      <div className="absolute top-32 left-8 w-24 h-24 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl shadow-lg shadow-purple-500/30" />

      {/* Bottom Left - Blue Shape */}
      <div className="absolute bottom-20 left-4 w-32 h-40 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl shadow-lg shadow-blue-500/30" />

      {/* Bottom Right - Burgundy Shape */}
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-br from-brand-burgundy via-brand-pink to-brand-red rounded-3xl shadow-lg shadow-brand-burgundy/30" />

      {/* Decorative Circle */}
      <div className="absolute top-1/3 -right-4 w-12 h-12 border-2 border-brand-pink rounded-full opacity-30" />

      {/* Decorative Dot */}
      <div className="absolute bottom-1/3 right-1/4 w-3 h-3 bg-brand-pink rounded-full opacity-60" />

      {/* Decorative Dot */}
      <div className="absolute top-1/4 left-1/3 w-2 h-2 bg-brand-burgundy rounded-full opacity-40" />
    </div>
  );
}
