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

  // Fetch results
  const { data: results } = await supabase
    .from('player_results')
    .select('net_profit, is_winner')
    .eq('user_id', user.id);

  // --- MATH LOGIC ---
  const sessionsPlayed = results?.length || 0;
  const totalProfit = results?.reduce((acc, row) => acc + Number(row.net_profit), 0) || 0;
  
  const wins = results?.filter(row => row.is_winner).length || 0;
  const winRate = sessionsPlayed > 0 ? ((wins / sessionsPlayed) * 100).toFixed(1) : 0;

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
        <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Poker Stats</h1>
        <p className="text-zinc-500 mt-1">Player: {user.email}</p>
      </div>
      
      {/* The New Button */}
      <Link 
        href="/dashboard/log-session" 
        className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-green-900/20"
      >
        + Log Session
      </Link>
    </div>
      {/* <h1 className="text-3xl font-bold tracking-tight">Poker Stats</h1>
      <p className="text-zinc-500 mt-1">Player: {user.email}</p> */}
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Profit Card */}
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
          <h3 className="text-zinc-500 text-sm font-medium">Total Profit</h3>
          <p className={`text-3xl font-bold mt-2 ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalProfit >= 0 ? `+$${totalProfit.toFixed(2)}` : `-$${Math.abs(totalProfit).toFixed(2)}`}
          </p>
        </div>

        {/* Win Rate Card */}
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
          <h3 className="text-zinc-500 text-sm font-medium">Win Rate</h3>
          <p className="text-3xl font-bold mt-2 text-blue-400">{winRate}%</p>
        </div>

        {/* Sessions Card */}
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
          <h3 className="text-zinc-500 text-sm font-medium">Sessions Played</h3>
          <p className="text-3xl font-bold mt-2 text-zinc-100">{sessionsPlayed}</p>
        </div>
      </div>
    </div>
  )
}