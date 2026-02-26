import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for Clerk webhook");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });
  }

  const svix_id = req.headers.get("svix-id") || "";
  const svix_timestamp = req.headers.get("svix-timestamp") || "";
  const svix_signature = req.headers.get("svix-signature") || "";

  const body = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Unauthorized", { status: 401 });
  }

  // Handle different event types
  if (evt.type === "user.created") {
    try {
      const { id, email_addresses, first_name, last_name, public_metadata } = evt.data;
      const primaryEmail =
        email_addresses.find((e: any) => e.primary)?.email_address || "";
      const role =
        typeof public_metadata?.role === "string"
          ? public_metadata.role
          : "student";

      // Create/update profile in Supabase
      const { error } = await supabaseAdmin.from("profiles").insert({
        clerk_id: id,
        email: primaryEmail,
        full_name: `${first_name || ""} ${last_name || ""}`.trim(),
        role,
      }).select().single();

      if (error?.code === "23505") {
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({
            email: primaryEmail,
            full_name: `${first_name || ""} ${last_name || ""}`.trim(),
          })
          .eq("clerk_id", id);

        if (updateError) {
          console.error("Error upserting profile in Supabase:", updateError);
          return new Response("Error creating profile", { status: 500 });
        }

        return new Response("Webhook processed", { status: 200 });
      }

      if (error) {
        console.error("Error creating profile in Supabase:", error);
        if ((error as any)?.code === "42703") {
          console.error("Schema mismatch: run CLERK_SUPABASE_MIGRATION.sql in Supabase SQL editor");
        }
        return new Response("Error creating profile", { status: 500 });
      }

      console.log("Profile created for user:", id);
    } catch (err) {
      console.error("Error handling user.created webhook:", err);
      return new Response("Error handling webhook", { status: 500 });
    }
  }

  if (evt.type === "user.updated") {
    try {
      const { id, email_addresses, first_name, last_name } = evt.data;
      const primaryEmail =
        email_addresses.find((e: any) => e.primary)?.email_address || "";

      // Update profile in Supabase
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          email: primaryEmail,
          full_name: `${first_name || ""} ${last_name || ""}`.trim(),
        })
        .eq("clerk_id", id);

      if (error) {
        console.error("Error updating profile in Supabase:", error);
        if ((error as any)?.code === "42703") {
          console.error("Schema mismatch: run CLERK_SUPABASE_MIGRATION.sql in Supabase SQL editor");
        }
        return new Response("Error updating profile", { status: 500 });
      }

      console.log("Profile updated for user:", id);
    } catch (err) {
      console.error("Error handling user.updated webhook:", err);
      return new Response("Error handling webhook", { status: 500 });
    }
  }

  if (evt.type === "user.deleted") {
    try {
      const { id } = evt.data;

      // Delete profile from Supabase
      const { error } = await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("clerk_id", id);

      if (error) {
        console.error("Error deleting profile from Supabase:", error);
        if ((error as any)?.code === "42703") {
          console.error("Schema mismatch: run CLERK_SUPABASE_MIGRATION.sql in Supabase SQL editor");
        }
        return new Response("Error deleting profile", { status: 500 });
      }

      console.log("Profile deleted for user:", id);
    } catch (err) {
      console.error("Error handling user.deleted webhook:", err);
      return new Response("Error handling webhook", { status: 500 });
    }
  }

  return new Response("Webhook processed", { status: 200 });
}
