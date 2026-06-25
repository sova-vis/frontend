"use client";

import { motion } from "framer-motion";

/**
 * Soft, editorial backdrop — warm paper-toned blobs and a faint shape that
 * drift slowly behind content. Intentionally low-contrast so foreground
 * cards and text always lead.
 */
export default function GeometricShapes() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Crimson glow — top right */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: "easeOut" }}
        className="absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-crimson/10 blur-[120px]"
      />

      {/* Gold glow — bottom left */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, delay: 0.2, ease: "easeOut" }}
        className="absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-gold/10 blur-[120px]"
      />

      {/* Mint glow — center drift */}
      <motion.div
        animate={{ y: [0, -24, 0], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/3 left-1/4 h-40 w-40 rounded-full bg-mint/10 blur-3xl"
      />

      {/* Faint rotating squircle outline */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-1/4 right-[8%] h-24 w-24 border border-crimson/10"
        style={{ borderRadius: "38% 62% 63% 37% / 41% 44% 56% 59%" }}
      />
    </div>
  );
}
