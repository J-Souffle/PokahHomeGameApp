import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function LeaderboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  // We'll fetch the whole profile object to see what columns are available
  const { data: leaderboard, error } = await supabase
    .from('player_results')
    .select(`
      user_id, 
      net_profit,
      profiles (*)
    `)

  if (error) {
    console.error("Leaderboard Error:", error)
  }

  const totals = leaderboard?.reduce((acc: any, curr: any) => {
    const id = curr.user_id;
    if (!acc[id]) {
      // Try display_name, then full_name, then fallback to ID
      const p = curr.profiles;
      const playerName = p?.display_name || p?.full_name || p?.username || `Player ${id.substring(0,4)}`;
      
      acc[id] = { 
        name: playerName, 
        total: 0, 
        games: 0 
      };
    }
    acc[id].total += Number(curr.net_profit);
    acc[id].games += 1;
    return acc;
  }, {});

  const sortedLeaderboard = Object.values(totals || {})
    .sort((a: any, b: any) => b.total - a.total);

  return (
    <div className="p-8 bg-black min-h-screen text-white font-sans selection:bg-yellow-500/30">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes subtle-glow {
          0%, 100% { border-color: rgba(234, 179, 8, 0.2); box-shadow: 0 0 20px rgba(234, 179, 8, 0.05); }
          50% { border-color: rgba(234, 179, 8, 0.6); box-shadow: 0 0 40px rgba(234, 179, 8, 0.2); }
        }
        .top-dawg-glow {
          animation: subtle-glow 3s infinite ease-in-out;
        }
      `}} />

      <div className="max-w-2xl mx-auto">
        <header className="mb-12">
          <h1 className="text-7xl font-black italic tracking-tighter uppercase leading-none">
            TOP <span className="text-yellow-500">DAWGS</span>
          </h1>
          <div className="h-1.5 w-24 bg-yellow-500 mt-4" />
          <p className="text-zinc-600 mt-4 text-[10px] font-bold tracking-[0.5em] uppercase">The Underground Leaderboard</p>
        </header>

        <div className="space-y-4">
          {sortedLeaderboard.map((player: any, i) => {
            const isFirst = i === 0;
            return (
              <div 
                key={i} 
                className={`flex justify-between items-center p-8 rounded-2xl border transition-all duration-500 ${
                  isFirst 
                    ? 'top-dawg-glow bg-zinc-900/90 border-yellow-500/50 scale-[1.04] shadow-2xl' 
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
                      {isFirst && (
                        <span className="text-[9px] bg-yellow-500 text-black px-2 py-0.5 font-black uppercase rounded-sm">
                          Top Dawg
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black mt-1">
                      {player.games} Sessions Won/Lost
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-mono font-black tracking-tighter ${player.total >= 0 ? 'text-green-500' : 'text-red-600'}`}>
                    {player.total >= 0 ? `+$${player.total.toFixed(2)}` : `-$${Math.abs(player.total).toFixed(2)}`}
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