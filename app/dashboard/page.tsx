'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/client'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function DashboardPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // State for inline editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')

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
      .order('created_at', { ascending: true }) 

    setResults(data || [])
    setLoading(false)
  }

  useEffect(() => {
    getData()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this session record?")) return
    const { error } = await supabase.from('player_results').delete().eq('id', id)
    if (!error) setResults(results.filter(r => r.id !== id))
  }

  const handleUpdate = async (id: string) => {
    const newProfit = parseFloat(editValue)
    if (isNaN(newProfit)) return setEditingId(null)

    const { error } = await supabase
      .from('player_results')
      .update({ 
        net_profit: newProfit,
        is_winner: newProfit > 0 
      })
      .eq('id', id)

    if (!error) {
      setResults(results.map(r => r.id === id ? { ...r, net_profit: newProfit, is_winner: newProfit > 0 } : r))
    }
    setEditingId(null)
  }

  // --- UPDATED GRAPH & MATH LOGIC ---
  const sessionsPlayed = results.length
  const totalProfit = results.reduce((acc, row) => acc + Number(row.net_profit), 0)
  const wins = results.filter(row => row.is_winner).length
  const winRate = sessionsPlayed > 0 ? ((wins / sessionsPlayed) * 100).toFixed(1) : 0

  // Running balance calculation for the Y-axis
  let runningBalance = 0
  const chartData = results.map(row => {
    runningBalance += parseFloat(row.net_profit.toString())
    return {
      date: new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      cumulativeProfit: parseFloat(runningBalance.toFixed(2)) 
    }
  })

  // Table displays newest sessions first
  const displayResults = [...results].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  if (loading) return <div className="p-8 text-white">Loading Stats...</div>

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Player Dashboard</h1>
          <p className="text-zinc-500 mt-1">{user?.email}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/settings" className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl font-bold transition-all text-sm">⚙️ Settings</Link>
          <Link href="/dashboard/leaderboard" className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl font-bold transition-all text-sm">🏆 Leaderboard</Link>
          <Link href="/dashboard/log-session" className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-black italic transition-all hover:bg-yellow-400 text-sm">+ LOG SESSION</Link>
        </div>
      </div>
      
      {/* Chart Section */}
      <div className="mb-8 bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 shadow-2xl">
        <h3 className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-4">Bankroll Trend</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis 
                stroke="#52525b" 
                fontSize={12} 
                domain={['auto', 'auto']}
                tickFormatter={(v) => `$${v}`} 
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                itemStyle={{ color: '#eab308' }}
                formatter={(value: number) => [`$${value}`, 'Total Bankroll']}
              />
              <Line 
                type="monotone" 
                dataKey="cumulativeProfit" 
                stroke="#eab308" 
                strokeWidth={4} 
                dot={{ r: 4, fill: '#eab308' }} 
                activeDot={{ r: 8 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Total Profit</p>
          <p className={`text-4xl font-black mt-1 ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            ${totalProfit.toFixed(2)}
          </p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Win Rate</p>
          <p className="text-4xl font-black mt-1 text-yellow-500">{winRate}%</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Sessions</p>
          <p className="text-4xl font-black mt-1">{sessionsPlayed}</p>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-800/30">
            <tr className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] border-b border-zinc-800">
              <th className="p-6 font-black">Game</th>
              <th className="p-6 font-black text-center">Date</th>
              <th className="p-6 font-black text-right">Net Profit</th>
              <th className="p-6 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {displayResults.map((row) => {
              const sessionData = row['poker_sessions!fk_session'] || row['poker_sessions']
              const isEditing = editingId === row.id

              return (
                <tr key={row.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors group">
                  <td className="p-6 font-bold text-zinc-200">{sessionData?.game_name || "Private Session"}</td>
                  <td className="p-6 text-zinc-500 text-center text-sm">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className="p-6 text-right">
                    {isEditing ? (
                      <input 
                        autoFocus
                        className="bg-black border border-yellow-500 text-right p-1 rounded w-24 outline-none font-mono"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleUpdate(row.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(row.id)}
                      />
                    ) : (
                      <span 
                        onClick={() => { setEditingId(row.id); setEditValue(row.net_profit.toString()) }}
                        className={`font-black cursor-pointer hover:underline decoration-dotted ${Number(row.net_profit) >= 0 ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {Number(row.net_profit) >= 0 ? `+$${row.net_profit}` : `-$${Math.abs(row.net_profit)}`}
                      </span>
                    )}
                  </td>
                  <td className="p-6 text-right">
                    <button onClick={() => handleDelete(row.id)} className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-500 transition-all">✕</button>
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