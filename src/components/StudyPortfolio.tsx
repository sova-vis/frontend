import React from 'react';

export default function StudyPortfolio() {
  return (
    <div className="relative w-full h-full">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-crimson/5 via-transparent to-crimson-deep/5 rounded-3xl" />

      {/* Top Right - Crimson Shape */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-crimson to-crimson-deep rounded-3xl shadow-lg shadow-crimson/30" />

      {/* Center - Mint Shape */}
      <div className="absolute top-32 left-8 w-24 h-24 bg-gradient-to-br from-mint to-mint-ink rounded-2xl shadow-lg shadow-mint/30" />

      {/* Bottom Left - Gold Shape */}
      <div className="absolute bottom-20 left-4 w-32 h-40 bg-gradient-to-br from-gold to-gold-deep rounded-2xl shadow-lg shadow-gold/30" />

      {/* Bottom Right - Crimson Shape */}
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-br from-crimson-deep via-crimson to-clay rounded-3xl shadow-lg shadow-crimson-deep/30" />

      {/* Decorative Circle */}
      <div className="absolute top-1/3 -right-4 w-12 h-12 border-2 border-crimson rounded-full opacity-30" />

      {/* Decorative Dot */}
      <div className="absolute bottom-1/3 right-1/4 w-3 h-3 bg-crimson rounded-full opacity-60" />

      {/* Decorative Dot */}
      <div className="absolute top-1/4 left-1/3 w-2 h-2 bg-gold rounded-full opacity-40" />
    </div>
  );
}
