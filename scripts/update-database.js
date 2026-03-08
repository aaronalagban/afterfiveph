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
  "kampaiph",
  "apothekamanila",
  "openhouse.world",
  "xinchaomnl",
  "umaafterdark",
  "uglyduckpoblacion",
  "electric.sala"
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

function isFromThisWeek(dateString){
  const postDate = new Date(dateString);
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  // Looks back to the nearest Monday
  const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diffToMonday));
  monday.setHours(0,0,0,0);
  
  return postDate >= monday;
}

/* ---------------------------
CAPTION SCORING
--------------------------- */

function captionScore(caption){

if(!caption) return 0;

caption = caption.toLowerCase();

let score = 0;

// Expanded keywords to catch Xin Chao MNL and listening bars
const dj = ["dj","b2b","set","guest","live","band","acoustic","music","singer","vinyl"];
const event = ["lineup","tonight","party","doors","schedule","gig","session","presents"];
const days = ["friday","saturday","thursday","tonight","wednesday","tuesday","monday","sunday"];
const time = ["pm","am",":00"];

if(dj.some(w=>caption.includes(w))) score += 3;
if(event.some(w=>caption.includes(w))) score += 2;
if(days.some(w=>caption.includes(w))) score += 2;
if(time.some(w=>caption.includes(w))) score += 2;

if(caption.match(/@\w+/g)) score += 1;

return score;

}

/* ---------------------------
OCR
--------------------------- */

async function extractText(buffer){

try{

const { data:{ text } } =
await Tesseract.recognize(buffer,"eng",{logger:()=>{}});

return text.toLowerCase();

}catch{

return "";

}

}

function looksLikePoster(text){

const keywords = [
"dj","lineup","friday","saturday","tonight","doors","pm","guest",
"live","acoustic","band","music","schedule","gig","session","presents",
"wednesday","thursday","sunday"
];

return keywords.some(k => text.includes(k));

}

/* ---------------------------
LOAD KNOWN DJs
--------------------------- */

async function loadKnownDJs(){

const { data } =
await supabase.from("events").select("djs");

let set = new Set();

if(!data) return [];

data.forEach(row => {

try{

let list = row.djs;

if(!list) return;

if(typeof list === "string"){
list = JSON.parse(list.replace(/""/g,'"'));
}

list.forEach(dj=>{
if(dj) set.add(dj.toLowerCase());
});

}catch{}

});

return Array.from(set);

}

/* ---------------------------
DJ DETECTION
--------------------------- */

function detectKnownDJ(text, knownDJs){

text = text.toLowerCase();

return knownDJs.some(dj => text.includes(dj));

}

/* ---------------------------
SAFE JSON
--------------------------- */

function safeJSON(text){

try{
return JSON.parse(text);
}catch{
return null;
}

}

/* ---------------------------
INSERT EVENT
--------------------------- */

async function insertEvent(event) {

  const { data: existing, error: lookupError } = await supabase
    .from("events")
    .select("source_priority")
    .eq("event_name", event.event_name)
    .eq("club_name", event.club_name)
    .eq("event_date", event.event_date)
    .maybeSingle();

  if (lookupError) {
    console.log("❌ Lookup error:", lookupError);
    return;
  }

  if (existing) {

    if (event.source_priority > existing.source_priority) {

      const { error: updateError } = await supabase
        .from("events")
        .update(event)
        .eq("event_name", event.event_name)
        .eq("club_name", event.club_name)
        .eq("event_date", event.event_date);

      if (updateError) {
        console.log("❌ Update error:", updateError);
      } else {
        console.log("🔁 Event updated (higher priority)");
      }

    } else {

      console.log("⏩ Existing event kept");

    }

  } else {

    const { data, error } = await supabase
      .from("events")
      .insert(event)
      .select();

    if (error) {
      console.log("❌ INSERT FAILED:", error);
    } else {
      console.log("📡 DB Insert SUCCESS:", data);
    }

  }

}

/* ---------------------------
SCRAPER
--------------------------- */

async function run(){

console.log("🚀 AfterFive Scraper Starting");

try{

const knownDJs = await loadKnownDJs();

console.log(`🎧 Loaded ${knownDJs.length} known DJs`);

const run =
await apifyClient.actor("apify/instagram-profile-scraper").call({
usernames: TARGET_ACCOUNTS,
resultsType:"posts",
resultsLimit:12
});

const { items } =
await apifyClient.dataset(run.defaultDatasetId).listItems();

let posts = [];

for(const profile of items){

if(profile.latestPosts)
posts.push(...profile.latestPosts);

}

console.log(`📦 Checking ${posts.length} posts`);

for(const post of posts){

try{

const username =
post.ownerUsername || post.username || "unknown";

if(!isFromThisWeek(post.timestamp)) continue;

let images = [];

if(post.childPosts?.length){
images = post.childPosts.map(p=>p.displayUrl);
}else{
images = [post.displayUrl];
}

const sourcePriority = images.length > 1 ? 1 : 2;

const score = captionScore(post.caption);

console.log(`🔍 ${username} | score ${score}`);

for(const imageUrl of images){

const imgRes = await fetch(imageUrl);
const buffer = Buffer.from(await imgRes.arrayBuffer());

let shouldRunAI = false;

// FIX: Xin Chao bypasses OCR check because Tesseract fails on their stylized fonts.
// Also lowered score threshold to 2 for sparse captions.
if(score >= 2 || username === "xinchaomnl"){

  shouldRunAI = true;

}else{

  const text = await extractText(buffer);

  if(
  looksLikePoster(text) ||
  detectKnownDJ(text,knownDJs)
  ){
  shouldRunAI = true;
  }else{
  continue;
  }

}

if(!shouldRunAI) continue;

// FIX: Instruct Gemini to recognize listening bars & return an array for weekly schedules.
const prompt = `
Analyze this flyer. It may be a nightlife flyer, a listening bar schedule, a restaurant DJ gig, or an acoustic session.

Treat restaurant and listening bar music schedules as valid events.
Return a JSON array of event objects. Even if there is only one event, return it inside an array.

[
  {
    "is_event": true/false,
    "event_name": "",
    "djs": [],
    "event_date": "YYYY-MM-DD"
  }
]
`;

const aiResponse =
await fetch(GEMINI_URL,{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({
contents:[{
parts:[
{ text:prompt },
{
inlineData:{
mimeType:"image/jpeg",
data:buffer.toString("base64")
}
}
]
}]
})
});

const aiData = await aiResponse.json();

if(!aiData.candidates) continue;

let text =
aiData.candidates[0].content.parts[0].text
.trim()
.replace(/```json|```/g,"");

const parsedJson = safeJSON(text);

if(!parsedJson) continue;

// FIX: Convert the response into an Array to process multiple events (weekly schedule)
let results = Array.isArray(parsedJson) ? parsedJson : [parsedJson];

// Filter out objects that aren't valid events
results = results.filter(r => r && r.is_event);

if (results.length === 0) continue;

console.log(`✅ Found ${results.length} event(s) in flyer from ${username}`);

// Upload the image ONCE per post, even if it has multiple events
const hosted = await hostImage(buffer, username);

// Loop through each event found in the flyer
for (const result of results) {
  
  // FIX: Correctly joins the array of DJs so multiple DJs are recorded in dj_name 
  const djNameString = Array.isArray(result.djs) && result.djs.length > 0 
    ? result.djs.join(", ") 
    : (result.djs || "Headliner");

  const event = {

    event_name: result.event_name || "Special Event",

    dj_name: djNameString,

    club_name: username,

    city: "Makati",

    event_date:
      result.event_date ||
      new Date().toISOString().split("T")[0],

    image_url: hosted,

    ig_post_url: post.url,

    djs: Array.isArray(result.djs) ? result.djs : (result.djs ? [result.djs] : []),

    source_priority: sourcePriority

  };

  await insertEvent(event);
}

}

await new Promise(r=>setTimeout(r,1500));

}catch(err){

console.log("⚠️ Post failed:",err.message);

}

}

}catch(err){

console.error("❌ Fatal Error:",err.message);

}

console.log("🏁 Scraper Finished");

}

run();