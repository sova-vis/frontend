"use client";

import { motion } from "framer-motion";

export default function GeometricShapes() {
    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
            {/* Circle Top Right */}
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 0.4, scale: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute -top-20 -right-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-20"
            />

            {/* Hexagon/Polygon Shape Bottom Left */}
            <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 0.6, x: 0 }}
                transition={{ duration: 1.5, delay: 0.2 }}
                className="absolute top-1/2 left-10 w-24 h-24 border-4 border-highlight/20 rotate-12"
                style={{ borderRadius: "20% 80% 20% 80% / 80% 20% 80% 20%" }}
            />

            {/* Small Triangle scattered */}
            <motion.svg
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 0.5, y: 0 }}
                transition={{ duration: 1, delay: 0.5 }}
                className="absolute bottom-20 right-40 text-accent/30 w-16 h-16"
                viewBox="0 0 100 100"
                fill="currentColor"
            >
                <polygon points="50,15 100,100 0,100" />
            </motion.svg>

            {/* Floating Circle */}
            <motion.div
                animate={{
                    y: [0, -20, 0],
                    rotate: [0, 10, -10, 0]
                }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="absolute top-32 left-1/4 w-12 h-12 bg-secondary/30 rounded-full blur-sm"
            />

            {/* Square */}
            <motion.div
                animate={{
                    rotate: [0, 90, 180, 270, 360],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute bottom-1/4 right-10 w-20 h-20 border-2 border-primary/10 rounded-xl"
            />

        </div>
    );
}
