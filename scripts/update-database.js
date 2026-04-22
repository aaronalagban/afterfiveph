import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import Tesseract from "tesseract.js";
import fs from "fs";
import { execSync } from "child_process";

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
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;

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
  SOURCE PRIORITY MAP
  dedicated_poster = best: a flyer made specifically for one event on one night
  weekly_overview  = medium: a schedule card showing multiple nights
  artist_promo     = low: an individual DJ/artist's personal promo, not venue-specific
  not_event        = discard
--------------------------- */

const PRIORITY = {
  dedicated_poster: 10,
  weekly_overview: 2,
  artist_promo: 1,
  not_event: 0
};

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
  FIX: original code mutated `today` via setDate(), causing bugs on repeated calls.
  Now we clone the date before mutating.
--------------------------- */

function isFromThisWeek(dateString) {
  const postDate = new Date(dateString);
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday

  const lastSunday = new Date(now); // clone before mutating
  lastSunday.setDate(now.getDate() - dayOfWeek);
  lastSunday.setHours(0, 0, 0, 0);

  return postDate >= lastSunday;
}

/* ---------------------------
  CAPTION SCORING
  Used as a cheap pre-filter before spending API calls on Gemini.
--------------------------- */

function captionScore(caption) {
  if (!caption) return 0;
  caption = caption.toLowerCase();
  let score = 0;

  const dj    = ["dj", "b2b", "set", "guest", "live", "band", "acoustic", "music", "singer", "vinyl"];
  const event  = ["lineup", "tonight", "party", "doors", "schedule", "gig", "session", "presents"];
  const days   = ["friday", "saturday", "thursday", "tonight", "wednesday", "tuesday", "monday", "sunday"];
  const time   = ["pm", "am", ":00"];

  if (dj.some(w => caption.includes(w)))    score += 3;
  if (event.some(w => caption.includes(w))) score += 2;
  if (days.some(w => caption.includes(w)))  score += 2;
  if (time.some(w => caption.includes(w)))  score += 2;
  if (caption.match(/@\w+/g))               score += 1;

  return score;
}

/* ---------------------------
  OCR & AI HELPERS
--------------------------- */

async function extractText(buffer) {
  try {
    const { data: { text } } = await Tesseract.recognize(buffer, "eng", { logger: () => {} });
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

/* ---------------------------
  SAFE JSON PARSE
  FIX: added debug logging so malformed Gemini responses aren't silently dropped.
--------------------------- */

function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.debug("⚠️  JSON parse failed. Raw snippet:", text.slice(0, 150));
    return null;
  }
}

/* ---------------------------
  NORMALIZE DJs
  FIX: previously djs field was inconsistently a string or array with fragile fallbacks.
  This normalizes any shape Gemini returns into a clean string[].
--------------------------- */

function normalizeDJs(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(s => String(s).trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw.split(/,|&|\//).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/* ---------------------------
  LOAD KNOWN DJs
--------------------------- */

async function loadKnownDJs() {
  const { data } = await supabase.from("events").select("djs");
  const set = new Set();
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
    } catch {}
  });

  return Array.from(set);
}

function detectKnownDJ(text, knownDJs) {
  text = text.toLowerCase();
  return knownDJs.some(dj => text.includes(dj));
}

/* ---------------------------
  VIDEO FRAME EXTRACTION
  For video posts, Instagram provides a static thumbnail via displayUrl which works
  in ~90% of cases. This fallback extracts an actual frame via ffmpeg for Reels
  where the key info appears mid-video rather than as a cover image.
  Requires ffmpeg installed on the system (e.g. `apt install ffmpeg`).
--------------------------- */

async function getImageBufferFromPost(post) {
  const isVideo = post.type === "Video" || !!post.videoUrl;

  // Always try the thumbnail first — it's fast and free
  const thumbnailUrl = post.displayUrl;
  if (thumbnailUrl) {
    try {
      const res = await fetch(thumbnailUrl);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > 5000) return buffer; // sanity check it's a real image
    } catch {
      console.debug("⚠️  Thumbnail fetch failed, trying video frame extraction...");
    }
  }

  // Fallback: download video and extract a frame at t=2s using ffmpeg
  if (isVideo && post.videoUrl) {
    try {
      const tmpVideo = `/tmp/vid-${Date.now()}.mp4`;
      const tmpFrame = `/tmp/frame-${Date.now()}.jpg`;

      const res = await fetch(post.videoUrl);
      fs.writeFileSync(tmpVideo, Buffer.from(await res.arrayBuffer()));

      // t=2 usually captures title cards or poster text in Reels
      execSync(`ffmpeg -ss 2 -i ${tmpVideo} -frames:v 1 ${tmpFrame} -y -loglevel error`);

      const buffer = fs.readFileSync(tmpFrame);

      // Cleanup temp files
      fs.unlinkSync(tmpVideo);
      fs.unlinkSync(tmpFrame);

      return buffer;
    } catch (err) {
      console.debug("⚠️  ffmpeg frame extraction failed:", err.message);
    }
  }

  return null;
}

/* ---------------------------
  INSERT EVENT (Database)
--------------------------- */

async function insertEvent(event) {
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
    const existingPriority = existing.source_priority ?? 0;

    if (event.source_priority > existingPriority) {
      const { error: updateError } = await supabase
        .from("events")
        .update(event)
        .eq("id", existing.id);

      if (updateError) {
        console.log("❌ Update error:", updateError);
      } else {
        console.log(`🔁 Updated: Better flyer found for ${event.club_name} on ${event.event_date}`);
      }
    } else {
      console.log(`⏩ Skipped ${event.event_date} — already have an equal or better flyer`);
    }
  } else {
    const { error } = await supabase.from("events").insert(event);

    if (error) {
      console.log("❌ INSERT FAILED:", error);
    } else {
      console.log(`📡 Inserted: ${event.club_name} on ${event.event_date}`);
    }
  }
}

/* ---------------------------
  GEMINI IMAGE CLASSIFIER
  FIX: Instead of counting dates to guess poster type (brittle), we now ask Gemini
  to explicitly classify the image_type. This prevents artist promo posts from
  being treated as dedicated posters, and ensures weekly overviews don't beat
  dedicated posters found later in the same carousel.
--------------------------- */

async function classifyImage(buffer, todayString) {
  const prompt = `
    You are an expert nightlife event scout analyzing a flyer image.

    Today's date is ${todayString}. All dates must be formatted as YYYY-MM-DD. Never use past years.

    STEP 1 — Classify the image as exactly ONE of these types:
    - "dedicated_poster": A flyer for ONE specific event on ONE specific night at a specific venue.
    - "weekly_overview": A schedule card listing multiple events across multiple different dates.
    - "artist_promo": A personal promotional post for an individual DJ or artist (not venue-specific, e.g. "follow me", "booking inquiries", tour announcements without a local venue).
    - "not_event": Food promo, lifestyle post, general announcement — no DJ or live music featured.

    STEP 2 — Extract event data based on type:
    - For "dedicated_poster": return a single event object.
    - For "weekly_overview": return one object per distinct date in the "events" array.
    - For "artist_promo" or "not_event": return is_event: false, no need to fill other fields.

    Return ONLY a raw JSON object with no markdown, no backticks, no explanation:
    {
      "image_type": "dedicated_poster" | "weekly_overview" | "artist_promo" | "not_event",
      "is_event": true | false,
      "event_name": "",
      "djs": [],
      "event_date": "YYYY-MM-DD",
      "events": [
        { "event_name": "", "djs": [], "event_date": "YYYY-MM-DD" }
      ]
    }

    Rules:
    - Only include events with DJs, live music, acoustic performances, or nightlife programming.
    - If you are unsure whether the post is artist_promo vs dedicated_poster, lean toward artist_promo to avoid false positives.
    - Never invent dates. If no date is visible, omit the event.
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

  if (!aiData.candidates?.[0]?.content?.parts?.[0]?.text) {
    console.debug("⚠️  Gemini returned no candidates");
    return null;
  }

  const raw = aiData.candidates[0].content.parts[0].text
    .trim()
    .replace(/```json|```/g, "");

  return safeJSON(raw);
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

        // Build image list. For video posts, include the post itself so
        // getImageBufferFromPost() can attempt thumbnail + ffmpeg fallback.
        let imageSources = [];
        if (post.childPosts?.length) {
          imageSources = post.childPosts;
        } else {
          imageSources = [post];
        }

        const score = captionScore(post.caption);
        const isVideo = post.type === "Video" || !!post.videoUrl;
        console.log(`\n🔍 Post: @${username} | Caption score: ${score} | Slides: ${imageSources.length} | Video: ${isVideo}`);

        // CAROUSEL MEMORY: track the best event per date across all slides in this post
        const bestEventsForThisPost = {};

        for (let i = 0; i < imageSources.length; i++) {
          const source = imageSources[i];

          // Get image buffer — handles both static images and video thumbnails/frames
          const buffer = await getImageBufferFromPost(source);
          if (!buffer) {
            console.debug(`   ⚠️  Could not get image buffer for slide ${i + 1}, skipping`);
            continue;
          }

          // Pre-filter: skip Gemini call if caption score is low AND OCR finds nothing
          let shouldRunAI = false;

          if (score >= 2) {
            shouldRunAI = true;
          } else {
            const ocrText = await extractText(buffer);
            if (looksLikePoster(ocrText) || detectKnownDJ(ocrText, knownDJs)) {
              shouldRunAI = true;
            }
          }

          if (!shouldRunAI) {
            console.log(`   ⏭  Slide ${i + 1} skipped (low score, no OCR signal)`);
            continue;
          }

          const parsed = await classifyImage(buffer, todayString);
          if (!parsed || !parsed.is_event) {
            console.log(`   ➔ Slide ${i + 1}: [${parsed?.image_type ?? "parse error"}] — skipped`);
            continue;
          }

          const sourcePriority = PRIORITY[parsed.image_type] ?? 0;
          if (sourcePriority === 0) {
            console.log(`   ➔ Slide ${i + 1}: [${parsed.image_type}] — no priority, skipped`);
            continue;
          }

          console.log(`   ➔ Slide ${i + 1}: [${parsed.image_type}] | Priority: ${sourcePriority}`);

          // Normalize events into a flat array regardless of image_type
          let eventsFromSlide = [];

          if (parsed.image_type === "weekly_overview" && Array.isArray(parsed.events)) {
            eventsFromSlide = parsed.events;
          } else if (parsed.event_date) {
            eventsFromSlide = [{
              event_name: parsed.event_name,
              djs: parsed.djs,
              event_date: parsed.event_date
            }];
          }

          for (const ev of eventsFromSlide) {
            if (!ev.event_date) continue;

            const existing = bestEventsForThisPost[ev.event_date];

            // Only replace if this slide has a HIGHER priority (dedicated beats overview beats artist_promo)
            if (!existing || sourcePriority > existing.sourcePriority) {
              bestEventsForThisPost[ev.event_date] = {
                ...ev,
                buffer,
                sourcePriority,
                imageType: parsed.image_type
              };

              const action = existing ? "↑ Upgraded" : "+ Saved";
              console.log(`      ${action}: ${ev.event_date} (${parsed.image_type})`);
            } else {
              console.log(`      = Kept existing for ${ev.event_date} (priority ${existing.sourcePriority} >= ${sourcePriority})`);
            }
          }

          // Small delay to avoid hammering Gemini
          await new Promise(r => setTimeout(r, 1200));
        }

        // Push only the winning flyer per date to Supabase
        const finalDates = Object.keys(bestEventsForThisPost);
        if (finalDates.length === 0) continue;

        console.log(`🚀 Uploading ${finalDates.length} winning flyer(s) from @${username}...`);

        for (const date of finalDates) {
          const winner = bestEventsForThisPost[date];

          // Upload image only now — no point storing losers
          const hostedUrl = await hostImage(winner.buffer, username);

          const djs = normalizeDJs(winner.djs);
          const djNameString = djs.length > 0 ? djs.join(", ") : "Headliner";

          const dbPayload = {
            event_name: winner.event_name || "Special Event",
            dj_name: djNameString,
            djs,
            club_name: username,
            city: "Makati",
            event_date: winner.event_date,
            image_url: hostedUrl,
            ig_post_url: `${post.url}#${winner.event_date}`,
            source_priority: winner.sourcePriority
          };

          await insertEvent(dbPayload);
        }

      } catch (err) {
        console.log("⚠️  Post failed:", err.message);
      }
    }

  } catch (err) {
    console.error("❌ Fatal Error:", err.message);
  }

  console.log("🏁 Scraper Finished");
}

run();