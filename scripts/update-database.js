import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

// 2026 Model: Gemini 3.1 Flash-Lite
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GEMINI_API_KEY}`;

const TARGET_ACCOUNTS = ["kampaiph"]; 
const NEXT_JS_API_URL = process.env.PRODUCTION_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;

async function hostImage(buffer, username) {
  const fileName = `flyer-${username}-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage
    .from("event-flyers")
    .upload(fileName, buffer, { contentType: "image/jpeg", upsert: true });

  if (error) throw new Error(`Upload Error: ${error.message}`);
  const { data: { publicUrl } } = supabase.storage.from("event-flyers").getPublicUrl(fileName);
  return publicUrl;
}

function isFromThisWeek(dateString) {
  const postDate = new Date(dateString);
  const today = new Date();
  const dayOfWeek = today.getDay(); 
  const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const mondayThisWeek = new Date(today.setDate(diffToMonday));
  mondayThisWeek.setHours(0, 0, 0, 0);
  return postDate >= mondayThisWeek;
}

async function run() {
  console.log("🚀 Starting AfterFive Poster-Only Scraper...");

  try {
    const run = await apifyClient.actor("apify/instagram-profile-scraper").call({
      usernames: TARGET_ACCOUNTS,
      resultsType: "posts",
      resultsLimit: 12 
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    let posts = [];
    for (const profile of items) { if (profile.latestPosts) posts.push(...profile.latestPosts); }

    console.log(`📦 Checking ${posts.length} recent posts...`);

    for (const post of posts) {
      const username = post.ownerUsername || post.username || "unknown";
      if (!isFromThisWeek(post.timestamp)) continue;

      console.log(`🔍 Inspecting post from @${username}...`);

      const imgRes = await fetch(post.displayUrl);
      const buffer = Buffer.from(await imgRes.arrayBuffer());

      const prompt = `
        You are a Nightlife Intelligence Bot.
        STRICT RULE: Analyze if this is a GRAPHIC GIG POSTER, EVENT FLYER, or WEEKLY SCHEDULE.
        REJECT (is_event: false) if the image is a photo of people/drinks/food.
        ACCEPT (is_event: true) ONLY if it is a designed flyer.
        
        If ACCEPTED, return JSON:
        {
          "is_event": true,
          "event_name": "The main party title",
          "venue": "${username}",
          "djs": ["DJ Name 1", "DJ Name 2"],
          "event_date": "YYYY-MM-DD"
        }
        Else return: {"is_event": false}
      `;

      const aiResponse = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: buffer.toString("base64") } }] }]
        })
      });

      const aiData = await aiResponse.json();
      if (!aiData.candidates) continue;

      let text = aiData.candidates[0].content.parts[0].text.trim().replace(/```json|```/g, "");
      const result = JSON.parse(text);

      if (result.is_event) {
        console.log(`✅ POSTER DETECTED: ${result.event_name}`);
        const permanentUrl = await hostImage(buffer, username);

        const formattedEvent = {
          event_name: result.event_name,
          dj_name: result.djs[0] || "Headliner", 
          club_name: username, 
          city: "Manila",
          event_date: result.event_date,
          image_url: permanentUrl,
          ig_post_url: post.url,
          djs: result.djs
        };

        const apiResponse = await fetch(`${NEXT_JS_API_URL}/api/scrape`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_SECRET}` },
          body: JSON.stringify({ events: [formattedEvent] })
        });

        const syncStatus = await apiResponse.json();
        console.log(`📡 DB Sync: ${syncStatus.success ? "SUCCESS" : "FAILED"}`);
      } else {
        console.log("⏩ Skipping: Not a flyer.");
      }
      
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (error) {
    console.error("❌ Fatal Error:", error.message);
  }
  console.log("🏁 Weekly Poster Sync Complete");
}

run();