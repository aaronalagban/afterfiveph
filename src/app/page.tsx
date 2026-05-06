"use client";

/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { supabase } from "@/lib/supabase-client";
import {
  Calendar, Disc, Map as MapIcon,
  X, Zap, Instagram, ChevronLeft, ChevronRight,
  Sun, Moon, Plus, Users, Info
} from "lucide-react";
import { GoogleMap, useLoadScript, Marker } from "@react-google-maps/api";
import Link from "next/link";

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
  [key: string]: unknown;
}

export interface MarkerData {
  name: string;
  lat: number;
  lng: number;
  type: string;
  status: string;
}

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

const INTRO_SEEN_KEY = "afterfive-intro-seen";

export default function AfterFivePop() {
  const [events, setEvents] = useState<AfterFiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(false);
  const [showBetaModal, setShowBetaModal] = useState(false);
  const [view, setView] = useState<"LIVE" | "AGENDA" | "MAP" | "ARCHIVE">("LIVE");
  const [darkMode, setDarkMode] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded: isMapLoaded } = useLoadScript({ googleMapsApiKey: googleMapsKey || "" });

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
    const hasSeenIntro = localStorage.getItem(INTRO_SEEN_KEY) === "1";
    let splashTimer: NodeJS.Timeout | undefined;

    if (hasSeenIntro) {
      setShowBetaModal(true);
    } else {
      setShowSplash(true);
      localStorage.setItem(INTRO_SEEN_KEY, "1");
      splashTimer = setTimeout(() => {
        setShowSplash(false);
        setShowBetaModal(true);
      }, 3500);
    }

    async function init() {
      if (!supabase) { setLoading(false); return; }
      const { data, error } = await supabase.from("events").select("*").order("event_date", { ascending: true });
      
      if (error) console.error("Supabase Error:", error);

      if (data) {
        const grouped = data.reduce<AfterFiveEvent[]>((acc, current) => {
          if (!current.event_date) return acc;

          const rawDjs = current.djs || current.dj_name || "";
          let currentDjs: string[] = [];

          if (Array.isArray(rawDjs)) {
             currentDjs = rawDjs;
          } else if (typeof rawDjs === 'string') {
             const cleanStr = rawDjs.replace(/""/g, '"');
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
    return () => {
      if (splashTimer) clearTimeout(splashTimer);
    };
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

  let galleryData = tonightEvents;
  let isShowingFuture = false;
  let displayTitle = "TONIGHT";

  if (tonightEvents.length === 0 && upcomingEvents.length > 0) {
    const nextDate = normalizeDbDate(upcomingEvents[0].event_date);
    galleryData = upcomingEvents.filter(e => normalizeDbDate(e.event_date) === nextDate);
    isShowingFuture = true;
    
    const todayObj = new Date(today);
    const nextObj = new Date(nextDate);
    const diffTime = nextObj.getTime() - todayObj.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
    
    if (diffDays === 1) {
      displayTitle = "TOMORROW";
    } else {
      displayTitle = nextObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    }
  }

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

        @media (max-width: 767px) {
          .mobile-safe-bottom {
            padding-bottom: calc(3rem + env(safe-area-inset-bottom, 0px));
          }

          .mobile-nav-safe {
            height: calc(3rem + env(safe-area-inset-bottom, 0px));
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
        }

        .tap-hint { display: none; }
        @media (hover: none) and (pointer: coarse) {
          .tap-hint { display: flex; }
        }
      `}} />

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
      
      <AnimatePresence>
        {showBetaModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`border p-8 max-w-sm w-full text-center ${darkMode ? 'bg-[#1C1C20] border-[#2A2A2E] text-[#FFFFFF]' : 'bg-[#FFFFFF] border-[#E5E5EA] text-[#111111]'}`}
            >
              <h2 className="font-black text-3xl uppercase mb-4">WIP / BETA</h2>
              
              <p className={`font-mono text-sm mb-6 leading-relaxed ${darkMode ? 'text-[#B3B3B8]' : 'text-[#55555A]'}`}>
                AfterFive is currently a work in progress. If you have any suggestions or find bugs, feel free to slide into my DMs:
                <a href="https://instagram.com/aaronalagbann" target="_blank" rel="noreferrer" className="text-[#F53D04] font-bold block mt-2 hover:underline">@aaronalagbann</a>
                <span className={`block mt-4 text-xs ${darkMode ? 'text-[#6E6E73]' : 'text-[#8C8C92]'}`}>Some events may not appear yet due to current automation limits.</span>
              </p>

              <div className="flex flex-col gap-3">
                <a 
                  href="https://afterfiveph.vercel.app/submit"
                  target="_blank"
                  rel="noreferrer"
                  className={`block w-full py-3 font-black uppercase transition-all duration-300 border ${darkMode ? 'bg-[#151518] text-[#FFFFFF] border-[#2A2A2E] hover:border-[#F53D04] hover:text-[#F53D04]' : 'bg-[#F7F7F9] text-[#111111] border-[#E5E5EA] hover:border-[#F53D04] hover:text-[#F53D04]'}`}
                >
                  Submit an Event
                </a>

                <button
                  onClick={() => setShowBetaModal(false)}
                  className={`w-full py-3 font-black uppercase transition-all duration-300 border ${darkMode ? 'bg-[#151518] text-[#FFFFFF] border-[#2A2A2E] hover:bg-[#F53D04] hover:border-[#F53D04]' : 'bg-[#F7F7F9] text-[#111111] border-[#E5E5EA] hover:bg-[#F53D04] hover:text-[#FFFFFF] hover:border-[#F53D04]'}`}
                >
                  Aight
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

        <div className={`p-4 flex justify-between items-center border-t font-mono text-[10px] uppercase tracking-wider ${darkMode ? 'bg-[#151518] border-[#2A2A2E] text-[#B3B3B8]' : 'bg-[#F7F7F9] border-[#E5E5EA] text-[#55555A]'}`}>
          <a href="/submit" className="hover:text-[#F53D04] transition-colors flex items-center gap-1 group">
            <Plus size={12} className="group-hover:rotate-90 transition-transform" /> Submit Event
          </a>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowInfo(true)} className="hover:text-[#F53D04] transition-colors flex items-center gap-1">
              <Info size={12} /> Info
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className="hover:text-[#F53D04] transition-colors flex items-center gap-1">
              {darkMode ? <Sun size={12} /> : <Moon size={12} />} Theme
            </button>
          </div>
        </div>
        
      </nav>

      <main className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
        <div className={`md:hidden h-12 w-full border-b flex items-center justify-between px-4 z-50 shrink-0 ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#F7F7F9] border-[#E5E5EA]'}`}>
          <img src="/logo-1.png" alt="AfterFive Logo" className="h-5 w-auto cursor-pointer" onClick={() => setView("LIVE")} />
          <div className="flex items-center gap-2">
            <a
              href="/submit"
              className={`font-black text-[9px] uppercase tracking-widest border px-2.5 py-1 transition-colors flex items-center gap-1 ${darkMode ? 'border-[#2A2A2E] text-[#B3B3B8] hover:border-[#F53D04] hover:text-[#F53D04]' : 'border-[#E5E5EA] text-[#55555A] hover:border-[#F53D04] hover:text-[#F53D04]'}`}
            >
              <Plus size={9} />SUBMIT
            </a>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`transition-colors p-1 ${darkMode ? 'text-[#6E6E73] hover:text-[#FFFFFF]' : 'text-[#8C8C92] hover:text-[#111111]'}`}
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={() => setShowInfo(true)}
              className={`transition-colors p-1 ${darkMode ? 'text-[#6E6E73] hover:text-[#FFFFFF]' : 'text-[#8C8C92] hover:text-[#111111]'}`}
            >
              <Info size={15} />
            </button>
          </div>
        </div>

        <div className="mobile-safe-bottom flex-1 w-full relative overflow-y-auto hide-scrollbar md:pb-0">
          <AnimatePresence mode="wait">
            {!loading && (
              <>
                {view === "LIVE" && (
                  <GalleryView
                    key={`LIVE-${today}-${galleryData.length}`}
                    events={galleryData}
                    isShowingFuture={isShowingFuture}
                    displayTitle={displayTitle}
                    darkMode={darkMode}
                  />
                )}
                {view === "AGENDA" && <BlockListView key="AGENDA" title="INCOMING" events={upcomingEvents} darkMode={darkMode} />}
                {view === "MAP" && <MapView key="MAP" isLoaded={isMapLoaded} darkMode={darkMode} />}
                {view === "ARCHIVE" && <ArchiveCalendarView key="ARCHIVE" events={pastEvents} darkMode={darkMode} />}
              </>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Info overlay */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            className="fixed inset-0 z-[150] flex items-end md:items-center justify-center md:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInfo(false)} />
            <motion.div
              className={`relative w-full md:max-w-sm border overflow-hidden ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#FFFFFF] border-[#E5E5EA]'}`}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-5 py-3 border-b ${darkMode ? 'border-[#2A2A2E]' : 'border-[#E5E5EA]'}`}>
                <span className={`font-mono font-bold text-[10px] uppercase tracking-[0.3em] ${darkMode ? 'text-[#6E6E73]' : 'text-[#8C8C92]'}`}>INFO</span>
                <button
                  onClick={() => setShowInfo(false)}
                  className={`p-1 border transition-colors ${darkMode ? 'border-[#2A2A2E] text-[#B3B3B8] hover:border-[#F53D04] hover:text-[#F53D04]' : 'border-[#E5E5EA] text-[#55555A] hover:border-[#F53D04] hover:text-[#F53D04]'}`}
                >
                  <X size={13} />
                </button>
              </div>

              {/* Brand */}
              <div className={`px-5 py-5 border-b ${darkMode ? 'border-[#2A2A2E]' : 'border-[#E5E5EA]'}`}>
                <img src="/logo-1.png" alt="AfterFivePH" className="h-8 w-auto mb-3" />
                <p className={`font-mono text-[10px] uppercase tracking-[0.25em] ${darkMode ? 'text-[#6E6E73]' : 'text-[#8C8C92]'}`}>
                  Where Manila goes after five
                </p>
              </div>

              {/* Legal */}
              <div className={`px-5 py-4 border-b ${darkMode ? 'border-[#2A2A2E]' : 'border-[#E5E5EA]'}`}>
                <p className={`font-mono text-[9px] uppercase tracking-[0.3em] mb-3 ${darkMode ? 'text-[#6E6E73]' : 'text-[#8C8C92]'}`}>Legal</p>
                <div className="flex flex-col gap-2.5">
                  <a
                    href="/privacy"
                    className={`font-black text-xs uppercase tracking-wider transition-colors flex items-center justify-between ${darkMode ? 'text-[#B3B3B8] hover:text-[#F53D04]' : 'text-[#55555A] hover:text-[#F53D04]'}`}
                  >
                    Privacy Policy <span className="font-mono text-[10px]">→</span>
                  </a>
                  <a
                    href="/terms"
                    className={`font-black text-xs uppercase tracking-wider transition-colors flex items-center justify-between ${darkMode ? 'text-[#B3B3B8] hover:text-[#F53D04]' : 'text-[#55555A] hover:text-[#F53D04]'}`}
                  >
                    Terms of Service <span className="font-mono text-[10px]">→</span>
                  </a>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3">
                <p className={`font-mono text-[9px] uppercase tracking-[0.2em] ${darkMode ? 'text-[#6E6E73]' : 'text-[#8C8C92]'}`}>
                  Beta · afterfiveph.vercel.app
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`mobile-nav-safe md:hidden fixed bottom-0 left-0 w-full border-t z-50 flex items-stretch ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#F7F7F9] border-[#E5E5EA]'}`}>
         <MobileNavBtn icon={<Zap size={18} />} active={view === "LIVE"} onClick={() => setView("LIVE")} color="#F53D04" darkMode={darkMode} />
         <div className={`w-[1px] h-full ${darkMode ? 'bg-[#2A2A2E]' : 'bg-[#E5E5EA]'}`} />
         <MobileNavBtn icon={<Calendar size={18} />} active={view === "AGENDA"} onClick={() => setView("AGENDA")} color={darkMode ? "#5C548A" : "#7A7399"} darkMode={darkMode} />
         <div className={`w-[1px] h-full ${darkMode ? 'bg-[#2A2A2E]' : 'bg-[#E5E5EA]'}`} />
         <MobileNavBtn icon={<MapIcon size={18} />} active={view === "MAP"} onClick={() => setView("MAP")} color={darkMode ? "#3A6E8F" : "#5F8EA8"} darkMode={darkMode} />
         <div className={`w-[1px] h-full ${darkMode ? 'bg-[#2A2A2E]' : 'bg-[#E5E5EA]'}`} />
         <MobileNavBtn icon={<Disc size={18} />} active={view === "ARCHIVE"} onClick={() => setView("ARCHIVE")} color={darkMode ? "#8F4A5A" : "#A06A75"} darkMode={darkMode} />
         <div className={`w-[1px] h-full ${darkMode ? 'bg-[#2A2A2E]' : 'bg-[#E5E5EA]'}`} />
         
         <MobileNavBtn href="/communities" icon={<Users size={18} />} active={false} color={darkMode ? "#10B981" : "#059669"} darkMode={darkMode} highlight={true} />
      </div>

    </div>
  );
}

interface ViewProps {
  events: AfterFiveEvent[];
  darkMode: boolean;
}

interface GalleryViewProps extends ViewProps {
  isShowingFuture: boolean;
  displayTitle: string;
}

function GalleryView({ events, isShowingFuture, displayTitle, darkMode }: GalleryViewProps) {
  const [current, setCurrent] = useState(0);
  const [showOverview, setShowOverview] = useState(false);
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

  const toggle = (
    <LayoutGroup>
      <div className={`flex items-stretch h-9 border ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#FFFFFF] border-[#E5E5EA]'}`}>
        <button
          onClick={() => setShowOverview(false)}
          className={`relative px-4 flex items-center justify-center font-mono font-bold text-[10px] tracking-[0.2em] uppercase transition-colors ${!showOverview ? (darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]') : (darkMode ? 'text-[#6E6E73] hover:text-[#FFFFFF]' : 'text-[#8C8C92] hover:text-[#111111]')}`}
        >
          POSTER
          {!showOverview && <motion.div layoutId="view-toggle" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F53D04]" />}
        </button>
        <div className={`w-[1px] my-1 ${darkMode ? 'bg-[#2A2A2E]' : 'bg-[#E5E5EA]'}`} />
        <button
          onClick={() => setShowOverview(true)}
          className={`relative px-4 flex items-center justify-center font-mono font-bold text-[10px] tracking-[0.2em] uppercase transition-colors ${showOverview ? (darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]') : (darkMode ? 'text-[#6E6E73] hover:text-[#FFFFFF]' : 'text-[#8C8C92] hover:text-[#111111]')}`}
        >
          OVERVIEW
          {showOverview && <motion.div layoutId="view-toggle" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F53D04]" />}
        </button>
      </div>
    </LayoutGroup>
  );

  const TopBanner = isShowingFuture && (
    <div className="w-full bg-[#F53D04] text-[#FFFFFF] py-2.5 px-4 flex items-center justify-center shrink-0 z-40 relative">
      <span className="font-mono font-bold text-[10px] md:text-xs uppercase tracking-[0.2em] flex items-center gap-2">
        <Zap size={14} className="fill-current" />
        NO EVENTS TONIGHT • SHOWING {displayTitle}
      </span>
    </div>
  );

  if (showOverview) {
    return (
      <motion.div
        variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit"
        className={`w-full h-full flex flex-col relative overflow-hidden ${darkMode ? 'bg-[#0B0B0D]' : 'bg-[#FFFFFF]'}`}
      >
        {TopBanner}
        <div className="shrink-0 flex justify-center py-2 md:py-3 relative z-30">
          {toggle}
        </div>
        <EventsOverview
          events={events}
          darkMode={darkMode}
          displayTitle={displayTitle}
          onSelect={(index) => {
            setCurrent(index);
            setShowOverview(false);
            resetTimer();
          }}
        />
      </motion.div>
    );
  }

  const activeEvent = events[current];
  const title = activeEvent.event_name || "LIVE SESSION";
  const dateObj = new Date(activeEvent.event_date);
  const formattedDate = `${dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${dateObj.getFullYear()}`.toUpperCase();

  return (
    <motion.div
      variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit"
      className={`w-full h-full flex flex-col relative overflow-hidden ${darkMode ? 'bg-[#0B0B0D]' : 'bg-[#FFFFFF]'}`}
    >
      {TopBanner}

      <div className="shrink-0 flex justify-center py-2 md:py-3 relative z-30">
        {toggle}
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center px-10 md:px-16 pb-2 overflow-hidden min-h-0">
        <div className={`absolute inset-0 pointer-events-none ${darkMode ? 'playful-bg-dark' : 'playful-bg'}`} />

        <button onClick={manualPrev} className={`absolute left-2 md:left-4 z-20 p-2 border transition-colors ${darkMode ? 'bg-[#1C1C20] border-[#2A2A2E] text-[#FFFFFF] hover:bg-[#2A2A2E]' : 'bg-[#FFFFFF] border-[#E5E5EA] text-[#111111] hover:bg-[#F7F7F9]'}`}><ChevronLeft size={18} /></button>
        <button onClick={manualNext} className={`absolute right-2 md:right-4 z-20 p-2 border transition-colors ${darkMode ? 'bg-[#1C1C20] border-[#2A2A2E] text-[#FFFFFF] hover:bg-[#2A2A2E]' : 'bg-[#FFFFFF] border-[#E5E5EA] text-[#111111] hover:bg-[#F7F7F9]'}`}><ChevronRight size={18} /></button>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeEvent.image_url || activeEvent.id || current}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={`relative z-10 h-full w-auto max-w-full flex justify-center border p-1.5 md:p-3 select-none ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#FFFFFF] border-[#E5E5EA]'}`}
          >
            <img src={activeEvent.image_url} className="h-full w-auto object-contain max-w-full" alt="Gig Poster" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Details bar — columns mirror the 5-slot mobile nav grid */}
      <div className={`h-[88px] md:h-[180px] shrink-0 border-t flex flex-row items-stretch z-20 relative ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#F7F7F9] border-[#E5E5EA]'}`}>

        {/* Date — w-1/5 on mobile aligns center with first nav icon (Zap) */}
        <div className={`w-1/5 md:w-[160px] shrink-0 border-r flex flex-col items-center justify-center text-center ${darkMode ? 'bg-[#1C1C20] border-[#2A2A2E] text-[#F53D04]' : 'bg-[#FFE5DE] border-[#E5E5EA] text-[#F53D04]'}`}>
          <span className="font-mono font-bold text-[6px] md:text-[10px] uppercase tracking-wider opacity-60">{new Date(activeEvent.event_date).toLocaleDateString("en-US", { weekday: 'short' }).toUpperCase()}</span>
          <span className="font-black text-[20px] md:text-5xl uppercase leading-none">{new Date(activeEvent.event_date).getDate()}</span>
          <span className="font-black text-[7px] md:text-base uppercase">{new Date(activeEvent.event_date).toLocaleDateString("en-US", { month: 'short' })}</span>
        </div>

        {/* Event info — spans 3 nav slots */}
        <div className={`flex-1 flex flex-col justify-center min-w-0 px-3 py-2 md:px-6 md:py-5 ${darkMode ? 'bg-[#151518]' : 'bg-[#F7F7F9]'}`}>
          <h3 className="font-black text-[10px] md:text-2xl uppercase text-[#F53D04] leading-none mb-0.5 line-clamp-1">
            {activeEvent.club_name}
          </h3>
          {title.length > 20 ? (
            <div className="whitespace-nowrap overflow-hidden">
              <h2 className={`animate-marquee-title font-black text-[14px] md:text-4xl uppercase ${darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]'}`}>
                {`${title} • ${title} • `}
              </h2>
            </div>
          ) : (
            <h2 className={`font-black uppercase leading-none line-clamp-1 md:line-clamp-2 ${darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]'}`} style={{ fontSize: 'clamp(0.8rem, 2.6vw, 2.5rem)' }}>
              {title}
            </h2>
          )}
          {(() => {
            const visibleDJs = (activeEvent.dj_names || []).filter(dj => dj.toUpperCase() !== 'HEADLINER');
            return visibleDJs.length > 0 ? (
              <div className="hidden md:flex flex-wrap gap-2 mt-2">
                {visibleDJs.map((dj, i) => (
                  <span key={i} className={`px-2 py-0.5 font-mono font-bold text-xs uppercase border ${darkMode ? 'bg-[#121214] text-[#B3B3B8] border-[#2A2A2E]' : 'bg-[#FFFFFF] text-[#55555A] border-[#E5E5EA]'}`}>
                    {dj}
                  </span>
                ))}
              </div>
            ) : null;
          })()}
        </div>

        {/* Instagram — w-1/5 on mobile aligns center with last nav icon (Communities) */}
        <a
          href={activeEvent.ig_post_url || "#"}
          target="_blank"
          rel="noreferrer"
          className={`w-1/5 md:w-24 shrink-0 flex flex-col items-center justify-center gap-1 transition-opacity active:opacity-70 ${activeEvent.ig_post_url ? '' : 'pointer-events-none opacity-30'} bg-[#F53D04] text-[#FFFFFF]`}
          title="View on Instagram"
        >
          <Instagram size={20} strokeWidth={1.75} />
          <span className="hidden md:block font-mono text-[9px] uppercase tracking-widest">Instagram</span>
        </a>
      </div>
    </motion.div>
  );
}

function EventsOverview({
  events,
  darkMode,
  onSelect,
  displayTitle
}: {
  events: AfterFiveEvent[];
  darkMode: boolean;
  onSelect: (index: number) => void;
  displayTitle: string;
}) {
  const [tappedIndex, setTappedIndex] = useState<number | null>(null);
  const isTouchRef = useRef(false);

  const handleCardClick = (index: number) => {
    if (isTouchRef.current) {
      if (tappedIndex === index) {
        onSelect(index);
        setTappedIndex(null);
      } else {
        setTappedIndex(index);
      }
    } else {
      onSelect(index);
    }
  };

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <div className={`absolute inset-0 pointer-events-none ${darkMode ? 'playful-bg-dark' : 'playful-bg'}`} />

      <div className="relative z-10 h-full overflow-y-auto hide-scrollbar px-4 md:px-10 pb-4 md:pb-10 pt-0">
        <div className="max-w-6xl w-full mx-auto flex flex-col gap-4 md:gap-6">
          <div className={`sticky top-0 z-20 border p-3 md:p-4 shrink-0 ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#F7F7F9] border-[#E5E5EA]'}`}>
            <div className="font-mono font-bold text-[10px] uppercase tracking-[0.3em] text-[#F53D04] mb-1.5">
              {displayTitle}
            </div>
            <h1 className={`font-black text-2xl md:text-4xl uppercase leading-none ${darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]'}`}>
              {events.length} {events.length === 1 ? 'Event' : 'Events'} {displayTitle === "TONIGHT" ? "TODAY" : displayTitle}
            </h1>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 pb-4">
            {events.map((event, index) => {
              const visibleDJs = (event.dj_names || []).filter(dj => dj.toUpperCase() !== 'HEADLINER');
              return (
                <div
                  key={`${event.id ?? event.club_name}-${index}`}
                  onTouchStart={() => { isTouchRef.current = true; }}
                  onClick={() => handleCardClick(index)}
                  className={`group relative aspect-[3/4] w-full border overflow-hidden cursor-pointer transition-[border-color,transform] duration-200 hover:border-[#F53D04] hover:-translate-y-0.5 ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#FFFFFF] border-[#E5E5EA]'}`}
                >
                  <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
                    {event.image_url ? (
                      <img
                        src={event.image_url}
                        alt={`${event.club_name} poster`}
                        className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center p-4 text-center font-black text-lg uppercase ${darkMode ? 'text-[#6E6E73]' : 'text-[#8C8C92]'}`}>
                        Poster Coming Soon
                      </div>
                    )}
                  </div>

                  {/* Desktop hover reveal */}
                  <div className="hidden md:block absolute inset-x-0 bottom-0 overflow-hidden">
                    <div className={`translate-y-full group-hover:translate-y-0 transition-transform duration-200 ease-out p-3 border-t ${darkMode ? 'bg-[#151518]/95 border-[#2A2A2E]' : 'bg-[#FFFFFF]/97 border-[#E5E5EA]'}`}>
                      <div className="font-black text-[#F53D04] text-xs uppercase line-clamp-1 mb-0.5">
                        {event.club_name}
                      </div>
                      <div className={`font-black text-sm uppercase leading-tight line-clamp-2 ${darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]'}`}>
                        {event.event_name || "Club Night"}
                      </div>
                      {visibleDJs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {visibleDJs.slice(0, 3).map((dj, djIndex) => (
                            <span key={djIndex} className={`px-1.5 py-0.5 font-mono font-bold text-[9px] uppercase border ${darkMode ? 'bg-[#121214] text-[#B3B3B8] border-[#2A2A2E]' : 'bg-[#F7F7F9] text-[#55555A] border-[#E5E5EA]'}`}>
                              {dj}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile tap reveal */}
                  <AnimatePresence>
                    {tappedIndex === index && (
                      <motion.div
                        className="md:hidden absolute inset-0 flex flex-col justify-end"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="absolute inset-0 bg-black/82" />
                        <button
                          onClick={(e) => { e.stopPropagation(); setTappedIndex(null); }}
                          className="absolute top-2 right-2 z-20 p-1 border border-white/20 text-white/60"
                        >
                          <X size={11} />
                        </button>
                        <div className="relative z-10 p-3">
                          <div className="font-black text-[#F53D04] text-[11px] uppercase mb-0.5 line-clamp-1">{event.club_name}</div>
                          <div className="font-black text-white text-sm uppercase leading-tight line-clamp-2 mb-2">
                            {event.event_name || "Club Night"}
                          </div>
                          {visibleDJs.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {visibleDJs.slice(0, 3).map((dj, djIdx) => (
                                <span key={djIdx} className="px-1.5 py-0.5 font-mono text-[9px] uppercase bg-white/10 text-white/70 border border-white/20">
                                  {dj}
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelect(index); setTappedIndex(null); }}
                            className="w-full py-1.5 bg-[#F53D04] text-white font-black text-[10px] uppercase tracking-widest"
                          >
                            VIEW →
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Touch-only "Tap for info" hint */}
                  {tappedIndex !== index && (
                    <div className="tap-hint absolute bottom-1.5 left-0 right-0 justify-center pointer-events-none">
                      <span className={`px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest border ${darkMode ? 'bg-[#0B0B0D]/80 text-[#B3B3B8] border-[#2A2A2E]' : 'bg-white/90 text-[#55555A] border-[#E5E5EA]'}`}>
                        TAP FOR INFO
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

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
          <h1 className={`font-black text-4xl md:text-7xl uppercase tracking-tighter leading-none ${darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]'}`}>{title}</h1>
       </div>

        <div className="flex flex-col relative z-10">
          {sortedDates.map((date) => {
               const dateObj = new Date(date);
               const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6;

               return (
                 <div key={date} className={`relative ${isWeekend ? 'ring-1 ring-[#F53D04]/50 z-20' : ''}`}>
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
                                ? 'bg-[#F53D04] text-[#FFFFFF] border-[#F53D04]'
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
                                  <img src={e.image_url} alt={e.event_name || e.club_name || "Event poster"} className="w-full h-full object-contain group-hover:scale-105 transition-all duration-300" />
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
                                    
                                    {(() => {
                                      const visibleDJs = (e.dj_names || []).filter(dj => dj.toUpperCase() !== 'HEADLINER');
                                      return visibleDJs.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5 mt-auto">
                                          {visibleDJs.map((dj, idx) => (
                                            <span key={idx} className={`px-2 py-[2px] font-mono font-bold text-[10px] md:text-xs uppercase border transition-all ${darkMode ? 'bg-[#121214] text-[#B3B3B8] border-[#2A2A2E] group-hover:border-[#FFFFFF] group-hover:text-[#FFFFFF]' : 'bg-[#F2F2F5] text-[#55555A] border-[#E5E5EA] group-hover:border-[#111111] group-hover:text-[#111111]'}`}>
                                              {dj}
                                            </span>
                                          ))}
                                        </div>
                                      ) : null;
                                    })()}
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

function ArchiveCalendarView({ events, darkMode }: ViewProps) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const byDate = events.reduce<Record<string, AfterFiveEvent[]>>((acc, event) => {
    if (!event.event_date) return acc;
    const key = String(event.event_date).substring(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});

  const monthsMap: Record<string, string[]> = {};
  Object.keys(byDate).forEach(dateStr => {
    const label = new Date(dateStr).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!monthsMap[label]) monthsMap[label] = [];
    monthsMap[label].push(dateStr);
  });

  const expandedEvents = expandedDate ? byDate[expandedDate] ?? null : null;

  return (
    <motion.div
      variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit"
      className={`w-full min-h-full pb-[60px] md:pb-12 ${darkMode ? 'bg-[#0B0B0D]' : 'bg-[#FFFFFF]'}`}
    >
      <div className={`sticky top-0 z-50 border-b p-4 md:p-8 backdrop-blur-md ${darkMode ? 'bg-[#0B0B0D]/95 border-[#2A2A2E]' : 'bg-[#FFFFFF]/95 border-[#E5E5EA]'}`}>
        <h1 className={`font-black text-4xl md:text-7xl uppercase tracking-tighter leading-none ${darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]'}`}>ARCHIVES</h1>
      </div>

      <div className="p-2 md:p-6 space-y-8 mt-2">
        {Object.entries(monthsMap).map(([monthYear, dates]) => (
          <div key={monthYear}>
            <h2 className={`font-black text-2xl uppercase mb-4 pl-2 border-l-4 border-[#F53D04] tracking-widest ${darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]'}`}>{monthYear}</h2>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 md:gap-2">
              {dates.map(date => {
                const dateEvents = byDate[date];
                const firstEvent = dateEvents[0];
                const dateObj = new Date(date);
                const isSelected = expandedDate === date;

                return (
                  <button
                    key={date}
                    onClick={() => setExpandedDate(isSelected ? null : date)}
                    className={`group relative aspect-square overflow-hidden block border transition-colors ${
                      isSelected
                        ? 'border-[#F53D04]'
                        : (darkMode ? 'bg-[#151518] border-[#2A2A2E] hover:border-[#F53D04]/50' : 'bg-[#F7F7F9] border-[#E5E5EA] hover:border-[#F53D04]/50')
                    }`}
                  >
                    {firstEvent.image_url ? (
                      <img
                        src={firstEvent.image_url}
                        alt={firstEvent.event_name || firstEvent.club_name || "Archived event"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center font-black text-sm ${darkMode ? 'text-[#6E6E73]' : 'text-[#8C8C92]'}`}>NO IMG</div>
                    )}

                    <div className={`absolute bottom-1 left-1 md:bottom-2 md:left-2 px-1.5 py-0.5 font-mono text-[9px] md:text-[10px] font-bold ${
                      isSelected ? 'bg-[#F53D04] text-[#FFFFFF]' : (darkMode ? 'bg-[#0B0B0D]/80 text-[#FFFFFF]' : 'bg-[#FFFFFF]/90 text-[#111111]')
                    }`}>
                      {dateObj.getDate()} {dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                    </div>

                    {dateEvents.length > 1 && (
                      <div className="absolute top-1 right-1 md:top-2 md:right-2 w-5 h-5 flex items-center justify-center font-black text-[9px] bg-[#F53D04] text-[#FFFFFF]">
                        {dateEvents.length}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {expandedDate && expandedEvents && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-end md:items-center justify-center md:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setExpandedDate(null)} />
            <motion.div
              className={`relative w-full md:max-w-2xl overflow-hidden border ${darkMode ? 'bg-[#151518] border-[#2A2A2E]' : 'bg-[#FFFFFF] border-[#E5E5EA]'}`}
              style={{ maxHeight: '82vh' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className={`flex items-start justify-between p-4 md:p-6 border-b ${darkMode ? 'border-[#2A2A2E]' : 'border-[#E5E5EA]'}`}>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#F53D04] mb-1">
                    {new Date(expandedDate).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()}
                  </div>
                  <h2 className={`font-black text-xl md:text-2xl uppercase ${darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]'}`}>
                    {new Date(expandedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
                  </h2>
                  <div className={`font-mono text-[10px] uppercase mt-1 ${darkMode ? 'text-[#6E6E73]' : 'text-[#8C8C92]'}`}>
                    {expandedEvents.length} {expandedEvents.length === 1 ? 'event' : 'events'}
                  </div>
                </div>
                <button
                  onClick={() => setExpandedDate(null)}
                  className={`p-2 border transition-colors mt-1 ${darkMode ? 'border-[#2A2A2E] text-[#B3B3B8] hover:border-[#F53D04] hover:text-[#F53D04]' : 'border-[#E5E5EA] text-[#55555A] hover:border-[#F53D04] hover:text-[#F53D04]'}`}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto hide-scrollbar" style={{ maxHeight: 'calc(82vh - 90px)' }}>
                <div className="p-3 md:p-4 grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                  {expandedEvents.map((event, idx) => (
                    <a
                      key={idx}
                      href={event.ig_post_url}
                      target="_blank"
                      rel="noreferrer"
                      className={`group block border overflow-hidden transition-colors ${darkMode ? 'border-[#2A2A2E] hover:border-[#F53D04]/50' : 'border-[#E5E5EA] hover:border-[#F53D04]/50'}`}
                    >
                      <div className={`aspect-square w-full overflow-hidden ${darkMode ? 'bg-[#1C1C20]' : 'bg-[#F7F7F9]'}`}>
                        {event.image_url ? (
                          <img src={event.image_url} alt={event.event_name || event.club_name || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center font-black text-sm ${darkMode ? 'text-[#6E6E73]' : 'text-[#8C8C92]'}`}>NO IMG</div>
                        )}
                      </div>
                      <div className={`p-2 md:p-3 ${darkMode ? 'bg-[#151518]' : 'bg-[#FFFFFF]'}`}>
                        <div className="font-black text-[10px] text-[#F53D04] uppercase mb-0.5 truncate">{event.club_name}</div>
                        <div className={`font-black text-xs uppercase leading-tight line-clamp-2 ${darkMode ? 'text-[#FFFFFF]' : 'text-[#111111]'}`}>{event.event_name || 'CLUB NIGHT'}</div>
                        {(() => {
                          const visibleDJs = (event.dj_names || []).filter(dj => dj.toUpperCase() !== 'HEADLINER');
                          return visibleDJs.length > 0 ? (
                            <div className={`font-mono text-[9px] uppercase mt-1 truncate ${darkMode ? 'text-[#6E6E73]' : 'text-[#8C8C92]'}`}>
                              {visibleDJs.join(' · ')}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

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

interface SidebarLinkProps {
  label: string;
  sub: string;
  active: boolean;
  onClick?: () => void;
  href?: string;
  color: string;
  icon: React.ReactNode;
  darkMode: boolean;
  highlight?: boolean;
}

function SidebarLink({ label, sub, active, onClick, href, color, icon, darkMode, highlight = false }: SidebarLinkProps) {
  
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
  highlight?: boolean;
}

function MobileNavBtn({ icon, active, onClick, href, color, darkMode, highlight = false }: MobileNavBtnProps) {
  const activeBg = darkMode ? 'bg-[#1C1C20] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#111111]';
  
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


function EmptyState({ darkMode }: { darkMode?: boolean }) {
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-8 text-center border m-4 ${darkMode ? 'bg-[#1C1C20] border-[#2A2A2E] text-[#FFFFFF]' : 'bg-[#FFFFFF] border-[#E5E5EA] text-[#111111]'}`}>
      <h1 className="font-black text-2xl uppercase mb-2">NO SIGNAL</h1>
      <p className={`font-mono font-bold text-xs ${darkMode ? 'text-[#B3B3B8]' : 'text-[#55555A]'}`}>Check back later or view the Agenda.</p>
    </div>
  );
}

