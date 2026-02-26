/**
 * Helper to get the API base URL from environment or fallback to localhost
 */
export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    // Client-side
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  }
  // Server-side
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

/**
 * Fetch wrapper that uses the correct API URL
 */
export async function apiCall(
  endpoint: string,
  options?: RequestInit
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${endpoint}`;
  return fetch(url, options);
}
