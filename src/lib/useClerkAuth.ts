"use client";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getApiUrl } from "./api";

export interface UserProfile {
  id: string;
  clerk_id: string;
  role: "student" | "teacher" | "admin";
  full_name: string;
  email: string;
  selected_subjects?: string[];
}

export function useClerkAuth() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    const loadProfile = async () => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const token = await getToken();

        if (!token) {
          console.error("❌ Failed to get Clerk token");
          throw new Error("Missing Clerk token");
        }

        const apiUrl = getApiUrl();
        const endpoint = `${apiUrl}/auth/sync-profile`;
        
        console.log("🔄 Syncing profile to:", endpoint);
        console.log("👤 User details:", {
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          role: user.publicMetadata?.role || "student",
        });

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: user.primaryEmailAddress?.emailAddress || null,
            full_name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User",
            role: typeof user.publicMetadata?.role === "string" ? user.publicMetadata.role : "student",
          }),
        });

        console.log("📡 Response status:", response.status, response.statusText);

        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("❌ Sync failed:", payload);
          throw new Error(payload.error || "Failed to sync profile");
        }

        const syncedProfile = (await response.json()) as UserProfile;
        console.log("✅ Profile synced successfully:", syncedProfile);
        setProfile(syncedProfile);
      } catch (err) {
        console.error("❌ Error in profile loading:", err);
        if (err instanceof Error) {
          console.error("Error message:", err.message);
          console.error("Error stack:", err.stack);
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user, isLoaded, getToken]);

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: "/" });
      setProfile(null);
    } catch (err) {
      console.error("Error signing out:", err);
      throw err;
    }
  };

  return {
    user,
    profile,
    loading: !isLoaded || loading,
    isAuthenticated: !!user,
    signOut: handleSignOut,
  };
}
