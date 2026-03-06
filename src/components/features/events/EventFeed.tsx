// src/components/features/events/EventFeed.tsx
"use client";

import { motion } from "framer-motion";
import { Event } from "@/types";

export default function EventFeed({ events }: { events: Event[] }) {
  if (!events || events.length === 0) {
    return (
      <div className="h-screen w-full bg-black text-white flex items-center justify-center font-mono">
        No upcoming events yet. Run your scraper!
      </div>
    );
  }

  return (
    <main className="h-screen w-full overflow-y-scroll snap-y snap-mandatory bg-black text-white">
      {events.map((event, index) => (
        <section 
          key={event.id || index} 
          className="relative h-screen w-full snap-start snap-always flex flex-col justify-end p-8 md:p-16"
        >
          {/* Background Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center z-0 opacity-50" 
            style={{ backgroundImage: `url(${event.image_url})` }} 
          />
          {/* Dark Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-0" />

          {/* Animated Text */}
          <motion.div 
            className="relative z-10 mb-12" 
            initial={{ opacity: 0, y: 40 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.7, ease: "easeOut" }} 
            viewport={{ once: false, amount: 0.3 }}
          >
            <motion.p 
              className="text-emerald-400 font-bold tracking-widest uppercase mb-2 text-sm md:text-lg"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })} • {event.city}
            </motion.p>
            
            <motion.h1 
              className="text-6xl md:text-9xl font-black mb-2 uppercase tracking-tighter leading-none"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              {event.dj_name}
            </motion.h1>
            
            <motion.p 
              className="text-2xl md:text-4xl font-light text-gray-300"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              @ {event.club_name}
            </motion.p>
          </motion.div>
        </section>
      ))}
    </main>
  );
}