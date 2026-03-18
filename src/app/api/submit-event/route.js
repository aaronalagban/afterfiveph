import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";
// Using the @ alias makes imports safer if your project supports it, otherwise fallback to relative
import { submitManualEvent } from '../../../utils/manualSubmissionServer'; 

export async function POST(request) {
  console.log("🟢 API ROUTE HIT: /api/submit-event");

  try {
    // 1. Check if Env Variables exist before crashing
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("❌ Missing Supabase Environment Variables!");
      return NextResponse.json({ message: "Server misconfiguration: Missing Supabase keys." }, { status: 500 });
    }

    // 2. Initialize Admin Client inside the request to prevent boot crashes
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 3. Parse FormData
    const formData = await request.formData();
const password = formData.get('password');

// Verify against the server-side env variable
const correctPassword = process.env.ADMIN_PASSWORD || "afterfive";

if (password !== correctPassword) {
  console.error("❌ Incorrect Password Attempt");
  return NextResponse.json({ message: "Unauthorized: Incorrect Password" }, { status: 401 });
}

    const eventName = formData.get('eventName');
    const djs = formData.get('djs');
    const eventDate = formData.get('eventDate');
    const clubName = formData.get('clubName');
    const igPostUrl = formData.get('igPostUrl');
    const imageFile = formData.get('imageFile');

    if (!imageFile || typeof imageFile === 'string') {
      console.error("❌ Missing Image File");
      return NextResponse.json({ message: "Image file is required." }, { status: 400 });
    }

    // 5. Upload File
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `flyer-${clubName.toLowerCase().replace(/\s/g, '-')}-${Date.now()}.${fileExt}`;
    
    console.log(`⏳ Uploading file: ${fileName}...`);
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from("event-flyers")
      .upload(fileName, imageFile, {
        contentType: imageFile.type,
        upsert: true
      });

    if (uploadError) {
      console.error("❌ Supabase upload error:", uploadError);
      return NextResponse.json({ message: `Failed to upload image: ${uploadError.message}` }, { status: 500 });
    }

    // 6. Get Public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from("event-flyers")
      .getPublicUrl(fileName);

    console.log(`✅ File uploaded successfully: ${publicUrl}`);

    // 7. Save to Database
    console.log(`⏳ Saving event to database...`);
    const result = await submitManualEvent(eventName, djs, eventDate, clubName, igPostUrl, publicUrl);
    
    console.log(`✅ Event saved! Returning success.`);
    return NextResponse.json(result);

  } catch (error) {
    console.error("🚨 CRITICAL ERROR IN API ROUTE:", error);
    return NextResponse.json({ message: error.message || "An internal server error occurred." }, { status: 500 });
  }
}