"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { MapPin, ArrowUpRight, ArrowRight } from "lucide-react";
import { GoogleMap, useLoadScript, Marker } from "@react-google-maps/api";

// --- SWISS / BRAND COLORS ---
const COLORS = {
  swissBlue: "#001BFF", 
  pink: "#CE1E8D",      // Exact logo pink
  yellow: "#F3E814",    // Exact logo yellow
  black: "#050505",
  white: "#F4F4F4",
};

// --- MAP CONFIGURATION ---
const POBLACION_CENTER = { lat: 14.5648, lng: 121.0318 };
const POBLACION_BARS =[
  { name: "Kampai", lat: 14.5646, lng: 121.0315 },
  { name: "Z Hostel Roofdeck", lat: 14.5655, lng: 121.0321 },
  { name: "Run Rabbit Run", lat: 14.5641, lng: 121.0320 },
  { name: "Alamat Filipino Pub", lat: 14.5649, lng: 121.0318 },
  { name: "The Spirits Library", lat: 14.5658, lng: 121.0319 },
  { name: "Agimat Foraging Bar", lat: 14.5644, lng: 121.0325 },
  { name: "Bolero", lat: 14.5638, lng: 121.0322 },

  { name: "Ugly Duck", lat: 14.5650, lng: 121.0314 },
  { name: "OTO", lat: 14.5645, lng: 121.0310 },
  { name: "The Annex House", lat: 14.5652, lng: 121.0316 },
  { name: "Cheshire", lat: 14.5647, lng: 121.0323 },
  { name: "Tango", lat: 14.5643, lng: 121.0317 },
  { name: "Sanctuary", lat: 14.5648, lng: 121.0326 },
  { name: "Atmosfera", lat: 14.5653, lng: 121.0312 },
  { name: "Lynx", lat: 14.5642, lng: 121.0327 },
  { name: "Reverie", lat: 14.5651, lng: 121.0324 },

  { name: "Handlebar", lat: 14.5656, lng: 121.0308 },
  { name: "The Fun Roof", lat: 14.5657, lng: 121.0313 },
  { name: "Filling Station Bar", lat: 14.5661, lng: 121.0311 },
  { name: "The Social", lat: 14.5649, lng: 121.0309 }
];

const swissMapStyle =[
  { elementType: "geometry", stylers:[{ color: "#F4F4F4" }] },
  { elementType: "labels.icon", stylers:[{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers:[{ color: "#001BFF" }] },
  { elementType: "labels.text.stroke", stylers:[{ color: "#ffffff" }, { weight: 4 }] },
  { featureType: "road", elementType: "geometry.fill", stylers:[{ color: "#001BFF" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#050505" }] },
];

export default function AppFeed() {
  const [events, setEvents] = useState<any[]>([]);
  const[loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  const { isLoaded: isMapLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
  });

  useEffect(() => {
    async function fetchEvents() {
      const { data } = await supabase.from("events").select("*").order("event_date", { ascending: true });
      if (!data) return;

      const grouped = data.reduce((acc: any[], current: any) => {
        const existing = acc.find((e) => e.club_name === current.club_name && e.event_date === current.event_date);
        if (existing) {
          if (!existing.dj_names.includes(current.dj_name)) existing.dj_names.push(current.dj_name);
        } else {
          acc.push({ ...current, dj_names:[current.dj_name] });
        }
        return acc;
      },[]);

      setEvents(grouped);
      setLoading(false);
    }
    fetchEvents();
  },[]);

  // Tracks scroll to hide header elements (except logo)
  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 50);
  };

  const today = new Date().toLocaleDateString("en-CA");
  const normalizeDbDate = (dbDateString: string) => dbDateString?.substring(0, 10).replace(/[ \/]/g, "-") || "";

  const exactTonightEvent = events.find((e) => normalizeDbDate(e.event_date) === today);
  const allUpcomingEvents = events
    .filter((e) => normalizeDbDate(e.event_date) > today)
    .sort((a, b) => new Date(normalizeDbDate(a.event_date)).getTime() - new Date(normalizeDbDate(b.event_date)).getTime());
  const pastEvents = events
    .filter((e) => normalizeDbDate(e.event_date) < today)
    .sort((a, b) => new Date(normalizeDbDate(b.event_date)).getTime() - new Date(normalizeDbDate(a.event_date)).getTime());

  const featuredEvent = exactTonightEvent || allUpcomingEvents[0];
  const isTonight = !!exactTonightEvent;
  const displayUpcoming = isTonight ? allUpcomingEvents : allUpcomingEvents.slice(1);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="bg-[#F4F4F4] text-[#050505] font-sans selection:bg-[#CE1E8D] selection:text-white overflow-hidden">
      
      {/* GLOBAL CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; overscroll-behavior: none; }
        .swiss-border { border: 4px solid #050505; }
        .swiss-shadow { box-shadow: 8px 8px 0px 0px #050505; }
        .swiss-shadow-hover:hover { transform: translate(-4px, -4px); box-shadow: 12px 12px 0px 0px #050505; }
        .swiss-shadow-hover:active { transform: translate(4px, 4px); box-shadow: 0px 0px 0px 0px #050505; }
      `}} />

      {/* DYNAMIC HEADER - Fades out entirely EXCEPT for the Logo */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-500 flex justify-between items-center px-4 md:px-8 py-3 h-[80px] ${isScrolled ? 'bg-transparent border-transparent pointer-events-none' : 'bg-[#F4F4F4] border-b-4 border-[#050505]'}`}>
        
        {/* LOGO (Stays visible, slightly shrinks on scroll) */}
        <div className={`pointer-events-auto transition-transform duration-500 ${isScrolled ? 'scale-90 -translate-y-1' : 'scale-100'}`}>
          <div className="w-14 h-14 md:w-16 md:h-16 swiss-border overflow-hidden bg-[#CE1E8D]">
             <img src="/logo.png" alt="AfterFive Logo" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
          </div>
        </div>
        
        {/* Fading Button */}
        <div className={`bg-[#F3E814] swiss-border px-4 py-2 flex items-center gap-2 swiss-shadow transition-all duration-300 pointer-events-auto cursor-pointer ${isScrolled ? 'opacity-0 translate-x-4 pointer-events-none' : 'opacity-100 hover:bg-[#CE1E8D] hover:text-white'}`}>
          <div className="w-2.5 h-2.5 rounded-full bg-[#050505] animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest hidden md:inline-block">Live Signals</span>
          <span className="text-xs font-black uppercase tracking-widest md:hidden">Live</span>
        </div>
      </header>

      {/* DESKTOP/MOBILE NAVIGATION PILL */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] md:w-auto max-w-[500px]">
        <div className="bg-[#050505] p-2 flex items-center justify-between rounded-none swiss-shadow border-2 border-white/10">
          <button onClick={() => scrollTo("hero")} className="flex-1 md:px-6 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest text-[#F4F4F4] hover:bg-[#001BFF] transition-colors border-r border-white/20">Now</button>
          <button onClick={() => scrollTo("upcoming")} className="flex-1 md:px-6 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest text-[#F4F4F4] hover:bg-[#F3E814] hover:text-[#050505] transition-colors border-r border-white/20">Next</button>
          <button onClick={() => scrollTo("archive")} className="flex-1 md:px-6 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest text-[#F4F4F4] hover:bg-[#CE1E8D] transition-colors border-r border-white/20">Missed</button>
          <button onClick={() => scrollTo("map")} className="flex-1 md:px-6 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest text-[#F4F4F4] hover:bg-[#F4F4F4] hover:text-[#050505] transition-colors">Map</button>
        </div>
      </nav>

      {/* MAIN SNAP CONTAINER - 100dvh hugs screen perfectly */}
      <main onScroll={handleScroll} className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth hide-scrollbar relative z-10">
        
        {/* SECTION 1: HERO (SPLIT DESKTOP, STACKED MOBILE) */}
        <section id="hero" className="h-[100dvh] w-full snap-start flex flex-col lg:flex-row relative bg-[#001BFF] text-[#F4F4F4] overflow-hidden">
          
          <div className="absolute -left-10 top-20 text-[#F4F4F4]/10 font-black text-[40vw] leading-none pointer-events-none">»</div>

          {/* Left Column: Text Content */}
          <div className="w-full lg:w-1/2 h-[50dvh] lg:h-[100dvh] p-6 pt-28 md:p-12 md:pt-36 flex flex-col justify-center relative z-10">
            <div className="inline-block bg-[#F3E814] text-[#050505] px-3 py-1 mb-4 lg:mb-6 self-start transform -rotate-2 swiss-border swiss-shadow">
              <span className="text-xs md:text-sm font-black uppercase tracking-widest">
                {isTonight ? "Happening Tonight" : "Up Next"} • {featuredEvent ? new Date(normalizeDbDate(featuredEvent.event_date)).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" }).replace("/", ".") : ""}
              </span>
            </div>

            <h2 className="text-[14vw] lg:text-[7vw] font-black uppercase leading-[0.85] tracking-tighter mb-4 lg:mb-8 line-clamp-3">
              {(featuredEvent?.dj_names || ["STANDBY"]).join(" • ")}
            </h2>

            {featuredEvent && (
              <div className="flex items-center gap-3 bg-[#050505] text-[#F4F4F4] px-4 py-2 lg:px-5 lg:py-3 self-start border border-white/20">
                <MapPin className="w-4 h-4 lg:w-5 lg:h-5 text-[#CE1E8D]" />
                <span className="font-bold uppercase tracking-widest text-sm lg:text-lg">{featuredEvent.club_name}</span>
              </div>
            )}
          </div>

          {/* Right Column: Dynamic Uncropped Poster */}
          <div className="w-full lg:w-1/2 h-[50dvh] lg:h-[100dvh] bg-[#050505] relative p-4 pb-28 md:p-12 md:pt-32 flex items-center justify-center lg:border-l-4 border-[#050505]">
            {featuredEvent ? (
              <a href={featuredEvent.link || featuredEvent.image_url} target="_blank" rel="noopener noreferrer" className="relative w-full h-full max-w-2xl group cursor-pointer block">
                <div className="absolute inset-0 overflow-hidden bg-[#050505]">
                  <img src={featuredEvent.image_url} className="w-full h-full object-cover blur-3xl opacity-60 scale-125 group-hover:opacity-80 transition-opacity duration-500" alt="" />
                </div>
                
                <div className="absolute inset-0 p-2 md:p-8 flex items-center justify-center transition-transform duration-500 group-hover:scale-105 z-10">
                   <img src={featuredEvent.image_url} className="w-auto h-full max-h-[100%] object-contain swiss-border shadow-[10px_10px_0px_#050505] md:shadow-[20px_20px_0px_#050505]" alt="Event Poster" />
                </div>

                <div className="absolute top-4 right-4 bg-[#CE1E8D] text-white p-2 md:p-3 rounded-full swiss-border z-20 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
              </a>
            ) : null}
          </div>
        </section>

        {/* SECTION 2: UPCOMING EVENTS - MASSIVE POSTERS */}
        {displayUpcoming.length > 0 && (
          <section id="upcoming" className="h-[100dvh] w-full snap-start bg-[#F4F4F4] flex flex-col pt-24 pb-28 relative overflow-hidden">
            
            <div className="absolute top-10 right-10 text-[#050505]/5 font-black text-[40vw] leading-none pointer-events-none">!</div>

            <div className="px-6 md:px-12 mb-6 flex justify-between items-end relative z-10">
              <h3 className="text-5xl md:text-[6vw] font-black tracking-tighter uppercase leading-[0.8] text-[#001BFF]">
                Incoming<br/>Signals
              </h3>
              <ArrowRight className="w-10 h-10 text-[#F3E814] bg-[#050505] rounded-full p-2 hidden md:block" />
            </div>

            {/* Horizontal Scroll with Massive Cards */}
            <div className="flex-1 flex gap-6 md:gap-10 overflow-x-auto snap-x snap-mandatory hide-scrollbar px-6 md:px-12 items-center z-10">
              {displayUpcoming.map((event, i) => (
                <a 
                  key={i} href={event.link || event.image_url} target="_blank" rel="noopener noreferrer"
                  className="min-w-[85vw] md:min-w-[500px] h-full max-h-[70dvh] md:max-h-[75dvh] bg-[#F3E814] swiss-border swiss-shadow swiss-shadow-hover transition-all snap-center flex flex-col relative group cursor-pointer"
                >
                  <div className="bg-[#050505] text-white px-4 py-3 md:px-5 md:py-4 flex justify-between items-center border-b-4 border-[#050505] shrink-0">
                     <span className="font-black text-xl md:text-2xl uppercase tracking-tighter">{new Date(normalizeDbDate(event.event_date)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                     <div className="w-3 h-3 md:w-4 md:h-4 bg-[#CE1E8D] rounded-full" />
                  </div>

                  <div className="flex-1 bg-black relative overflow-hidden border-b-4 border-[#050505]">
                    <div className="absolute inset-0">
                      <img src={event.image_url} className="w-full h-full object-cover blur-2xl opacity-40 group-hover:opacity-60 transition-opacity" alt="" />
                    </div>
                    <img src={event.image_url} className="absolute inset-0 w-full h-full object-contain p-2 md:p-4 group-hover:scale-105 transition-transform duration-500 z-10" alt="Poster" />
                  </div>

                  <div className="bg-[#F4F4F4] p-4 md:p-5 shrink-0">
                    <h4 className="font-black text-2xl md:text-3xl uppercase tracking-tight truncate mb-1 text-[#001BFF]">
                      {(event.dj_names ||[]).join(", ")}
                    </h4>
                    <p className="font-black text-xs md:text-sm uppercase tracking-widest text-[#050505] flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#CE1E8D]" /> {event.club_name}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 3: THE "WOW" EXPANDING ARCHIVE (BELOW UPCOMING) */}
        {pastEvents.length > 0 && (
          <section id="archive" className="h-[100dvh] w-full snap-start bg-[#CE1E8D] flex flex-col pt-24 pb-32 relative overflow-hidden">
            
            <div className="absolute bottom-10 left-10 text-[#050505]/10 font-black text-[30vw] leading-none pointer-events-none">X</div>

            <div className="px-6 md:px-12 flex items-center gap-6 mb-8 relative z-10">
              <h3 className="text-5xl md:text-7xl font-black tracking-tighter uppercase text-[#F3E814]" style={{ WebkitTextStroke: '2px #050505' }}>
                Missed
              </h3>
              <div className="h-[4px] flex-1 bg-[#050505]" />
            </div>

            {/* Horizontal Accordion - Expanding Cards */}
            <div className="flex-1 flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory hide-scrollbar px-6 md:px-12 items-center z-10 pb-4">
              {pastEvents.slice(0, 10).map((event, i) => (
                <a
                  href={event.link || event.image_url} target="_blank" rel="noopener noreferrer"
                  key={i}
                  className="shrink-0 w-[55vw] md:w-[250px] hover:w-[85vw] md:hover:w-[600px] h-[55dvh] md:h-[65dvh] bg-[#050505] swiss-border flex flex-col group relative overflow-hidden swiss-shadow hover:swiss-shadow-hover transition-[width,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] snap-center"
                >
                  <div className="absolute inset-0 bg-[#050505]">
                    {/* Blurred Background (Fills space when expanded) */}
                    <img 
                      src={event.image_url} 
                      className="absolute inset-0 w-full h-full object-cover opacity-30 blur-xl group-hover:opacity-50 transition-opacity duration-700" 
                      alt="" 
                    />
                    {/* Foreground Image: Smoothly transitions to Uncropped */}
                    <img
                      src={event.image_url}
                      className="absolute inset-0 w-full h-full object-cover group-hover:object-contain grayscale group-hover:grayscale-0 transition-all duration-700 z-10 group-hover:p-4 md:group-hover:p-8"
                      alt="Archived event"
                    />
                  </div>

                  {/* Top "Missed" tag (fades out on hover) */}
                  <div className="absolute top-4 left-4 z-20 transition-opacity duration-300 group-hover:opacity-0">
                      <div className="bg-[#F4F4F4] text-[#050505] px-2 py-1 swiss-border">
                         <span className="font-black text-[10px] uppercase">Archived</span>
                      </div>
                  </div>

                  {/* MASSIVE Hover Info Panel (Slides up from bottom) */}
                  <div className="absolute bottom-0 left-0 w-full p-4 md:p-8 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent translate-y-[120%] group-hover:translate-y-0 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] z-20 flex flex-col justify-end">
                    <p className="text-xs md:text-sm font-black text-[#CE1E8D] uppercase tracking-widest mb-1 drop-shadow-md">
                      {new Date(normalizeDbDate(event.event_date)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                    <h5 className="font-black text-2xl md:text-5xl uppercase leading-none tracking-tighter text-[#F4F4F4] drop-shadow-lg mb-2">
                      {(event.dj_names ||[]).join(", ")}
                    </h5>
                    <p className="text-sm md:text-lg font-bold text-[#F3E814] uppercase tracking-widest flex items-center gap-2 drop-shadow-md">
                      <MapPin className="w-4 h-4 md:w-5 md:h-5" /> {event.club_name}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 4: MAP */}
        <section id="map" className="h-[100dvh] w-full snap-start bg-[#050505] flex flex-col lg:flex-row relative overflow-hidden">
          
          <div className="w-full lg:w-1/3 p-6 pt-24 md:p-12 md:pt-32 flex flex-col justify-center bg-[#F3E814] text-[#050505] z-10 swiss-border lg:border-y-0 lg:border-l-0 shrink-0">
            <h3 className="text-6xl md:text-[6vw] font-black tracking-tighter uppercase leading-[0.85] mb-6">
              The<br/><span className="text-[#001BFF]">Grid</span>
            </h3>
            <p className="font-bold text-sm md:text-lg uppercase tracking-widest border-t-4 border-[#050505] pt-4 md:pt-6">
              Poblacion, Makati City
            </p>
          </div>

          <div className="w-full lg:w-2/3 flex-1 lg:h-full relative pb-20 lg:pb-0">
            {!isMapLoaded ? (
              <div className="w-full h-full bg-[#F4F4F4] flex items-center justify-center">
                <div className="w-16 h-16 bg-[#001BFF] swiss-border animate-spin" />
              </div>
            ) : (
              <GoogleMap
                mapContainerClassName="w-full h-full"
                center={POBLACION_CENTER}
                zoom={17}
                options={{
                  styles: swissMapStyle,
                  disableDefaultUI: true,
                  gestureHandling: "cooperative"
                }}
              >
                {POBLACION_BARS.map((bar, index) => (
                  <Marker
                    key={index}
                    position={{ lat: bar.lat, lng: bar.lng }}
                    icon={{
                      path: typeof window !== "undefined" ? window.google.maps.SymbolPath.CIRCLE : 0,
                      fillColor: COLORS.yellow,
                      fillOpacity: 1,
                      strokeWeight: 4,
                      strokeColor: COLORS.black,
                      scale: 14,
                    }}
                  />
                ))}
              </GoogleMap>
            )}
            
            <div className="absolute top-4 right-4 md:top-6 md:right-6 bg-[#001BFF] text-white swiss-border px-3 py-1.5 md:px-4 md:py-2 swiss-shadow hidden md:block">
              <span className="text-xs md:text-sm font-black uppercase tracking-widest">Live View</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  );}