"use client";

import { useState, useRef, useEffect } from "react";
import { motion, Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Info } from "lucide-react";

// --- ANIMATION VARIANTS ---
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 } 
  }
};

const imageReveal: Variants = {
  hidden: { clipPath: "inset(100% 0 0 0)", scale: 1.1 },
  visible: { 
    clipPath: "inset(0% 0 0 0)", 
    scale: 1, 
    transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } 
  }
};

// --- DESIGN TOKENS ---
const BEIGE = "bg-[#EAE6DF]";
const RED_TEXT = "text-[#E6291C]";
const RED_BG = "bg-[#E6291C]";
const RED_BORDER = "border-[#E6291C]";

export default function PlanetProfile() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Smooth Exit Handler
  const handleBack = () => {
    setIsExiting(true); 
    setTimeout(() => {
      router.push("/communities"); 
    }, 400); 
  };

  // Scroll visibility for Navbar
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 80);
  };

  // Custom Smooth Scroll for Anchor Links
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element && scrollContainerRef.current) {
      const topPos = element.offsetTop;
      scrollContainerRef.current.scrollTo({
        top: topPos - 55, // Account for sticky navbar height
        behavior: 'smooth'
      });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 1 }} 
      animate={{ opacity: isExiting ? 0 : 1 }} 
      transition={{ duration: 0.4, ease: "easeOut" }}
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className={`min-h-screen w-full fixed inset-0 overflow-y-auto overflow-x-hidden z-[9999] ${BEIGE} ${RED_TEXT} font-sans selection:bg-[#E6291C] selection:text-[#EAE6DF]`}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="w-full relative z-10"
      >
        {/* 1. ANIMATED STICKY TOP NAV */}
        <motion.nav 
          initial={{ y: "-100%" }}
          animate={{ y: isScrolled ? "0%" : "-100%" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`fixed top-0 w-full px-6 py-4 flex justify-between items-center border-b ${RED_BORDER} ${BEIGE} z-50 uppercase font-mono text-[9px] md:text-[10px] tracking-widest shadow-sm`}
        >
          <button onClick={handleBack} className="flex items-center gap-2 hover:opacity-50 transition-opacity uppercase tracking-widest">
            <ArrowLeft size={14} /> Directory
          </button>
          <div className="hidden md:flex gap-8">
            <a href="#overview" onClick={(e) => handleNavClick(e, "overview")} className="hover:opacity-50 transition-opacity">Overview</a>
            <a href="#world" onClick={(e) => handleNavClick(e, "world")} className="hover:opacity-50 transition-opacity">The World</a>
            <a href="#work" onClick={(e) => handleNavClick(e, "work")} className="hover:opacity-50 transition-opacity">Work</a>
            <a href="#members" onClick={(e) => handleNavClick(e, "members")} className="hover:opacity-50 transition-opacity">Members</a>
          </div>
          <div className="flex gap-1">
            <div className={`w-2 h-2 rounded-full ${RED_BG}`} />
            <div className={`w-2 h-2 rounded-full ${RED_BG}`} />
            <div className={`w-2 h-2 rounded-full ${RED_BG}`} />
          </div>
        </motion.nav>

        <main className="w-full">
          
          {/* 2. FULLSCREEN HERO SECTION */}
          <div className={`grid grid-cols-1 md:grid-cols-2 border-b ${RED_BORDER} h-screen`}>
            <motion.div 
              initial="hidden" animate="visible" variants={staggerContainer}
              className={`p-6 md:p-12 md:border-r ${RED_BORDER} flex flex-col justify-between h-[50vh] md:h-full`}
            >
              <div className="flex justify-between items-start w-full">
                {/* Fallback back button inside Hero when nav is hidden */}
                <button onClick={handleBack} className="flex items-center gap-2 hover:opacity-50 transition-opacity uppercase font-mono text-[9px] md:text-[10px] tracking-widest">
                  <ArrowLeft size={14} /> Directory
                </button>
                <motion.span variants={fadeUp} className="font-mono text-[9px] md:text-[10px] uppercase tracking-widest text-right">
                  The Collective
                </motion.span>
              </div>

              <div>
                <motion.h1 variants={fadeUp} className="font-black text-6xl md:text-[8vw] leading-[0.85] tracking-tighter mt-12 md:mt-0">
                  P°LANET<br/>WORKSHOP
                </motion.h1>
                <motion.p variants={fadeUp} className="font-mono text-[10px] uppercase tracking-widest max-w-xs mt-8 md:mt-12 leading-relaxed">
                  Curating environments where sound and space collide. Manila-based independent collective.
                </motion.p>
              </div>
            </motion.div>

            {/* Full Bleed Colored Image Container */}
            <div className="relative h-[50vh] md:h-full w-full overflow-hidden bg-black/5">
              <motion.div 
                initial="hidden" animate="visible" variants={imageReveal}
                className="absolute inset-0 w-full h-full"
              >
                <img 
                  src="https://aqhavvixrywiuzjraxfy.supabase.co/storage/v1/object/public/collective-hero/planet.webp" 
                  alt="Planet Hero" 
                  className="w-full h-full object-cover" // Removed grayscale classes
                />
              </motion.div>
              <span className="absolute bottom-4 right-6 font-mono text-[8px] uppercase tracking-widest text-white mix-blend-difference z-10">
                Fig 01.
              </span>
            </div>
          </div>

          {/* 3. OVERVIEW */}
          <div id="overview" className={`grid grid-cols-1 md:grid-cols-2 border-b ${RED_BORDER}`}>
            <div className={`relative aspect-square md:aspect-auto md:border-r ${RED_BORDER} overflow-hidden`}>
              <motion.div 
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={imageReveal}
                className="w-full h-full"
              >
                <img 
                  src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000&auto=format&fit=crop" 
                  alt="Planet Event" 
                  className="w-full h-full object-cover grayscale contrast-125"
                />
              </motion.div>
            </div>
            <motion.div 
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
              className={`${RED_BG} text-[#EAE6DF] p-6 md:p-12 flex flex-col`}
            >
              <h2 className="font-black text-4xl md:text-5xl uppercase tracking-tighter mb-8 md:mb-16">
                Overview
              </h2>
              <div className="font-serif text-lg md:text-xl leading-relaxed mt-auto max-w-lg">
                <p className="mb-6">
                  Planet is an ecosystem built for the nocturnal. We disregard traditional club boundaries in favor of raw, industrial experiences.
                </p>
                <p>
                  Founded in 2023, the collective merges brutalist visual arts with forward-thinking electronic music, serving as a sanctuary for Manila's underground.
                </p>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest mt-12 block">Est. 2023</span>
            </motion.div>
          </div>

          {/* 4. WHAT THEY STAND FOR (STORYTELLING) */}
          <div className={`p-6 md:p-12 border-b ${RED_BORDER}`}>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="font-black text-4xl md:text-6xl uppercase tracking-tighter mb-12 md:mb-20 text-center md:text-left"
            >
              What They Stand For
            </motion.h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 font-serif text-lg md:text-xl leading-relaxed">
              {[
                { 
                  title: "The Genesis", 
                  desc: "We started in the cracks of the city. A reaction against velvet ropes and bottle service, seeking a space where the only currency is the frequency we share." 
                },
                { 
                  title: "The Architecture", 
                  desc: "Concrete is our canvas. We don't just occupy warehouses and abandoned bunkers; we wake them up. We let the architecture dictate the reverberation of every kick drum, turning cold spaces into living organisms." 
                },
                { 
                  title: "The Nocturnal", 
                  desc: "This is for the sleepless. The marginalized voices of Manila's underground who find sanctuary in the strobe lights, bound together by a relentless, uncompromising sound." 
                }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, duration: 0.6 }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-widest mb-6 block border-b border-[#E6291C]/30 pb-2">
                    0{i + 1} // {item.title}
                  </span>
                  <p>{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 5. THE WORLD THEY CREATE (Netflix Style Video Embeds) */}
          <div id="world" className="bg-[#0a0a0a] border-b border-[#E6291C]">
            <div className="p-6 md:p-12 pb-6 flex flex-col md:flex-row md:justify-between md:items-end">
              <div>
                <h2 className="font-black text-[#EAE6DF] text-4xl md:text-6xl uppercase tracking-tighter">
                  The World They Create
                </h2>
                <span className="font-mono text-[#EAE6DF]/60 text-[10px] uppercase tracking-widest mt-2 block">
                  Cinematic Documentation / Watch Now
                </span>
              </div>
            </div>

            {/* Featured Video Player */}
            <div className="w-full aspect-video relative group bg-black">
              <iframe 
                src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=0&mute=0&controls=1&rel=0&modestbranding=1" 
                className="absolute top-0 left-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              />
            </div>

            {/* "Episodes" / More Sets Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 border-t border-white/10 divide-x divide-white/10">
              {[
                "https://www.youtube.com/embed/5qap5aO4i9A?controls=0&rel=0&modestbranding=1",
                "https://www.youtube.com/embed/DWcJFNfaw9c?controls=0&rel=0&modestbranding=1",
                "https://www.youtube.com/embed/jfKfPfyJRdk?controls=0&rel=0&modestbranding=1",
                "https://www.youtube.com/embed/5qap5aO4i9A?controls=0&rel=0&modestbranding=1"
              ].map((src, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.6 }}
                  className="aspect-video relative group cursor-pointer bg-zinc-900 overflow-hidden"
                >
                  <iframe 
                    src={src} 
                    className="absolute top-0 left-0 w-full h-full pointer-events-auto opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  />
                  <div className="absolute bottom-2 left-2 flex items-center gap-2 pointer-events-none">
                    <div className="bg-[#E6291C] text-[#EAE6DF] p-1 rounded-full">
                      <Play size={10} fill="currentColor" />
                    </div>
                    <span className="text-white font-mono text-[8px] uppercase tracking-widest drop-shadow-md">
                      Set 0{i + 1}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 6. WORK / EVENTS */}
          <div id="work" className={`border-b ${RED_BORDER}`}>
            <div className={`p-6 md:p-12 border-b ${RED_BORDER}`}>
              <h2 className="font-black text-4xl md:text-6xl uppercase tracking-tighter">Work / Events</h2>
              <span className="font-mono text-[10px] uppercase tracking-widest mt-2 block">Archive 2024</span>
            </div>

            <div className="flex flex-col font-mono text-[10px] md:text-xs uppercase tracking-widest">
              {[
                { date: "MAR 12", title: "WAREHOUSE 001", loc: "MAKATI" },
                { date: "APR 04", title: "PLANET X UNKNWN", loc: "INTRAMUROS" },
                { date: "MAY 22", title: "INDUSTRIAL COMPLEX", loc: "PASIG" },
                { date: "AUG 18", title: "OPEN AIR SESSIONS", loc: "BGC" },
                { date: "NOV 02", title: "THE NOCTURNAL VOID", loc: "QUEZON CITY" }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className={`grid grid-cols-4 md:grid-cols-5 p-4 border-b last:border-b-0 ${RED_BORDER} hover:${RED_BG} hover:text-[#EAE6DF] transition-colors cursor-pointer group`}
                >
                  <div className="col-span-1 flex items-center">{item.date}</div>
                  <div className="col-span-2 md:col-span-3 font-bold text-sm md:text-base flex items-center">
                    {item.title}
                  </div>
                  <div className="col-span-1 text-right flex items-center justify-end gap-2">
                    <span className="hidden md:inline-block">{item.loc}</span>
                    <span className="md:hidden truncate">{item.loc}</span>
                    <Info size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 7. MEMBERS */}
          <div id="members" className={`p-6 md:p-12 border-b ${RED_BORDER}`}>
            <div className="flex justify-between items-end mb-12 md:mb-16">
              <h2 className="font-black text-4xl md:text-6xl uppercase tracking-tighter">Members</h2>
              <span className="font-mono text-[10px] uppercase tracking-widest">Individuals</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
              {[
                { name: "Adrian", role: "Selector / Curation", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600" },
                { name: "Sofia", role: "Visuals / Light", img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600" },
                { name: "Miguel", role: "Audio Production", img: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?q=80&w=600" }
              ].map((member, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="flex flex-col"
                >
                  <div className="w-full aspect-[3/4] overflow-hidden mb-6">
                    <img src={member.img} alt={member.name} className="w-full h-full object-cover grayscale contrast-125 hover:grayscale-0 transition-all duration-700" />
                  </div>
                  <div className="w-full flex justify-between items-end border-t border-[#E6291C] pt-2">
                    <span className="font-black uppercase text-2xl tracking-tighter">{member.name}</span>
                    <span className="font-mono text-[9px] uppercase tracking-widest opacity-80">{member.role}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 8. CONNECT (FOOTER) */}
          <div className="grid grid-cols-1 md:grid-cols-2 min-h-[40vh]">
            <div className={`p-6 md:p-12 md:border-r ${RED_BORDER} flex flex-col justify-center`}>
              <h2 className="font-black text-6xl md:text-8xl uppercase tracking-tighter leading-[0.85]">
                Connect
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-widest mt-6 opacity-80">
                Join the Network
              </span>
            </div>
            <div className={`${RED_BG} text-[#EAE6DF] p-6 md:p-12 flex flex-col justify-center`}>
               <div className="flex flex-col gap-8 md:gap-10 text-3xl md:text-5xl font-black uppercase tracking-tighter w-full">
                  {['Instagram', 'YouTube', 'Website'].map((platform, i) => (
                    <a key={i} href="#" className="group flex justify-between items-center border-b border-[#EAE6DF]/30 pb-4 hover:border-[#EAE6DF] transition-colors">
                       <span>{platform}</span> 
                       <span className="text-xl md:text-3xl opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300">↗</span>
                    </a>
                  ))}
               </div>
            </div>
          </div>

        </main>
      </motion.div>
    </motion.div>
  );
}