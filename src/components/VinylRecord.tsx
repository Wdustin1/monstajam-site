'use client';

import { motion } from 'framer-motion';

export default function VinylRecord() {
  return (
    <div className="relative w-[400px] h-[400px] md:w-[500px] md:h-[500px]">
      {/* Glow effects */}
      <div className="absolute inset-0 rounded-full bg-fuchsia-500/50 blur-[100px]"></div>
      <div className="absolute inset-0 rounded-full bg-cyan-500/50 blur-[100px] translate-x-10 translate-y-10"></div>

      {/* Record Graphic */}
      <div className="absolute inset-0 rounded-full border border-white/10 bg-gradient-to-tr from-gray-900 to-black p-4 shadow-[0_0_50px_rgba(255,0,255,0.3)]">
        {/* Spinning vinyl disc */}
        <motion.div
          className="w-full h-full rounded-full border border-gray-800 bg-[#111] flex items-center justify-center relative overflow-hidden"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          {/* Grooves simulation */}
          <div className="absolute inset-4 rounded-full border border-gray-800/50"></div>
          <div className="absolute inset-8 rounded-full border border-gray-800/50"></div>
          <div className="absolute inset-12 rounded-full border border-gray-800/50"></div>
          <div className="absolute inset-16 rounded-full border border-gray-800/50"></div>
          <div className="absolute inset-20 rounded-full border border-gray-800/50"></div>
          <div className="absolute inset-24 rounded-full border border-gray-800/50"></div>

          {/* Center Label - counter-rotate to stay upright */}
          <motion.div
            className="w-32 h-32 rounded-full bg-gray-900 border border-gray-700 flex flex-col items-center justify-center z-10 shadow-lg"
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-sm transition-colors mb-2">
              <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4l12 6-12 6z"></path>
              </svg>
            </button>
            <span className="text-xs font-bold text-gray-300">Lost Tapes Vol. 1</span>
            <span className="text-[10px] text-gray-500">Various Artists</span>
          </motion.div>
        </motion.div>

        {/* Tonearm */}
        <div className="absolute top-10 right-10 w-4 h-40 bg-gradient-to-b from-gray-700 to-gray-900 rounded-full origin-top transform rotate-45 shadow-lg border border-gray-600">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-10 bg-gray-800 rounded-sm border border-gray-600"></div>
        </div>
      </div>
    </div>
  );
}
