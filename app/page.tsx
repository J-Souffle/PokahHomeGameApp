'use client'
import { useState } from "react"
import { useRouter } from 'next/navigation'
import { Trophy, Zap, ChevronRight, Crown } from "lucide-react"

export default function PokerDashboard() {
  const router = useRouter()
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleEnter = () => {
    setIsTransitioning(true)
    setTimeout(() => {
      router.push('/dashboard')
    }, 800)
  }

  return (
    <main className={`min-h-screen bg-black flex items-center justify-center p-6 overflow-hidden transition-all duration-1000 relative ${isTransitioning ? 'scale-150 blur-3xl opacity-0' : 'scale-100'}`}>
      
      {/* ANIMATED BACKGROUND LAYER */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Animated Gradient Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-yellow-500/20 blur-[120px] rounded-full animate-pulse transition-all duration-[10s]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse delay-700 transition-all duration-[8s]" />
        
        {/* The Grid Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.15]" 
          style={{ 
            backgroundImage: `linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)`,
            backgroundSize: '40px 40px' 
          }} 
        />

        {/* Floating Particles/Shapes */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30" />
        
        <div className="absolute top-1/4 left-1/3 w-1 h-32 bg-gradient-to-b from-transparent via-yellow-500/20 to-transparent animate-drift" />
        <div className="absolute top-1/2 right-1/4 w-1 h-24 bg-gradient-to-b from-transparent via-blue-500/20 to-transparent animate-drift delay-1000" />
      </div>

      <div className="relative z-10 max-w-md w-full animate-float">
        {/* The "3D" Card */}
        <div className="group perspective-1000">
          <div className="relative bg-zinc-900/60 border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-xl transform transition-all duration-500 hover:rotate-x-12 hover:rotate-y-12 hover:shadow-yellow-500/10 border-t-zinc-700/50">
            
            <div className="flex justify-between items-start mb-12">
              <div className="w-12 h-12 bg-yellow-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.5)]">
                <Crown size={24} className="text-black" />
              </div>
              <div className="text-right">
                <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">Access Level</p>
                <p className="text-white font-mono text-xs font-bold uppercase tracking-widest">Josh's Homeboy/Homegirl</p>
              </div>
            </div>

            <header className="mb-10 text-center">
              <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-[0.8] text-white">
                Welcome to the <span className="text-yellow-500">High Roller</span> <br />Suite
              </h1>
              <p className="text-zinc-500 mt-6 text-[10px] font-bold tracking-[0.4em] uppercase">Session ID: 43dfbd26...B7E81A58</p>
            </header>

            <div className="space-y-4">
              <button 
                onClick={handleEnter}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black italic py-6 rounded-2xl transition-all uppercase flex items-center justify-center gap-3 group active:scale-95 shadow-[0_20px_50px_-10px_rgba(234,179,8,0.4)] relative overflow-hidden"
              >
                <span className="relative z-10">Enter Dashboard</span>
                <ChevronRight size={20} className="relative z-10 group-hover:translate-x-2 transition-transform" />
                {/* Button Shine Animation */}
                <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-all duration-500 group-hover:left-[100%]" />
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-xl flex flex-col items-center">
                  <Trophy size={16} className="text-zinc-500 mb-2" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Leaderboard</span>
                </div>
                <div className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-xl flex flex-col items-center">
                  <Zap size={16} className="text-zinc-500 mb-2" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Live Stats</span>
                </div>
              </div>
            </div>

            {/* Bottom Glow Effect */}
            <div className="absolute -bottom-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent opacity-80" />
          </div>
        </div>

        <p className="text-center mt-12 text-zinc-800 font-black uppercase text-[9px] tracking-[0.6em] animate-pulse">
          Connection Secure // Auth Valid
        </p>
      </div>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes drift {
          0% { transform: translateY(-100%) translateX(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(100vh) translateX(50px); opacity: 0; }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-drift {
          animation: drift 8s linear infinite;
        }
        .perspective-1000 {
          perspective: 1000px;
        }
        .rotate-x-12 {
          transform: rotateX(8deg);
        }
        .rotate-y-12 {
          transform: rotateY(-8deg);
        }
      `}</style>
    </main>
  )
}