
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="w-full py-4 px-6 flex justify-between items-center border-b border-rose-500/20 bg-black/30 backdrop-blur-md z-10">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 bg-rose-600 rounded-lg flex items-center justify-center shadow-lg shadow-rose-500/30">
          <i className="fas fa-heart text-white text-xl"></i>
        </div>
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-rose-400 to-rose-200 bg-clip-text text-transparent">
          তোমার গার্লফ্রেন্ড মায়া
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-xs font-medium text-rose-300 uppercase tracking-widest">Online</span>
        </div>
      </div>
    </header>
  );
};
