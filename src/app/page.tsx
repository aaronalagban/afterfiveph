"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase-client";
import { 
  MapPin, ArrowUpRight, Calendar, Disc, Map as MapIcon, 
  X, Star, Zap, Instagram, ChevronLeft, ChevronRight,
  Sun, Moon, Plus
} from "lucide-react";
import { GoogleMap, useLoadScript, Marker } from "@react-google-maps/api";

// --- CONFIG & PALETTE ---
const COLORS = {
  dates: ["#00E5FF", "#76FF03", "#FFEB3B", "#D500F9", "#FF3D00"], 
  cardHover: ["#FFEB3B", "#00E5FF", "#76FF03"]
};

// Animation Variants for Tab Switching
const TAB_VARIANTS = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: "easeInOut" }
};

const POBLACION_CENTER = { lat: 14.5648, lng: 121.0318 };
const POBLACION_BARS = [
  { name: "Kampai", lat: 14.56420, lng: 121.03163, type: "Listening Bar", status: "03:00" },
  { name: "Apotheka Manila", lat: 14.56471, lng: 121.03234, type: "Club", status: "04:00" },
  { name: "Open House World", lat: 14.55869, lng: 121.02443, type: "Listening Bar", status: "02:00" },
  { name: "Uma After Dark", lat: 14.56515, lng: 121.03152, type: "Club", status: "03:00" },
  { name: "Z Hostel Roofdeck", lat: 14.56550, lng: 121.03193, type: "Rooftop", status: "02:00" },
  { name: "Run Rabbit Run", lat: 14.56405, lng: 121.03224, type: "Speakeasy", status: "01:00" },
  { name: "OTO", lat: 14.56449, lng: 121.03080, type: "Hi-Fi Bar", status: "02:00" },
  { name: "Agimat", lat: 14.56430, lng: 121.03255, type: "Cocktail Bar", status: "02:00" },
  { name: "Spirits Library", lat: 14.56575, lng: 121.03178, type: "Cocktail Bar", status: "03:00" },
  { name: "Alamat", lat: 14.56482, lng: 121.03163, type: "Bar", status: "02:00" },
  { name: "Ugly Duck", lat: 14.56468, lng: 121.03209, type: "Tapas Bar", status: "02:00" },
  { name: "Buccaneers Rum & Kitchen", lat: 14.56523, lng: 121.03231, type: "Rum Bar", status: "02:00" },
  { name: "Japonesa", lat: 14.56503, lng: 121.03199, type: "Bar", status: "02:00" },
  { name: "Polilya", lat: 14.56473, lng: 121.03069, type: "Restaurant Bar", status: "00:00" },
  { name: "Funky Monkey", lat: 14.56408, lng: 121.03012, type: "Bar", status: "02:00" },
  { name: "Almacen", lat: 14.56432, lng: 121.03115, type: "Bar", status: "02:00" },
  { name: "The Way Out", lat: 14.56496, lng: 121.03245, type: "Club", status: "03:00" },
  { name: "WYP (What's Your Poison)", lat: 14.56560, lng: 121.03103, type: "Cocktail Bar", status: "02:00" }
];

const popMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.stroke", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#000000" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#00E5FF" }] },
];

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#00E5FF" }] },
];

export default function AfterFivePop() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [showBetaModal, setShowBetaModal] = useState(false);
  const [view, setView] = useState<"LIVE" | "AGENDA" | "MAP" | "ARCHIVE">("LIVE");
  const [darkMode, setDarkMode] = useState(false);
  
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded: isMapLoaded } = useLoadScript({ googleMapsApiKey: googleMapsKey || "" });

  // Initialize Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setDarkMode(true);
    else if (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
      setShowBetaModal(true); 
    }, 3500);

    async function init() {
      if (!supabase) { setLoading(false); return; }
      const { data, error } = await supabase.from("events").select("*").order("event_date", { ascending: true });
      
      if (error) console.error("Supabase Error:", error);

      if (data) {
        const grouped = data.reduce((acc: any[], current: any) => {
          if (!current.event_date) return acc;

          let rawDjs = current.djs || current.dj_name || "";
          let currentDjs: string[] = [];

          if (Array.isArray(rawDjs)) {
             currentDjs = rawDjs;
          } else if (typeof rawDjs === 'string') {
             let cleanStr = rawDjs.replace(/""/g, '"');
             if (cleanStr.trim().startsWith('[')) {
                try { currentDjs = JSON.parse(cleanStr); } 
                catch { currentDjs = cleanStr.split(','); }
             } else {
                currentDjs = cleanStr.split(','); 
             }
          }

          currentDjs = currentDjs.map((d: any) => String(d).replace(/[\[\]"]/g, '').trim()).filter((d) => d.length > 0);
          if (currentDjs.length === 0) currentDjs = ["HEADLINER"];

          const existing = acc.find((e) => 
            e.club_name === current.club_name && 
            e.event_date === current.event_date &&
            e.event_name === current.event_name 
          );

          if (existing) {
            currentDjs.forEach((dj) => {
               if (!existing.dj_names.includes(dj)) existing.dj_names.push(dj);
            });
          } else {
            acc.push({ ...current, dj_names: [...currentDjs] });
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

  const getLogicalToday = () => {
    const now = new Date();
    const manilaTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Manila" });
    const manilaDate = new Date(manilaTimeStr);
    manilaDate.setHours(manilaDate.getHours() - 5);
    const year = manilaDate.getFullYear();
    const month = String(manilaDate.getMonth() + 1).padStart(2, '0');
    const day = String(manilaDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [today, setToday] = useState(getLogicalToday());

  useEffect(() => {
    const getMsUntilNext5AM = () => {
      const now = new Date();
      const manilaTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Manila" });
      const manilaNow = new Date(manilaTimeStr);
      const next5AM = new Date(manilaNow);
      next5AM.setHours(5, 0, 0, 0);

      if (manilaNow.getTime() >= next5AM.getTime()) {
        next5AM.setDate(next5AM.getDate() + 1);
      }
      return next5AM.getTime() - manilaNow.getTime();
    };

    let timeoutId: NodeJS.Timeout;
    const scheduleRefresh = () => {
      const msUntil5AM = getMsUntilNext5AM();
      timeoutId = setTimeout(() => {
        setToday(getLogicalToday()); 
        scheduleRefresh(); 
      }, msUntil5AM);
    };

    scheduleRefresh();
    return () => clearTimeout(timeoutId);
  }, []);

  const normalizeDbDate = (d: string) => d?.substring(0, 10).replace(/[ /]/g, "-") || "";
  
  const tonightEvents = events.filter((e) => normalizeDbDate(e.event_date) === today);
  const upcomingEvents = events.filter((e) => normalizeDbDate(e.event_date) > today);
  const pastEvents = events.filter((e) => normalizeDbDate(e.event_date) < today).reverse();
  const galleryData = tonightEvents.length > 0 ? tonightEvents : upcomingEvents;

  return (
    <div className={`fixed inset-0 w-full h-full font-sans overflow-hidden flex flex-col md:flex-row transition-colors duration-300 ${darkMode ? 'bg-[#121212] text-white' : 'bg-white text-black'}`}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        /* Reduced Shadow Sizes */
        .hard-shadow { box-shadow: 4px 4px 0px 0px #000; }
        .hard-shadow-sm { box-shadow: 2px 2px 0px 0px #000; }
        .hard-shadow-date { box-shadow: 0px 2px 0px 0px #000; }
        
        .playful-bg {
          background-color: transparent;
          background-image: radial-gradient(#000 1px, transparent 1px), radial-gradient(#000 1px, transparent 1px);
          background-size: 40px 40px;
          background-position: 0 0, 20px 20px;
          animation: bgShift 10s linear infinite;
        }

        .playful-bg-dark {
          background-color: transparent;
          background-image: radial-gradient(#ffffff 1px, transparent 1px), radial-gradient(#ffffff 1px, transparent 1px);
          background-size: 40px 40px;
          background-position: 0 0, 20px 20px;
          animation: bgShift 10s linear infinite;
        }

        @keyframes bgShift {
          0% { background-position: 0 0, 20px 20px; }
          100% { background-position: 40px 40px, 60px 60px; }
        }

        .animate-marquee-title {
          display: inline-block;
          animation: marquee-title 15s linear infinite;
        }

        @keyframes marquee-title {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}} />

      {/* --- SPLASH SCREEN --- */}
      <AnimatePresence>
        {showSplash && (
          <motion.div 
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 text-center"
            exit={{ y: "-100%", transition: { duration: 0.8, ease: "circIn" } }}
          >
            <img src="/logo-1.png" alt="AfterFive Logo" className="w-[60vw] max-w-[300px] md:max-w-[400px] mb-8 animate-pulse drop-shadow-[0px_0px_30px_rgba(255,61,0,0.4)]" />
            <div className="overflow-hidden">
              <motion.p 
                initial={{ y: "100%" }} 
                animate={{ y: 0 }} 
                transition={{ delay: 0.5, duration: 0.5 }}
                className="font-mono font-bold text-xs md:text-sm text-neutral-400 tracking-[0.3em] uppercase"
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`border-2 hard-shadow p-8 max-w-sm w-full text-center ${darkMode ? 'bg-[#1a1a1a] border-neutral-700 text-white' : 'bg-white border-black text-black'}`}
            >
              <h2 className="font-black text-3xl uppercase mb-4">WIP / BETA</h2>
              <p className="font-mono text-sm mb-6 leading-relaxed">
                AfterFive is currently in beta. If you have any suggestions or find bugs, feel free to slide into my DMs:
                <a href="https://instagram.com/aaronalagbann" target="_blank" className="text-[#FF3D00] font-bold block mt-2 hover:underline">@aaronalagbann</a>
                <span className="block mt-4">Currently tracking venues:</span>
                <span className={`block mt-3 ${darkMode ? 'text-neutral-300' : 'text-neutral-500'}`}>Kampai • Apotheka Manila • Open House World • Uma After Dark • Electric Sala • Ugly Duck</span>
                <span className={`block mt-4 text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Some events may not appear yet due to current automation limits.</span>
              </p>
              <button 
                onClick={() => setShowBetaModal(false)}
                className={`w-full py-3 font-black uppercase transition-colors border-2 ${darkMode ? 'bg-white text-black hover:bg-[#FF3D00] hover:text-white border-white' : 'bg-black text-white hover:bg-[#FF3D00] border-black'}`}
              >
                Aight
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DESKTOP SIDEBAR --- */}
      <nav className={`hidden md:flex flex-col w-[260px] h-full border-r-2 z-50 shrink-0 ${darkMode ? 'bg-[#111] border-neutral-800' : 'bg-white border-black'}`}>
        <div className={`h-[180px] border-b-2 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden ${darkMode ? 'bg-[#000] border-neutral-800' : 'bg-white border-black'}`}>
           <div className={`absolute inset-0 opacity-10 ${darkMode ? 'playful-bg-dark' : 'playful-bg'}`} />
           <img src="/logo-1.png" alt="AfterFive Logo" className="w-48 z-10 relative cursor-pointer hover:scale-105 transition-transform" onClick={() => setView("LIVE")} />
        </div>
        
        <div className="flex-1 flex flex-col overflow-y-auto hide-scrollbar">
          <SidebarLink label="CURRENT" sub="HAPPENING NOW" active={view === "LIVE"} onClick={() => setView("LIVE")} color="#00E5FF" icon={<Zap />} darkMode={darkMode} />
          <SidebarLink label="INCOMING" sub="THIS WEEK" active={view === "AGENDA"} onClick={() => setView("AGENDA")} color="#76FF03" icon={<Calendar />} darkMode={darkMode} />
          <SidebarLink label="MAP" sub="VENUES" active={view === "MAP"} onClick={() => setView("MAP")} color="#FF3D00" icon={<MapIcon />} darkMode={darkMode} />
          <SidebarLink label="ARCHIVES" sub="WHAT YOU MISSED" active={view === "ARCHIVE"} onClick={() => setView("ARCHIVE")} color="#D500F9" icon={<Disc />} darkMode={darkMode} />
        </div>

        {/* Desktop Footer Toggles */}
        <div className={`p-4 flex justify-between items-center border-t-2 font-mono text-[10px] uppercase tracking-wider ${darkMode ? 'bg-[#111] border-neutral-800 text-neutral-400' : 'bg-white border-black text-neutral-500'}`}>
          <a href="/admin/submit" className="hover:text-[#FF3D00] transition-colors flex items-center gap-1 group">
            <Plus size={12} className="group-hover:rotate-90 transition-transform" /> Submit Event
          </a>
          <button onClick={() => setDarkMode(!darkMode)} className="hover:text-[#00E5FF] transition-colors flex items-center gap-1">
            {darkMode ? <Sun size={12} /> : <Moon size={12} />} Theme
          </button>
        </div>
        
        <div className={`p-4 text-white border-t-2 ${darkMode ? 'bg-[#000] border-neutral-800' : 'bg-black border-black'}`}>
          <Marquee text="MANILA AFTER DARK • DRINK RESPONSIBLY • " />
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
        {/* Mobile Header */}
        <div className={`md:hidden h-[60px] w-full border-b-2 flex items-center justify-between px-4 z-50 shrink-0 ${darkMode ? 'bg-[#000] border-neutral-800' : 'bg-white border-black'}`}>
           <img src="/logo-1.png" alt="AfterFive Logo" className="h-6 w-auto" onClick={() => setView("LIVE")} />
           <div className="flex items-center gap-4">
             <a href="/admin/submit" className={`text-[9px] font-mono uppercase tracking-wider flex items-center gap-0.5 ${darkMode ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-black'}`}>
               <Plus size={10} /> Submit
             </a>
             <button onClick={() => setDarkMode(!darkMode)} className={`transition-colors ${darkMode ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-black'}`}>
               {darkMode ? <Sun size={16} /> : <Moon size={16} />}
             </button>
             <div className="bg-[#FF3D00] text-white px-2 py-0.5 text-[10px] font-bold font-mono shadow-[1px_1px_0px_transparent] border border-transparent">BETA</div>
           </div>
        </div>

        <div className="flex-1 w-full relative overflow-y-auto hide-scrollbar pb-[50px] md:pb-0">
          <AnimatePresence mode="wait">
            {!loading && (
              <>
                {view === "LIVE" && <GalleryView key="LIVE" events={galleryData} darkMode={darkMode} />}
                {view === "AGENDA" && <BlockListView key="AGENDA" title="INCOMING" events={upcomingEvents} darkMode={darkMode} />}
                {view === "MAP" && <MapView key="MAP" isLoaded={isMapLoaded} darkMode={darkMode} />}
                {view === "ARCHIVE" && <ArchiveCalendarView key="ARCHIVE" events={pastEvents} darkMode={darkMode} />}
              </>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* --- MOBILE NAV --- */}
      <div className={`md:hidden fixed bottom-0 left-0 w-full h-12 border-t-2 z-50 flex items-stretch ${darkMode ? 'bg-[#111] border-neutral-800' : 'bg-white border-black'}`}>
         <MobileNavBtn icon={<Zap size={18} />} active={view === "LIVE"} onClick={() => setView("LIVE")} darkMode={darkMode} />
         <div className={`w-[2px] h-full ${darkMode ? 'bg-neutral-800' : 'bg-black'}`} />
         <MobileNavBtn icon={<Calendar size={18} />} active={view === "AGENDA"} onClick={() => setView("AGENDA")} darkMode={darkMode} />
         <div className={`w-[2px] h-full ${darkMode ? 'bg-neutral-800' : 'bg-black'}`} />
         <MobileNavBtn icon={<MapIcon size={18} />} active={view === "MAP"} onClick={() => setView("MAP")} darkMode={darkMode} />
         <div className={`w-[2px] h-full ${darkMode ? 'bg-neutral-800' : 'bg-black'}`} />
         <MobileNavBtn icon={<Disc size={18} />} active={view === "ARCHIVE"} onClick={() => setView("ARCHIVE")} darkMode={darkMode} />
      </div>

    </div>
  );
}

// ==========================================
// 1. GALLERY VIEW (LIVE/CURRENT)
// ==========================================
function GalleryView({ events, darkMode }: { events: any[], darkMode: boolean }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (events.length > 1) {
      timerRef.current = setInterval(() => {
        setCurrent((prev) => (prev + 1) % events.length);
      }, 6000);
    }
  }, [events.length]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const manualNext = () => { setCurrent((prev) => (prev + 1) % events.length); resetTimer(); };
  const manualPrev = () => { setCurrent((prev) => (prev - 1 + events.length) % events.length); resetTimer(); };

  if (!events || events.length === 0) return <EmptyState darkMode={darkMode} />;

  const activeEvent = events[current];
  const title = activeEvent.event_name || "LIVE SESSION";

  return (
    <motion.div 
      variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit"
      className={`w-full h-full flex flex-col relative overflow-hidden ${darkMode ? 'bg-[#121212]' : 'bg-[#F0F0F0]'}`}
    >
       <div className={`absolute inset-0 opacity-10 pointer-events-none ${darkMode ? 'playful-bg-dark' : 'playful-bg'}`} />
      
       <div className="flex-1 relative flex items-center justify-center p-6 md:p-12 overflow-hidden">
          <div className={`absolute inset-0 opacity-20 transition-colors duration-1000 ${current % 2 === 0 ? 'bg-[#00E5FF]' : 'bg-[#FF3D00]'}`} />
          <button onClick={manualPrev} className={`absolute left-2 md:left-8 z-20 p-2 md:p-3 border-2 hard-shadow-sm active:translate-y-1 active:shadow-none transition-colors ${darkMode ? 'bg-[#1a1a1a] border-neutral-700 text-white hover:bg-neutral-800' : 'bg-white border-black hover:bg-[#FFEB3B]'}`}><ChevronLeft size={20} /></button>
          <button onClick={manualNext} className={`absolute right-2 md:right-8 z-20 p-2 md:p-3 border-2 hard-shadow-sm active:translate-y-1 active:shadow-none transition-colors ${darkMode ? 'bg-[#1a1a1a] border-neutral-700 text-white hover:bg-neutral-800' : 'bg-white border-black hover:bg-[#FFEB3B]'}`}><ChevronRight size={20} /></button>

          <AnimatePresence mode="wait">
            <motion.div key={activeEvent.image_url || activeEvent.id || current} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.3 }}
              className={`relative z-10 h-full w-auto max-w-full flex justify-center border-2 md:border-4 p-2 md:p-4 ${darkMode ? 'bg-black border-neutral-800 shadow-[4px_4px_0px_#FF3D00]' : 'bg-white border-black shadow-[4px_4px_0px_#000]'}`}>
               <img src={activeEvent.image_url} className="h-full w-auto object-contain max-w-full" alt="Gig Poster" />
          </motion.div>
          </AnimatePresence>
       </div>

       <div className={`h-auto shrink-0 border-t-2 flex flex-row md:items-stretch z-20 relative ${darkMode ? 'bg-[#111] border-neutral-800' : 'bg-white border-black'}`}>
          <div className={`w-[90px] md:w-[200px] shrink-0 border-r-2 p-2 md:p-4 flex flex-col justify-center items-center text-center ${darkMode ? 'bg-neutral-900 border-neutral-800 text-[#00E5FF]' : 'bg-[#FFEB3B] border-black text-black'}`}>
             <span className="font-mono font-bold text-[9px] md:text-sm uppercase tracking-widest mb-1 text-inherit">Happening</span>
             <span className="font-black text-3xl md:text-6xl uppercase leading-none text-inherit">{new Date(activeEvent.event_date).getDate()}</span>
             <span className="font-black text-[10px] md:text-xl uppercase text-inherit">{new Date(activeEvent.event_date).toLocaleDateString("en-US", { month: 'short' })}</span>
          </div>

          <div className="flex-1 flex flex-col justify-center relative overflow-hidden min-w-0">
             <div className="w-full h-5 md:h-7 bg-black text-white flex items-center overflow-hidden shrink-0"><Marquee text={`LIVE SESSION // LIVE SESSION // `} /></div>
             
             <div className={`p-3 md:p-6 overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 ${darkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col justify-center overflow-hidden">
                    {/* HIERARCHY: 1. VENUE */}
                    <h3 className="font-black text-lg md:text-3xl uppercase text-[#FF3D00] mb-1 line-clamp-1">
                      {activeEvent.club_name}
                    </h3>
                    
                    {/* HIERARCHY: 2. EVENT NAME */}
                    {title.length > 25 ? (
                      <div className="whitespace-nowrap overflow-hidden py-1">
                         <h2 className={`animate-marquee-title font-black text-3xl md:text-5xl uppercase ${darkMode ? 'text-white' : 'text-black'}`}>
                            {title}  ///  {title}  ///  
                         </h2>
                      </div>
                    ) : (
                      <h2 className={`font-black uppercase leading-[0.85] line-clamp-2 mb-2 ${darkMode ? 'text-white drop-shadow-[1px_1px_0px_rgba(255,255,255,0.2)]' : 'text-black drop-shadow-[1px_1px_0px_#ccc]'}`} style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)' }}>
                         {title}
                      </h2>
                    )}
                  </div>

                  {/* HIERARCHY: 3. DJ LINE UP */}
                  <div className="flex flex-wrap gap-1 md:gap-2 mt-2">
                    {(activeEvent.dj_names || []).map((dj: string, i: number) => (
                        <span key={i} className={`px-2 py-0.5 font-mono font-bold text-[9px] md:text-xs uppercase border shadow-[1px_1px_0px_#00E5FF] ${darkMode ? 'bg-neutral-800 text-white border-neutral-700' : 'bg-black text-white border-black'}`}>
                          {dj}
                        </span>
                    ))}
                  </div>
                </div>

                <a href={activeEvent.ig_post_url} target="_blank" className={`px-4 py-3 md:px-6 md:py-4 font-black uppercase tracking-widest text-[10px] md:text-xs transition-colors border-2 hard-shadow-sm flex items-center justify-center gap-2 shrink-0 ${darkMode ? 'bg-[#FF3D00] text-white border-neutral-700 hover:bg-neutral-800' : 'bg-[#FF3D00] text-white border-black hover:bg-black'}`}>
                   <Instagram size={16} /> <span className="hidden md:inline">VIEW</span> INSTAGRAM
                </a>
             </div>
          </div>
       </div>
    </motion.div>
  );
}

// ==========================================
// 2. BLOCK LIST VIEW (AGENDA/INCOMING)
// ==========================================
function BlockListView({ title, events, darkMode }: { title: string, events: any[], darkMode: boolean }) {
  const grouped = events.reduce((acc: any, event: any) => {
    if (!event.event_date) return acc;
    const dateStr = String(event.event_date).substring(0, 10);
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(event);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

  return (
    <motion.div 
      variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit"
      className={`w-full min-h-full pb-[60px] md:pb-12 ${darkMode ? 'bg-[#121212]' : 'bg-[#F0F0F0]'}`}
    >
       <div className={`fixed inset-0 pointer-events-none z-0 opacity-10 ${darkMode ? 'playful-bg-dark' : 'playful-bg'}`} />
       <div className={`sticky top-0 z-50 border-b-2 p-4 md:p-8 backdrop-blur-md ${darkMode ? 'bg-[#121212]/95 border-neutral-800' : 'bg-[#F0F0F0]/95 border-black'}`}>
          <h1 className={`font-black text-4xl md:text-7xl uppercase tracking-tighter leading-none ${darkMode ? 'text-white drop-shadow-[2px_2px_0px_#333]' : 'text-black drop-shadow-[2px_2px_0px_#fff]'}`}>{title}</h1>
       </div>
        <div className="flex flex-col relative z-10">
          {sortedDates.map((date, dateIndex) => {
               const dateObj = new Date(date);
               const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6;

               return (
                 <div key={date} className="relative">
                    <div 
                      className={`sticky top-[73px] md:top-[138px] z-40 py-3 px-3 md:px-6 flex justify-between items-center hard-shadow-date transition-colors ${darkMode ? 'border-b-2 border-neutral-800' : 'border-b-2 border-black'} ${isWeekend && !darkMode ? 'border-b-4' : ''}`} 
                      style={{ backgroundColor: isWeekend ? (darkMode ? '#111' : '#000') : (darkMode ? '#1a1a1a' : COLORS.dates[dateIndex % COLORS.dates.length]) }}
                    >
                       <div className="flex items-center gap-3">
                          <div className={`border-2 px-2 py-0.5 md:py-1 font-black text-2xl md:text-3xl shadow-[1px_1px_0px_currentColor] ${isWeekend ? 'bg-[#FF3D00] text-white border-white' : (darkMode ? 'bg-neutral-800 text-white border-neutral-600' : 'bg-white border-black text-black')}`}>
                            {dateObj.getDate()}
                          </div>
                          <span className={`font-black text-lg md:text-2xl uppercase leading-none tracking-wider ${isWeekend ? 'text-[#76FF03]' : (darkMode ? 'text-white' : 'text-black')}`}>
                            {dateObj.toLocaleDateString("en-US", { weekday: 'long' })} {isWeekend && "🔥"}
                          </span>
                       </div>
                       {isWeekend && <div className="font-mono text-[10px] md:text-xs font-bold bg-[#76FF03] text-black px-2 py-1 uppercase hidden md:block">PEAK NIGHT</div>}
                    </div>
                    
                    <div className={`grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-0 border-b-2 ${darkMode ? 'border-neutral-800' : 'border-black'}`}>
                       {grouped[date].map((e: any, i: number) => (
                          <a key={i} href={e.ig_post_url} target="_blank" className={`group relative border-r-2 flex flex-col h-full overflow-hidden hover:z-20 ${darkMode ? 'border-neutral-800 bg-[#1a1a1a]' : 'border-black bg-white'}`}>
                             <div className={`w-full aspect-square border-b-2 flex items-center justify-center overflow-hidden ${darkMode ? 'bg-[#222] border-neutral-800' : 'bg-[#E5E5E5] border-black'}`}>
                                {e.image_url ? (
                                  <img src={e.image_url} className="w-full h-full object-contain group-hover:scale-110 transition-all duration-300" />
                                ) : (
                                  <div className={`font-black text-xl ${darkMode ? 'text-white/20' : 'text-black/20'}`}>NO IMG</div>
                                )}
                             </div>
                             <div className={`p-3 md:p-5 flex-1 flex flex-col justify-between relative ${darkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
                                  {!darkMode && <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-0" style={{ backgroundColor: COLORS.cardHover[i % COLORS.cardHover.length] }} />}
                                  {darkMode && <div className="absolute inset-0 bg-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-0" />}
                                  
                                  <div className="relative z-10 flex flex-col h-full">
                                    {/* HIERARCHY: 1. VENUE */}
                                    <span className="font-black text-[10px] md:text-sm text-[#FF3D00] uppercase mb-1 line-clamp-1">{e.club_name}</span>
                                    
                                    {/* HIERARCHY: 2. EVENT NAME */}
                                    <h3 className={`font-black text-sm md:text-xl uppercase leading-[1.1] mb-3 line-clamp-2 break-words ${darkMode ? 'text-neutral-300 group-hover:text-white' : 'text-neutral-800 group-hover:text-black'}`}>
                                      {e.event_name || "CLUB NIGHT"}
                                    </h3>
                                    
                                    {/* HIERARCHY: 3. DJ LINE UP */}
                                    <div className="flex flex-wrap gap-1.5 mt-auto">
                                       {(e.dj_names || []).map((dj: string, idx: number) => (
                                         <span key={idx} className={`px-1.5 py-[2px] font-mono font-bold text-[9px] uppercase border shadow-[1px_1px_0px_transparent] ${darkMode ? 'bg-neutral-900 text-neutral-300 border-neutral-700 group-hover:border-white group-hover:text-white group-hover:shadow-[1px_1px_0px_#fff]' : 'bg-black text-white border-transparent group-hover:border-black group-hover:shadow-[1px_1px_0px_#000]'}`}>
                                           {dj}
                                         </span>
                                       ))}
                                    </div>
                                  </div>
                               </div>
                          </a>
                       ))}
                    </div>
                 </div>
               );
          })}
       </div>
    </motion.div>
  );
}

// ==========================================
// 3. ARCHIVE CALENDAR VIEW (INSTA-STYLE)
// ==========================================
function ArchiveCalendarView({ events, darkMode }: { events: any[], darkMode: boolean }) {
  const grouped = events.reduce((acc: any, event: any) => {
    if (!event.event_date) return acc;
    const dateObj = new Date(event.event_date);
    const monthYear = dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!acc[monthYear]) acc[monthYear] = [];
    acc[monthYear].push(event);
    return acc;
  }, {});

  return (
    <motion.div 
      variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit"
      className={`w-full min-h-full pb-[60px] md:pb-12 ${darkMode ? 'bg-[#121212]' : 'bg-[#F0F0F0]'}`}
    >
      <div className={`sticky top-0 z-50 border-b-2 p-4 md:p-8 backdrop-blur-md ${darkMode ? 'bg-[#121212]/95 border-neutral-800' : 'bg-[#F0F0F0]/95 border-black'}`}>
        <h1 className={`font-black text-4xl md:text-7xl uppercase tracking-tighter leading-none ${darkMode ? 'text-white drop-shadow-[2px_2px_0px_#00E5FF]' : 'text-black drop-shadow-[2px_2px_0px_#ccc]'}`}>ARCHIVES</h1>
      </div>

      <div className="p-2 md:p-6 space-y-8 mt-2">
        {Object.entries(grouped).map(([monthYear, monthEvents]) => (
          <div key={monthYear}>
            <h2 className={`font-black text-2xl uppercase mb-4 pl-2 border-l-4 border-[#00E5FF] tracking-widest ${darkMode ? 'text-white' : 'text-black'}`}>{monthYear}</h2>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 md:gap-2">
              {(monthEvents as any[]).map((e: any, i: number) => (
                <a key={i} href={e.ig_post_url} target="_blank" className={`group relative aspect-square overflow-hidden block border ${darkMode ? 'bg-[#222] border-neutral-800' : 'bg-[#E5E5E5] border-black/20'}`}>
                  {e.image_url ? (
                    <img src={e.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center font-black text-sm ${darkMode ? 'text-[#555]' : 'text-[#aaa]'}`}>NO IMG</div>
                  )}
                  
                  <div className="absolute top-1 right-1 md:top-2 md:right-2 bg-black/80 text-white px-1.5 py-0.5 font-mono text-[9px] md:text-xs font-bold rounded-sm shadow-md">
                    {new Date(e.event_date).getDate()} {new Date(e.event_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                  </div>

                  <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-center p-2 md:p-4">
                    <span className="text-[#FF3D00] font-black text-[9px] md:text-[11px] uppercase mb-1 line-clamp-1">{e.club_name}</span>
                    <span className="text-white font-bold text-xs md:text-sm leading-tight line-clamp-2 mb-2">{e.event_name}</span>
                    <div className="hidden md:flex flex-wrap justify-center gap-1">
                      {(e.dj_names || []).slice(0, 3).map((dj: string, idx: number) => (
                        <span key={idx} className="text-[#00E5FF] font-mono text-[9px] uppercase">{dj}</span>
                      ))}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ==========================================
// 4. MAP VIEW
// ==========================================
function MapView({ isLoaded, darkMode }: { isLoaded: boolean, darkMode: boolean }) {
  const [selected, setSelected] = useState<any>(null);
return (
    <motion.div 
      variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit"
      className="w-full h-full relative"
    >
       {!isLoaded ? <div className={`w-full h-full flex items-center justify-center font-black ${darkMode ? 'text-white bg-[#121212]' : 'text-black bg-white'}`}>LOADING...</div> : (
         <GoogleMap mapContainerClassName="w-full h-full" center={POBLACION_CENTER} zoom={17} options={{ styles: darkMode ? darkMapStyle : popMapStyle, disableDefaultUI: true, clickableIcons: false }} onClick={() => setSelected(null)}>
            {POBLACION_BARS.map((bar, i) => (
               <Marker key={i} position={bar} icon={{ path: typeof window !== "undefined" ? window.google.maps.SymbolPath.CIRCLE : 0, fillColor: selected?.name === bar.name ? "#FF3D00" : (darkMode ? "#fff" : "#000"), fillOpacity: 1, scale: 12, strokeColor: darkMode ? "#212121" : "#fff", strokeWeight: 3 }} onClick={() => setSelected(bar)} />
            ))}
         </GoogleMap>
       )}
       <AnimatePresence>{selected && (
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className={`absolute bottom-16 md:bottom-8 left-4 md:left-8 right-4 md:w-[400px] border-2 hard-shadow p-6 z-30 ${darkMode ? 'bg-[#1a1a1a] border-neutral-700 text-white' : 'bg-white border-black text-black'}`}>
               <div className="flex justify-between items-start mb-2"><h3 className="font-black text-2xl uppercase">{selected.name}</h3><button onClick={() => setSelected(null)}><X size={24} className={`border-2 hover:bg-[#FF3D00] ${darkMode ? 'border-neutral-500' : 'border-black'}`} /></button></div>
               <div className="flex gap-2 mb-4"><div className={`px-2 py-1 font-mono text-xs font-bold border-2 uppercase ${darkMode ? 'bg-[#00E5FF] text-black border-neutral-700' : 'bg-[#00E5FF] border-black'}`}>{selected.type}</div><div className={`px-2 py-1 font-mono text-xs font-bold border-2 uppercase ${darkMode ? 'bg-[#76FF03] text-black border-neutral-700' : 'bg-[#76FF03] border-black'}`}>UNTIL {selected.status}</div></div>
               <a href={`https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`} target="_blank" className={`block w-full text-center py-3 font-bold uppercase hover:bg-[#FF3D00] hover:text-white border-2 transition-colors ${darkMode ? 'bg-white text-black border-white' : 'bg-black text-white border-black'}`}>NAVIGATE</a>
            </motion.div>
       )}</AnimatePresence>
    </motion.div>
  );
}

// ==========================================
// UTILITIES
// ==========================================

function SidebarLink({ label, sub, active, onClick, color, icon, darkMode }: any) {
  const baseBg = darkMode ? 'bg-[#111] text-white border-neutral-800 hover:bg-neutral-900' : 'bg-white text-black border-black hover:bg-[#F0F0F0]';
  const activeBg = darkMode ? 'bg-neutral-800 text-white border-neutral-800' : 'bg-black text-white border-black';
  return (
    <button onClick={onClick} className={`w-full p-6 text-left border-b-2 transition-all group relative overflow-hidden flex items-center justify-between ${active ? activeBg : baseBg}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-2 transition-all ${active ? 'w-full opacity-10' : 'w-3'}`} style={{ backgroundColor: color }} />
      <div className="relative z-10 pl-4"><h3 className="font-black text-2xl uppercase mb-1">{label}</h3><p className="font-mono text-[10px] font-bold tracking-widest uppercase opacity-60">{sub}</p></div>
      <div className={`relative z-10 ${active ? 'scale-110' : ''}`} style={{ color: active ? color : (darkMode ? 'white' : 'black') }}>{icon}</div>
    </button>
  );
}

function MobileNavBtn({ icon, active, onClick, darkMode }: any) {
  const activeBg = darkMode ? 'bg-neutral-800 text-[#00E5FF] shadow-[inset_0px_2px_0px_#00E5FF]' : 'bg-[#FFEB3B] text-black shadow-[inset_0px_2px_0px_#000]';
  const baseBg = darkMode ? 'bg-[#111] text-neutral-400' : 'bg-white text-black';
  return (<button onClick={onClick} className={`flex-1 flex items-center justify-center transition-colors ${active ? activeBg : baseBg}`}><div className={`${active ? 'scale-125' : 'scale-100'} transition-transform`}>{icon}</div></button>);
}

function Marquee({ text }: { text: string }) {
  return (
    <div className="relative w-full overflow-hidden whitespace-nowrap">
      <div className="animate-marquee inline-block font-mono font-bold text-[10px]">{text.repeat(10)}</div>
      <style>{`.animate-marquee { animation: marquee 15s linear infinite; } @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

function EmptyState({ darkMode }: { darkMode?: boolean }) { 
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-8 text-center border-2 m-4 hard-shadow ${darkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#FFEB3B] border-black text-black'}`}>
      <h1 className="font-black text-2xl uppercase mb-2">NO SIGNAL</h1>
      <p className="font-mono font-bold text-xs">Check back later or view the Agenda.</p>
    </div>
  ); 
}