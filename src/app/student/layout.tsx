"use client";

import React from 'react';
import StudentNavbar from '@/components/student/StudentNavbar';
import GeometricShapes from '@/components/ui/GeometricShapes';
import { PaperLevelProvider } from '@/lib/paperLevel';
import { useClerkAuth } from '@/lib/useClerkAuth';
import { reconcilePersonalizationWithProfile, persistActiveLevel } from '@/lib/studentPersonalization';
import { hideAuthSplash } from '@/lib/authSplash';
import { useInactivityLogout } from '@/lib/useInactivityLogout';
import PropelLoader from '@/components/ui/PropelLoader';
import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
	const { loading, profile } = useClerkAuth();
	const { user, isLoaded } = useUser();
	const { getToken } = useAuth();
	const router = useRouter();
	const warmed = useRef(false);
	useInactivityLogout(30);

	// Make the SERVER the source of truth for subjects + active level: mirror the
	// profile into this browser on login (so any device shows the same thing), or
	// migrate this browser's existing choices up if the server has none yet.
	useEffect(() => {
		if (loading || !profile || profile.role !== 'student') return;
		void reconcilePersonalizationWithProfile(profile, getToken);
	}, [loading, profile, getToken]);

	// Persist O/A toggles to the server too, so the active level follows the account.
	useEffect(() => {
		const onLevel = (e: Event) => {
			const lv = (e as CustomEvent).detail;
			if (lv === 'olevel' || lv === 'alevel') void persistActiveLevel(lv, getToken);
		};
		window.addEventListener('propel:level-change', onLevel);
		return () => window.removeEventListener('propel:level-change', onLevel);
	}, [getToken]);

	useEffect(() => {
		if (!isLoaded || loading) return;

		if (!user) {
			router.replace('/');
			return;
		}

		// New account that hasn't chosen a role yet → onboarding.
		if (profile && profile.onboarding_complete === false) {
			router.replace('/onboarding');
			return;
		}

		if (profile && profile.role !== 'student') {
			router.replace('/');
			return;
		}

		// Student workspace is the destination → drop the post-login splash.
		if (profile && profile.role === 'student' && profile.onboarding_complete !== false) {
			hideAuthSplash();
		}
	}, [isLoaded, loading, user, profile, router]);

	// Warm the practice bank + heavy route chunks once the student is in their
	// workspace, so opening Practice / Past Papers is near-instant later.
	useEffect(() => {
		if (warmed.current) return;
		if (loading || !isLoaded || !user || (profile && profile.role !== 'student')) return;
		warmed.current = true;

		const warm = () => {
			// Prime the expensive practice metadata scan for the active level (server
			// memory + browser HTTP cache) so the dashboard weak-spots + Practice are
			// instant on open.
			const lvl = typeof window !== 'undefined' && window.localStorage.getItem('propel_paper_level') === 'alevel' ? 'alevel' : 'olevel';
			fetch(`/api/paper-practice?level=${lvl}`).catch(() => {});
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

	// Only block on the full-screen spinner when we have nothing cached yet.
	// A cached profile renders the dashboard instantly while it revalidates.
	if ((!profile && loading) || !isLoaded || !user || (profile && profile.role !== 'student')) {
		return <PropelLoader fullScreen label="Loading…" />;
	}

	return (
		<PaperLevelProvider>
			<div className="flex flex-col h-screen bg-paper overflow-hidden relative">
				<GeometricShapes />
				<StudentNavbar />
				<main className="flex-1 overflow-auto relative z-10">
					{children}
				</main>
			</div>
		</PaperLevelProvider>
	);
}
