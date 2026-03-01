"use client";

import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { getApiUrl } from "./api";

export interface UserProfile {
  id: string;
  clerk_id: string;
  role: "student" | "teacher" | "admin";
  full_name: string;
  email: string;
  selected_subjects?: string[];
}

const PROFILE_CACHE_PREFIX = "propel_profile_";
let inMemoryProfile: UserProfile | null = null;
let inFlightProfileRequest: Promise<UserProfile | null> | null = null;

function cacheKeyForUser(clerkId: string) {
  return `${PROFILE_CACHE_PREFIX}${clerkId}`;
}

function readCachedProfile(clerkId: string): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKeyForUser(clerkId));
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

function writeCachedProfile(clerkId: string, profile: UserProfile | null) {
  if (typeof window === "undefined") return;
  const key = cacheKeyForUser(clerkId);

  if (!profile) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(profile));
}

async function fetchOrCreateProfile(
  token: string,
  seed: { email: string | null; full_name: string; role: string }
): Promise<UserProfile> {
  const apiUrl = getApiUrl();

  const profileResponse = await fetch(`${apiUrl}/auth/profile`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (profileResponse.ok) {
    return (await profileResponse.json()) as UserProfile;
  }

  // If not found, create/sync once.
  if (profileResponse.status !== 404) {
    const payload = await profileResponse
      .json()
      .catch(() => ({ error: "Failed to fetch profile" }));
    throw new Error(payload.error || "Failed to fetch profile");
  }

  const syncResponse = await fetch(`${apiUrl}/auth/sync-profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(seed),
  });

  if (!syncResponse.ok) {
    const payload = await syncResponse
      .json()
      .catch(() => ({ error: "Failed to sync profile" }));
    throw new Error(payload.error || "Failed to sync profile");
  }

  return (await syncResponse.json()) as UserProfile;
}

export function useClerkAuth() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [profile, setProfile] = useState<UserProfile | null>(inMemoryProfile);
  const [loading, setLoading] = useState(true);
  const fetchedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      inMemoryProfile = null;
      inFlightProfileRequest = null;
      fetchedForUser.current = null;
      setProfile(null);
      setLoading(false);
      return;
    }

    const clerkId = user.id;

    // Try in-memory cache first
    if (inMemoryProfile && inMemoryProfile.clerk_id === clerkId) {
      setProfile(inMemoryProfile);
      setLoading(false);
      return;
    }

    // Try localStorage cache
    const localProfile = readCachedProfile(clerkId);
    if (localProfile) {
      inMemoryProfile = localProfile;
      setProfile(localProfile);
      setLoading(false);
      // Don't return — still refresh in background, but UI is unblocked
    }

    // Skip if we've already started a fetch for this user
    if (fetchedForUser.current === clerkId) return;
    fetchedForUser.current = clerkId;

    let cancelled = false;

    const loadProfile = async () => {
      try {
        if (!inFlightProfileRequest) {
          inFlightProfileRequest = (async () => {
            const token = await getToken();
            if (!token) return null;

            const loadedProfile = await fetchOrCreateProfile(token, {
              email: user.primaryEmailAddress?.emailAddress || null,
              full_name:
                `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User",
              role:
                typeof user.publicMetadata?.role === "string"
                  ? user.publicMetadata.role
                  : "student",
            });

            return loadedProfile;
          })();
        }

        const resolvedProfile = await inFlightProfileRequest;

        if (cancelled) return;
        inMemoryProfile = resolvedProfile;
        setProfile(resolvedProfile);
        writeCachedProfile(clerkId, resolvedProfile);
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading Clerk profile:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
        inFlightProfileRequest = null;
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user, isLoaded, getToken]);

  const handleSignOut = async () => {
    try {
      if (user?.id) {
        writeCachedProfile(user.id, null);
      }
      inMemoryProfile = null;
      inFlightProfileRequest = null;
      setProfile(null);
      await signOut({ redirectUrl: "/" });
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
