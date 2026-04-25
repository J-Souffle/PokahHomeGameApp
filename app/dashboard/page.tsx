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
  const [isMounted, setIsMounted] = useState(false)

  const handleTransform = (rawData: any[]) => {
    const DEFAULT_BUY_IN = 5; 

    const transformed = rawData.map((row) => {
      const session = row.poker_sessions || row['poker_sessions!fk_session'];
      const buyIn = session ? parseFloat(session.buy_in) : DEFAULT_BUY_IN;
      const finalChips = parseFloat(row.final_chips) || 0;
      const rebuys = parseInt(row.rebuys) || 0;
      
      const totalInvested = buyIn * (1 + rebuys);
      const calculatedProfit = finalChips - totalInvested;

      return {
        ...row,
        poker_sessions: session, 
        calculatedProfit: calculatedProfit,
        is_winner: calculatedProfit > 0
      }
    })
    setResults(transformed)
  }

  async function getData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return (window.location.href = '/login')
      setUser(user)

      const { data, error } = await supabase
        .from('player_results')
        .select(`id, final_chips, rebuys, created_at, user_id`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (data) handleTransform(data);
    } catch (err) {
      console.error("Dashboard error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setIsMounted(true)
    getData()
  }, [])

  const stats = useMemo(() => {
    if (results.length === 0) return { total: 0, winRate: "0.0", count: 0 }
    const total = results.reduce((acc, row) => acc + row.calculatedProfit, 0)
    const wins = results.filter(row => row.calculatedProfit > 0).length
    return {
      total,
      winRate: ((wins / results.length) * 100).toFixed(1),
      count: results.length
    }
  }, [results])

  const chartData = useMemo(() => {
    let runningBalance = 0
    return results.map((row) => {
      runningBalance += row.calculatedProfit
      return {
        displayDate: new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        cumulativeProfit: parseFloat(runningBalance.toFixed(2)) 
      }
    })
  }, [results])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950">
      <div className="p-8 text-white font-mono animate-pulse uppercase tracking-[0.3em] text-sm">Accessing The Lab...</div>
    </div>
  )

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">The Lab</h1>
          <p className="text-zinc-500 text-[10px] mt-2 font-mono uppercase tracking-widest">{user?.email}</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/leaderboard" className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl font-black italic transition-all text-sm active:scale-95">
            🏆 LEADERBOARD
          </Link>
          <Link href="/dashboard/log-session" className="bg-yellow-500 text-black px-4 py-2.5 rounded-xl font-black italic transition-all hover:bg-yellow-400 text-sm active:scale-95">
            + LOG SESSION
          </Link>
        </div>
      </div>
      
      {results.length > 0 ? (
        <>
          {/* THE FIX: Forced aspect ratio and explicit height fallback */}
          <div className="mb-8 bg-zinc-900/30 p-8 rounded-[2.5rem] border border-zinc-800/50 shadow-2xl relative w-full overflow-hidden">
            <h3 className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] mb-8">Bankroll Trajectory</h3>
            
            <div className="w-full" style={{ height: '350px', minHeight: '350px' }}>
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%" key={`chart-${results.length}`}>
                  <LineChart data={chartData} margin={{ left: -20, right: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dx={-10} tickFormatter={(val) => `$${val}`} />
                    <Tooltip 
                      cursor={{ stroke: '#27272a', strokeWidth: 1 }}
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '16px' }}
                      itemStyle={{ color: '#eab308', fontWeight: '900' }}
                    />
                    <ReferenceLine y={0} stroke="#27272a" strokeWidth={2} />
                    <Line 
                      type="monotone" 
                      dataKey="cumulativeProfit" 
                      stroke="#eab308" 
                      strokeWidth={5} 
                      dot={{ r: 6, fill: '#09090b', stroke: '#eab308', strokeWidth: 2 }} 
                      activeDot={{ r: 8, fill: '#fff', stroke: '#eab308', strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 shadow-sm">
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Total Net Profit</p>
              <p className={`text-5xl font-black mt-2 tracking-tighter ${stats.total >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${stats.total.toFixed(2)}
              </p>
            </div>
            <div className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 shadow-sm">
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Win Rate</p>
              <p className="text-5xl font-black mt-2 tracking-tighter text-yellow-500">{stats.winRate}%</p>
            </div>
            <div className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 shadow-sm">
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Sessions</p>
              <p className="text-5xl font-black mt-2 tracking-tighter">{stats.count}</p>
            </div>
          </div>

          <div className="bg-zinc-900/40 rounded-[2.5rem] border border-zinc-800 overflow-hidden shadow-2xl mb-12">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-zinc-600 text-[10px] uppercase tracking-[0.2em] border-b border-zinc-800">
                  <th className="p-8 font-black">Session Type</th>
                  <th className="p-8 font-black text-center">Date</th>
                  <th className="p-8 font-black text-right">Net Result</th>
                </tr>
              </thead>
              <tbody>
                {[...results].reverse().map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/50 hover:bg-white/[0.02] transition-colors">
                    <td className="p-8 font-bold text-zinc-200">
                      Private Session <span className="text-zinc-600 text-xs font-mono ml-2">({row.final_chips} chips)</span>
                    </td>
                    <td className="p-8 text-zinc-500 text-center font-mono text-sm">{new Date(row.created_at).toLocaleDateString()}</td>
                    <td className="p-8 text-right">
                      <span className={`font-black text-2xl transition-all ${row.calculatedProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {row.calculatedProfit >= 0 ? `+$${row.calculatedProfit.toFixed(2)}` : `-$${Math.abs(row.calculatedProfit).toFixed(2)}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-zinc-900 rounded-[3rem] bg-zinc-900/10">
          <p className="text-zinc-600 font-black italic uppercase tracking-widest text-lg">No session data found</p>
          <button onClick={getData} className="mt-4 text-yellow-500 font-bold text-sm underline">RETRY FETCH</button>
        </div>
      )}
    </div>
  )
}