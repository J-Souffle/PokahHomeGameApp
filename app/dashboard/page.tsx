import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch results WITH the specific relationship hint
  const { data: results, error } = await supabase
    .from('player_results')
    .select(`
      net_profit, 
      is_winner, 
      created_at,
      poker_sessions!fk_session (
        game_name
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });   

  // --- DEBUG LOGS (Check your terminal) ---
  console.log("--- DASHBOARD DEBUG ---");
  console.log("DB Error:", error);
  console.log("Raw Results Count:", results?.length || 0);
  console.log("------------------------");

  // --- MATH LOGIC ---
  const sessionsPlayed = results?.length || 0;
  const totalProfit = results?.reduce((acc, row) => acc + Number(row.net_profit), 0) || 0;
  
  const wins = results?.filter(row => row.is_winner).length || 0;
  const winRate = sessionsPlayed > 0 ? ((wins / sessionsPlayed) * 100).toFixed(1) : 0;

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Poker Stats</h1>
          <p className="text-zinc-500 mt-1">Player: {user.email}</p>
        </div>
        
        <div className="flex gap-4">
          <Link 
            href="/dashboard/leaderboard" 
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all"
          >
            🏆 Leaderboard
          </Link>
          <Link 
            href="/dashboard/log-session" 
            className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-green-900/20"
          >
            + Log Session
          </Link>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl text-center">
          <h3 className="text-zinc-500 text-sm font-medium">Total Profit</h3>
          <p className={`text-3xl font-bold mt-2 ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalProfit >= 0 ? `+$${totalProfit.toFixed(2)}` : `-$${Math.abs(totalProfit).toFixed(2)}`}
          </p>
        </div>

        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl text-center">
          <h3 className="text-zinc-500 text-sm font-medium">Win Rate</h3>
          <p className="text-3xl font-bold mt-2 text-blue-400">{winRate}%</p>
        </div>

        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl text-center">
          <h3 className="text-zinc-500 text-sm font-medium">Sessions Played</h3>
          <p className="text-3xl font-bold mt-2 text-zinc-100">{sessionsPlayed}</p>
        </div>
      </div>

      {/* Session History Table */}
      <div className="mt-12 bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold">Recent Sessions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-zinc-500 text-sm border-b border-zinc-800">
                <th className="p-4 font-medium">Game Name</th>
                <th className="p-4 font-medium text-center">Date</th>
                <th className="p-4 font-medium text-right">Profit</th>
              </tr>
            </thead>
           <tbody>
  {results && results.length > 0 ? (
    results.map((row: any, i) => {
      // Try the hinted key first, then fall back to the standard key
      const sessionData = row['poker_sessions!fk_session'] || row['poker_sessions'];
      const gameName = sessionData?.game_name || "Unnamed Session";

      return (
        <tr key={i} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20 transition-colors">
          <td className="p-4 font-semibold">
            {gameName}
          </td>
          <td className="p-4 text-zinc-400 text-sm text-center">
            {row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A'}
          </td>
          <td className={`p-4 text-right font-bold ${Number(row.net_profit) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {Number(row.net_profit) >= 0 ? `+$${row.net_profit}` : `-$${Math.abs(Number(row.net_profit))}`}
          </td>
        </tr>
      );
    })
  ) : (
    <tr>
      <td colSpan={3} className="p-8 text-center text-zinc-500">
        No sessions logged yet.
      </td>
    </tr>
  )}
</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}