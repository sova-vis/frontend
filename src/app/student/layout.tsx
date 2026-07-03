"use client";

import React from 'react';
import StudentNavbar from '@/components/student/StudentNavbar';
import GeometricShapes from '@/components/ui/GeometricShapes';
import { useClerkAuth } from '@/lib/useClerkAuth';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
	const { loading, profile } = useClerkAuth();
	const { user, isLoaded } = useUser();
	const router = useRouter();
	const warmed = useRef(false);

	useEffect(() => {
		if (!isLoaded || loading) return;

		if (!user) {
			router.replace('/sign-in');
			return;
		}

		if (profile && profile.role !== 'student') {
			router.replace('/');
		}
	}, [isLoaded, loading, user, profile, router]);

	// Warm the practice bank + heavy route chunks once the student is in their
	// workspace, so opening Practice / Past Papers is near-instant later.
	useEffect(() => {
		if (warmed.current) return;
		if (loading || !isLoaded || !user || (profile && profile.role !== 'student')) return;
		warmed.current = true;

		const warm = () => {
			// Prime the expensive practice metadata scan (server memory + browser HTTP cache).
			fetch('/api/paper-practice').catch(() => {});
			router.prefetch('/student/paper-practice');
			router.prefetch('/student/past-papers');
			router.prefetch('/student/practise');
		};

		const w = window as unknown as {
			requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
			cancelIdleCallback?: (id: number) => void;
		};
		if (typeof w.requestIdleCallback === 'function') {
			const id = w.requestIdleCallback(warm, { timeout: 2500 });
			return () => w.cancelIdleCallback?.(id);
		}
		const t = setTimeout(warm, 900);
		return () => clearTimeout(t);
	}, [loading, isLoaded, user, profile, router]);

	if (loading || !isLoaded || !user || (profile && profile.role !== 'student')) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-paper">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-crimson mx-auto mb-4"></div>
					<p className="text-ink-muted">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen bg-paper overflow-hidden relative">
			<GeometricShapes />
			<StudentNavbar />
			<main className="flex-1 overflow-auto relative z-10">
				{children}
			</main>
		</div>
	);
}
