"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase-client";
import { 
  MapPin, ArrowUpRight, Calendar, Disc, Map as MapIcon, 
  X, Star, Zap, Instagram, ChevronLeft, ChevronRight,
  Sun, Moon, Plus, Users 
} from "lucide-react";
import { GoogleMap, useLoadScript, Marker } from "@react-google-maps/api";
import Link from "next/link";

// --- TYPES & INTERFACES ---
export interface AfterFiveEvent {
  id?: string | number;
  event_date: string;
  club_name: string;
  event_name?: string;
  djs?: string | string[];
  dj_name?: string | string[];
  dj_names: string[];
  image_url?: string;
  ig_post_url?: string;
  [key: string]: any;
}

export interface MarkerData {
  name: string;
  lat: number;
  lng: number;
  type: string;
  status: string;
}

// --- CONFIG & PALETTE (Soft Accents Theme) ---
const THEME = {
  dark: {
    bgPrimary: "#0B0B0D",
    bgSecondary: "#151518",
    surface: "#1C1C20",
    primaryAccent: "#F53D04",
    accentHover: "#FF4D1A",
    textPrimary: "#FFFFFF",
    textSecondary: "#B3B3B8",
    border: "#2A2A2E",
    inputBg: "#121214"
  },
  light: {
    bgPrimary: "#FFFFFF",
    bgSecondary: "#F7F7F9",
    surface: "#FFFFFF",
    primaryAccent: "#F53D04",
    accentHover: "#D93600",
    accentSoft: "#FFE5DE",
    textPrimary: "#111111",
    textSecondary: "#55555A",
    border: "#E5E5EA",
    inputBg: "#F2F2F5"
  }
};

// Animation Variants for Tab Switching
const TAB_VARIANTS = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: "easeInOut" }
};

const POBLACION_CENTER = { lat: 14.5648, lng: 121.0318 };
const POBLACION_BARS: MarkerData[] = [
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
  { elementType: "geometry", stylers: [{ color: "#F7F7F9" }] },
  { elementType: "labels.text.stroke", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#55555A" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#E5E5EA" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#5F8EA8" }] },
];

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0B0B0D" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#B3B3B8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#151518" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1C1C20" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#3A6E8F" }] },
];

export default function AfterFivePop() {
  const [events, setEvents] = useState<AfterFiveEvent[]>([]);
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
        const grouped = data.reduce<AfterFiveEvent[]>((acc, current) => {
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

          currentDjs = currentDjs.map((d: string) => String(d).replace(/[\[\]"]/g, '').trim()).filter((d) => d.length > 0);
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
    <div className={`fixed inset-0 w-full h-full font-sans overflow-hidden flex flex-col md:flex-row transition-colors duration-300 ${darkMode ? 'bg-[#0B0B0D] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#111111]'}`}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .playful-bg {
          background-color: transparent;
          background-image: radial-gradient(rgba(17,17,17,0.05) 1px, transparent 1px), radial-gradient(rgba(17,17,17,0.05) 1px, transparent 1px);
          background-size: 40px 40px;
          background-position: 0 0, 20px 20px;
          animation: bgShift 10s linear infinite;
        }

        .playful-bg-dark {
          background-color: transparent;
          background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
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
            className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 text-center ${darkMode ? 'bg-[#0B0B0D]' : 'bg-[#FFFFFF]'}`}
            exit={{ y: "-100%", transition: { duration: 0.8, ease: "circIn" } }}
          >
            <img src="/logo-1.png" alt="AfterFive Logo" className={`w-[60vw] max-w-[300px] md:max-w-[400px] mb-8 animate-pulse ${darkMode ? 'drop-shadow-[0_0_30px_rgba(245,61,4,0.4)]' : 'drop-shadow-[0_0_30px_rgba(245,61,4,0.2)]'}`} />
            <div className="overflow-hidden">
              <motion.p 
                initial={{ y: "100%" }} 
                animate={{ y: 0 }} 
                transition={{ delay: 0.5, duration: 0.5 }}
                className={`font-mono font-bold text-xs md:text-sm tracking-[0.3em] uppercase ${darkMode ? 'text-[#B3B3B8]' : 'text-[#55555A]'}`}
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
        className={`border p-8 max-w-sm w-full text-center shadow-[0_0_40px_rgba(245,61,4,0.2)] ${darkMode ? 'bg-[#1C1C20] border-[#2A2A2E] text-[#FFFFFF]' : 'bg-[#FFFFFF] border-[#E5E5EA] text-[#111111]'}`}
      >
        <h2 className="font-black text-3xl uppercase mb-4">WIP / BETA</h2>
        
        <p className={`font-mono text-sm mb-6 leading-relaxed ${darkMode ? 'text-[#B3B3B8]' : 'text-[#55555A]'}`}>
          AfterFive is currently a work in progress. If you have any suggestions or find bugs, feel free to slide into my DMs:
          <a href="https://instagram.com/aaronalagbann" target="_blank" rel="noreferrer" className="text-[#F53D04] font-bold block mt-2 hover:underline drop-shadow-[0_0_8px_rgba(245,61,4,0.2)]">@aaronalagbann</a>
          <span className={`block mt-4 text-xs ${darkMode ? 'text-[#6E6E73]' : 'text-[#8C8C92]'}`}>Some events may not appear yet due to current automation limits.</span>
        </p>

        <div className="flex flex-col gap-3">
          {/* New Submit Button/Link */}
          <a 
            href="https://afterfiveph.vercel.app/submit"
            target="_blank"
            rel="noreferrer"
            className={`block w-full py-3 font-black uppercase transition-all duration-300 border ${darkMode ? 'bg-[#151518] text-[#FFFFFF] border-[#2A2A2E] hover:border-[#F53D04] hover:text-[#F53D04]' : 'bg-[#F7F7F9] text-[#111111] border-[#E5E5EA] hover:border-[#F53D04] hover:text-[#F53D04]'}`}
          >
            Submit an Event
          </a>

          {/* Original Aight Button */}
          <button 
            onClick={() => setShowBetaModal(false)}
            className={`w-full py-3 font-black uppercase transition-all duration-300 border ${darkMode ? 'bg-[#151518] text-[#FFFFFF] border-[#2A2A2E] hover:bg-[#F53D04] hover:border-[#F53D04] hover:shadow-[0_0_20px_rgba(245,61,4,0.4)]' : 'bg-[#F7F7F9] text-[#111111] border-[#E5E5EA] hover:bg-[#F53D04] hover:text-[#FFFFFF] hover:border-[#F53D04] hover:shadow-[0_0_20px_rgba(245,61,4,0.3)]'}`}
          >
            Aight
          </button>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>

      {/* --- DESKTOP SIDEBAR --- */}
      <nav className={`hidden md:flex flex-col w-[300px] h-full border-r z-50 shrink-0 ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#F7F7F9] border-[#E5E5EA]'}`}>
        <div className={`h-[180px] border-b flex flex-col items-center justify-center p-6 text-center relative overflow-hidden ${darkMode ? 'bg-[#0B0B0D] border-[#2A2A2E]' : 'bg-[#FFFFFF] border-[#E5E5EA]'}`}>
           <div className={`absolute inset-0 opacity-10 ${darkMode ? 'playful-bg-dark' : 'playful-bg'}`} />
           <img src="/logo-1.png" alt="AfterFive Logo" className="w-48 z-10 relative cursor-pointer hover:scale-105 transition-transform" onClick={() => setView("LIVE")} />
        </div>
        
        <div className="flex-1 flex flex-col overflow-y-auto hide-scrollbar">
          <SidebarLink label="CURRENT" sub="HAPPENING NOW" active={view === "LIVE"} onClick={() => setView("LIVE")} color="#F53D04" icon={<Zap />} darkMode={darkMode} />
          <SidebarLink label="INCOMING" sub="THIS WEEK" active={view === "AGENDA"} onClick={() => setView("AGENDA")} color={darkMode ? "#5C548A" : "#7A7399"} icon={<Calendar />} darkMode={darkMode} />
          <SidebarLink label="MAP" sub="VENUES" active={view === "MAP"} onClick={() => setView("MAP")} color={darkMode ? "#3A6E8F" : "#5F8EA8"} icon={<MapIcon />} darkMode={darkMode} />
          <SidebarLink label="ARCHIVES" sub="WHAT YOU MISSED" active={view === "ARCHIVE"} onClick={() => setView("ARCHIVE")} color={darkMode ? "#8F4A5A" : "#A06A75"} icon={<Disc />} darkMode={darkMode} />
          
          {/* FSD: COMMUNITIES (Highlighted) */}
          <SidebarLink 
            href="/communities" 
            label="COMMUNITIES" 
            sub="CULTURE & CREWS" 
            active={false} 
            color={darkMode ? "#10B981" : "#059669"} 
            icon={<Users />} 
            darkMode={darkMode} 
            highlight={true} 
          />
        </div>

        {/* Desktop Footer Toggles */}
        <div className={`p-4 flex justify-between items-center border-t font-mono text-[10px] uppercase tracking-wider ${darkMode ? 'bg-[#151518] border-[#2A2A2E] text-[#B3B3B8]' : 'bg-[#F7F7F9] border-[#E5E5EA] text-[#55555A]'}`}>
          <a href="/submit" className={`hover:text-[#F53D04] transition-all flex items-center gap-1 group ${darkMode ? 'hover:drop-shadow-[0_0_8px_rgba(245,61,4,0.6)]' : ''}`}>
            <Plus size={12} className="group-hover:rotate-90 transition-transform" /> Submit Event
          </a>
          <button onClick={() => setDarkMode(!darkMode)} className={`hover:text-[#F53D04] transition-all flex items-center gap-1 ${darkMode ? 'hover:drop-shadow-[0_0_8px_rgba(245,61,4,0.6)]' : ''}`}>
            {darkMode ? <Sun size={12} /> : <Moon size={12} />} Theme
          </button>
        </div>
        
        <div className={`p-4 border-t ${darkMode ? 'bg-[#0B0B0D] border-[#2A2A2E] text-[#6E6E73]' : 'bg-[#FFFFFF] border-[#E5E5EA] text-[#8C8C92]'}`}>
          <Marquee text="MANILA AFTER DARK • DRINK RESPONSIBLY • " />
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
        {/* Mobile Header */}
        <div className={`md:hidden h-[60px] w-full border-b flex items-center justify-between px-4 z-50 shrink-0 ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#F7F7F9] border-[#E5E5EA]'}`}>
           <img src="/logo-1.png" alt="AfterFive Logo" className="h-6 w-auto" onClick={() => setView("LIVE")} />
           <div className="flex items-center gap-4">
             <a href="/submit" className={`text-[9px] font-mono uppercase tracking-wider flex items-center gap-0.5 ${darkMode ? 'text-[#B3B3B8] hover:text-[#FFFFFF]' : 'text-[#55555A] hover:text-[#111111]'}`}>
               <Plus size={10} /> Submit
             </a>
             <button onClick={() => setDarkMode(!darkMode)} className={`transition-colors ${darkMode ? 'text-[#B3B3B8] hover:text-[#FFFFFF]' : 'text-[#55555A] hover:text-[#111111]'}`}>
               {darkMode ? <Sun size={16} /> : <Moon size={16} />}
             </button>
             <div className="bg-[#F53D04] text-[#FFFFFF] px-2 py-0.5 text-[10px] font-bold font-mono border border-transparent shadow-[0_0_10px_rgba(245,61,4,0.3)]">BETA</div>
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
      <div className={`md:hidden fixed bottom-0 left-0 w-full h-12 border-t z-50 flex items-stretch ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#F7F7F9] border-[#E5E5EA]'}`}>
         <MobileNavBtn icon={<Zap size={18} />} active={view === "LIVE"} onClick={() => setView("LIVE")} color="#F53D04" darkMode={darkMode} />
         <div className={`w-[1px] h-full ${darkMode ? 'bg-[#2A2A2E]' : 'bg-[#E5E5EA]'}`} />
         <MobileNavBtn icon={<Calendar size={18} />} active={view === "AGENDA"} onClick={() => setView("AGENDA")} color={darkMode ? "#5C548A" : "#7A7399"} darkMode={darkMode} />
         <div className={`w-[1px] h-full ${darkMode ? 'bg-[#2A2A2E]' : 'bg-[#E5E5EA]'}`} />
         <MobileNavBtn icon={<MapIcon size={18} />} active={view === "MAP"} onClick={() => setView("MAP")} color={darkMode ? "#3A6E8F" : "#5F8EA8"} darkMode={darkMode} />
         <div className={`w-[1px] h-full ${darkMode ? 'bg-[#2A2A2E]' : 'bg-[#E5E5EA]'}`} />
         <MobileNavBtn icon={<Disc size={18} />} active={view === "ARCHIVE"} onClick={() => setView("ARCHIVE")} color={darkMode ? "#8F4A5A" : "#A06A75"} darkMode={darkMode} />
         <div className={`w-[1px] h-full ${darkMode ? 'bg-[#2A2A2E]' : 'bg-[#E5E5EA]'}`} />
         
         {/* FSD: COMMUNITIES MOBILE LINK (Highlighted) */}
         <MobileNavBtn href="/communities" icon={<Users size={18} />} active={false} color={darkMode ? "#10B981" : "#059669"} darkMode={darkMode} highlight={true} />
      </div>

    </div>
  );
}

// ==========================================
// 1. GALLERY VIEW (LIVE/CURRENT)
// ==========================================
interface ViewProps {
  events: AfterFiveEvent[];
  darkMode: boolean;
}

function GalleryView({ events, darkMode }: ViewProps) {
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
  const dateObj = new Date(activeEvent.event_date);
  const formattedDate = `${dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${dateObj.getFullYear()}`.toUpperCase();

  return (
    <motion.div 
      variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit"
      className={`w-full h-full flex flex-col relative overflow-hidden ${darkMode ? 'bg-[#0B0B0D]' : 'bg-[#FFFFFF]'}`}
    >
       <div className={`absolute inset-0 pointer-events-none ${darkMode ? 'playful-bg-dark' : 'playful-bg'}`} />
      
       <div className="flex-1 relative flex items-center justify-center p-6 md:p-12 overflow-hidden">
          <div className={`absolute inset-0 opacity-10 transition-colors duration-1000 ${current % 2 === 0 ? 'bg-[#F53D04]' : 'bg-[#5C548A]'}`} />
          <button onClick={manualPrev} className={`absolute left-2 md:left-8 z-20 p-2 md:p-3 border shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(255,255,255,0.05)] active:translate-y-1 active:shadow-none transition-colors ${darkMode ? 'bg-[#1C1C20] border-[#2A2A2E] text-[#FFFFFF] hover:bg-[#2A2A2E]' : 'bg-[#FFFFFF] border-[#E5E5EA] text-[#111111] hover:bg-[#F7F7F9]'}`}><ChevronLeft size={20} /></button>
          <button onClick={manualNext} className={`absolute right-2 md:right-8 z-20 p-2 md:p-3 border shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(255,255,255,0.05)] active:translate-y-1 active:shadow-none transition-colors ${darkMode ? 'bg-[#1C1C20] border-[#2A2A2E] text-[#FFFFFF] hover:bg-[#2A2A2E]' : 'bg-[#FFFFFF] border-[#E5E5EA] text-[#111111] hover:bg-[#F7F7F9]'}`}><ChevronRight size={20} /></button>

          <AnimatePresence mode="wait">
            <motion.div key={activeEvent.image_url || activeEvent.id || current} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.3 }}
              className={`relative z-10 h-full w-auto max-w-full flex justify-center border md:border-2 p-2 md:p-4 ${darkMode ? 'bg-[#151518] border-[#2A2A2E] shadow-[0_0_40px_rgba(245,61,4,0.15)]' : 'bg-[#FFFFFF] border-[#E5E5EA] shadow-[0_0_30px_rgba(0,0,0,0.1)]'}`}>
               <img src={activeEvent.image_url} className="h-full w-auto object-contain max-w-full" alt="Gig Poster" />
          </motion.div>
          </AnimatePresence>
       </div>

       <div className={`h-auto shrink-0 border-t flex flex-row md:items-stretch z-20 relative ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#F7F7F9] border-[#E5E5EA]'}`}>
          <div className={`w-1/4 md:w-[200px] shrink-0 border-r p-2 md:p-4 flex flex-col justify-center items-center text-center ${darkMode ? 'bg-[#1C1C20] border-[#2A2A2E] text-[#F53D04]' : 'bg-[#FFE5DE] border-[#E5E5EA] text-[#F53D04]'}`}>
             <span className="font-mono font-bold text-[8px] md:text-sm uppercase tracking-widest mb-1 text-inherit hidden md:block">Happening</span>
             <span className="font-black text-3xl md:text-6xl uppercase leading-none text-inherit">{new Date(activeEvent.event_date).getDate()}</span>
             <span className="font-black text-[10px] md:text-xl uppercase text-inherit">{new Date(activeEvent.event_date).toLocaleDateString("en-US", { month: 'short' })}</span>
          </div>

          <div className="flex-1 flex flex-col justify-center relative overflow-hidden min-w-0">
             <div className={`w-full h-5 md:h-7 flex items-center overflow-hidden shrink-0 ${darkMode ? 'bg-[#0B0B0D] text-[#6E6E73]' : 'bg-[#E5E5EA] text-[#8C8C92]'}`}>
               <Marquee text={`${title} / ${formattedDate} // `} />
             </div>
             
             <div className={`p-3 md:p-6 overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 ${darkMode ? 'bg-[#151518]' : 'bg-[#F7F7F9]'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col justify-center overflow-hidden">
                    <h3 className="font-black text-lg md:text-3xl uppercase text-[#F53D04] mb-1 line-clamp-1 drop-shadow-[0_0_8px_rgba(245,61,4,0.2)]">
                      {activeEvent.club_name}
                    </h3>
                    
                    {title.length > 25 ? (
                      <div className="whitespace-nowrap overflow-hidden py-1">
                         <h2 className={`animate-marquee-title font-black text-3xl md:text-5xl uppercase ${darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]'}`}>
                            {title}  ///  {title}  ///  
                         </h2>
                      </div>
                    ) : (
                      <h2 className={`font-black uppercase leading-[0.85] line-clamp-2 mb-2 ${darkMode ? 'text-[#FFFFFF] drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'text-[#111111] drop-shadow-[0_0_10px_rgba(0,0,0,0.05)]'}`} style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)' }}>
                         {title}
                      </h2>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2">
                    {(activeEvent.dj_names || []).map((dj, i) => (
                        <span key={i} className={`px-2.5 py-1 md:px-3 md:py-1.5 font-mono font-bold text-[10px] md:text-sm uppercase border ${darkMode ? 'bg-[#121214] text-[#B3B3B8] border-[#2A2A2E]' : 'bg-[#FFFFFF] text-[#55555A] border-[#E5E5EA]'}`}>
                          {dj}
                        </span>
                    ))}
                  </div>
                </div>

                <a href={activeEvent.ig_post_url} target="_blank" rel="noreferrer" className={`px-5 py-3 md:px-8 md:py-4 font-black uppercase tracking-widest text-[10px] md:text-xs transition-colors shadow-[0_0_15px_rgba(245,61,4,0.4)] flex items-center justify-center gap-2 shrink-0 ${darkMode ? 'bg-[#F53D04] text-[#FFFFFF] hover:bg-[#FF4D1A] hover:shadow-[0_0_25px_rgba(245,61,4,0.6)]' : 'bg-[#F53D04] text-[#FFFFFF] hover:bg-[#D93600]'}`}>
                   <Instagram size={18} /> <span className="hidden md:inline">VIEW</span> INSTAGRAM
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
interface BlockListViewProps extends ViewProps {
  title: string;
}

function BlockListView({ title, events, darkMode }: BlockListViewProps) {
  const grouped = events.reduce<Record<string, AfterFiveEvent[]>>((acc, event) => {
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
      className={`w-full min-h-full pb-[60px] md:pb-12 ${darkMode ? 'bg-[#0B0B0D]' : 'bg-[#FFFFFF]'}`}
    >
       <div className={`fixed inset-0 pointer-events-none z-0 ${darkMode ? 'playful-bg-dark' : 'playful-bg'}`} />
       
       <div className={`sticky top-0 z-50 border-b p-4 md:p-8 backdrop-blur-md ${darkMode ? 'bg-[#0B0B0D]/95 border-[#2A2A2E]' : 'bg-[#FFFFFF]/95 border-[#E5E5EA]'}`}>
          <h1 className={`font-black text-4xl md:text-7xl uppercase tracking-tighter leading-none ${darkMode ? 'text-[#FFFFFF] drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'text-[#111111] drop-shadow-[0_0_15px_rgba(0,0,0,0.05)]'}`}>{title}</h1>
       </div>

        <div className="flex flex-col relative z-10">
          {sortedDates.map((date, dateIndex) => {
               const dateObj = new Date(date);
               const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6;

               return (
                 <div key={date} className={`relative ${isWeekend ? 'ring-2 ring-[#F53D04] shadow-[0_0_30px_rgba(245,61,4,0.1)] z-20' : ''}`}>
                    <div 
                      className={`sticky top-[69px] md:top-[137px] z-40 py-3 px-3 md:px-6 flex justify-between items-center transition-all ${
                        isWeekend 
                          ? (darkMode ? 'bg-[#1C1C20] border-b-2 border-[#F53D04]' : 'bg-[#FFE5DE] border-b-2 border-[#F53D04]') 
                          : (darkMode ? 'bg-[#151518] border-b border-[#2A2A2E]' : 'bg-[#F7F7F9] border-b border-[#E5E5EA]')
                      }`}
                    >
                       <div className="flex items-center gap-3">
                          <div className={`border px-2 py-0.5 md:py-1 font-black text-2xl md:text-3xl ${
                              isWeekend 
                                ? 'bg-[#F53D04] text-[#FFFFFF] border-[#F53D04] shadow-[0_0_10px_rgba(245,61,4,0.3)]' 
                                : (darkMode ? 'bg-[#1C1C20] text-[#FFFFFF] border-[#2A2A2E]' : 'bg-[#FFFFFF] border-[#E5E5EA] text-[#111111]')
                            }`}>
                            {dateObj.getDate()}
                          </div>
                          <span className={`font-black text-lg md:text-2xl uppercase leading-none tracking-wider ${
                              isWeekend 
                                ? (darkMode ? 'text-[#F53D04] drop-shadow-[0_0_8px_rgba(245,61,4,0.4)]' : 'text-[#F53D04]') 
                                : (darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]')
                            }`}>
                            {dateObj.toLocaleDateString("en-US", { weekday: 'long' })}
                          </span>
                       </div>
                    </div>
                    
                    <div className={`grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-0 border-b ${darkMode ? 'border-[#2A2A2E]' : 'border-[#E5E5EA]'}`}>
                       {grouped[date].map((e, i) => (
                          <a key={i} href={e.ig_post_url} target="_blank" rel="noreferrer" className={`group relative border-r flex flex-col h-full overflow-hidden hover:z-20 ${darkMode ? 'border-[#2A2A2E] bg-[#1C1C20]' : 'border-[#E5E5EA] bg-[#FFFFFF]'}`}>
                             <div className={`w-full aspect-square border-b flex items-center justify-center overflow-hidden ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#F7F7F9] border-[#E5E5EA]'}`}>
                                {e.image_url ? (
                                  <img src={e.image_url} className="w-full h-full object-contain group-hover:scale-105 transition-all duration-300" />
                                ) : (
                                  <div className={`font-black text-xl ${darkMode ? 'text-[#6E6E73]' : 'text-[#8C8C92]'}`}>NO IMG</div>
                                )}
                             </div>
                             <div className={`p-3 md:p-5 flex-1 flex flex-col justify-between relative ${darkMode ? 'bg-[#1C1C20]' : 'bg-[#FFFFFF]'}`}>
                                  {!darkMode && <div className="absolute inset-0 bg-[#FFE5DE] opacity-0 group-hover:opacity-10 transition-opacity duration-200 pointer-events-none z-0" />}
                                  {darkMode && <div className="absolute inset-0 bg-[#2A2A2E] opacity-0 group-hover:opacity-20 transition-opacity duration-200 pointer-events-none z-0" />}
                                  
                                  <div className="relative z-10 flex flex-col h-full">
                                    <span className="font-black text-[10px] md:text-sm text-[#F53D04] uppercase mb-1 line-clamp-1">{e.club_name}</span>
                                    
                                    <h3 className={`font-black text-sm md:text-xl uppercase leading-[1.1] mb-3 line-clamp-2 break-words transition-colors ${darkMode ? 'text-[#B3B3B8] group-hover:text-[#FFFFFF]' : 'text-[#55555A] group-hover:text-[#111111]'}`}>
                                      {e.event_name || "CLUB NIGHT"}
                                    </h3>
                                    
                                    <div className="flex flex-wrap gap-1.5 mt-auto">
                                       {(e.dj_names || []).map((dj, idx) => (
                                         <span key={idx} className={`px-2 py-[2px] font-mono font-bold text-[10px] md:text-xs uppercase border transition-all ${darkMode ? 'bg-[#121214] text-[#B3B3B8] border-[#2A2A2E] group-hover:border-[#FFFFFF] group-hover:text-[#FFFFFF]' : 'bg-[#F2F2F5] text-[#55555A] border-[#E5E5EA] group-hover:border-[#111111] group-hover:text-[#111111]'}`}>
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
function ArchiveCalendarView({ events, darkMode }: ViewProps) {
  const grouped = events.reduce<Record<string, AfterFiveEvent[]>>((acc, event) => {
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
      className={`w-full min-h-full pb-[60px] md:pb-12 ${darkMode ? 'bg-[#0B0B0D]' : 'bg-[#FFFFFF]'}`}
    >
      <div className={`sticky top-0 z-50 border-b p-4 md:p-8 backdrop-blur-md ${darkMode ? 'bg-[#0B0B0D]/95 border-[#2A2A2E]' : 'bg-[#FFFFFF]/95 border-[#E5E5EA]'}`}>
        <h1 className={`font-black text-4xl md:text-7xl uppercase tracking-tighter leading-none ${darkMode ? 'text-[#FFFFFF] drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'text-[#111111] drop-shadow-[0_0_10px_rgba(0,0,0,0.05)]'}`}>ARCHIVES</h1>
      </div>

      <div className="p-2 md:p-6 space-y-8 mt-2">
        {Object.entries(grouped).map(([monthYear, monthEvents]) => (
          <div key={monthYear}>
            <h2 className={`font-black text-2xl uppercase mb-4 pl-2 border-l-4 border-[#F53D04] tracking-widest ${darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]'}`}>{monthYear}</h2>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 md:gap-2">
              {monthEvents.map((e, i) => (
                <a key={i} href={e.ig_post_url} target="_blank" rel="noreferrer" className={`group relative aspect-square overflow-hidden block border ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#F7F7F9] border-[#E5E5EA]'}`}>
                  {e.image_url ? (
                    <img src={e.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center font-black text-sm ${darkMode ? 'text-[#6E6E73]' : 'text-[#8C8C92]'}`}>NO IMG</div>
                  )}
                  
                  <div className={`absolute top-1 right-1 md:top-2 md:right-2 px-1.5 py-0.5 font-mono text-[9px] md:text-xs font-bold rounded-sm shadow-[0_0_8px_rgba(0,0,0,0.2)] ${darkMode ? 'bg-[#1C1C20] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#111111]'}`}>
                    {new Date(e.event_date).getDate()} {new Date(e.event_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                  </div>

                  <div className="absolute inset-0 bg-[#0B0B0D]/90 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-center p-2 md:p-4">
                    <span className="text-[#F53D04] font-black text-[9px] md:text-[11px] uppercase mb-1 line-clamp-1">{e.club_name}</span>
                    <span className="text-[#FFFFFF] font-bold text-xs md:text-sm leading-tight line-clamp-2 mb-2">{e.event_name}</span>
                    <div className="hidden md:flex flex-wrap justify-center gap-1">
                      {(e.dj_names || []).slice(0, 3).map((dj, idx) => (
                        <span key={idx} className="text-[#B3B3B8] font-mono text-[9px] uppercase">{dj}</span>
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
interface MapViewProps {
  isLoaded: boolean;
  darkMode: boolean;
}

function MapView({ isLoaded, darkMode }: MapViewProps) {
  const [selected, setSelected] = useState<MarkerData | null>(null);
  
  return (
    <motion.div 
      variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit"
      className="w-full h-full relative"
    >
       {!isLoaded ? <div className={`w-full h-full flex items-center justify-center font-black ${darkMode ? 'text-[#FFFFFF] bg-[#0B0B0D]' : 'text-[#111111] bg-[#FFFFFF]'}`}>LOADING...</div> : (
         <GoogleMap mapContainerClassName="w-full h-full" center={POBLACION_CENTER} zoom={17} options={{ styles: darkMode ? darkMapStyle : popMapStyle, disableDefaultUI: true, clickableIcons: false }} onClick={() => setSelected(null)}>
            {POBLACION_BARS.map((bar, i) => (
               <Marker key={i} position={{ lat: bar.lat, lng: bar.lng }} icon={{ path: typeof window !== "undefined" && window.google ? window.google.maps.SymbolPath.CIRCLE : 0, fillColor: selected?.name === bar.name ? "#F53D04" : (darkMode ? "#FFFFFF" : "#111111"), fillOpacity: 1, scale: 12, strokeColor: darkMode ? "#1C1C20" : "#FFFFFF", strokeWeight: 3 }} onClick={() => setSelected(bar)} />
            ))}
         </GoogleMap>
       )}
       <AnimatePresence>{selected && (
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className={`absolute bottom-16 md:bottom-8 left-4 md:left-8 right-4 md:w-[400px] border p-6 z-30 shadow-[0_0_20px_rgba(0,0,0,0.1)] ${darkMode ? 'bg-[#1C1C20] border-[#2A2A2E] text-[#FFFFFF]' : 'bg-[#FFFFFF] border-[#E5E5EA] text-[#111111]'}`}>
               <div className="flex justify-between items-start mb-2"><h3 className="font-black text-2xl uppercase">{selected.name}</h3><button onClick={() => setSelected(null)}><X size={24} className={`border hover:bg-[#F53D04] hover:border-[#F53D04] hover:text-[#FFFFFF] transition-colors ${darkMode ? 'border-[#6E6E73]' : 'border-[#8C8C92]'}`} /></button></div>
               <div className="flex gap-2 mb-4"><div className={`px-2 py-1 font-mono text-xs font-bold border uppercase ${darkMode ? 'bg-[#121214] text-[#B3B3B8] border-[#2A2A2E]' : 'bg-[#F2F2F5] text-[#55555A] border-[#E5E5EA]'}`}>{selected.type}</div><div className={`px-2 py-1 font-mono text-xs font-bold border uppercase ${darkMode ? 'bg-[#151518] text-[#F53D04] border-[#2A2A2E]' : 'bg-[#FFE5DE] text-[#F53D04] border-[#FFE5DE]'}`}>UNTIL {selected.status}</div></div>
               <a href={`https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`} target="_blank" rel="noreferrer" className={`block w-full text-center py-3 font-bold uppercase transition-all border ${darkMode ? 'bg-[#151518] text-[#FFFFFF] border-[#2A2A2E] hover:bg-[#F53D04] hover:border-[#F53D04] hover:shadow-[0_0_15px_rgba(245,61,4,0.4)]' : 'bg-[#F7F7F9] text-[#111111] border-[#E5E5EA] hover:bg-[#F53D04] hover:text-[#FFFFFF] hover:border-[#F53D04] hover:shadow-[0_0_15px_rgba(245,61,4,0.3)]'}`}>NAVIGATE</a>
            </motion.div>
       )}</AnimatePresence>
    </motion.div>
  );
}

// ==========================================
// UTILITIES
// ==========================================

interface SidebarLinkProps {
  label: string;
  sub: string;
  active: boolean;
  onClick?: () => void;
  href?: string;
  color: string;
  icon: React.ReactNode;
  darkMode: boolean;
  highlight?: boolean; // FSD Emphasis prop
}

function SidebarLink({ label, sub, active, onClick, href, color, icon, darkMode, highlight = false }: SidebarLinkProps) {
  
  // Highlighting specific background color modification, keeping structural integrity uniform
  const baseBg = highlight 
    ? (darkMode ? 'bg-[#10B981]/10 text-[#FFFFFF] border-[#2A2A2E] hover:bg-[#10B981]/20' : 'bg-[#10B981]/10 text-[#111111] border-[#E5E5EA] hover:bg-[#10B981]/20')
    : (darkMode ? 'bg-[#151518] text-[#FFFFFF] border-[#2A2A2E] hover:bg-[#1C1C20]' : 'bg-[#F7F7F9] text-[#111111] border-[#E5E5EA] hover:bg-[#FFFFFF]');
  
  const activeBg = darkMode ? 'bg-[#1C1C20] text-[#FFFFFF] border-[#2A2A2E]' : 'bg-[#FFFFFF] text-[#111111] border-[#E5E5EA]';
  
  const content = (
    <>
      <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all ${active ? 'w-full opacity-5' : 'w-1'}`} style={{ backgroundColor: color }} />
      <div className="relative z-10 pl-4">
        <h3 className={`font-black text-lg uppercase mb-1 ${active ? `drop-shadow-[0_0_8px_${color}40]` : ''}`}>{label}</h3>
        <p className={`font-mono text-[10px] font-bold tracking-widest uppercase ${highlight ? 'opacity-80 text-[#10B981]' : 'opacity-60'}`}>{sub}</p>
      </div>
      <div className={`relative z-10 transition-all ${active || highlight ? `scale-110 drop-shadow-[0_0_10px_${color}]` : ''}`} style={{ color: active || highlight ? color : (darkMode ? '#B3B3B8' : '#55555A') }}>
        {icon}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`block w-full p-6 text-left border-b transition-all group relative overflow-hidden flex items-center justify-between ${active ? activeBg : baseBg}`}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={`w-full p-6 text-left border-b transition-all group relative overflow-hidden flex items-center justify-between ${active ? activeBg : baseBg}`}>
      {content}
    </button>
  );
}

interface MobileNavBtnProps {
  icon: React.ReactNode;
  active: boolean;
  onClick?: () => void;
  href?: string;
  color: string;
  darkMode: boolean;
  highlight?: boolean; // FSD Emphasis prop
}

function MobileNavBtn({ icon, active, onClick, href, color, darkMode, highlight = false }: MobileNavBtnProps) {
  const activeBg = darkMode ? 'bg-[#1C1C20] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#111111]';
  
  // Highlighting in mobile applies a distinct background block
  const baseBg = highlight 
    ? (darkMode ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#10B981]/15 text-[#059669]')
    : (darkMode ? 'bg-[#151518] text-[#6E6E73]' : 'bg-[#F7F7F9] text-[#8C8C92]');
  
  const content = (
    <div className={`${active || highlight ? 'scale-125' : 'scale-100'} transition-all flex items-center justify-center w-full h-full`} style={{ color: active || highlight ? color : 'inherit', filter: active || highlight ? `drop-shadow(0 0 8px ${color})` : 'none' }}>
      {icon}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={`flex-1 flex items-center justify-center transition-all ${active ? activeBg : baseBg}`}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center transition-all ${active ? activeBg : baseBg}`}>
      {content}
    </button>
  );
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
    <div className={`w-full h-full flex flex-col items-center justify-center p-8 text-center border m-4 shadow-[0_0_20px_rgba(0,0,0,0.05)] ${darkMode ? 'bg-[#1C1C20] border-[#2A2A2E] text-[#FFFFFF]' : 'bg-[#FFFFFF] border-[#E5E5EA] text-[#111111]'}`}>
      <h1 className="font-black text-2xl uppercase mb-2">NO SIGNAL</h1>
      <p className={`font-mono font-bold text-xs ${darkMode ? 'text-[#B3B3B8]' : 'text-[#55555A]'}`}>Check back later or view the Agenda.</p>
    </div>
  ); 
}