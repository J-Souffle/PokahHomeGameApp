'use client' // We move to Client for Recharts and Delete interaction
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/client'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function DashboardPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return (window.location.href = '/login')
      setUser(user)

      const { data } = await supabase
        .from('player_results')
        .select(`
          id,
          net_profit, 
          is_winner, 
          created_at,
          poker_sessions!fk_session (game_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }) // Ascending for the graph logic

      setResults(data || [])
      setLoading(false)
    }
    getData()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this session record?")) return
    const { error } = await supabase.from('player_results').delete().eq('id', id)
    if (!error) setResults(results.filter(r => r.id !== id))
  }

  // --- MATH & GRAPH LOGIC ---
  const displayResults = [...results].reverse() // Reverse for the table to show newest first
  const sessionsPlayed = results.length
  const totalProfit = results.reduce((acc, row) => acc + Number(row.net_profit), 0)
  const wins = results.filter(row => row.is_winner).length
  const winRate = sessionsPlayed > 0 ? ((wins / sessionsPlayed) * 100).toFixed(1) : 0

  // Graph Data: Cumulative Profit over time
  let cumulative = 0
  const chartData = results.map(row => {
    cumulative += Number(row.net_profit)
    return {
      date: new Date(row.created_at).toLocaleDateString(),
      profit: cumulative
    }
  })

  if (loading) return <div className="p-8 text-white">Loading Stats...</div>

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Player Dashboard</h1>
          <p className="text-zinc-500 mt-1">{user?.email}</p>
        </div>
        
        <div className="flex gap-3">
          <Link href="/dashboard/settings" className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl font-bold transition-all">
            ⚙️ Settings
          </Link>
          <Link href="/dashboard/leaderboard" className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl font-bold transition-all">
            🏆 Leaderboard
          </Link>
          <Link href="/dashboard/log-session" className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-black italic transition-all hover:bg-yellow-400">
            + LOG SESSION
          </Link>
        </div>
      </div>
      
      {/* Recharts Profit Graph */}
      <div className="mb-8 bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 shadow-2xl">
        <h3 className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-4">Bankroll Progression</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis stroke="#52525b" fontSize={12} tickFormatter={(v) => `$${v}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                itemStyle={{ color: '#eab308', fontWeight: 'bold' }}
              />
              <Line type="monotone" dataKey="profit" stroke="#eab308" strokeWidth={4} dot={{ r: 4, fill: '#eab308' }} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 text-center">
          <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Total Profit</h3>
          <p className={`text-4xl font-black mt-2 ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalProfit >= 0 ? `+$${totalProfit.toFixed(2)}` : `-$${Math.abs(totalProfit).toFixed(2)}`}
          </p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 text-center">
          <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Win Rate</h3>
          <p className="text-4xl font-black mt-2 text-yellow-500">{winRate}%</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 text-center">
          <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Sessions</h3>
          <p className="text-4xl font-black mt-2">{sessionsPlayed}</p>
        </div>
      </div>

      <div className="mt-12 bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="text-zinc-500 text-xs uppercase tracking-widest border-b border-zinc-800">
              <th className="p-6 font-bold">Game</th>
              <th className="p-6 font-bold text-center">Date</th>
              <th className="p-6 font-bold text-right">Net</th>
              <th className="p-6 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {displayResults.map((row: any, i) => {
              const sessionData = row['poker_sessions!fk_session'] || row['poker_sessions']
              return (
                <tr key={row.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="p-6 font-bold text-zinc-200">{sessionData?.game_name || "Private Session"}</td>
                  <td className="p-6 text-zinc-500 text-center">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className={`p-6 text-right font-black ${Number(row.net_profit) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Number(row.net_profit) >= 0 ? `+$${row.net_profit}` : `-$${Math.abs(row.net_profit)}`}
                  </td>
                  <td className="p-6">
                    <button onClick={() => handleDelete(row.id)} className="text-zinc-700 hover:text-red-500 transition-colors">✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}