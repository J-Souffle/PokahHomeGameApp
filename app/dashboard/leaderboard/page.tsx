import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function LeaderboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  // This query groups by user_id to find the big winners
  const { data: leaderboard } = await supabase
    .from('player_results')
    .select('user_id, player_name, net_profit')

  // Aggregate data in JS (or you could create a View in Supabase)
  const totals = leaderboard?.reduce((acc: any, curr) => {
    const id = curr.user_id;
    if (!acc[id]) {
      acc[id] = { name: curr.player_name || 'Anonymous Shark', total: 0, games: 0 };
    }
    acc[id].total += Number(curr.net_profit);
    acc[id].games += 1;
    return acc;
  }, {});

  const sortedLeaderboard = Object.values(totals || {}).sort((a: any, b: any) => b.total - a.total);

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-8">The Shark Tank 🦈</h1>
      <div className="max-w-2xl bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
        {sortedLeaderboard.map((player: any, i) => (
          <div key={i} className="flex justify-between items-center p-6 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 transition-colors">
            <div className="flex items-center gap-4">
              <span className={`text-xl font-black ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-zinc-400' : 'text-orange-700'}`}>
                #{i + 1}
              </span>
              <div>
                <p className="font-bold">{player.name}</p>
                <p className="text-xs text-zinc-500">{player.games} sessions played</p>
              </div>
            </div>
            <p className={`text-xl font-mono font-bold ${player.total >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ${player.total.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}