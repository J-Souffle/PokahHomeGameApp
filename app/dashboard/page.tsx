'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/client'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export default function DashboardPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
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

  const handleUpdate = async (id: string) => {
    const newProfit = parseFloat(editValue)
    if (isNaN(newProfit)) return setEditingId(null)

    const { error } = await supabase
      .from('player_results')
      .update({ net_profit: newProfit, is_winner: newProfit > 0 })
      .eq('id', id)

    if (!error) {
      setResults(prev => prev.map(r => r.id === id ? { ...r, net_profit: newProfit, is_winner: newProfit > 0 } : r))
    }
    setEditingId(null)
  }

  const chartData = useMemo(() => {
    return results.map((row, index) => ({
      uniqueId: row.id || index, 
      displayDate: new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      profit: parseFloat(row.net_profit.toString()) 
    }))
  }, [results])

  const stats = useMemo(() => {
    const total = results.reduce((acc, row) => acc + Number(row.net_profit), 0)
    const wins = results.filter(row => row.is_winner).length
    return {
      total: total.toFixed(2),
      winRate: results.length > 0 ? ((wins / results.length) * 100).toFixed(1) : "0",
      count: results.length
    }
  }, [results])

  const displayResults = [...results].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  if (loading) return <div className="p-8 text-white font-mono animate-pulse">Syncing Lab Data...</div>

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Pokah @ Josh's Crib</h1>
          <p className="text-zinc-500 text-xs mt-1 font-mono">Welcome, {user?.email}!</p>
        </div>
        <Link href="/dashboard/log-session" className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-black italic transition-all hover:bg-yellow-400 text-sm shadow-lg shadow-yellow-500/10">+ LOG SESSION</Link>
      </div>
      
      <div className="mb-8 bg-zinc-900/20 p-8 rounded-[2rem] border border-zinc-800/50 shadow-2xl">
        <h3 className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] mb-8">Growth Chart</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: -20, right: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
              
              <XAxis 
                dataKey="uniqueId" 
                stroke="#52525b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={15}
                tickFormatter={(val) => {
                  const item = chartData.find(d => d.uniqueId === val);
                  return item ? item.displayDate : "";
                }}
              />

              <YAxis 
                stroke="#52525b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dx={-10}
                tickFormatter={(val) => `$${val}`}
              />
              
              <Tooltip 
                cursor={{ stroke: '#27272a', strokeWidth: 1 }}
                contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '16px', padding: '12px' }}
                itemStyle={{ color: '#eab308', fontSize: '16px', fontWeight: '900' }}
                labelFormatter={(_, payload) => {
                  return payload[0]?.payload?.displayDate || ''
                }}
                formatter={(value: number) => [`$${value}`, 'Net Profit']}
              />

              <ReferenceLine y={0} stroke="#27272a" />
              
              <Line 
                type="monotone" 
                dataKey="profit" 
                stroke="#eab308" 
                strokeWidth={5} 
                dot={{ r: 5, fill: '#09090b', stroke: '#eab308', strokeWidth: 2 }} 
                activeDot={{ r: 8, fill: '#fff', stroke: '#eab308', strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Total P/L</p>
          <p className={`text-4xl font-black mt-2 tracking-tighter ${Number(stats.total) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            ${stats.total}
          </p>
        </div>
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Win Rate</p>
          <p className="text-4xl font-black mt-2 tracking-tighter text-yellow-500">{stats.winRate}%</p>
        </div>
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Sessions</p>
          <p className="text-4xl font-black mt-2 tracking-tighter">{stats.count}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900/40 rounded-[2rem] border border-zinc-800 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="text-zinc-600 text-[10px] uppercase tracking-[0.2em] border-b border-zinc-800">
              <th className="p-8 font-black">Game</th>
              <th className="p-8 font-black text-center">Date</th>
              <th className="p-8 font-black text-right">Net Profit</th>
              <th className="p-8 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {displayResults.map((row) => {
              const sessionData = row['poker_sessions!fk_session'] || row['poker_sessions']
              const isWin = Number(row.net_profit) >= 0

              return (
                <tr key={row.id} className="border-b border-zinc-800/50 hover:bg-white/[0.02] transition-colors group">
                  <td className="p-8 font-bold text-zinc-200">{sessionData?.game_name || "Private Session"}</td>
                  <td className="p-8 text-zinc-500 text-center font-mono text-sm">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className="p-8 text-right">
                    {editingId === row.id ? (
                      <input 
                        autoFocus
                        className="bg-black border border-yellow-500/50 text-right p-2 rounded-lg w-28 outline-none font-black text-yellow-500"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleUpdate(row.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(row.id)}
                      />
                    ) : (
                      <span 
                        onClick={() => { setEditingId(row.id); setEditValue(row.net_profit.toString()) }}
                        className={`font-black text-lg cursor-pointer hover:underline decoration-zinc-700 underline-offset-8 transition-all ${isWin ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {isWin ? `+$${row.net_profit}` : `-$${Math.abs(row.net_profit)}`}
                      </span>
                    )}
                  </td>
                  <td className="p-8 text-right">
                    <button onClick={async () => {
                      if(confirm("Delete session?")) {
                        await supabase.from('player_results').delete().eq('id', row.id)
                        setResults(prev => prev.filter(r => r.id !== row.id))
                      }
                    }} className="opacity-0 group-hover:opacity-100 text-zinc-800 hover:text-red-500 transition-all text-xl">✕</button>
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