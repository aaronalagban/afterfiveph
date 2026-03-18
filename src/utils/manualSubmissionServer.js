// src/utils/manualSubmissionServer.js
import { createClient } from "@supabase/supabase-js";

/* ---------------------------
HELPER: GET ADMIN CLIENT
--------------------------- */
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase configuration missing in environment variables.");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/* ---------------------------
INSERT EVENT logic
--------------------------- */
async function insertManualEvent(event) {
  // Initialize client here so it doesn't crash the build
  const supabase = getAdminClient();

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

  const MANUAL_PRIORITY = 100;
  event.source_priority = MANUAL_PRIORITY;

  if (existing) {
    if (MANUAL_PRIORITY > (existing.source_priority || 0)) {
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
      console.log(`⏩ Existing event kept (higher/equal priority already exists)`);
    }
  } else {
    const { error: insertError } = await supabase
      .from("events")
      .insert(event);

    if (insertError) {
      console.error("❌ INSERT FAILED:", insertError);
      throw new Error("Failed to insert new event.");
    } else {
      console.log(`📡 DB Insert SUCCESS for ${event.event_name}`);
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
  imageUrl 
) {
  if (!eventName || !eventDate || !clubName || !igPostUrl || !imageUrl) {
    throw new Error("Missing required event details.");
  }

  const djsArray = djsString ? djsString.split(",").map(dj => dj.trim()).filter(Boolean) : [];
  const djNameForDisplay = djsArray.length > 0 ? djsArray.join(", ") : "Various Artists";

  const event = {
    event_name: eventName,
    dj_name: djNameForDisplay,
    club_name: clubName,
    city: "Makati",
    event_date: eventDate,
    image_url: imageUrl,
    ig_post_url: igPostUrl,
    djs: djsArray,
    source_priority: 100 
  };

  await insertManualEvent(event);
  return { success: true, message: "Manual event submitted successfully!" };
}