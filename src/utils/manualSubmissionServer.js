import { createClient } from "@supabase/supabase-js";
import { ApifyClient } from "apify-client";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function hostImage(supabase, buffer, clubName) {
  const safeClubName = clubName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const fileName = `approved-${safeClubName}-${Date.now()}.jpg`;

  const { error } = await supabase.storage.from("event-flyers").upload(fileName, buffer, {
    contentType: "image/jpeg",
    upsert: true
  });

  if (error) throw new Error(`Storage Error: ${error.message}`);
  return supabase.storage.from("event-flyers").getPublicUrl(fileName).data.publicUrl;
}

export async function approveAndScrapeEvent(pendingEventId) {
  const supabase = getAdminClient();
  const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

  // 1. Fetch the pending event data
  const { data: pendingEvent, error: fetchError } = await supabase
    .from('pending_events')
    .select('*')
    .eq('id', pendingEventId)
    .single();

  if (fetchError || !pendingEvent) throw new Error("Pending event not found");

  console.log(`🔍 Scraping IG Post: ${pendingEvent.ig_post_url}`);

  // 2. Scrape IG for the image
  const apifyRun = await apifyClient.actor("apify/instagram-scraper").call({
    directUrls: [pendingEvent.ig_post_url],
    resultsType: "details"
  });

  const { items } = await apifyClient.dataset(apifyRun.defaultDatasetId).listItems();
  if (!items || items.length === 0) throw new Error("Failed to scrape IG post.");

  const postData = items[0];
  const rawImageUrl = postData.displayUrl || (postData.childPosts && postData.childPosts[0]?.displayUrl);

  if (!rawImageUrl) throw new Error("Could not extract image from post.");

  // 3. Download and Upload Image
  const imgRes = await fetch(rawImageUrl);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const finalImageUrl = await hostImage(supabase, buffer, pendingEvent.club_name);

  // 4. Insert into LIVE events table
  const djNameForDisplay = pendingEvent.djs && pendingEvent.djs.length > 0 
    ? pendingEvent.djs.join(", ") 
    : "Various Artists";

  const { error: insertError } = await supabase.from('events').insert({
    event_name: pendingEvent.event_name,
    dj_name: djNameForDisplay,
    club_name: pendingEvent.club_name,
    city: "Makati",
    event_date: pendingEvent.event_date,
    image_url: finalImageUrl,
    ig_post_url: pendingEvent.ig_post_url,
    djs: pendingEvent.djs,
    source_priority: 100 // Top priority since a human approved it
  });

  if (insertError) throw new Error("Failed to insert into live events");

  // 5. Mark pending as approved
  await supabase.from('pending_events').update({ status: 'approved' }).eq('id', pendingEventId);

  return { success: true };
}

export async function rejectEvent(pendingEventId) {
  const supabase = getAdminClient();
  await supabase.from('pending_events').update({ status: 'rejected' }).eq('id', pendingEventId);
  return { success: true };
}