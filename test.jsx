"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Image as ImageIcon, 
  Settings, 
  Code2, 
  UploadCloud, 
  Wand2, 
  SlidersHorizontal,
  Download
} from "lucide-react";

export default function PremiumMinimalStudio() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Compress");
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  // Tools from your reference image_c94984.jpg
  const tools = ["Compress", "Resize", "Crop", "Rotate/Flip", "Filters", "Convert", "Watermark", "BG Remove"];

  useEffect(() => {
    // Initial Loader Timeout
    const timer = setTimeout(() => setIsLoading(false), 2000);
    
    // Mouse Tracking for Custom Context Cursor
    const updateMousePosition = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener("mousemove", updateMousePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", updateMousePosition);
    };
  }, []);

  // Framer Motion Variants
  const cursorVariants = {
    default: {
      x: mousePosition.x - 8,
      y: mousePosition.y - 8,
      height: 16,
      width: 16,
      backgroundColor: "#000000",
      mixBlendMode: "normal",
      transition: { type: "spring", stiffness: 500, damping: 28, mass: 0.5 }
    },
    hover: {
      x: mousePosition.x - 32,
      y: mousePosition.y - 32,
      height: 64,
      width: 64,
      backgroundColor: "#FFFFFF",
      mixBlendMode: "difference",
      transition: { type: "spring", stiffness: 400, damping: 25, mass: 0.5 }
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] font-sans overflow-hidden selection:bg-black selection:text-white">
      
      {/* Custom Context Cursor */}
      <motion.div
        className="fixed top-0 left-0 rounded-full pointer-events-none z-[9999]"
        variants={cursorVariants}
        animate={isHovering ? "hover" : "default"}
      />

      {/* Cinematic Loader */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: "-100%" }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          >
            <div className="overflow-hidden">
              <motion.h1 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "-100%" }}
                transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
                className="text-5xl md:text-7xl font-bold tracking-tighter text-white"
              >
                DevForge<span className="text-gray-500">.</span>
              </motion.h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex h-screen p-4 md:p-6 gap-6">
        
        {/* Minimal Sidebar */}
        <motion.aside 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="w-64 h-full flex flex-col"
        >
          <div 
            className="flex items-center gap-3 mb-12 pl-2"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Code2 className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">DevForge</h1>
          </div>

          <nav className="flex-1 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 pl-2">Studios</div>
            {[
              { icon: ImageIcon, label: "Image Studio", active: true, desc: "All image tools" },
              { icon: Code2, label: "JSON Studio", active: false, desc: "Format & validate" },
              { icon: Settings, label: "Dev Tools", active: false, desc: "Encoders & decoders" }
            ].map((item, idx) => (
              <div 
                key={idx}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className={`relative flex flex-col px-3 py-3 rounded-xl cursor-none transition-colors ${
                  item.active ? "bg-white shadow-[0_4px_20px_rgb(0,0,0,0.03)]" : "hover:bg-gray-100"
                }`}
              >
                {item.active && (
                  <motion.div 
                    layoutId="sidebar-active" 
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-black rounded-r-full"
                  />
                )}
                <div className="flex items-center gap-3">
                  <item.icon className={`w-4 h-4 ${item.active ? "text-black" : "text-gray-500"}`} />
                  <span className={`text-sm font-medium ${item.active ? "text-black" : "text-gray-600"}`}>
                    {item.label}
                  </span>
                </div>
                {item.desc && (
                  <span className="text-xs text-gray-400 ml-7 mt-0.5">{item.desc}</span>
                )}
              </div>
            ))}
          </nav>
        </motion.aside>

        {/* Main Content Workspace */}
        <main className="flex-1 h-full flex flex-col bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden relative">
          
          {/* Header */}
          <header className="h-20 border-b border-gray-100 flex items-center justify-between px-8">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" /> Image Studio
              </h2>
              <p className="text-xs text-gray-500 mt-1">Compress, resize, crop, rotate, filters, convert — all pipeline-based.</p>
            </div>
            <div className="flex gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
              <button 
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className="px-3 py-1.5 text-xs font-medium bg-white shadow-sm rounded-md border border-gray-200"
              >
                Side by Side
              </button>
              <button 
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-black transition-colors"
              >
                Stacked
              </button>
            </div>
          </header>

          {/* Interactive Tool Ribbon */}
          <div className="w-full border-b border-gray-100 bg-gray-50/50 px-8">
            <div className="flex gap-6 overflow-x-auto no-scrollbar">
              {tools.map((tool) => (
                <button
                  key={tool}
                  onClick={() => setActiveTab(tool)}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  className={`relative py-4 text-sm font-medium transition-colors cursor-none whitespace-nowrap ${
                    activeTab === tool ? "text-indigo-600" : "text-gray-500 hover:text-black"
                  }`}
                >
                  {tool}
                  {activeTab === tool && (
                    <motion.div
                      layoutId="active-tool-tab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
            
            {/* Visual Workspace (Side by Side) */}
            <div className="grid grid-cols-2 gap-8 h-80">
              {/* Working Image */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Working Image</span>
                  <span className="text-[10px] font-mono bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">1080 x 810</span>
                </div>
                <div 
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  className="flex-1 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-indigo-300 transition-all flex flex-col items-center justify-center gap-4 group cursor-none relative overflow-hidden"
                >
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-14 h-14 bg-white rounded-full shadow-sm flex items-center justify-center border border-gray-100 z-10"
                  >
                    <UploadCloud className="w-6 h-6 text-indigo-600" />
                  </motion.div>
                  <p className="text-sm text-gray-600 z-10 font-medium">Drop an image here</p>
                  
                  {/* Decorative background grid for the "premium" feel */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:16px_16px]" />
                </div>
              </div>

              {/* Result Image */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Result</span>
                </div>
                <div className="flex-1 rounded-2xl border border-gray-100 bg-[#F8F9FA] flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                  <Wand2 className="w-8 h-8 text-gray-300" />
                  <p className="text-sm text-gray-400">Awaiting processing...</p>
                </div>
              </div>
            </div>

            {/* Bottom Controls (Based on the Compression tab in the screenshot) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-auto bg-gray-50 border border-gray-100 rounded-2xl p-6 flex flex-col gap-6"
            >
              <div className="grid grid-cols-12 gap-8 items-start">
                
                {/* Format Dropdown */}
                <div className="col-span-3">
                  <label className="text-xs font-semibold text-gray-900 mb-2 block">Format</label>
                  <div 
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm flex justify-between items-center cursor-none hover:border-indigo-300 transition-colors shadow-sm"
                  >
                    AVIF <span className="text-gray-400 text-xs">▼</span>
                  </div>
                </div>

                {/* Sliders */}
                <div className="col-span-9 space-y-6">
                  <div>
                    <div className="flex justify-between text-xs mb-3">
                      <span className="font-semibold text-gray-900">Quality: <span className="text-indigo-600">63</span></span>
                      <span className="text-gray-400">Lower = better quality, slower</span>
                    </div>
                    {/* Custom Styled Range Input via Tailwind */}
                    <div 
                      onMouseEnter={() => setIsHovering(true)}
                      onMouseLeave={() => setIsHovering(false)}
                      className="w-full h-1.5 bg-gray-200 rounded-full cursor-none relative"
                    >
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "63%" }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full"
                      />
                      <div className="absolute top-1/2 -translate-y-1/2 left-[63%] w-4 h-4 bg-white border-2 border-indigo-600 rounded-full shadow-md" />
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 mt-2">
                <button 
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors cursor-none"
                >
                  Reset
                </button>
                <button 
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  className="px-6 py-2.5 rounded-lg text-sm font-medium bg-black text-white hover:bg-gray-800 transition-colors shadow-lg shadow-black/10 flex items-center gap-2 cursor-none"
                >
                  <SlidersHorizontal className="w-4 h-4" /> Preview Compress
                </button>
                <button 
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  className="px-6 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-none"
                >
                  <Download className="w-4 h-4" /> Download .avif
                </button>
              </div>
            </motion.div>
            
          </div>
        </main>
      </div>
    </div>
  );
}