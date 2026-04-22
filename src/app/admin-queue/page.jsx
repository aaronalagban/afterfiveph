"use client";

import React, { useState, useEffect } from 'react';
import { Check, X, Loader, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminQueue() {
  const [password, setPassword] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const fetchQueue = async (pass) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass, action: 'fetch' })
      });
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue);
        setIsAuth(true);
      } else {
        alert("Wrong password!");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (eventId, action) => {
    setProcessingId(eventId);
    try {
      const res = await fetch('/api/admin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action, eventId })
      });
      
      if (res.ok) {
        // Remove from queue on success
        setQueue(q => q.filter(e => e.id !== eventId));
      } else {
        const data = await res.json();
        alert(`Error: ${data.message}`);
      }
    } catch (e) {
      alert("Sys fail");
    } finally {
      setProcessingId(null);
    }
  };

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="w-full max-w-sm border-2 border-neutral-700 bg-black p-8 shadow-[4px_4px_0px_rgba(0,229,255,0.5)]">
          <h1 className="text-white font-black text-2xl mb-4 uppercase">Admin Queue</h1>
          <input 
            type="password" 
            placeholder="PASSWORD" 
            className="w-full bg-[#1a1a1a] border-2 border-neutral-700 text-white p-3 font-mono mb-4 text-center"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchQueue(password)}
          />
          <button 
            onClick={() => fetchQueue(password)}
            className="w-full bg-[#00E5FF] text-black font-black p-3 uppercase hover:bg-[#76FF03] transition-colors"
          >
            {loading ? 'WAIT...' : 'ENTER'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col p-4 md:p-8 overflow-hidden relative">
      <div className="flex justify-between items-center mb-8 max-w-md mx-auto w-full">
        <h1 className="font-black text-2xl uppercase tracking-tighter">Queue ({queue.length})</h1>
        <button onClick={() => fetchQueue(password)} className="p-2 border-2 border-neutral-700 hover:bg-neutral-800">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center relative max-w-md mx-auto w-full">
        {queue.length === 0 ? (
          <div className="text-neutral-500 font-mono text-center">
            <Check size={48} className="mx-auto mb-4 opacity-50" />
            <p>NO PENDING EVENTS.</p>
            <p className="text-xs mt-2">GO TOUCH GRASS.</p>
          </div>
        ) : (
          <AnimatePresence>
            {}
            <motion.div 
              key={queue[0].id}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ x: -200, opacity: 0, transition: { duration: 0.2 } }}
              className="absolute w-full bg-[#111] border-2 border-neutral-700 shadow-[8px_8px_0px_#000] p-6 flex flex-col gap-6"
            >
              <div>
                <h2 className="text-3xl font-black uppercase text-[#00E5FF] leading-none mb-1">
                  {queue[0].event_name}
                </h2>
                <p className="font-mono text-sm text-neutral-400">
                  @{queue[0].club_name} • {queue[0].event_date}
                </p>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 p-4 font-mono text-sm break-words">
                <span className="text-[#76FF03] font-bold">DJs:</span> {queue[0].djs?.join(", ") || "None"}
              </div>

              <a 
                href={queue[0].ig_post_url} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-2 border-2 border-neutral-700 p-3 font-black uppercase text-sm hover:bg-neutral-800 transition-colors"
              >
                View IG Post <ExternalLink size={16} />
              </a>

              <div className="flex gap-4 mt-2">
                <button 
                  disabled={processingId === queue[0].id}
                  onClick={() => handleAction(queue[0].id, 'reject')}
                  className="flex-1 flex justify-center items-center py-4 border-2 border-neutral-700 hover:bg-[#FF3D00] hover:text-white transition-colors disabled:opacity-50"
                >
                  <X size={24} />
                </button>

                <button 
                  disabled={processingId === queue[0].id}
                  onClick={() => handleAction(queue[0].id, 'approve')}
                  className="flex-1 flex justify-center items-center py-4 border-2 border-neutral-700 text-[#76FF03] hover:bg-[#76FF03] hover:text-black transition-colors disabled:opacity-50"
                >
                  {processingId === queue[0].id ? <Loader className="animate-spin" size={24} /> : <Check size={24} />}
                </button>
              </div>
              
              {processingId === queue[0].id && (
                <p className="text-center font-mono text-[10px] text-[#00E5FF] animate-pulse absolute -bottom-8 left-0 right-0">
                  RUNNING SCRAPER & UPLOADING...
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}