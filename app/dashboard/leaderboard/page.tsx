import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ChevronLeft, Trophy, Zap, Anchor, Flame, ChevronRight } from 'lucide-react'

interface PlayerStats {
  name: string;
  totalProfit: number;
  games: number;
  bestSingleWin: number;
  biggestComeback: number;
  rebuys: number;
}

export default async function LeaderboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

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

  const totals = leaderboard?.reduce((acc: Record<string, PlayerStats>, curr: any) => {
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
    
    if (rebuys >= 2 && profit > acc[id].biggestComeback) {
      acc[id].biggestComeback = profit;
    }

    if (profit > acc[id].bestSingleWin) {
      acc[id].bestSingleWin = profit;
    }

    return acc;
  }, {});

  const playerArray = Object.values(totals || {}) as PlayerStats[];
  
  const sortedLeaderboard = [...playerArray].sort((a, b) => b.totalProfit - a.totalProfit);
  const ironMan = [...playerArray].sort((a, b) => b.games - a.games)[0];
  const comebackKing = [...playerArray].sort((a, b) => b.biggestComeback - a.biggestComeback)[0];
  const highRoller = [...playerArray].sort((a, b) => b.bestSingleWin - a.bestSingleWin)[0];

return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8 font-sans max-w-7xl mx-auto">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 md:mb-12 font-black italic text-[10px] tracking-widest uppercase">
        <ChevronLeft size={14} /> Back to Dashboard
      </Link>

      <header className="mb-12">
        <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase leading-none">Hall of <span className="text-yellow-500">Agents</span></h1>
        <p className="text-zinc-500 text-[10px] mt-4 font-mono uppercase tracking-[0.4em]">Global Lifetime Standings</p>
      </header>

      {/* Milestone Cards - Grid scales down to 1 col on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-12">
        {[
          { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-500/10', title: 'High Roller', name: highRoller?.name, stat: `+$${highRoller?.bestSingleWin.toFixed(2)}` },
          { icon: Anchor, color: 'text-blue-500', bg: 'bg-blue-500/10', title: 'Iron Man', name: ironMan?.name, stat: `${ironMan?.games} Sessions` },
          { icon: Flame, color: 'text-green-500', bg: 'bg-green-500/10', title: 'Comeback King', name: comebackKing?.name, stat: `+$${comebackKing?.biggestComeback.toFixed(2)}` },
        ].map((item, i) => (
          <div key={i} className="bg-zinc-900/50 border border-zinc-800 p-6 md:p-8 rounded-[2rem]">
            <div className={`w-12 h-12 rounded-2xl ${item.bg} border border-current/20 flex items-center justify-center ${item.color} mb-6`}>
              <item.icon size={24} />
            </div>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">{item.title}</p>
            <p className="text-xl md:text-2xl font-black italic uppercase text-white truncate">{item.name || '---'}</p>
            <p className={`${item.color} font-mono text-xs mt-2`}>{item.stat}</p>
          </div>
        ))}
      </div>

      {/* Main Leaderboard - Responsive Switch */}
      <div className="bg-zinc-900/40 rounded-[2rem] border border-zinc-800 overflow-hidden shadow-2xl">
        
        {/* Desktop Table View */}
        <table className="w-full text-left border-collapse hidden md:table">
          <thead>
            <tr className="text-zinc-600 text-[10px] uppercase tracking-[0.2em] border-b border-zinc-800">
              <th className="p-8 font-black text-center w-20">Rank</th>
              <th className="p-8 font-black">Agent</th>
              <th className="p-8 font-black text-center">Sessions</th>
              <th className="p-8 font-black text-right">Lifetime Profit</th>
            </tr>
          </thead>
          <tbody>
            {sortedLeaderboard.map((player, index) => (
              <tr key={player.name} className="border-b border-zinc-800/50 hover:bg-white/[0.02] transition-colors group">
                <td className="p-8 text-center font-black italic text-2xl text-zinc-700 group-hover:text-yellow-500 transition-colors">#{index + 1}</td>
                <td className="p-8">
                  <p className="font-black text-xl italic uppercase text-zinc-200">{player.name}</p>
                  <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">{player.rebuys} Rebuys</p>
                </td>
                <td className="p-8 text-center font-mono text-zinc-400 font-bold">{player.games}</td>
                <td className="p-8 text-right">
                  <span className={`font-black text-3xl ${player.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {player.totalProfit >= 0 ? `+$${player.totalProfit.toFixed(2)}` : `-$${Math.abs(player.totalProfit).toFixed(2)}`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile List View */}
        {/* Mobile List View */}
<div className="md:hidden divide-y divide-zinc-800">
  {sortedLeaderboard.map((player, index) => (
    // 1. Added 'gap-4' and 'min-w-0' to the main container
    <div key={player.name} className="p-6 flex justify-between items-center gap-4 bg-zinc-900/20 min-w-0">
      
      <div className="flex items-center gap-4 min-w-0">
        <span className="font-black italic text-xl text-zinc-700 shrink-0">#{index + 1}</span>
        
        {/* 2. Added 'min-w-0' and 'truncate' to ensure the name doesn't push the profit off */}
        <div className="min-w-0">
          <p className="font-black italic uppercase text-zinc-200 truncate">{player.name}</p>
          <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">{player.games} SESSIONS</p>
        </div>
      </div>

      {/* 3. Added 'shrink-0' so the profit amount is never compressed */}
      <span className={`font-black text-lg shrink-0 ${player.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {player.totalProfit >= 0 
          ? `+$${player.totalProfit.toFixed(2)}` 
          : `-$${Math.abs(player.totalProfit).toFixed(2)}`
        }
      </span>
    </div>
  ))}
</div>
      </div>
    </div>
  )
}