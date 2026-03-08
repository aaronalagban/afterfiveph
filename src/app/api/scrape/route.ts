import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {

try{

const authHeader = request.headers.get("authorization");

if(authHeader !== `Bearer ${process.env.CRON_SECRET}`){

return new Response("Unauthorized",{status:401});

}



const { events } = await request.json();

if(!Array.isArray(events)){

return NextResponse.json(
{ success:false, error:"Invalid payload"},
{ status:400 }
);

}



const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
);



for(const event of events){

const { data:existing } =
await supabase
.from("events")
.select("source_priority")
.eq("event_name",event.event_name)
.eq("club_name",event.club_name)
.eq("event_date",event.event_date)
.maybeSingle();



if(existing){

if(event.source_priority > existing.source_priority){

await supabase
.from("events")
.update(event)
.eq("event_name",event.event_name)
.eq("club_name",event.club_name)
.eq("event_date",event.event_date);

}

}else{

await supabase
.from("events")
.insert(event);

}

}



return NextResponse.json({ success:true });



}catch(error:any){

console.error("Sync Error:",error.message);

return NextResponse.json(
{ success:false,error:error.message },
{ status:500 }
);

}

}