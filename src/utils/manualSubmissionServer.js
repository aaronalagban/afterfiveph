// src/utils/manualSubmissionServer.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Ensure dotenv is configured if this script is run standalone or in a non-Next.js environment
// Next.js handles .env files automatically for API routes, but good practice for server utils.
if (typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'undefined') {
  dotenv.config({ path: ".env.local" });
}

/* ---------------------------
SUPABASE
--------------------------- */

// Use the service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ---------------------------
INSERT EVENT (Simplified for manual)
--------------------------- */

async function insertManualEvent(event) {
  const { data: existing, error: lookupError } = await supabase
    .from("events")
    .select("id, source_priority")
    .eq("club_name", event.club_name)
    .eq("event_date", event.event_date)
    .maybeSingle();

  if (lookupError) {
    console.error("❌ Lookup error:", lookupError);
    throw new Error("Database lookup failed.");
  }

  // Manual submissions will have a higher priority to override scraped data
  const MANUAL_PRIORITY = 100;
  event.source_priority = MANUAL_PRIORITY;

  if (existing) {
    if (MANUAL_PRIORITY > existing.source_priority) {
      const { error: updateError } = await supabase
        .from("events")
        .update(event)
        .eq("id", existing.id);

      if (updateError) {
        console.error("❌ Update error:", updateError);
        throw new Error("Failed to update existing event.");
      } else {
        console.log(`🔁 Event updated: Manual submission for ${event.club_name} on ${event.event_date}`);
      }
    } else {
      console.log(`⏩ Existing event kept for ${event.event_date} (higher/equal priority already exists)`);
    }
  } else {
    const { data, error } = await supabase
      .from("events")
      .insert(event)
      .select();

    if (error) {
      console.error("❌ INSERT FAILED:", error);
      throw new Error("Failed to insert new event.");
    } else {
      console.log(`📡 DB Insert SUCCESS for ${event.event_name} on ${event.event_date}`);
    }
  }
}

/* ---------------------------
MAIN MANUAL SUBMISSION FUNCTION
--------------------------- */

export async function submitManualEvent(
  eventName,
  djsString,
  eventDate,
  clubName,
  igPostUrl,
  imageUrl // Parameter for the flyer image URL
) {
  if (!eventName || !eventDate || !clubName || !igPostUrl || !imageUrl) {
    throw new Error("Missing required event details: event name, date, club, IG post URL, or image URL.");
  }

  const djsArray = djsString ? djsString.split(",").map(dj => dj.trim()).filter(Boolean) : [];
  const djNameForDisplay = djsArray.length > 0 ? djsArray.join(", ") : "Various Artists";

  const event = {
    event_name: eventName,
    dj_name: djNameForDisplay,
    club_name: clubName,
    city: "Makati", // Assuming Makati
    event_date: eventDate,
    image_url: imageUrl,
    ig_post_url: igPostUrl,
    djs: djsArray,
    source_priority: 100 // High priority for manual entries
  };

  await insertManualEvent(event);
  return { success: true, message: "Manual event submitted successfully!" };
}