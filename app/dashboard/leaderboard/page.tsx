import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ChevronLeft, Trophy, Anchor, Flame, Gem, Zap } from 'lucide-react'

interface PlayerStats {
  name: string;
  totalProfit: number;
  games: number;
  bestSingleWin: number;
  biggestComeback: number;
  rebuys: number;
  totalAllIns: number;
}

export default async function LeaderboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  // Fetch results and global settings concurrently
  const [resultsData, settingsData] = await Promise.all([
    supabase.from('player_results').select(`
      user_id, 
      final_chips,
      rebuys,
      all_in,
      poker_sessions (buy_in),
      profiles (*)
    `),
    supabase.from('global_settings').select('*').eq('id', 'poker_config').single()
  ])

  const leaderboard = resultsData.data;
  const settings = settingsData.data;

  // Extract settings values
  const jackpotWinner = settings?.jackpot_winner || '---';
  // Updated source to pull from record_win_amount
  const jackpotAmount = settings?.record_win_amount || 0; 
  const recordWinAmount = settings?.record_win_amount || 0;

  if (resultsData.error) console.error("Leaderboard Error:", resultsData.error)

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
        rebuys: 0,
        totalAllIns: 0
      };
    }

    const buyIn = Number(curr.poker_sessions?.buy_in || 5);
    const rebuys = Number(curr.rebuys || 0);
    const isAllIn = curr.all_in ? 1 : 0; // Track all-in count
    const profit = Number(curr.final_chips || 0) - (buyIn * (1 + rebuys));

    acc[id].totalProfit += profit;
    acc[id].games += 1;
    acc[id].rebuys += rebuys;
    acc[id].totalAllIns += isAllIn;
    
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

      {/* Milestone Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 mb-12">
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 md:p-8 rounded-[2rem]">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 mb-6">
            <Trophy size={24} />
          </div>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">High Roller</p>
          <p className="text-xl md:text-2xl font-black italic uppercase text-white truncate">{highRoller?.name || '---'}</p>
          <p className="text-yellow-500 font-mono text-xs mt-2">+${highRoller?.bestSingleWin.toFixed(2) || '0.00'}</p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-6 md:p-8 rounded-[2rem]">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mb-6">
            <Anchor size={24} />
          </div>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Iron Man</p>
          <p className="text-xl md:text-2xl font-black italic uppercase text-white truncate">{ironMan?.name || '---'}</p>
          <p className="text-blue-500 font-mono text-xs mt-2">{ironMan?.games || 0} Sessions</p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-6 md:p-8 rounded-[2rem]">
          <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500 mb-6">
            <Flame size={24} />
          </div>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Comeback King</p>
          <p className="text-xl md:text-2xl font-black italic uppercase text-white truncate">{comebackKing?.name || '---'}</p>
          <p className="text-green-500 font-mono text-xs mt-2">+${comebackKing?.biggestComeback.toFixed(2) || '0.00'}</p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-6 md:p-8 rounded-[2rem]">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 mb-6">
            <Gem size={24} />
          </div>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Jackpot Winner</p>
          <p className="text-xl md:text-2xl font-black italic uppercase text-white truncate">{jackpotWinner}</p>
          <p className="text-purple-400 font-mono text-xs mt-2">+${Number(jackpotAmount).toFixed(2)}</p>
        </div>
      </div>

      {/* Main Leaderboard */}
      <div className="bg-zinc-900/40 rounded-[2rem] border border-zinc-800 overflow-hidden shadow-2xl">
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
                  <div className="flex gap-4">
                     <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">{player.rebuys} Rebuys</p>
                     {player.totalAllIns > 0 && (
                       <p className="text-[10px] text-yellow-500 font-mono uppercase tracking-widest flex items-center gap-1">
                         <Zap size={10} /> {player.totalAllIns} All-In
                       </p>
                     )}
                  </div>
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
      </div>
    </div>
  )
}