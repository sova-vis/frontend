"use client";

import React, { useState } from 'react';
import StudentSidebar from '@/components/student/Sidebar';
import GeometricShapes from '@/components/ui/GeometricShapes';
import { Menu } from 'lucide-react';
import { useClerkAuth } from '@/lib/useClerkAuth';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
	const [isSidebarOpen, setIsSidebarOpen] = useState(true);
	const { loading } = useClerkAuth();

	// Quick fix for mobile default closed:
	React.useEffect(() => {
		if (window.innerWidth < 768) setIsSidebarOpen(false);
	}, []);

	if (loading) {
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
		<div className="flex min-h-screen bg-gray-50/50 relative">
			<GeometricShapes />

			{/* Mobile Menu Button - shows when closed */}
			{!isSidebarOpen && (
				<button
					onClick={() => setIsSidebarOpen(true)}
					className="fixed top-4 left-4 z-40 p-2 bg-white/80 backdrop-blur-md border border-gray-200 rounded-lg shadow-sm text-gray-700 hover:text-primary transition-colors"
				>
					<Menu size={24} />
				</button>
			)}

			<StudentSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(!isSidebarOpen)} />

			<main className={`flex-1 transition-all duration-300 relative z-10 w-full ${isSidebarOpen ? "md:ml-64" : ""}`}>
				{children}
			</main>
		</div>
	);
}
