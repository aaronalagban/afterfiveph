"use client";

import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle, XCircle, Loader, ArrowRight, ArrowLeft, Sun, Moon, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const variants = {
  enter: (direction) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1
  },
  exit: (direction) => ({
    x: direction < 0 ? 100 : -100,
    opacity: 0
  })
};

export default function ManualSubmissionForm() {
  const [darkMode, setDarkMode] = useState(false);

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

  // Form State
  const [eventName, setEventName] = useState('');
  const [djs, setDjs] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [clubName, setClubName] = useState('');
  const [igPostUrl, setIgPostUrl] = useState('');
  
  // UI State
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  // We now have 5 steps (0 to 4)
  const totalSteps = 5;

  const canGoNext = () => {
    switch (step) {
      case 0: return eventName.trim().length > 0;
      case 1: return true; // DJs are optional
      case 2: return eventDate !== '';
      case 3: return clubName.trim().length > 0;
      case 4: return igPostUrl.trim().length > 0;
      default: return false;
    }
  };

  const handleNext = () => {
    if (!canGoNext()) return;
    setDirection(1);
    setStep((s) => s + 1);
    setMessage(null);
  };

  const handlePrev = () => {
    setDirection(-1);
    setStep((s) => s - 1);
    setMessage(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (step < totalSteps - 1) handleNext();
      else if (step === totalSteps - 1 && canGoNext()) handleSubmit(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canGoNext()) return;

    setMessage(null);
    setLoading(true);

    try {
      const payload = {
        eventName,
        djs,
        eventDate,
        clubName,
        igPostUrl
      };

      const response = await fetch('/api/submit-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: "SUBMITTED FOR APPROVAL!" });
        setTimeout(() => {
          setEventName(''); setDjs(''); setEventDate(''); setClubName(''); setIgPostUrl('');
          setStep(0);
          setMessage(null);
        }, 2500);
      } else {
        setMessage({ type: 'error', text: `ERROR: ${data.message || 'Unknown error'}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `SYS FAIL: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `w-full p-4 border-2 focus:outline-none focus:ring-0 hard-shadow-sm transition-colors ${
    darkMode ? 'bg-[#1a1a1a] border-neutral-700 text-white placeholder-neutral-600' : 'bg-white border-black text-black placeholder-neutral-300'
  }`;

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <h2 className="font-black text-3xl md:text-4xl uppercase leading-none">The Gig</h2>
            <p className={`font-mono text-xs uppercase tracking-widest ${darkMode ? 'text-[#00E5FF]' : 'text-neutral-500'}`}>What's the event name?</p>
            <input
              type="text" autoFocus value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputClass} font-black text-2xl uppercase`}
              placeholder="e.g. STRICTLY VINYL"
            />
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="font-black text-3xl md:text-4xl uppercase leading-none">The Lineup</h2>
            <p className={`font-mono text-xs uppercase tracking-widest ${darkMode ? 'text-[#00E5FF]' : 'text-neutral-500'}`}>Comma separated DJs (Optional)</p>
            <textarea
              autoFocus value={djs}
              onChange={(e) => setDjs(e.target.value)}
              className={`${inputClass} font-mono text-lg resize-none h-32`}
              placeholder="BRUNCHBOY, PHY, GLANCE..."
            />
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="font-black text-3xl md:text-4xl uppercase leading-none">When?</h2>
            <p className={`font-mono text-xs uppercase tracking-widest ${darkMode ? 'text-[#00E5FF]' : 'text-neutral-500'}`}>Select the date</p>
            <input
              type="date" autoFocus value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputClass} font-black text-2xl uppercase cursor-pointer`}
              style={{ colorScheme: darkMode ? 'dark' : 'light' }}
            />
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="font-black text-3xl md:text-4xl uppercase leading-none">Where?</h2>
            <p className={`font-mono text-xs uppercase tracking-widest ${darkMode ? 'text-[#00E5FF]' : 'text-neutral-500'}`}>Enter the venue name</p>
            <input
              type="text" autoFocus value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputClass} font-black text-2xl uppercase`}
              placeholder="e.g. KAMPAI"
            />
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-black text-3xl uppercase leading-none mb-1">IG Link</h2>
              <p className={`font-mono text-xs uppercase tracking-widest mb-3 ${darkMode ? 'text-[#00E5FF]' : 'text-neutral-500'}`}>Paste the Instagram link</p>
              <input
                type="url" value={igPostUrl}
                onChange={(e) => setIgPostUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`${inputClass} font-mono text-sm p-3`}
                placeholder="https://instagram.com/p/..."
              />
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className={`fixed inset-0 w-full h-[100dvh] font-sans overflow-hidden flex flex-col transition-colors duration-300 ${darkMode ? 'bg-[#121212] text-white' : 'bg-white text-black'}`}>
      
      {/* Background Styling */}
      <style dangerouslySetInnerHTML={{ __html: `
        .hard-shadow { box-shadow: 4px 4px 0px 0px ${darkMode ? 'rgba(0,0,0,0.5)' : '#000'}; }
        .hard-shadow-sm { box-shadow: 2px 2px 0px 0px ${darkMode ? 'rgba(0,0,0,0.5)' : '#000'}; }
        .playful-bg { background-image: radial-gradient(#000 1px, transparent 1px), radial-gradient(#000 1px, transparent 1px); background-size: 40px 40px; background-position: 0 0, 20px 20px; animation: bgShift 10s linear infinite; }
        .playful-bg-dark { background-image: radial-gradient(#ffffff 1px, transparent 1px), radial-gradient(#ffffff 1px, transparent 1px); background-size: 40px 40px; background-position: 0 0, 20px 20px; animation: bgShift 10s linear infinite; }
        @keyframes bgShift { 0% { background-position: 0 0, 20px 20px; } 100% { background-position: 40px 40px, 60px 60px; } }
      `}} />
      <div className={`absolute inset-0 pointer-events-none opacity-5 ${darkMode ? 'playful-bg-dark' : 'playful-bg'}`} />

      {/* Header */}
      <div className={`relative z-10 w-full border-b-2 p-4 flex justify-between items-center shrink-0 ${darkMode ? 'bg-[#000] border-neutral-800' : 'bg-white border-black'}`}>
        <div className="flex items-center gap-5">
          <a href="/" className={`p-1.5 border-2 transition-colors ${darkMode ? 'border-neutral-700 text-white hover:bg-neutral-800' : 'border-black text-black hover:bg-neutral-100'}`}><Home size={18} /></a>
          <img src="/logo-1.png" alt="Logo" className="h-8 w-auto cursor-pointer" onClick={() => window.location.href = "/"} />
        </div>
        <button onClick={() => setDarkMode(!darkMode)} className={`transition-colors ${darkMode ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-black'}`}>
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative w-full flex flex-col justify-center items-center p-4 overflow-hidden">
        <div className={`w-full max-w-md border-2 hard-shadow relative flex flex-col max-h-full ${darkMode ? 'bg-[#111] border-neutral-800' : 'bg-white border-black'}`}>
          <div className={`w-full h-3 flex border-b-2 ${darkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-[#F0F0F0] border-black'}`}>
            <motion.div className="h-full bg-[#76FF03]" initial={{ width: '0%' }} animate={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
          </div>

          <div className="p-6 md:p-8 flex-1 overflow-y-auto">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div key={step} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
                {renderStep()}
              </motion.div>
            </AnimatePresence>

            <AnimatePresence>
              {message && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`mt-6 p-4 border-2 hard-shadow-sm flex items-center gap-3 font-mono font-bold text-xs uppercase ${message.type === 'success' ? 'bg-[#76FF03] text-black' : 'bg-[#FF3D00] text-white'}`}>
                  {message.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  <span>{message.text}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className={`p-4 flex justify-between gap-4 border-t-2 ${darkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-[#F0F0F0] border-black'}`}>
            {step > 0 ? (
              <button onClick={handlePrev} className={`px-4 py-3 border-2 font-black uppercase text-xs hard-shadow-sm ${darkMode ? 'bg-[#1a1a1a] text-white border-neutral-700' : 'bg-white border-black'}`}><ArrowLeft size={16} /></button>
            ) : <div />}

            <button
              onClick={step < totalSteps - 1 ? handleNext : handleSubmit}
              disabled={!canGoNext() || loading}
              className={`px-6 py-3 border-2 font-black uppercase text-xs flex items-center gap-2 transition-all ${
                canGoNext() && !loading ? 'bg-[#00E5FF] border-black hard-shadow-sm active:translate-y-1 active:shadow-none' : 'bg-gray-200 text-gray-400 border-neutral-300 cursor-not-allowed'
              }`}
            >
              {loading ? <Loader className="animate-spin" size={16} /> : step < totalSteps - 1 ? <>NEXT <ArrowRight size={16} /></> : <>SUBMIT EVENT</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}