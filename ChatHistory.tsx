
import React, { useState } from 'react';

interface Props {
  messages: { role: 'user' | 'model', text: string }[];
}

export const ChatHistory: React.FC<Props> = ({ messages }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`fixed bottom-0 right-0 w-full md:w-80 bg-gray-900/95 backdrop-blur-xl border-t md:border-l border-rose-500/20 transition-transform duration-300 ease-in-out z-20 ${isOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-[calc(100%-56px)] md:translate-y-0 md:translate-x-[calc(100%-48px)]'}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:w-12 h-14 flex items-center justify-between px-4 md:px-0 md:justify-center bg-rose-600/10 md:absolute md:left-0 md:top-0 md:h-full md:bg-transparent"
      >
        <span className="md:hidden font-bold text-rose-300">কথোপকথন রেকর্ড</span>
        <i className={`fas fa-chevron-${isOpen ? 'down' : 'up'} md:fa-chevron-${isOpen ? 'right' : 'left'} text-rose-500`}></i>
      </button>

      <div className="h-80 md:h-[calc(100vh-80px)] overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <h3 className="hidden md:block text-lg font-bold text-rose-300 mb-6 flex items-center gap-2">
          <i className="fas fa-history"></i> কথোপকথন
        </h3>
        
        {messages.length === 0 ? (
          <div className="text-center py-10 opacity-30 italic text-sm">
            এখনও কোনো কথা হয়নি...
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] uppercase font-bold text-gray-500 mb-1">
                {msg.role === 'user' ? 'আপনি' : 'মায়া'}
              </span>
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-rose-600/20 text-rose-100 rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none'}`}>
                {msg.text || "..."}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
