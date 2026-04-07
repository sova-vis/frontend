"use client";

import React from 'react';
import StudentNavbar from '@/components/student/StudentNavbar';
import GeometricShapes from '@/components/ui/GeometricShapes';
import { useClerkAuth } from '@/lib/useClerkAuth';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
	const { loading, profile } = useClerkAuth();
	const { user, isLoaded } = useUser();
	const router = useRouter();

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

	if (loading || !isLoaded || !user || (profile && profile.role !== 'student')) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
					<p className="text-gray-600">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen bg-gray-50/50 dark:bg-gray-950 overflow-hidden relative">
			<GeometricShapes />
			<StudentNavbar />
			<main className="flex-1 overflow-auto relative z-10">
				{children}
			</main>
		</div>
	);
}
