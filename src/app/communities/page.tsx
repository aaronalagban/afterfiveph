"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const ACCESS_PASSWORD = "MANILA";

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

    const points: { x: number; z: number }[] = [];
    const spacing = 40; 
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
        const waveY = Math.sin(p.x * 0.005 + time) * 40 + Math.cos(p.z * 0.005 + time) * 40;
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

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />;
};

export default function CommunitiesDirectory() {
  const router = useRouter();

  // --- STATE ---
  const [communities, setCommunities] = useState<CommunityDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  // App Transition State
  const [zoomingId, setZoomingId] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [hasExplored, setHasExplored] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<boolean>(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setDarkMode(true);
    else if (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
    
    if (sessionStorage.getItem('comm_auth') === 'true') setIsAuthenticated(true);
    if (sessionStorage.getItem('comm_explore') === 'true') setHasExplored(true);
  }, []);

  // Fetch Data from Supabase (Optimized Loading)
  useEffect(() => {
    async function fetchCommunities() {
      try {
        if (!supabase) return;
        const { data, error } = await supabase
          .from("communities")
          .select("id, name, tagline, logo_url, hover_video_url, cover_image_url")
          .eq("is_active", true)
          .order("created_at", { ascending: true }); 

        if (!error && data) {
          setCommunities(data as CommunityDirectoryItem[]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchCommunities();
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.toUpperCase() === ACCESS_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('comm_auth', 'true');
      setPasswordError(false);
    } else {
      setPasswordError(true);
      setPasswordInput("");
    }
  };

  const handleExplore = () => {
    setHasExplored(true);
    sessionStorage.setItem('comm_explore', 'true');
  };

  // --- SEAMLESS TRANSITION HANDLER ---
  const handleNavigateToProfile = (communityId: string) => {
    setZoomingId(communityId);
    setIsNavigating(true); // Shrinks the background directory
    
    // Prefetch the route silently
    router.prefetch(`/communities/${communityId}`);

    // Wait for the full screen beige overlay to show up and display text, then route
    setTimeout(() => {
      router.push(`/communities/${communityId}`);
    }, 1200); 
  };

  if (loading) {
    return (
      <div className={`h-screen w-full flex flex-col items-center justify-center font-sans ${darkMode ? 'bg-[#0B0B0D] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#111111]'}`}>
         <div className="font-mono text-xs uppercase tracking-widest animate-pulse">Loading Directory...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden font-sans transition-colors duration-300 relative bg-[#0B0B0D]">
      
      {/* 
        ========================================================================
        THE GLOBAL TRANSITION OVERLAY 
        (Sits outside the shrinking box so it covers 100% of the screen instantly)
        ========================================================================
      */}
      <AnimatePresence>
        {zoomingId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }} // Instantly flashes the beige screen
            className="fixed inset-0 z-[9999] bg-[#EAE6DF] flex items-center justify-center pointer-events-none"
          >
            <motion.h1 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="font-black text-4xl md:text-6xl tracking-widest uppercase text-[#E6291C]"
            >
              {zoomingId === 'planet' ? 'P°LANET WORKSHOP' : communities.find(c => c.id === zoomingId)?.name}
            </motion.h1>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 
        ========================================================================
        THE MAIN SHRINKING DIRECTORY 
        ========================================================================
      */}
      <motion.div 
        className={`h-full w-full relative ${darkMode ? 'text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#111111]'}`}
        initial={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        animate={{ 
          scale: isNavigating ? 0.95 : 1, 
          opacity: isNavigating ? 0.3 : 1,
          filter: isNavigating ? "blur(4px)" : "blur(0px)"
        }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        
        {/* 3D INTERACTIVE BACKGROUND */}
        <AnimatePresence>
          {(!isAuthenticated || !hasExplored) && (
            <motion.div 
              key="bg-dots" 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              transition={{ duration: 0.8 }} 
              className={`absolute inset-0 z-0 ${darkMode ? '' : 'bg-[#FFFFFF]'}`}
            >
              <InteractiveWavyGrid darkMode={darkMode} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* PASSWORD GATE */}
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

          {/* INTRO SCREEN */}
          {isAuthenticated && !hasExplored && (
            <motion.div 
              key="intro-screen"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-between p-6 py-8 md:py-12 text-center overflow-y-auto"
            >
              <div className="w-full shrink-0 h-4 md:h-8" />
              <div className="flex flex-col items-center justify-center my-auto w-full">
                <h1 className="font-black text-[#F53D04] text-5xl md:text-8xl lg:text-[10vw] uppercase tracking-tighter leading-none mb-4 md:mb-6">
                  Community
                </h1>
                <p className="font-mono text-[9px] md:text-sm uppercase tracking-[0.1em] md:tracking-[0.3em] opacity-70 mb-10 md:mb-12 whitespace-nowrap leading-relaxed">
                  The collectives shaping Manila’s creative scene
                </p>
                <button 
                  onClick={handleExplore}
                  className={`relative z-10 px-12 py-5 font-black uppercase tracking-widest text-sm shrink-0 transition-all duration-300 border-2 hover:-translate-y-1 ${
                    darkMode 
                      ? 'bg-[#0B0B0D] border-white text-white hover:bg-white hover:text-black shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]' 
                      : 'bg-[#FFFFFF] border-black text-black hover:bg-black hover:text-white shadow-[0_0_20px_rgba(0,0,0,0.1)] hover:shadow-[0_0_30px_rgba(0,0,0,0.3)]'
                  }`}
                >
                  Explore
                </button>
              </div>
              <Link href="/" className="mt-12 mb-4 font-mono text-[9px] uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-[#F53D04] transition-all relative z-10 shrink-0">
                Return to Events
              </Link>
            </motion.div>
          )}

          {/* MAIN DIRECTORY ACCORDION */}
          {isAuthenticated && hasExplored && (
            <motion.div 
              key="main-directory"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }}
              className={`absolute inset-0 z-30 flex flex-col ${darkMode ? 'bg-[#0B0B0D]' : 'bg-[#FFFFFF]'}`}
            >
              
              <header className={`h-[70px] md:h-[90px] shrink-0 border-b flex justify-center md:justify-start items-center px-6 md:px-10 z-20 relative ${darkMode ? 'border-[#2A2A2E] bg-[#0B0B0D]' : 'border-[#E5E5EA] bg-[#F7F7F9]'}`}>
                <h1 className="font-black text-[#F53D04] text-3xl md:text-4xl uppercase tracking-widest flex items-start">
                  Community
                </h1>
                <Link href="/" className="hidden md:block absolute right-10 font-mono text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 hover:text-[#F53D04] transition-colors">
                  Return to Radar
                </Link>
              </header>

              <main className="flex-1 w-full flex flex-col md:flex-row overflow-hidden group/container">
                {communities.map((community) => {
                  const isHovered = hoveredId === community.id;
                  const isZooming = zoomingId === community.id;
                  const isHidden = zoomingId !== null && zoomingId !== community.id;

                  return (
                    <a
                      key={community.id}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!zoomingId) handleNavigateToProfile(community.id);
                      }}
                      onMouseEnter={() => !zoomingId && setHoveredId(community.id)}
                      onMouseLeave={() => !zoomingId && setHoveredId(null)}
                      
                      className={`
                        relative flex-1 flex flex-col justify-between border-b md:border-b-0 md:border-r overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer
                        ${darkMode ? 'border-[#2A2A2E]' : 'border-[#E5E5EA]'}
                        ${isHovered ? 'md:flex-[1.5]' : ''} 
                        ${isZooming || isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                      `}
                    >

                      <div className="absolute inset-0 w-full h-full flex flex-col justify-between">
                        {/* STATIC BACKGROUND */}
                        {community.cover_image_url && (
                          <div className="absolute inset-0 w-full h-full z-0 bg-[#0B0B0D]">
                            <img 
                              src={community.cover_image_url} alt={community.name} 
                              className={`w-full h-full object-cover transition-transform duration-700 ${isHovered ? 'scale-105' : 'scale-100'}`}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/30 to-[#0B0B0D]/70" />
                          </div>
                        )}

                        {/* HOVER VIDEO */}
                        <div className={`absolute inset-0 w-full h-full z-0 transition-opacity duration-700 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                          {isHovered && community.hover_video_url && (
                            <>
                              <video src={community.hover_video_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/30 to-[#0B0B0D]/70" />
                            </>
                          )}
                        </div>

                        {/* LOGO */}
                        <div className="relative z-10 p-6 md:p-8 flex justify-between items-start">
                          <div className="h-8 md:h-12 max-w-[120px] md:max-w-[150px]">
                            {community.logo_url ? (
                              <img src={community.logo_url} alt={community.name} className="h-full w-auto object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-transform duration-500" />
                            ) : (
                              <div className="font-black text-2xl uppercase text-white drop-shadow-md">{community.name.substring(0,3)}</div>
                            )}
                          </div>
                        </div>

                        {/* NAME & TAGLINE */}
                        <div className={`relative z-10 p-6 md:p-8 flex flex-col transition-transform duration-500 ${isHovered ? 'translate-y-0' : 'translate-y-0 md:translate-y-4'}`}>
                          <h2 className="font-black text-3xl md:text-5xl lg:text-6xl uppercase tracking-tighter leading-[0.9] text-[#FFFFFF] drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                            {community.name}
                          </h2>
                          <p className={`font-mono text-[10px] md:text-xs uppercase tracking-widest mt-4 leading-relaxed max-w-[90%] transition-colors duration-500 drop-shadow-[0_0_10px_rgba(0,0,0,0.8)] ${isHovered ? 'text-white' : 'text-white/80'}`}>
                            {community.tagline}
                          </p>
                          <div className={`mt-6 md:mt-8 flex items-center gap-2 font-mono text-xs uppercase font-bold tracking-widest transition-all duration-500 ${isHovered ? 'opacity-100 text-[#F53D04]' : 'md:opacity-0 md:-translate-y-4 text-white'}`}>
                            Explore Profile <ArrowUpRight size={16} className={isHovered ? 'translate-x-1 -translate-y-1 transition-transform' : ''} />
                          </div>
                        </div>
                      </div>

                    </a>
                  );
                })}
              </main>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}