import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface FloatingHeroProps {
    user?: any;
    profile?: { role: string; full_name?: string } | null;
    onSignUp: () => void;
    onExplore: () => void;
}


const Book3D = ({ delay = 0, color = "#880E4F", secondaryColor = "#C2185B", position = "" }: { delay?: number, color?: string, secondaryColor?: string, position?: string }) => (
    <motion.div
        animate={{
            y: [-15, 15, -15],
            rotateY: [-12, 12, -12],
            rotateX: [15, 20, 15]
        }}
        transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: delay
        }}
        className={`absolute ${position} w-44 h-60 md:w-56 md:h-80 perspective-2000 preserve-3d z-10`}
    >
        {/* Book Container with Realistic Volume */}
        <div className="absolute inset-0 preserve-3d">
            {/* Front Cover with Gold Accents */}
            <div
                className="absolute inset-0 rounded-r-lg shadow-2xl flex flex-col justify-between p-6 preserve-3d backface-hidden"
                style={{
                    background: `linear-gradient(135deg, ${color} 0%, ${secondaryColor} 100%)`,
                    transform: 'translateZ(14px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2), 0 10px 30px rgba(0,0,0,0.4)'
                }}
            >
                {/* Gold Embossed Emblem */}
                <div className="w-12 h-12 rounded-full border-2 border-yellow-500/50 flex items-center justify-center self-center opacity-80">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600" />
                </div>

                <div className="space-y-3">
                    {/* Gold Text simulation */}
                    <div className="w-full h-1 bg-gradient-to-r from-yellow-400/80 to-yellow-600/80 rounded-sm" />
                    <div className="w-4/5 h-1 bg-gradient-to-r from-yellow-400/60 to-yellow-600/60 rounded-sm" />
                    <div className="w-3/4 h-1 bg-gradient-to-r from-yellow-400/40 to-yellow-600/40 rounded-sm" />
                </div>
            </div>

            {/* Back Cover */}
            <div
                className="absolute inset-0 rounded-r-lg preserve-3d"
                style={{
                    background: color,
                    transform: 'translateZ(-14px)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                }}
            />

            {/* Spine (Advanced Rounded Look) */}
            <div
                className="absolute left-0 top-0 bottom-0 w-[28px] overflow-hidden"
                style={{
                    background: `linear-gradient(to right, ${secondaryColor}, ${color} 50%, ${secondaryColor})`,
                    transform: 'translateX(-14px) rotateY(-90deg)',
                    borderRadius: '8px 0 0 8px',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)'
                }}
            >
                {/* Spine Decorative Ribs */}
                <div className="absolute top-[20%] w-full h-[2px] bg-yellow-500/30 shadow-sm" />
                <div className="absolute top-[40%] w-full h-[2px] bg-yellow-500/30 shadow-sm" />
                <div className="absolute top-[60%] w-full h-[2px] bg-yellow-500/30 shadow-sm" />
                <div className="absolute top-[80%] w-full h-[2px] bg-yellow-500/30 shadow-sm" />
            </div>

            {/* Top Pages Edge (Realistic fiber texture) */}
            <div
                className="absolute top-0 left-0 right-0 h-[28px] bg-[#fdfdfd]"
                style={{
                    transform: 'translateY(-14px) rotateX(90deg)',
                    background: 'repeating-linear-gradient(90deg, #dee2eb, #dee2eb 1px, #fff 1px, #fff 2px)',
                    opacity: 0.95
                }}
            />

            {/* Bottom Pages Edge */}
            <div
                className="absolute bottom-0 left-0 right-0 h-[28px] bg-[#fdfdfd]"
                style={{
                    transform: 'translateY(14px) rotateX(-90deg)',
                    background: 'repeating-linear-gradient(90deg, #dee2eb, #dee2eb 1px, #fff 1px, #fff 2px)',
                    opacity: 0.95
                }}
            />

            {/* Right Side (Page Edges Rounded) */}
            <div
                className="absolute right-0 top-0 bottom-0 w-[28px] bg-[#fdfdfd]"
                style={{
                    transform: 'translateX(14px) rotateY(90deg)',
                    background: 'repeating-linear-gradient(0deg, #dee2eb, #dee2eb 1px, #fff 1px, #fff 2px)',
                    opacity: 0.95
                }}
            />

            {/* Animated Pages (Extreme Realism with Bend Simulation) */}
            {[1, 2, 3, 4, 5].map((i) => (
                <motion.div
                    key={i}
                    animate={{ rotateY: [0, -175, 0] }}
                    transition={{
                        duration: 6,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: delay + (i * 0.15)
                    }}
                    className="absolute inset-y-2 right-2 left-4 bg-[#fffefe] rounded-r-sm origin-left shadow-2xl preserve-3d overflow-hidden"
                    style={{
                        transform: `translateZ(${10 - (i * 4)}px)`,
                        borderLeft: '1px solid #dee2e6',
                        animation: 'page-flip-v3 6s ease-in-out infinite'
                    }}
                >
                    <div className="w-full h-full p-4 space-y-3 opacity-30">
                        {/* Text simulations on pages */}
                        <div className="w-full h-[1px] bg-slate-400" />
                        <div className="w-3/4 h-[1px] bg-slate-400" />
                        <div className="w-full h-[2px] bg-brand-burgundy/10" />
                        <div className="w-4/5 h-[1px] bg-slate-400" />
                        <div className="w-full h-[1px] bg-slate-400" />
                        <div className="w-1/2 h-[1px] bg-slate-400" />
                    </div>
                </motion.div>
            ))}
        </div>
    </motion.div>
);

const Pencil3D = ({ delay = 1.5, position = "" }: { delay?: number, position?: string }) => (
    <motion.div
        animate={{
            y: [0, -30, 0],
            rotate: [15, 25, 15],
            rotateY: [0, 45, 0],
            z: [0, 25, 0]
        }}
        transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: delay
        }}
        className={`absolute ${position} w-6 h-48 md:w-8 md:h-64 z-10 perspective-2000 preserve-3d`}
    >
        {/* Hexagonal Pencil Body (Simulated with 3 sides) */}
        <div className="w-full h-full preserve-3d">
            {/* Top Eraser Block */}
            <div className="absolute top-0 w-full h-[15%] preserve-3d">
                <div
                    className="absolute inset-0 bg-[#F48FB1] rounded-t-sm"
                    style={{ transform: 'translateZ(4px)' }}
                />
                <div
                    className="absolute inset-0 bg-[#C2185B]"
                    style={{ transform: 'rotateY(90deg) translateZ(4px)' }}
                />
                <div className="absolute top-[80%] w-full h-[20%] bg-slate-300 shadow-inner" style={{ transform: 'translateZ(5px)' }} />
            </div>

            {/* Main Body with perspective shading */}
            <div className="absolute top-[15%] w-full h-[65%] preserve-3d">
                <div
                    className="absolute inset-0 bg-[#FFD54F] shadow-inner border-y border-black/5"
                    style={{ transform: 'translateZ(4px)' }}
                />
                <div
                    className="absolute inset-0 bg-[#FBC02D]"
                    style={{ transform: 'rotateY(60deg) translateZ(4px)' }}
                />
                <div
                    className="absolute inset-0 bg-[#F9A825]"
                    style={{ transform: 'rotateY(-60deg) translateZ(4px)' }}
                />
            </div>

            {/* Sharpened Tip (Pyramid-like) */}
            <div className="absolute bottom-0 w-full h-[20%] preserve-3d flex justify-center">
                <div
                    className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[32px] border-t-[#D7CCC8] border-l-transparent border-r-transparent origin-top"
                    style={{ transform: 'rotateX(180deg) translateZ(4px)' }}
                />
                <div className="absolute bottom-0 w-3 h-3 bg-slate-800 rounded-full shadow-lg" style={{ transform: 'translateZ(6px)' }} />
            </div>
        </div>
    </motion.div>
);

const Pen3D = ({ delay = 2, position = "" }: { delay?: number, position?: string }) => (
    <motion.div
        animate={{
            y: [-25, 25, -25],
            rotate: [-15, -5, -15],
            rotateY: [-25, 25, -25],
            z: [0, 40, 0]
        }}
        transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
            delay: delay
        }}
        className={`absolute ${position} w-5 h-52 md:w-7 md:h-64 z-10 perspective-2000 preserve-3d`}
    >
        <div className="w-full h-full preserve-3d shadow-2xl">
            {/* Glossy Pen Body */}
            <div
                className="absolute inset-0 bg-brand-blue rounded-full border border-white/10"
                style={{
                    transform: 'translateZ(5px)',
                    background: 'linear-gradient(to right, #0288D1, #03A9F4 50%, #01579B)'
                }}
            />
            {/* Meta-Clip (Realistic depth) */}
            <div
                className="absolute top-8 -right-2 w-3 h-20 bg-gradient-to-r from-slate-200 to-slate-400 rounded-sm shadow-lg"
                style={{ transform: 'translateZ(10px) rotateY(-10deg)' }}
            />
            {/* Clicker */}
            <div
                className="absolute -top-2 left-1/2 -translateX-1/2 w-4 h-6 bg-slate-800 rounded-t-lg"
                style={{ transform: 'translateZ(3px)' }}
            />
            {/* Grip Texture */}
            <div className="absolute top-1/2 w-full h-1/4 bg-black/10 backdrop-blur-[1px] flex flex-col justify-around py-1" style={{ transform: 'translateZ(6px)' }}>
                {[1, 2, 3, 4].map(i => <div key={i} className="w-full h-[1px] bg-white/5" />)}
            </div>
            {/* Chrome Tip */}
            <div
                className="absolute bottom-0 left-1/2 -translateX-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[24px] border-t-slate-300 border-l-transparent border-r-transparent origin-top"
                style={{ transform: 'rotateX(180deg) translateZ(5px)' }}
            />
        </div>
    </motion.div>
);

const FloatingHero = ({ user, profile, onSignUp, onExplore }: FloatingHeroProps) => {

    return (
        <div className="relative w-full h-[80vh] md:h-[90vh] min-h-[600px] md:min-h-[800px] flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900 pt-32 md:pt-44">

            {/* 3D Floating Education Objects - Simplified */}
            <Pencil3D position="left-[12%] bottom-[2%]" delay={1} />

            <Pen3D position="right-[15%] bottom-[4%]" delay={3} />


            {/* Faint 'A/O Levels' Background Text */}
            <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-12 z-0 overflow-hidden pointer-events-none opacity-[0.02] dark:opacity-[0.03] rotate-[-5deg] scale-150">
                {Array.from({ length: 24 }).map((_, i) => (
                    <span key={i} className="text-6xl md:text-9xl font-black whitespace-nowrap select-none">
                        {i % 2 === 0 ? 'O LEVELS' : 'A LEVELS'}
                    </span>
                ))}
            </div>

            {/* Central Content */}
            <div className="relative z-30 flex flex-col items-center justify-center text-center max-w-4xl px-6 -mt-16">
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.05] mb-4 md:mb-6"
                >
                    Propel Your Success<br />
                    in <span className="relative inline-block text-brand-burgundy z-10">
                        O Levels
                        <svg className="absolute -bottom-2 md:-bottom-4 w-full h-4 md:h-8 left-0 text-brand-pink -z-10" viewBox="0 0 200 20" preserveAspectRatio="none">
                            <path d="M0 10 Q 25 20, 50 10 T 100 10 T 150 10 T 200 10" fill="transparent" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </span><br />
                    with <span className="text-brand-pink">Expert Teachers</span>
                </motion.h1 >

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-base md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl font-medium leading-relaxed mb-6 md:mb-8"
                >
                    Unlock your academic potential with interactive lessons, top resources, and real exam strategies for O Level students.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="flex flex-col sm:flex-row items-center gap-4"
                >
                    {user ? (
                        <Link href={
                            (profile?.role === "teacher" || user.publicMetadata?.role === "teacher") ? "/teacher/dashboard" :
                                (profile?.role === "admin" || user.publicMetadata?.role === "admin") ? "/admin/dashboard" :
                                    "/student/dashboard"
                        }>
                            <Button className="bg-brand-burgundy hover:bg-brand-burgundy/90 text-white font-bold rounded-full px-10 h-14 shadow-xl shadow-brand-burgundy/30 text-lg transition-all hover:scale-105 active:scale-95">
                                Go to Dashboard <ArrowRight className="ml-2" size={20} />
                            </Button>
                        </Link>
                    ) : (
                        <>
                            <Button
                                onClick={onSignUp}
                                className="bg-brand-burgundy hover:bg-brand-burgundy/90 text-white font-bold rounded-full px-10 h-14 shadow-xl shadow-brand-burgundy/30 text-lg transition-all hover:scale-105 active:scale-95"
                            >
                                Get Started <ArrowRight className="ml-2" size={20} />
                            </Button>
                            <Button
                                onClick={onExplore}
                                className="bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-200 hover:text-slate-700 font-bold rounded-full px-10 h-14 text-lg transition-all shadow-sm"
                            >
                                Explore
                            </Button>
                        </>
                    )}
                </motion.div>
            </div>

        </div>
    );
};

export default FloatingHero;
