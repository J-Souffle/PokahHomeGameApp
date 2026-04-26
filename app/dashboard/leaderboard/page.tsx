import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ChevronLeft, Trophy, Zap, Anchor, Flame } from 'lucide-react'

export default async function LeaderboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  // Fetch results with session info to calculate rebuys/buy-ins for comeback logic
  const { data: leaderboard, error } = await supabase
    .from('player_results')
    .select(`
      user_id, 
      final_chips,
      rebuys,
      poker_sessions (buy_in),
      profiles (*)
    `)

  if (error) console.error("Leaderboard Error:", error)

  const totals = leaderboard?.reduce((acc: any, curr: any) => {
    const id = curr.user_id;
    if (!acc[id]) {
      const p = curr.profiles;
      const playerName = p?.display_name || p?.full_name || p?.username || `Player ${id.substring(0,4)}`;
      
      acc[id] = { 
        name: playerName, 
        totalProfit: 0, 
        games: 0, 
        bestSingleWin: 0,
        biggestComeback: 0,
        rebuys: 0
      };
    }

    const buyIn = Number(curr.poker_sessions?.buy_in || 5);
    const rebuys = Number(curr.rebuys || 0);
    const profit = Number(curr.final_chips || 0) - (buyIn * (1 + rebuys));

    acc[id].totalProfit += profit;
    acc[id].games += 1;
    acc[id].rebuys += rebuys;
    
    // Greatest Comeback Logic (Profit on a game where they rebought at least twice)
    if (rebuys >= 2 && profit > acc[id].biggestComeback) {
      acc[id].biggestComeback = profit;
    }

    // High Roller Logic (Single largest net win)
    if (profit > acc[id].bestSingleWin) {
      acc[id].bestSingleWin = profit;
    }

    return acc;
  }, {});

  const playerArray = Object.values(totals || {});
  
  const sortedLeaderboard = [...playerArray].sort((a: any, b: any) => b.totalProfit - a.totalProfit);
  
  // Find global "Kings" for the Milestone cards
  const ironMan = [...playerArray].sort((a: any, b: any) => b.games - a.games)[0];
  const comebackKing = [...playerArray].sort((a: any, b: any) => b.biggestComeback - a.biggestComeback)[0];
  const highRoller = [...playerArray].sort((a: any, b: any) => b.bestSingleWin - a.bestSingleWin)[0];

  return (
    <div className="p-8 bg-black min-h-screen text-white font-sans selection:bg-yellow-500/30">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes subtle-glow {
          0%, 100% { border-color: rgba(234, 179, 8, 0.2); box-shadow: 0 0 20px rgba(234, 179, 8, 0.05); }
          50% { border-color: rgba(234, 179, 8, 0.6); box-shadow: 0 0 40px rgba(234, 179, 8, 0.2); }
        }
        .top-dawg-glow { animation: subtle-glow 3s infinite ease-in-out; }
      `}} />
      

      <div className="max-w-4xl mx-auto">
        {/* Navigation Link */}
        <Link 
          href="/dashboard" 
          className="group flex items-center gap-2 text-zinc-600 hover:text-white transition-all mb-12 font-black italic text-[10px] tracking-[0.3em] uppercase"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to the Lab
        </Link>
        <header className="mb-12">
          <h1 className="text-7xl font-black italic tracking-tighter uppercase leading-none text-white">
            TOP <span className="text-yellow-500">DAWGS</span>
          </h1>
          <div className="h-1.5 w-24 bg-yellow-500 mt-4" />
          <p className="text-zinc-600 mt-4 text-[10px] font-bold tracking-[0.5em] uppercase italic">The Suite Hall of Fame</p>
        </header>

        {/* Milestone Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl">
            <div className="text-yellow-500 mb-3"><Trophy size={20}/></div>
            <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">High Roller</p>
            <p className="text-xl font-black italic uppercase">{highRoller?.name}</p>
            <p className="text-zinc-600 text-[10px] font-mono">+${highRoller?.bestSingleWin.toFixed(2)} single game</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl">
            <div className="text-green-500 mb-3"><Zap size={20}/></div>
            <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Comeback King</p>
            <p className="text-xl font-black italic uppercase">{comebackKing?.name}</p>
            <p className="text-zinc-600 text-[10px] font-mono">Won after 2+ rebuys</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl">
            <div className="text-blue-500 mb-3"><Anchor size={20}/></div>
            <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Iron Man</p>
            <p className="text-xl font-black italic uppercase">{ironMan?.name}</p>
            <p className="text-zinc-600 text-[10px] font-mono">{ironMan?.games} sessions logged</p>
          </div>
        </div>

        {/* Main Leaderboard */}
        <div className="space-y-4">
          {sortedLeaderboard.map((player: any, i) => {
            const isFirst = i === 0;
            const isIronMan = player.name === ironMan?.name;
            return (
              <div 
                key={i} 
                className={`flex justify-between items-center p-8 rounded-2xl border transition-all duration-500 ${
                  isFirst 
                    ? 'top-dawg-glow bg-zinc-900/90 border-yellow-500/50 scale-[1.02] shadow-2xl' 
                    : 'bg-zinc-900/30 border-zinc-800/50 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-8">
                  <span className={`text-4xl font-black italic ${
                    isFirst ? 'text-yellow-500' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-orange-900' : 'text-zinc-800'
                  }`}>
                    {i + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="font-black text-2xl tracking-tight uppercase italic text-zinc-100">{player.name}</p>
                      {isFirst && <span className="text-[9px] bg-yellow-500 text-black px-2 py-0.5 font-black uppercase rounded-sm">Apex</span>}
                      {isIronMan && <Flame size={14} className="text-orange-600 animate-pulse" />}
                    </div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black mt-1">
                      {player.games} SESSIONS / {player.rebuys} TOTAL REBUYS
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-mono font-black tracking-tighter ${player.totalProfit >= 0 ? 'text-green-500' : 'text-red-600'}`}>
                    {player.totalProfit >= 0 ? `+$${player.totalProfit.toFixed(2)}` : `-$${Math.abs(player.totalProfit).toFixed(2)}`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}