import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import Tesseract from "tesseract.js";

dotenv.config({ path: ".env.local" });

/* ---------------------------
SUPABASE
--------------------------- */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ---------------------------
APIFY
--------------------------- */

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN
});

/* ---------------------------
GEMINI
--------------------------- */

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GEMINI_API_KEY}`;

/* ---------------------------
TARGET CLUBS
--------------------------- */

const TARGET_ACCOUNTS = [
  "annexhousemanila",
  "kampaiph",
  "apothekamanila",
  "openhouse.world",
  "umaafterdark",
  "uglyduckpoblacion"
];

/* ---------------------------
UPLOAD IMAGE
--------------------------- */

async function hostImage(buffer, username) {
  const fileName = `flyer-${username}-${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from("event-flyers")
    .upload(fileName, buffer, {
      contentType: "image/jpeg",
      upsert: true
    });

  if (error) throw new Error(error.message);

  const { data: { publicUrl } } =
    supabase.storage.from("event-flyers").getPublicUrl(fileName);

  return publicUrl;
}

/* ---------------------------
DATE FILTER
--------------------------- */

function isFromThisWeek(dateString) {
  const postDate = new Date(dateString);
  const today = new Date();
  
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  const dayOfWeek = today.getDay(); 

  // Subtracting the current dayOfWeek exactly lands on the most recent Sunday.
  // (If today is Wednesday(3), it subtracts 3 days. If today is Sunday(0), it subtracts 0 days).
  const diffToSunday = today.getDate() - dayOfWeek;
  const lastSunday = new Date(today.setDate(diffToSunday));
  lastSunday.setHours(0, 0, 0, 0);

  return postDate >= lastSunday;
}

/* ---------------------------
CAPTION SCORING
--------------------------- */

function captionScore(caption) {
  if (!caption) return 0;
  caption = caption.toLowerCase();
  let score = 0;

  const dj = ["dj", "b2b", "set", "guest", "live", "band", "acoustic", "music", "singer", "vinyl"];
  const event = ["lineup", "tonight", "party", "doors", "schedule", "gig", "session", "presents"];
  const days = ["friday", "saturday", "thursday", "tonight", "wednesday", "tuesday", "monday", "sunday"];
  const time = ["pm", "am", ":00"];

  if (dj.some(w => caption.includes(w))) score += 3;
  if (event.some(w => caption.includes(w))) score += 2;
  if (days.some(w => caption.includes(w))) score += 2;
  if (time.some(w => caption.includes(w))) score += 2;
  if (caption.match(/@\w+/g)) score += 1;

  return score;
}

/* ---------------------------
OCR & AI HELPERS
--------------------------- */

async function extractText(buffer) {
  try {
    const { data: { text } } = await Tesseract.recognize(buffer, "eng", { logger: () => { } });
    return text.toLowerCase();
  } catch {
    return "";
  }
}

function looksLikePoster(text) {
  const keywords = [
    "dj", "lineup", "friday", "saturday", "tonight", "doors", "pm", "guest",
    "live", "acoustic", "band", "music", "schedule", "gig", "session", "presents",
    "wednesday", "thursday", "sunday", "b2b", "feat", "featuring", "resident"
  ];
  return keywords.some(k => text.includes(k));
}

function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ---------------------------
LOAD KNOWN DJs
--------------------------- */

async function loadKnownDJs() {
  const { data } = await supabase.from("events").select("djs");
  let set = new Set();
  if (!data) return [];

  data.forEach(row => {
    try {
      let list = row.djs;
      if (!list) return;
      if (typeof list === "string") {
        list = JSON.parse(list.replace(/""/g, '"'));
      }
      list.forEach(dj => {
        if (dj) set.add(dj.toLowerCase());
      });
    } catch { }
  });

  return Array.from(set);
}

function detectKnownDJ(text, knownDJs) {
  text = text.toLowerCase();
  return knownDJs.some(dj => text.includes(dj));
}

/* ---------------------------
INSERT EVENT (Database)
--------------------------- */

async function insertEvent(event) {
  // Switched to .limit(1) instead of .maybeSingle() to prevent database crashes if duplicates already exist
  const { data: existingRecords, error: lookupError } = await supabase
    .from("events")
    .select("id, source_priority")
    .eq("club_name", event.club_name)
    .eq("event_date", event.event_date)
    .limit(1);

  if (lookupError) {
    console.log("❌ Lookup error:", lookupError);
    return;
  }

  if (existingRecords && existingRecords.length > 0) {
    const existing = existingRecords[0];
    const existingPriority = existing.source_priority || 0; // Treat null as 0

    if (event.source_priority > existingPriority) {
      const { error: updateError } = await supabase
        .from("events")
        .update(event)
        .eq("id", existing.id);

      if (updateError) {
        console.log("❌ Update error:", updateError);
      } else {
        console.log(`🔁 Event updated: Better dedicated flyer found for ${event.club_name} on ${event.event_date}`);
      }
    } else {
      console.log(`⏩ Event skipped for ${event.event_date} (Already have an equal or better flyer)`);
    }
  } else {
    const { error } = await supabase
      .from("events")
      .insert(event);

    if (error) {
      console.log("❌ INSERT FAILED:", error);
    } else {
      console.log(`📡 DB Insert SUCCESS for ${event.event_date}`);
    }
  }
}

/* ---------------------------
SCRAPER
--------------------------- */

async function run() {
  console.log("🚀 AfterFive Scraper Starting");

  const todayString = new Date().toISOString().split("T")[0];

  try {
    const knownDJs = await loadKnownDJs();
    console.log(`🎧 Loaded ${knownDJs.length} known DJs`);

    const apifyRun = await apifyClient.actor("apify/instagram-profile-scraper").call({
      usernames: TARGET_ACCOUNTS,
      resultsType: "posts",
      resultsLimit: 12
    });

    const { items } = await apifyClient.dataset(apifyRun.defaultDatasetId).listItems();

    let posts = [];
    for (const profile of items) {
      if (profile.latestPosts) posts.push(...profile.latestPosts);
    }

    console.log(`📦 Checking ${posts.length} posts`);

    for (const post of posts) {
      try {
        const username = post.ownerUsername || post.username || "unknown";

        if (!isFromThisWeek(post.timestamp)) continue;

        let images = [];
        if (post.childPosts?.length) {
          images = post.childPosts.map(p => p.displayUrl);
        } else {
          images = [post.displayUrl];
        }

        const score = captionScore(post.caption);
        console.log(`\n🔍 Analyzing Post: ${username} | Score ${score} | Images: ${images.length}`);

        // CAROUSEL MEMORY: We will hold the best events from this post before pushing to Supabase
        const bestEventsForThisPost = {};

        for (let i = 0; i < images.length; i++) {
          const imageUrl = images[i];
          const imgRes = await fetch(imageUrl);
          const buffer = Buffer.from(await imgRes.arrayBuffer());

          let shouldRunAI = false;

          if (score >= 2 || username === "xinchaomnl") {
            shouldRunAI = true;
          } else {
            const text = await extractText(buffer);
            if (looksLikePoster(text) || detectKnownDJ(text, knownDJs)) {
              shouldRunAI = true;
            }
          }

          if (!shouldRunAI) continue;

          const prompt = `
            You are an expert nightlife scout. Analyze this flyer.

            CRITICAL DATE INSTRUCTION:
            Today's date is ${todayString}. Format strictly as YYYY-MM-DD. DO NOT use past years.

            CRITICAL EVENT INSTRUCTIONS:
            1. Extract events ONLY if they feature DJs, live music, acoustic bands, or nightlife.
            2. If this flyer is a weekly overview containing multiple different dates, extract EVERY DATE as a separate object.
            3. If this flyer is a poster for a single specific day, return just one object.
            4. Ignore food promos without DJs. Set "is_event": false if no music/DJ is listed.

            Return a JSON array:
            [
              {
                "is_event": true/false,
                "event_name": "",
                "djs": [],
                "event_date": "YYYY-MM-DD"
              }
            ]
          `;

          const aiResponse = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: "image/jpeg", data: buffer.toString("base64") } }
                ]
              }]
            })
          });

          const aiData = await aiResponse.json();
          if (!aiData.candidates) continue;

          let text = aiData.candidates[0].content.parts[0].text.trim().replace(/```json|```/g, "");
          const parsedJson = safeJSON(text);
          if (!parsedJson) continue;

          let results = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
          results = results.filter(r => r && r.is_event);

          if (results.length === 0) continue;

          // ⭐ MATHEMATICAL PRIORITY:
          // If Gemini pulls 3 or more distinct dates from this ONE photo, it is 100% an Overview (Priority 2)
          // If it only pulls 1 or 2 dates, it's highly specific/individual (Priority 10)
          const uniqueDatesCount = new Set(results.map(r => r.event_date)).size;
          const sourcePriority = uniqueDatesCount >= 3 ? 2 : 10;
          
          const posterType = sourcePriority === 10 ? "Dedicated Poster" : "Weekly Overview";
          console.log(`   ➔ Found ${uniqueDatesCount} date(s) in Image ${i + 1} [Type: ${posterType} | Priority: ${sourcePriority}]`);

          // Save the results to memory, overwriting overviews if a dedicated poster was found for that date
          for (const result of results) {
            const eventDate = result.event_date || todayString;

            if (!bestEventsForThisPost[eventDate] || sourcePriority > bestEventsForThisPost[eventDate].sourcePriority) {
              bestEventsForThisPost[eventDate] = {
                ...result,
                buffer, // Hold the image in memory temporarily so we don't upload the bad ones
                sourcePriority,
                eventDate
              };
            }
          }
          await new Promise(r => setTimeout(r, 1500));
        }

        // AFTER checking all images in the carousel, push ONLY the winners to Supabase
        const finalDates = Object.keys(bestEventsForThisPost);
        if (finalDates.length > 0) {
          console.log(`🚀 Uploading ${finalDates.length} winning flyer(s) from this carousel...`);
          
          for (const date of finalDates) {
            const winningEvent = bestEventsForThisPost[date];
            
            // Only now do we host the image (Saves Supabase Storage Space!)
            const hostedUrl = await hostImage(winningEvent.buffer, username);

            const djNameString = Array.isArray(winningEvent.djs) && winningEvent.djs.length > 0
              ? winningEvent.djs.join(", ")
              : (winningEvent.djs || "Headliner");

            const dbPayload = {
              event_name: winningEvent.event_name || "Special Event",
              dj_name: djNameString,
              club_name: username,
              city: "Makati",
              event_date: winningEvent.eventDate,
              image_url: hostedUrl,
              ig_post_url: `${post.url}#${winningEvent.eventDate}`, 
              djs: Array.isArray(winningEvent.djs) ? winningEvent.djs : (winningEvent.djs ? [winningEvent.djs] : []),
              source_priority: winningEvent.sourcePriority
            };

            await insertEvent(dbPayload);
          }
        }

      } catch (err) {
        console.log("⚠️ Post failed:", err.message);
      }
    }
  } catch (err) {
    console.error("❌ Fatal Error:", err.message);
  }

  console.log("🏁 Scraper Finished");
}

run();