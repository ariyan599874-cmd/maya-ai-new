import React from 'react';

interface Props {
  status: 'idle' | 'connecting' | 'listening' | 'speaking';
  volume: number;
}

export const VoiceVisualizer: React.FC<Props> = ({ status, volume }) => {
  const volumeHeight = Math.min(volume * 1.5, 100);

  return (
    <div className="relative w-72 h-72 flex items-center justify-center">
      {/* Ambient Multi-Color Glow during speaking */}
      {status === 'speaking' && (
        <>
          <div className="absolute inset-[-20px] bg-rose-600/20 blur-[80px] rounded-full animate-pulse-slow"></div>
          <div className="absolute inset-[-40px] bg-purple-500/10 blur-[100px] rounded-full animate-glow-cycle-1"></div>
          <div className="absolute inset-[-30px] bg-rose-400/15 blur-[90px] rounded-full animate-glow-cycle-2"></div>
        </>
      )}

      {/* Main Avatar Centerpiece */}
      <div className={`relative w-56 h-56 rounded-full overflow-hidden border-2 transition-all duration-300 z-10 shadow-2xl ${
        status === 'speaking' ? 'border-rose-400 scale-105 shadow-[0_0_30px_rgba(225,29,72,0.6)]' : 
        status === 'listening' && volume > 10 ? 'border-rose-300/50 scale-102' : 'border-white/10'
      }`}>
        <img 
          src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600" 
          alt="Maya AI"
          className={`w-full h-full object-cover transition-all duration-[1000ms] ${status === 'idle' ? 'grayscale opacity-30 blur-[2px] scale-110' : 'grayscale-0 opacity-100 scale-100'}`}
        />
        
        {/* Real-time Frequency Visualizer Overlay */}
        {(status === 'speaking' || (status === 'listening' && volume > 5)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
            <div className="flex gap-1 items-center h-20">
              {[...Array(10)].map((_, i) => (
                <div 
                  key={i}
                  className={`w-1 rounded-full transition-all duration-75 shadow-[0_0_8px_#e11d48] ${status === 'speaking' ? 'bg-rose-400' : 'bg-rose-200/70'}`}
                  style={{ 
                    height: status === 'speaking' 
                      ? `${Math.random() * 50 + 20}%` 
                      : `${Math.min(15 + volumeHeight * (0.6 + Math.random() * 0.4), 100)}%`,
                    transitionDelay: `${i * 15}ms`
                  }}
                ></div>
              ))}
            </div>
            
            {/* Heart Particles during talking */}
            {status === 'speaking' && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                 <i className="fas fa-heart absolute text-rose-500/80 text-[10px] animate-float-up" style={{ left: '25%', bottom: '15%', animationDelay: '0s' }}></i>
                 <i className="fas fa-heart absolute text-pink-400/60 text-[12px] animate-float-up" style={{ right: '35%', bottom: '25%', animationDelay: '1.2s' }}></i>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-100px) scale(2); opacity: 0; }
        }
        @keyframes glow-cycle-1 {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.15); }
        }
        @keyframes glow-cycle-2 {
          0%, 100% { opacity: 0.2; transform: scale(1.1); }
          50% { opacity: 0.5; transform: scale(1.25); }
        }
        .animate-float-up { animation: float-up 3s ease-out infinite; }
        .animate-glow-cycle-1 { animation: glow-cycle-1 4s ease-in-out infinite; }
        .animate-glow-cycle-2 { animation: glow-cycle-2 5s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse 3s infinite; }
      `}</style>
    </div>
  );
};