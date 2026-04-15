"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase-client";

// --- TYPES ---
export interface CommunityDirectoryItem {
  id: string;
  name: string;
  tagline: string;
  logo_url?: string;
  hover_video_url?: string;
  cover_image_url?: string;
}

// --- CONFIG ---
const ACCESS_PASSWORD = "MANILA"; // Change this to whatever you want

// --- INTERACTIVE 3D WAVE CANVAS ---
const InteractiveWavyGrid = ({ darkMode }: { darkMode: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Mouse tracking
    let mouse = { x: -1000, y: -1000 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    // 3D Grid setup
    const points: { x: number; z: number }[] = [];
    const spacing = 40; // Space between points in 3D
    const gridWidth = 2000;
    const gridDepth = 1500;

    for (let x = -gridWidth / 2; x <= gridWidth / 2; x += spacing) {
      for (let z = 0; z <= gridDepth; z += spacing) {
        points.push({ x, z });
      }
    }

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener("resize", resize);
    resize();

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      time += 0.015;

      const fillStyle = darkMode ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.15)";
      ctx.fillStyle = fillStyle;

      const fov = 400;
      const interactionRadius = 150;
      const disruptionForce = 60;

      points.forEach((p) => {
        const waveY =
          Math.sin(p.x * 0.005 + time) * 40 +
          Math.cos(p.z * 0.005 + time) * 40;

        const scale = fov / (fov + p.z);
        let screenX = width / 2 + p.x * scale;
        let screenY = height / 2 + (waveY + 150) * scale;

        const dx = screenX - mouse.x;
        const dy = screenY - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < interactionRadius) {
          const force = (interactionRadius - dist) / interactionRadius;
          screenX += (dx / dist) * force * disruptionForce;
          screenY += (dy / dist) * force * disruptionForce;
        }

        const size = Math.max(0.5, 2 * scale);
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [darkMode]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
    />
  );
};

export default function CommunitiesDirectory() {
  // --- STATE ---
  const [communities, setCommunities] = useState<CommunityDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Flow State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [hasExplored, setHasExplored] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<boolean>(false);

  // Theme Init
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setDarkMode(true);
    else if (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  // Fetch Data from Supabase
  useEffect(() => {
    async function fetchCommunities() {
      if (!supabase) return;
      
      const { data, error } = await supabase
        .from("communities")
        .select("id, name, tagline, logo_url, hover_video_url, cover_image_url")
        .eq("is_active", true)
        .order("created_at", { ascending: true }); 

      if (error) {
        console.error("Error fetching communities:", error);
      } else if (data) {
        setCommunities(data as CommunityDirectoryItem[]);
      }
      setLoading(false);
    }

    fetchCommunities();
  }, []);

  // Handlers
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.toUpperCase() === ACCESS_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
      setPasswordInput("");
    }
  };

  // --- RENDERS ---

  if (loading) {
    return (
      <div className={`h-screen w-full flex flex-col items-center justify-center font-sans ${darkMode ? 'bg-[#0B0B0D] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#111111]'}`}>
         <div className="font-mono text-xs uppercase tracking-widest animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-full overflow-hidden font-sans transition-colors duration-300 relative ${darkMode ? 'bg-[#0B0B0D] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#111111]'}`}>
      
      {/* 3D INTERACTIVE BACKGROUND */}
      <AnimatePresence>
        {(!isAuthenticated || !hasExplored) && (
          <motion.div 
            key="bg-dots" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.8 }} 
            className="absolute inset-0 z-0"
          >
            <InteractiveWavyGrid darkMode={darkMode} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        
        {/* =========================================
            STAGE 1: PASSWORD GATE
        ========================================= */}
        {!isAuthenticated && (
          <motion.div 
            key="password-gate"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6"
          >
            <Lock size={32} className={`mb-6 ${darkMode ? 'text-[#3A3A3C]' : 'text-[#D1D1D6]'}`} />
            <h1 className="font-black text-2xl uppercase tracking-widest mb-2">WIP!</h1>
            <p className="font-mono text-[10px] uppercase tracking-widest mb-8 opacity-50">Enter password to view directory</p>
            
            <form onSubmit={handlePasswordSubmit} className="flex flex-col items-center w-full max-w-xs relative z-10">
              <input 
                type="password"
                placeholder="PASSWORD"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(false);
                }}
                className={`w-full p-4 text-center font-mono text-sm tracking-widest uppercase border outline-none transition-colors mb-4 ${
                  passwordError 
                    ? 'border-[#F53D04] text-[#F53D04]' 
                    : (darkMode ? 'bg-[#151518] border-[#2A2A2E] text-white focus:border-white' : 'bg-[#F7F7F9] border-[#E5E5EA] text-black focus:border-black')
                }`}
              />
              <button 
                type="submit"
                className={`w-full py-4 font-black uppercase tracking-widest text-xs transition-colors ${darkMode ? 'bg-white text-black hover:bg-[#F53D04] hover:text-white' : 'bg-black text-white hover:bg-[#F53D04]'}`}
              >
                Enter
              </button>
            </form>
          </motion.div>
        )}

        {/* =========================================
            STAGE 2: INTRO SCREEN
        ========================================= */}
        {isAuthenticated && !hasExplored && (
          <motion.div 
            key="intro-screen"
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            // Changed layout here to `flex-col justify-between` to safely separate top, middle, and bottom content
            className="absolute inset-0 z-40 flex flex-col items-center justify-between p-6 py-8 md:py-12 text-center overflow-y-auto"
          >
            {/* Top spacer so the center content perfectly balances with the bottom link */}
            <div className="w-full shrink-0 h-4 md:h-8" />
            
            {/* Centered Main Content Block */}
            <div className="flex flex-col items-center justify-center my-auto w-full">
              <h1 className="font-black text-[#F53D04] text-5xl md:text-8xl lg:text-[10vw] uppercase tracking-tighter leading-none mb-4 md:mb-6">
                Community<span className="align-super text-[clamp(1.5rem,4vw,4vw)] ml-[-1vw]"></span>
              </h1>
              
              <p className="font-mono text-[9px] md:text-sm uppercase tracking-[0.1em] md:tracking-[0.3em] opacity-70 mb-10 md:mb-12 whitespace-nowrap leading-relaxed">
                The collectives shaping Manila’s creative scene
              </p>
              
              <button 
                onClick={() => setHasExplored(true)}
                className={`relative z-10 px-12 py-5 font-black uppercase tracking-widest text-sm shrink-0 transition-all duration-300 border-2 hover:-translate-y-1 ${
                  darkMode 
                    ? 'bg-[#0B0B0D] border-white text-white hover:bg-white hover:text-black shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]' 
                    : 'bg-[#FFFFFF] border-black text-black hover:bg-black hover:text-white shadow-[0_0_20px_rgba(0,0,0,0.1)] hover:shadow-[0_0_30px_rgba(0,0,0,0.3)]'
                }`}
              >
                Explore
              </button>
            </div>

            {/* Bottom Footer Link in Normal Flow (Removes Absolute overlap issues entirely) */}
            <Link 
              href="/" 
              className="mt-12 mb-4 font-mono text-[9px] uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-[#F53D04] transition-all relative z-10 shrink-0"
            >
              Return to Radar
            </Link>
          </motion.div>
        )}

        {/* =========================================
            STAGE 3: MAIN ACCORDION DIRECTORY
        ========================================= */}
        {isAuthenticated && hasExplored && (
          <motion.div 
            key="main-directory"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ duration: 0.8, delay: 0.2 }}
            className="absolute inset-0 z-30 flex flex-col"
          >
            {/* HEADER - Cleaned up and larger */}
            <header className={`h-[70px] md:h-[90px] shrink-0 border-b flex justify-center md:justify-start items-center px-6 md:px-10 z-20 relative ${darkMode ? 'border-[#2A2A2E] bg-[#0B0B0D]' : 'border-[#E5E5EA] bg-[#F7F7F9]'}`}>
              <h1 className="font-black text-[#F53D04] text-3xl md:text-4xl uppercase tracking-widest flex items-start">
                Community<span className="ml-1 text-base md:text-xl"></span>
              </h1>
              
              {/* Optional: Return to Radar Link on Desktop right side */}
              <Link href="/" className="hidden md:block absolute right-10 font-mono text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 hover:text-[#F53D04] transition-colors">
                Return to Radar
              </Link>
            </header>

            {/* ACCORDION MAIN AREA */}
            <main className="flex-1 w-full flex flex-col md:flex-row overflow-hidden group/container">
              {communities.map((community) => {
                const isHovered = hoveredId === community.id;
                const isDimmed = hoveredId !== null && hoveredId !== community.id;

                return (
                  <Link
                    key={community.id}
                    href={`/communities/${community.id}`}
                    onMouseEnter={() => setHoveredId(community.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`
                      relative flex-1 flex flex-col justify-between border-b md:border-b-0 md:border-r overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]
                      ${darkMode ? 'border-[#2A2A2E]' : 'border-[#E5E5EA]'}
                      ${isHovered ? 'md:flex-[1.5]' : ''} 
                      ${isDimmed ? 'opacity-40' : 'opacity-100'}
                    `}
                  >
                    
                    {/* --- 1. STATIC BACKGROUND IMAGE --- */}
                    {community.cover_image_url && (
                      <div className="absolute inset-0 w-full h-full z-0 bg-[#0B0B0D]">
                        <img 
                          src={community.cover_image_url} 
                          alt={community.name} 
                          className={`w-full h-full object-cover transition-transform duration-700 ${isHovered ? 'scale-105' : 'scale-100'}`}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/30 to-[#0B0B0D]/70" />
                      </div>
                    )}

                    {/* --- 2. BACKGROUND VIDEO (Revealed on Hover) --- */}
                    {community.hover_video_url && (
                      <div className={`absolute inset-0 w-full h-full z-0 transition-opacity duration-700 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                        <video 
                          src={community.hover_video_url} 
                          autoPlay 
                          loop 
                          muted 
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/30 to-[#0B0B0D]/70" />
                      </div>
                    )}

                    {/* --- TOP CONTENT: LOGO --- */}
                    <div className="relative z-10 p-6 md:p-8 flex justify-between items-start">
                      <div className="h-8 md:h-12 max-w-[120px] md:max-w-[150px]">
                        {community.logo_url ? (
                          <img 
                            src={community.logo_url} 
                            alt={community.name} 
                            className="h-full w-auto object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-transform duration-500" 
                          />
                        ) : (
                          <div className="font-black text-2xl uppercase text-white drop-shadow-md">
                            {community.name.substring(0,3)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* --- BOTTOM CONTENT: NAME & TAGLINE --- */}
                    <div className={`relative z-10 p-6 md:p-8 flex flex-col transition-transform duration-500 ${isHovered ? 'translate-y-0' : 'translate-y-0 md:translate-y-4'}`}>
                      <h2 className="font-black text-3xl md:text-5xl lg:text-6xl uppercase tracking-tighter leading-[0.9] text-[#FFFFFF] drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                        {community.name}
                      </h2>
                      
                      <p className={`font-mono text-[10px] md:text-xs uppercase tracking-widest mt-4 leading-relaxed max-w-[90%] transition-colors duration-500 drop-shadow-[0_0_10px_rgba(0,0,0,0.8)] ${isHovered ? 'text-white' : 'text-white/80'}`}>
                        {community.tagline}
                      </p>

                      {/* Explore Action Button */}
                      <div className={`mt-6 md:mt-8 flex items-center gap-2 font-mono text-xs uppercase font-bold tracking-widest transition-all duration-500 ${isHovered ? 'opacity-100 text-[#F53D04]' : 'md:opacity-0 md:-translate-y-4 text-white'}`}>
                        Explore Profile <ArrowUpRight size={16} className={isHovered ? 'translate-x-1 -translate-y-1 transition-transform' : ''} />
                      </div>
                    </div>

                  </Link>
                );
              })}
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}