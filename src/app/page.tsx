"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase-client";
import { 
  MapPin, ArrowUpRight, Calendar, Disc, Map as MapIcon, 
  X, Star, Zap, Instagram, ChevronLeft, ChevronRight
} from "lucide-react";
import { GoogleMap, useLoadScript, Marker } from "@react-google-maps/api";

// --- CONFIG & PALETTE ---
const COLORS = {
  dates: ["#00E5FF", "#76FF03", "#FFEB3B", "#D500F9", "#FF3D00"], 
  cardHover: ["#FFEB3B", "#00E5FF", "#76FF03"]
};

const POBLACION_CENTER = { lat: 14.5648, lng: 121.0318 };
const POBLACION_BARS = [
  { name: "Kampai", lat: 14.56396, lng: 121.03162, type: "Listening Bar", status: "03:00" },
  { name: "Apotheka Manila", lat: 14.56462, lng: 121.03214, type: "Club", status: "04:00" },
  { name: "Open House", lat: 14.56438, lng: 121.03177, type: "Listening Bar", status: "02:00" },
  { name: "Uma After Dark", lat: 14.56509, lng: 121.03147, type: "Club", status: "03:00" },

  { name: "Z Hostel Roofdeck", lat: 14.56547, lng: 121.03196, type: "Rooftop", status: "02:00" },
  { name: "Run Rabbit Run", lat: 14.56410, lng: 121.03230, type: "Speakeasy", status: "01:00" },
  { name: "OTO", lat: 14.56447, lng: 121.03089, type: "Hi-Fi Bar", status: "02:00" },
  { name: "Agimat", lat: 14.56431, lng: 121.03256, type: "Cocktail Bar", status: "02:00" },
  { name: "Spirits Library", lat: 14.56578, lng: 121.03183, type: "Cocktail Bar", status: "03:00" },
  { name: "Alamat", lat: 14.56484, lng: 121.03163, type: "Bar", status: "02:00" },

  { name: "Ugly Duck", lat: 14.56466, lng: 121.03209, type: "Tapas Bar", status: "02:00" },
  { name: "Buccaneers Rum & Kitchen", lat: 14.56521, lng: 121.03228, type: "Rum Bar", status: "02:00" },
  { name: "Japonesa", lat: 14.56502, lng: 121.03199, type: "Bar", status: "02:00" },
  { name: "Polilya", lat: 14.56473, lng: 121.03071, type: "Restaurant Bar", status: "00:00" },
  { name: "Funky Monkey", lat: 14.56407, lng: 121.03011, type: "Bar", status: "02:00" },

  { name: "Almacen", lat: 14.56429, lng: 121.03112, type: "Bar", status: "02:00" },
  { name: "The Way Out", lat: 14.56495, lng: 121.03243, type: "Club", status: "03:00" },
  { name: "WYP (What's Your Poison)", lat: 14.56562, lng: 121.03102, type: "Cocktail Bar", status: "02:00" }
];

const popMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.stroke", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#000000" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#00E5FF" }] },
];

export default function AfterFivePop() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [showBetaModal, setShowBetaModal] = useState(false);
  const [view, setView] = useState<"LIVE" | "AGENDA" | "ARCHIVE" | "MAP">("LIVE");
  
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded: isMapLoaded } = useLoadScript({ googleMapsApiKey: googleMapsKey || "" });

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
      setShowBetaModal(true); 
    }, 3500);

    async function init() {
      if (!supabase) { setLoading(false); return; }
      const { data } = await supabase.from("events").select("*").order("event_date", { ascending: true });
      
      if (data) {
        const grouped = data.reduce((acc: any[], current: any) => {
          const existing = acc.find((e) => 
            e.club_name === current.club_name && 
            e.event_date === current.event_date &&
            e.event_name === current.event_name 
          );
          if (existing) {
            if (!existing.dj_names.includes(current.dj_name)) existing.dj_names.push(current.dj_name);
          } else {
            acc.push({ ...current, dj_names: [current.dj_name] });
          }
          return acc;
        }, []);
        setEvents(grouped);
      }
      setLoading(false);
    }
    init();
    return () => clearTimeout(timer);
  }, []);

  // Time Logic
  const getLogicalToday = () => {
    const now = new Date();
    now.setHours(now.getHours() - 5);
    return now.toISOString().split('T')[0];
  };

  const today = getLogicalToday();
  const normalizeDbDate = (d: string) => d?.substring(0, 10).replace(/[ /]/g, "-") || "";
  
  const tonightEvents = events.filter((e) => normalizeDbDate(e.event_date) === today);
  const upcomingEvents = events.filter((e) => normalizeDbDate(e.event_date) > today);
  const pastEvents = events.filter((e) => normalizeDbDate(e.event_date) < today).reverse();
  const galleryData = tonightEvents.length > 0 ? tonightEvents : upcomingEvents;

  return (
    <div className="fixed inset-0 w-full h-full font-sans overflow-hidden flex flex-col md:flex-row bg-white text-black">
      
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .hard-shadow { box-shadow: 6px 6px 0px 0px #000; }
        .hard-shadow-sm { box-shadow: 3px 3px 0px 0px #000; }
        .hard-shadow-date { box-shadow: 0px 4px 0px 0px #000; }
        
        .playful-bg {
          background-color: #ffffff;
          background-image: radial-gradient(#000 1.5px, transparent 1.5px), radial-gradient(#000 1.5px, #ffffff 1.5px);
          background-size: 40px 40px;
          background-position: 0 0, 20px 20px;
          animation: bgShift 10s linear infinite;
        }
        
        .color-wash {
          background: linear-gradient(45deg, rgba(0,229,255,0.15), rgba(118,255,3,0.15), rgba(255,235,59,0.15), rgba(213,0,249,0.15));
          background-size: 400% 400%;
          animation: gradientMove 8s ease infinite;
        }

        @keyframes bgShift {
          0% { background-position: 0 0, 20px 20px; }
          100% { background-position: 40px 40px, 60px 60px; }
        }

        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}} />

      {/* --- SPLASH SCREEN --- */}
      <AnimatePresence>
        {showSplash && (
          <motion.div 
            className="fixed inset-0 z-[100] bg-[#FF3D00] flex flex-col items-center justify-center p-8 text-center"
            exit={{ y: "-100%", transition: { duration: 0.8, ease: "circIn" } }}
          >
            <h1 className="font-black text-6xl md:text-9xl text-white tracking-tighter uppercase mb-4 animate-pulse drop-shadow-[8px_8px_0px_#000]">
              AFTER<br/>FIVE®
            </h1>
            <div className="overflow-hidden">
              <motion.p 
                initial={{ y: "100%" }} 
                animate={{ y: 0 }} 
                transition={{ delay: 0.5, duration: 0.5 }}
                className="font-mono font-bold text-lg md:text-2xl bg-black text-white px-4 py-2 rotate-2 border-2 border-white"
              >
                WHERE MANILA GOES AFTER FIVE
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* --- BETA MODAL --- */}
      <AnimatePresence>
        {showBetaModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-black hard-shadow p-8 max-w-sm w-full text-center"
            >
              <h2 className="font-black text-3xl uppercase mb-4">WIP / BETA</h2>
              <p className="font-mono text-sm mb-6 leading-relaxed">
  AfterFive is currently in beta. If you have any suggestions or find bugs, feel free to slide into my DMs:
  <a 
    href="https://instagram.com/aaronalagbann" 
    target="_blank" 
    className="text-[#FF3D00] font-bold block mt-2 hover:underline"
  >
    @aaronalagbann
  </a>

  <span className="block mt-4">Currently tracking venues:</span>
  <span className="block mt-3 text-neutral-400">
    Kampai • Apotheka Manila • Open House • Uma After Dark
  </span>

  <span className="block mt-4 text-neutral-500 text-xs">
    Some events may not appear yet due to current automation limits. If your event is missing, send it over.
  </span>
</p>
              <button 
                onClick={() => setShowBetaModal(false)}
                className="w-full bg-black text-white py-3 font-black uppercase hover:bg-[#FF3D00] transition-colors border-2 border-black"
              >
                Aight
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DESKTOP SIDEBAR --- */}
      <nav className="hidden md:flex flex-col w-[260px] h-full border-r-2 border-black z-50 shrink-0 bg-white">
        <div className="h-[180px] border-b-2 border-black bg-[#FFEB3B] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
           <div className="absolute inset-0 playful-bg opacity-20" />
           <h1 className="font-black text-5xl tracking-tighter italic z-10 relative bg-white border-2 border-black px-4 py-2 shadow-[4px_4px_0px_#000] -rotate-3 hover:rotate-0 transition-transform cursor-pointer">AFTERFIVE</h1>
        </div>
        
        <div className="flex-1 flex flex-col overflow-y-auto hide-scrollbar">
          <SidebarLink label="LIVE" sub="HAPPENING NOW" active={view === "LIVE"} onClick={() => setView("LIVE")} color="#00E5FF" icon={<Zap />} />
          <SidebarLink label="UPCOMING" sub="THIS WEEK" active={view === "AGENDA"} onClick={() => setView("AGENDA")} color="#76FF03" icon={<Calendar />} />
          <SidebarLink label="ARCHIVES" sub="WHAT YOU MISSED" active={view === "ARCHIVE"} onClick={() => setView("ARCHIVE")} color="#D500F9" icon={<Disc />} />
          <SidebarLink label="MAP" sub="VENUES" active={view === "MAP"} onClick={() => setView("MAP")} color="#FF3D00" icon={<MapIcon />} />

          <div className="mt-auto p-6 border-t-2 border-black bg-[#F0F0F0]">
            <div className="bg-white border-2 border-black px-3 py-2 flex items-center gap-2 justify-center shadow-[3px_3px_0px_#000]">
              <span className="w-2 h-2 bg-[#FF3D00] rounded-full animate-pulse" />
              <span className="font-black text-[10px] tracking-widest uppercase">Beta Build v0.1</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-black text-white border-t-2 border-black">
          <Marquee text="MANILA AFTER DARK • DRINK RESPONSIBLY • " />
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 w-full h-full relative overflow-hidden bg-white flex flex-col">
        <div className="md:hidden h-[60px] w-full border-b-2 border-black bg-[#FFEB3B] flex items-center justify-between px-4 z-50 shrink-0">
           <h1 className="font-black text-2xl tracking-tighter italic">AFTERFIVE</h1>
           <div className="bg-black text-white px-2 py-0.5 text-[10px] font-bold font-mono border border-black shadow-[2px_2px_0px_#FF3D00]">BETA</div>
        </div>

        <div className="flex-1 w-full relative overflow-y-auto hide-scrollbar pb-[50px] md:pb-0">
          <AnimatePresence mode="wait">
            {!loading && (
              <>
                {view === "LIVE" && <GalleryView key="LIVE" events={galleryData} />}
                {view === "AGENDA" && <BlockListView key="AGENDA" title="INCOMING" events={upcomingEvents} theme="vibrant" />}
                {view === "ARCHIVE" && <BlockListView key="ARCHIVE" title="ARCHIVE" events={pastEvents} theme="dark" />}
                {view === "MAP" && <MapView key="MAP" isLoaded={isMapLoaded} />}
              </>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* --- SLIM MOBILE NAV --- */}
      <div className="md:hidden fixed bottom-0 left-0 w-full h-12 bg-white border-t-2 border-black z-50 flex items-stretch">
         <MobileNavBtn icon={<Zap size={18} />} active={view === "LIVE"} onClick={() => setView("LIVE")} />
         <div className="w-[2px] h-full bg-black" />
         <MobileNavBtn icon={<Calendar size={18} />} active={view === "AGENDA"} onClick={() => setView("AGENDA")} />
         <div className="w-[2px] h-full bg-black" />
         <MobileNavBtn icon={<Disc size={18} />} active={view === "ARCHIVE"} onClick={() => setView("ARCHIVE")} />
         <div className="w-[2px] h-full bg-black" />
         <MobileNavBtn icon={<MapIcon size={18} />} active={view === "MAP"} onClick={() => setView("MAP")} />
      </div>

    </div>
  );
}

// ==========================================
// 1. GALLERY VIEW (Signal)
// ==========================================
function GalleryView({ events }: { events: any[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (events.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % events.length);
    }, 6000); 
    return () => clearInterval(interval);
  }, [events.length]);

  if (!events || events.length === 0) return <EmptyState />;

  const activeEvent = events[current];
  const next = () => setCurrent((prev) => (prev + 1) % events.length);
  const prev = () => setCurrent((prev) => (prev - 1 + events.length) % events.length);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col relative bg-[#F0F0F0] overflow-hidden">
       <div className="absolute inset-0 playful-bg opacity-10 pointer-events-none" />
       <div className="absolute inset-0 color-wash opacity-30 pointer-events-none" />
       
       <div className="flex-1 relative flex items-center justify-center p-6 md:p-12 overflow-hidden">
          <div className={`absolute inset-0 opacity-20 transition-colors duration-1000 ${current % 2 === 0 ? 'bg-[#00E5FF]' : 'bg-[#FF3D00]'}`} />

          {events.length > 1 && (
            <>
              <button onClick={prev} className="absolute left-2 md:left-8 z-20 p-2 md:p-3 bg-white border-2 border-black hover:bg-[#FFEB3B] hard-shadow-sm active:translate-y-1 active:shadow-none"><ChevronLeft size={20} /></button>
              <button onClick={next} className="absolute right-2 md:right-8 z-20 p-2 md:p-3 bg-white border-2 border-black hover:bg-[#FFEB3B] hard-shadow-sm active:translate-y-1 active:shadow-none"><ChevronRight size={20} /></button>
            </>
          )}

          <AnimatePresence mode="wait">
            <motion.div 
              key={activeEvent.image_url}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.3 }}
              className="relative z-10 h-full w-auto max-w-full flex justify-center bg-white border-2 md:border-4 border-black p-2 md:p-4 shadow-[8px_8px_0px_rgba(0,0,0,1)]"
            >
               <img src={activeEvent.image_url} className="h-full w-auto object-contain max-w-full" alt="Gig Poster" />
               <div className="absolute top-0 right-0 translate-x-2 -translate-y-2 bg-black text-white px-2 py-0.5 font-mono font-bold text-xs border-2 border-white shadow-[2px_2px_0px_#FFEB3B] rotate-3">
                  {current + 1} / {events.length}
               </div>
            </motion.div>
          </AnimatePresence>
       </div>

       <div className="h-auto shrink-0 bg-white border-t-2 border-black flex flex-row md:items-stretch z-20 relative shadow-[0px_-4px_10px_rgba(0,0,0,0.1)]">
          <div className="w-[90px] md:w-[200px] shrink-0 bg-[#FFEB3B] border-r-2 border-black p-2 md:p-4 flex flex-col justify-center items-center text-center">
             <span className="font-mono font-bold text-[9px] md:text-sm uppercase tracking-widest mb-1">Happening</span>
             <span className="font-black text-3xl md:text-6xl uppercase leading-none">{new Date(activeEvent.event_date).getDate()}</span>
             <span className="font-black text-[10px] md:text-xl uppercase">{new Date(activeEvent.event_date).toLocaleDateString("en-US", { month: 'short' })}</span>
          </div>

          <div className="flex-1 flex flex-col justify-center relative overflow-hidden min-w-0">
             <div className="w-full h-5 md:h-7 bg-black text-white flex items-center overflow-hidden shrink-0">
                <Marquee text={`NOW PLAYING AT @${activeEvent.club_name.toUpperCase()} // `} />
             </div>
             
             <div className="p-3 md:p-6 overflow-hidden bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-black text-xl md:text-5xl uppercase leading-none mb-2 md:mb-3 truncate text-black drop-shadow-[1px_1px_0px_#FF3D00]">
                     {activeEvent.event_name || "LIVE SESSION"}
                  </h2>
                  <div className="flex flex-wrap gap-1 md:gap-2">
                     {activeEvent.dj_names.slice(0, 4).map((dj: string, i: number) => (
                        <span key={i} className="bg-black text-white px-1.5 py-0.5 font-mono font-bold text-[9px] md:text-xs uppercase border border-black shadow-[2px_2px_0px_#00E5FF]">
                           {dj}
                        </span>
                     ))}
                     {activeEvent.dj_names.length > 4 && <span className="text-[10px] font-bold py-0.5">+MORE</span>}
                  </div>
                </div>

                <a href={activeEvent.ig_post_url} target="_blank" className="bg-[#FF3D00] text-white px-4 py-3 md:px-6 md:py-4 font-black uppercase tracking-widest text-[10px] md:text-xs hover:bg-black transition-colors border-2 border-black hard-shadow-sm flex items-center justify-center gap-2 shrink-0">
                   <Instagram size={16} /> <span className="hidden md:inline">VIEW</span> INSTAGRAM
                </a>
             </div>
          </div>
       </div>
    </motion.div>
  );
}

// ==========================================
// 2. BLOCK LIST VIEW (AGENDA & ARCHIVES) - UPDATED
// ==========================================
function BlockListView({ title, events, theme }: { title: string, events: any[], theme: "vibrant" | "dark" }) {
  const grouped = events.reduce((acc: any, event: any) => {
    const dateStr = event.event_date.substring(0, 10);
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(event);
    return acc;
  }, {});
  
  const sortedDates = Object.keys(grouped).sort((a,b) => 
    title === "ARCHIVE" ? new Date(b).getTime() - new Date(a).getTime() : new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div className={`w-full min-h-full pb-[60px] md:pb-12 ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-[#F0F0F0]'}`}>
       
       <div className={`fixed inset-0 playful-bg pointer-events-none z-0 ${theme === 'dark' ? 'opacity-10' : 'opacity-10'}`} />
       <div className={`fixed inset-0 color-wash pointer-events-none z-0 ${theme === 'dark' ? 'opacity-10' : 'opacity-30'}`} />

       <div className={`sticky top-0 z-50 border-b-2 border-black p-4 md:p-8 transition-colors shadow-md ${theme === 'dark' ? 'bg-[#1a1a1a]/95' : 'bg-[#F0F0F0]/95 backdrop-blur-md'}`}>
          <h1 className={`font-black text-4xl md:text-7xl uppercase tracking-tighter leading-none ${theme === 'dark' ? 'text-white' : 'text-black drop-shadow-[3px_3px_0px_#fff]'}`}>
             {title}
          </h1>
       </div>

       <div className="flex flex-col relative z-10">
          {sortedDates.map((date, dateIndex) => {
             const headerBg = COLORS.dates[dateIndex % COLORS.dates.length];
             const dateObj = new Date(date);

             return (
               <div key={date} className="relative">
                  
                  <div 
                     className="sticky top-[73px] md:top-[138px] z-40 border-b-2 border-black py-2 px-3 md:px-6 flex justify-between items-center hard-shadow-date transition-transform"
                     style={{ backgroundColor: headerBg }}
                  >
                     <div className="flex items-center gap-3">
                        <div className="bg-white border-2 border-black px-2 py-0.5 md:py-1 font-black text-2xl md:text-3xl leading-none shadow-[2px_2px_0px_#000] -rotate-3 hover:rotate-0 transition-transform cursor-default">
                           {dateObj.getDate()}
                        </div>
                        <div className="flex flex-col">
                           <span className="font-black text-lg md:text-xl uppercase leading-none text-black">
                              {dateObj.toLocaleDateString("en-US", { weekday: 'long' })}
                           </span>
                           <span className="font-mono font-bold text-[10px] md:text-xs uppercase leading-none text-black/70 mt-0.5">
                              {dateObj.toLocaleDateString("en-US", { month: 'long' })}
                           </span>
                        </div>
                     </div>
                     <Star size={20} className="text-black opacity-30 animate-spin-slow hidden md:block" />
                  </div>

                  <div className={`grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-0 border-b-2 border-black`}>
                     {grouped[date].map((e: any, i: number) => {
                        const hoverBg = COLORS.cardHover[i % COLORS.cardHover.length];
                        
                        return (
                          <a 
                            key={i} 
                            href={e.ig_post_url} 
                            target="_blank" 
                            className="group relative border-r-2 border-black bg-white flex flex-col h-full overflow-hidden hover:z-20"
                          >
                             <div className="w-full aspect-square border-b-2 border-black bg-[#E5E5E5] relative p-2 md:p-6 flex items-center justify-center overflow-hidden">
                                <div className="absolute inset-0 pattern-grid opacity-[0.08]" />
                                {e.image_url ? (
                                  <img 
                                     src={e.image_url} 
                                     className="w-full h-full object-contain drop-shadow-[4px_4px_0px_rgba(0,0,0,0.6)] group-hover:scale-110 group-hover:rotate-1 transition-all duration-300 z-0" 
                                     alt="Gig Poster" 
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-black text-black/20 text-xl -rotate-12 z-0">NO IMG</div>
                                )}
                                <div className="absolute top-2 left-2 md:top-3 md:left-3 bg-[#FF3D00] text-white border-2 border-black px-1.5 py-0.5 md:px-2 md:py-1 font-black text-[9px] md:text-sm uppercase shadow-[2px_2px_0px_#000] -rotate-3 group-hover:rotate-0 transition-transform z-10">
                                   {e.club_name}
                                </div>
                             </div>

                             <div 
                                className="p-3 md:p-5 flex-1 flex flex-col justify-between relative transition-colors duration-200"
                                style={{ backgroundColor: 'white' }}
                             >
                                <div 
                                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-0" 
                                  style={{ backgroundColor: hoverBg }} 
                                />
                                <div className="relative z-10 flex flex-col h-full">
                                  <h3 className="font-black text-sm md:text-xl uppercase leading-[1.1] mb-2 md:mb-4 group-hover:text-black line-clamp-2">
                                     {e.event_name || "CLUB NIGHT"}
                                  </h3>
                                  
                                  <div className="flex flex-wrap gap-1.5 mt-auto">
                                     {e.dj_names.map((dj: string, idx: number) => (
                                        <span key={idx} className="bg-black text-white px-1.5 py-[2px] md:px-2 md:py-1 font-mono font-bold text-[9px] md:text-[11px] uppercase border border-transparent group-hover:border-black group-hover:shadow-[1px_1px_0px_#000]">
                                           {dj}
                                        </span>
                                     ))}
                                  </div>
                                </div>
                             </div>
                          </a>
                        );
                     })}
                  </div>
               </div>
             );
          })}
       </div>
    </div>
  );
}

// ==========================================
// 3. MAP VIEW
// ==========================================
function MapView({ isLoaded }: { isLoaded: boolean }) {
  const [selected, setSelected] = useState<any>(null);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full relative">
       <div className="absolute inset-0 playful-bg opacity-10 bg-white pointer-events-none" />

       {!isLoaded ? <div className="w-full h-full flex items-center justify-center font-black text-3xl">LOADING SECTOR...</div> : (
         <GoogleMap 
           mapContainerClassName="w-full h-full" 
           center={POBLACION_CENTER} zoom={17} 
           options={{ styles: popMapStyle, disableDefaultUI: true, clickableIcons: false }} 
           onClick={() => setSelected(null)}
         >
            {POBLACION_BARS.map((bar, i) => (
               <Marker 
                 key={i} position={bar} 
                 icon={{ 
                   path: typeof window !== "undefined" ? window.google.maps.SymbolPath.CIRCLE : 0, 
                   fillColor: selected?.name === bar.name ? "#FF3D00" : "#000000", 
                   fillOpacity: 1, scale: 12, strokeColor: "#ffffff", strokeWeight: 3
                 }} 
                 onClick={() => setSelected(bar)} 
               />
            ))}
         </GoogleMap>
       )}
       
       <AnimatePresence>
         {selected && (
            <motion.div 
               initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
               className="absolute bottom-16 md:bottom-8 left-4 md:left-8 right-4 md:w-[400px] bg-white border-2 border-black hard-shadow p-6 z-30"
            >
               <div className="flex justify-between items-start mb-2">
                  <h3 className="font-black text-2xl md:text-3xl uppercase leading-none">{selected.name}</h3>
                  <button onClick={() => setSelected(null)}><X size={24} className="border-2 border-black hover:bg-[#FF3D00] transition-colors" /></button>
               </div>
               <div className="flex gap-2 mb-4">
                  <div className="bg-[#00E5FF] px-2 py-1 font-mono text-xs font-bold border-2 border-black uppercase hard-shadow-sm">
                      {selected.type}
                  </div>
                  <div className="bg-[#76FF03] px-2 py-1 font-mono text-xs font-bold border-2 border-black uppercase hard-shadow-sm">
                      UNTIL {selected.status}
                  </div>
               </div>
               <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`} target="_blank" className="block w-full text-center py-3 bg-black text-white font-bold uppercase hover:bg-[#FF3D00] border-2 border-black transition-colors">
                  NAVIGATE TO SECTOR
               </a>
            </motion.div>
         )}
       </AnimatePresence>
    </motion.div>
  );
}

// ==========================================
// UTILITIES
// ==========================================

function SidebarLink({ label, sub, active, onClick, color, icon }: any) {
  return (
    <button 
      onClick={onClick}
      className={`
        w-full p-6 text-left border-b-2 border-black transition-all group relative overflow-hidden flex items-center justify-between
        ${active ? 'bg-black text-white' : 'bg-white hover:bg-[#F0F0F0]'}
      `}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-2 transition-all duration-300 ${active ? 'w-full opacity-10' : 'w-3'}`} style={{ backgroundColor: color }} />
      <div className="relative z-10 pl-4">
         <h3 className="font-black text-2xl uppercase leading-none mb-1 group-hover:translate-x-1 transition-transform">{label}</h3>
         <p className={`font-mono text-[10px] font-bold tracking-widest uppercase opacity-60`}>{sub}</p>
      </div>
      <div className={`relative z-10 transform transition-transform ${active ? 'rotate-12 scale-125' : 'group-hover:rotate-12'}`} style={{ color: active ? color : 'black' }}>
        {icon}
      </div>
    </button>
  );
}

function MobileNavBtn({ icon, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center transition-colors ${active ? 'bg-[#FFEB3B] text-black shadow-[inset_0px_4px_0px_#000]' : 'bg-white text-black hover:bg-gray-100'}`}>
       <div className={`transform transition-transform ${active ? 'scale-125' : 'scale-100'}`}>
         {icon}
       </div>
    </button>
  );
}

function Marquee({ text }: { text: string }) {
  return (
    <div className="relative w-full overflow-hidden whitespace-nowrap">
      <div className="animate-marquee inline-block font-mono font-bold text-[10px] md:text-xs">
        {text.repeat(10)}
      </div>
      <style>{`
        .animate-marquee { animation: marquee 15s linear infinite; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#FFEB3B] p-8 text-center border-2 border-black m-4 hard-shadow">
      <h1 className="font-black text-2xl md:text-4xl uppercase mb-2">NO SIGNAL</h1>
      <p className="font-mono font-bold text-xs md:text-sm">Check back later or view the Agenda.</p>
    </div>
  );
}