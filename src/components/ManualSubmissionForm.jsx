"use client";

import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle, XCircle, Loader, ArrowRight, ArrowLeft, Image as ImageIcon, Sun, Moon, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const POBLACION_CLUBS = [
  "kampaiph",
  "apothekamanila",
  "openhouse.world",
  "umaafterdark",
  "uglyduckpoblacion",
  "electric.sala",
  "annexhousemanila"
];

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
  const [failedAttempts, setFailedAttempts] = useState(0);

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
  const [password, setPassword] = useState('');
  const [eventName, setEventName] = useState('');
  const [djs, setDjs] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [clubName, setClubName] = useState('');
  const [igPostUrl, setIgPostUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  
  // UI State
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const totalSteps = 6;

  const canGoNext = () => {
    switch (step) {
      case 0: return password.length > 0;
      case 1: return eventName.trim().length > 0;
      case 2: return true; 
      case 3: return eventDate !== '';
      case 4: return clubName !== '';
      case 5: return igPostUrl.trim().length > 0 && imageFile !== null;
      default: return false;
    }
  };

  const handleNext = () => {
     if (!canGoNext()) return;

    // STEP 0: Password Check Flow
    if (step === 0) {
      // It looks for NEXT_PUBLIC_ADMIN_PASSWORD first, then falls back to "afterfive"
      const correctPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "afterfive";
      
      if (password !== correctPassword) {
        console.log("Login Failed. Input:", password);
        const newCount = failedAttempts + 1;
        setFailedAttempts(newCount);

        if (newCount === 1) {
          setMessage({ type: 'error', text: "Cmon bro.." });
        } else {
          setMessage({ type: 'error', text: "Just DM @aaronalagbann (Instagram) for the password" });
        }
        return; 
      } else {
        console.log("Login Success!");
      }
    }

    setDirection(1);
    setStep((s) => s + 1);
    setMessage(null);
    setFailedAttempts(0); 
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
      const formData = new FormData();
      formData.append('password', password);
      formData.append('eventName', eventName);
      formData.append('djs', djs);
      formData.append('eventDate', eventDate);
      formData.append('clubName', clubName);
      formData.append('igPostUrl', igPostUrl);
      if (imageFile) formData.append('imageFile', imageFile);

      const response = await fetch('/api/submit-event', {
        method: 'POST',
        body: formData,
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (err) {
        throw new Error(`Server Error: ${responseText.substring(0, 100)}`);
      }

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || "EVENT LOCKED IN!" });
        
        setTimeout(() => {
          setEventName(''); setDjs(''); setEventDate(''); setClubName(''); setIgPostUrl(''); setImageFile(null);
          setMessage(null);
          setStep(1); 
        }, 2500);
        
      } else {
        setMessage({ type: 'error', text: `ERROR: ${data.message || 'Unknown error'}` });
      }
    } catch (error) {
      console.error("Submission error:", error);
      setMessage({ type: 'error', text: `SYS FAIL: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `w-full p-4 border-2 focus:outline-none focus:ring-0 hard-shadow-sm transition-colors ${
    darkMode 
      ? 'bg-[#1a1a1a] border-neutral-700 text-white placeholder-neutral-600' 
      : 'bg-white border-black text-black placeholder-neutral-300'
  }`;

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <h2 className="font-black text-3xl md:text-4xl uppercase">Admin Access</h2>
            <p className={`font-mono text-xs uppercase tracking-widest ${darkMode ? 'text-[#00E5FF]' : 'text-neutral-500'}`}>Enter passcode to proceed</p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputClass} font-mono text-xl text-center`}
              placeholder="••••••••"
            />
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="font-black text-3xl md:text-4xl uppercase">The Gig</h2>
            <p className={`font-mono text-xs uppercase tracking-widest ${darkMode ? 'text-[#00E5FF]' : 'text-neutral-500'}`}>What's the event name?</p>
            <input
              type="text"
              autoFocus
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputClass} font-black text-2xl uppercase`}
              placeholder="e.g. STRICTLY VINYL"
            />
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="font-black text-3xl md:text-4xl uppercase">The Lineup</h2>
            <p className={`font-mono text-xs uppercase tracking-widest ${darkMode ? 'text-[#00E5FF]' : 'text-neutral-500'}`}>Comma separated DJs</p>
            <textarea
              autoFocus
              value={djs}
              onChange={(e) => setDjs(e.target.value)}
              className={`${inputClass} font-mono text-lg resize-none h-32`}
              placeholder="BRUNCHBOY, PHY, GLANCE, AIRIEL..."
            />
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="font-black text-3xl md:text-4xl uppercase">When?</h2>
            <p className={`font-mono text-xs uppercase tracking-widest ${darkMode ? 'text-[#00E5FF]' : 'text-neutral-500'}`}>Select the exact date</p>
            <input
              type="date"
              autoFocus
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputClass} font-black text-2xl uppercase cursor-pointer`}
              style={{ colorScheme: darkMode ? 'dark' : 'light' }}
            />
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <h2 className="font-black text-3xl md:text-4xl uppercase">Where?</h2>
            <p className={`font-mono text-xs uppercase tracking-widest ${darkMode ? 'text-[#00E5FF]' : 'text-neutral-500'}`}>Select the venue</p>
            <select
              autoFocus
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              className={`${inputClass} font-black text-xl uppercase appearance-none cursor-pointer`}
              style={{ 
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='${darkMode ? '%23fff' : '%23000'}' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, 
                backgroundRepeat: 'no-repeat', 
                backgroundPosition: 'right 1rem center', 
                backgroundSize: '1.5em 1.5em' 
              }}
            >
              <option value="" disabled>SELECT A VENUE</option>
              {POBLACION_CLUBS.map((club) => (
                <option key={club} value={club}>@{club.toUpperCase()}</option>
              ))}
            </select>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-black text-2xl md:text-3xl uppercase mb-1">IG Link</h2>
              <input
                type="url"
                value={igPostUrl}
                onChange={(e) => setIgPostUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`${inputClass} font-mono text-sm p-3`}
                placeholder="https://instagram.com/p/..."
              />
            </div>
            
            <div>
              <h2 className="font-black text-2xl md:text-3xl uppercase mb-1">Poster</h2>
              <div className={`relative w-full border-2 border-dashed transition-colors cursor-pointer group flex flex-col items-center justify-center p-6 h-32 hard-shadow-sm ${darkMode ? 'bg-[#1a1a1a] border-neutral-700 hover:bg-neutral-800' : 'bg-[#F0F0F0] border-black hover:bg-[#FFEB3B]'}`}>
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {imageFile ? (
                  <div className="text-center">
                    <CheckCircle className="mx-auto mb-2 text-[#76FF03]" size={32} />
                    <span className={`font-black uppercase text-sm ${darkMode ? 'text-white' : 'text-black'}`}>{imageFile.name}</span>
                  </div>
                ) : (
                  <div className={`text-center transition-opacity ${darkMode ? 'opacity-50 text-white group-hover:opacity-100' : 'opacity-50 text-black group-hover:opacity-100'}`}>
                    <ImageIcon className="mx-auto mb-2" size={32} />
                    <span className="font-black uppercase text-sm">TAP TO UPLOAD</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`fixed inset-0 w-full h-[100dvh] font-sans overflow-hidden flex flex-col transition-colors duration-300 ${darkMode ? 'bg-[#121212] text-white' : 'bg-white text-black'}`}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .hard-shadow { box-shadow: 4px 4px 0px 0px ${darkMode ? 'rgba(0,0,0,0.5)' : '#000'}; }
        .hard-shadow-sm { box-shadow: 2px 2px 0px 0px ${darkMode ? 'rgba(0,0,0,0.5)' : '#000'}; }
        
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
      `}} />
      <div className={`absolute inset-0 pointer-events-none opacity-10 ${darkMode ? 'playful-bg-dark' : 'playful-bg'}`} />

      {/* Header */}
      <div className={`relative z-10 w-full border-b-2 p-4 flex justify-between items-center shrink-0 ${darkMode ? 'bg-[#000] border-neutral-800' : 'bg-white border-black'}`}>
        <div className="flex items-center gap-5">
          <a href="/" className={`p-1.5 border-2 transition-colors ${darkMode ? 'border-neutral-700 text-white hover:bg-neutral-800' : 'border-black text-black hover:bg-neutral-100'}`}>
             <Home size={18} />
          </a>
          <img 
            src="/logo-1.png" 
            alt="AfterFive Logo" 
            className="h-8 w-auto cursor-pointer hover:scale-105 transition-transform" 
            onClick={() => window.location.href = "/"} 
          />
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setDarkMode(!darkMode)} className={`transition-colors ${darkMode ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-black'}`}>
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="bg-[#FF3D00] text-white px-2 py-0.5 font-mono text-[10px] font-bold shadow-[1px_1px_0px_transparent] border border-transparent">ADMIN</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative w-full flex flex-col justify-center items-center p-4 md:p-8 overflow-hidden">
        <div className={`w-full max-w-md border-2 hard-shadow relative flex flex-col max-h-full ${darkMode ? 'bg-[#111] border-neutral-800' : 'bg-white border-black'}`}>
          
          {/* Progress Bar */}
          <div className={`w-full h-3 flex border-b-2 ${darkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-[#F0F0F0] border-black'}`}>
            <motion.div 
              className={`h-full bg-[#00E5FF] border-r-2 ${darkMode ? 'border-neutral-800' : 'border-black'}`}
              initial={{ width: '0%' }}
              animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>

          {/* Form Step Content */}
          <div className="p-6 md:p-8 flex-1 overflow-y-auto hide-scrollbar">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>

            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className={`mt-6 p-4 border-2 hard-shadow-sm flex items-start md:items-center gap-3 font-mono font-bold text-[10px] md:text-xs uppercase leading-tight ${
                    message.type === 'success' 
                      ? (darkMode ? 'bg-[#76FF03] text-black border-neutral-700' : 'bg-[#76FF03] text-black border-black') 
                      : (darkMode ? 'bg-[#FF3D00] text-white border-neutral-700' : 'bg-[#FF3D00] text-white border-black')
                  }`}
                >
                  {message.type === 'success' ? <CheckCircle size={16} className="shrink-0 mt-0.5 md:mt-0" /> : <XCircle size={16} className="shrink-0 mt-0.5 md:mt-0" />}
                  <span>{message.text}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Controls */}
          <div className={`p-4 flex justify-between gap-4 shrink-0 border-t-2 ${darkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-[#F0F0F0] border-black'}`}>
            {step > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                disabled={loading}
                className={`px-4 py-3 border-2 font-black uppercase text-xs md:text-sm hard-shadow-sm active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 ${darkMode ? 'bg-[#1a1a1a] border-neutral-700 text-white hover:bg-neutral-800' : 'bg-white border-black hover:bg-gray-100'}`}
              >
                <ArrowLeft size={16} /> BACK
              </button>
            ) : (
              <div /> 
            )}

            {step < totalSteps - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canGoNext()}
                className={`px-6 py-3 border-2 font-black uppercase text-xs md:text-sm flex items-center gap-2 transition-all ${
                  canGoNext() 
                    ? (darkMode ? 'bg-[#00E5FF] text-black border-neutral-700 hard-shadow-sm hover:bg-[#76FF03] active:translate-y-1 active:shadow-none' : 'bg-[#00E5FF] border-black hard-shadow-sm hover:bg-[#76FF03] active:translate-y-1 active:shadow-none')
                    : (darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-600 cursor-not-allowed' : 'bg-gray-200 border-black text-gray-400 cursor-not-allowed')
                }`}
              >
                NEXT <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canGoNext() || loading}
                className={`px-6 py-3 border-2 font-black uppercase text-xs md:text-sm flex items-center gap-2 transition-all flex-1 justify-center ${
                  canGoNext() && !loading
                    ? (darkMode ? 'bg-[#FF3D00] text-white border-neutral-700 hard-shadow-sm hover:bg-white hover:text-black active:translate-y-1 active:shadow-none' : 'bg-[#FF3D00] text-white border-black hard-shadow-sm hover:bg-black active:translate-y-1 active:shadow-none')
                    : (darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-600 cursor-not-allowed' : 'bg-gray-200 border-black text-gray-400 cursor-not-allowed')
                }`}
              >
                {loading ? (
                  <><Loader size={16} className="animate-spin" /> SENDING...</>
                ) : (
                  <><UploadCloud size={16} /> UPLOAD EVENT</>
                )}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}