'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Trophy, TrendingUp, Zap, ChevronRight, User as UserIcon } from 'lucide-react'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null) 
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [globalJackpot, setGlobalJackpot] = useState(0) // New State for Jackpot

  const handleTransform = useCallback((rawData: any[]) => {
    const DEFAULT_BUY_IN = 5; 

    const transformed = rawData.map((row) => {
      const session = row.poker_sessions;
      const buyIn = session ? parseFloat(session.buy_in) : DEFAULT_BUY_IN;
      const finalChips = parseFloat(row.final_chips) || 0;
      const rebuys = parseInt(row.rebuys) || 0;
      
      const totalInvested = buyIn * (1 + rebuys);
      const calculatedProfit = finalChips - totalInvested;

      return {
        ...row,
        session_id: row.session_id, 
        totalInvested: totalInvested, 
        calculatedProfit: calculatedProfit,
        is_winner: calculatedProfit > 0
      }
    })
    setResults(transformed)
  }, [])

  const getData = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return (window.location.href = '/login')
      setUser(authUser)

      // Fetch Profile for Display Name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name, full_name, role')
        .eq('id', authUser.id)
        .single()
      
      if (profileData) setProfile(profileData)

      // Fetch Global Jackpot from most recent session
    // 2. INSERT THE JACKPOT FETCH HERE 
    const { data: settings } = await supabase
      .from('global_settings')
      .select('jackpot_amount')
      .eq('id', 'poker_config')
      .single()

    if (settings) setGlobalJackpot(settings.jackpot_amount || 0)

      const { data, error } = await supabase
        .from('player_results')
        .select(`
          id, 
          session_id,
          final_chips, 
          rebuys, 
          created_at, 
          user_id,
          poker_sessions (
            buy_in
          )
        `)
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: true });

      if (data) {
        handleTransform(data);
      }
      if (error) console.error("Supabase fetch error:", error);
    } catch (err) {
      console.error("Dashboard error:", err)
    } finally {
      setLoading(false)
    }
  }, [supabase, handleTransform])

  useEffect(() => {
    setIsMounted(true)
    getData()
  }, [getData])

  const stats = useMemo(() => {
    if (results.length === 0) return { total: 0, totalBuyIns: 0, winRate: "0.0", count: 0, wins: 0, losses: 0, bestWin: 0, worstLoss: 0, biggestWin: 0, comeback: 0, trend: 0 }
    
    const total = results.reduce((acc, row) => acc + row.calculatedProfit, 0)
    const totalBuyIns = results.reduce((acc, row) => acc + row.totalInvested, 0)
    const wins = results.filter(row => row.calculatedProfit > 0)
    
    const allProfits = results.map(r => r.calculatedProfit)
    const bestWin = Math.max(...allProfits, 0)
    const worstLoss = Math.min(...allProfits, 0)

    const biggestWin = Math.max(...results.map(r => r.final_chips || 0))
    const comebackGames = results.filter(r => r.rebuys >= 2 && r.calculatedProfit > 0)
    const bestComeback = comebackGames.length > 0 ? Math.max(...comebackGames.map(r => r.calculatedProfit)) : 0
    
    const lastFive = results.slice(-5)
    const trend = lastFive.reduce((acc, r) => acc + r.calculatedProfit, 0)

    return {
      total,
      totalBuyIns,
      winRate: ((wins.length / results.length) * 100).toFixed(1),
      count: results.length,
      wins: wins.length,
      losses: results.length - wins.length,
      bestWin,
      worstLoss,
      biggestWin,
      comeback: bestComeback,
      trend
    }
  }, [results])

  const chartData = useMemo(() => {
    let runningBalance = 0
    return results.map((row, index) => {
      runningBalance += row.calculatedProfit
      return {
        u_id: index,
        displayDate: new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        bankroll: Number(runningBalance.toFixed(2)),
        sessionNet: Number(row.calculatedProfit.toFixed(2))
      }
    });
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
          <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
            Welcome back, Mousier <span className="text-yellow-500">{profile?.display_name || profile?.full_name || 'Bond'}</span>
          </h1>
          <p className="text-zinc-500 text-[10px] mt-2 font-mono uppercase tracking-widest">{user?.email}</p>
        </div>
        
       <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/leaderboard" className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest hover:bg-zinc-800 transition-all">🏆 LEADERBOARD</Link>
          <Link href="/dashboard/join" className="bg-yellow-500 text-black px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest hover:bg-yellow-400 transition-all">🚀 JOIN LOBBY</Link>
          {profile?.role === 'host' && (
            <>
              <Link href="/dashboard/host" className="bg-blue-600 px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest hover:bg-blue-500 transition-all">
                📡 LIVE CONTROL
              </Link>
              <Link href="/dashboard/log-session" className="bg-zinc-800 border border-zinc-700 px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest hover:bg-zinc-700 transition-all">
                📝 LOG SESSION
              </Link>
            </>
          )}
          <Link href="/dashboard/settings" className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest hover:bg-zinc-800 transition-all">⚙️ SETTINGS</Link>
        </div>
      </div>
      
      {results.length > 0 ? (
        <>
          <div className="mb-8 bg-zinc-900/30 p-8 rounded-[2.5rem] border border-zinc-800/50 shadow-2xl relative w-full overflow-hidden">
            <h3 className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] mb-8">Bankroll Trajectory</h3>
            <div className="w-full" style={{ height: '350px', minHeight: '350px' }}>
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%" key={`chart-${results.length}`}>
                  <LineChart data={chartData} margin={{ left: -20, right: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                    <XAxis 
                      dataKey="u_id" 
                      stroke="#52525b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(idx) => chartData[idx]?.displayDate || ''}
                    />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dx={-10} tickFormatter={(val) => `$${val}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '16px' }}
                      itemStyle={{ fontWeight: '900' }}
                      separator=""
                      labelFormatter={(idx) => chartData[idx]?.displayDate || ''}
                      formatter={(value: number, name: string, props: any) => {
                        const { bankroll, sessionNet } = props.payload;
                        return [
                          <div className="flex flex-col gap-1 text-left" key="tooltip-content">
                            <span className="text-yellow-500 text-lg font-black tracking-tighter">TOTAL: ${bankroll.toFixed(2)}</span>
                            <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest font-bold">
                              SESSION: {sessionNet >= 0 ? '+' : ''}${sessionNet.toFixed(2)}
                            </span>
                          </div>,
                          null 
                        ];
                      }}
                    />
                    <ReferenceLine y={0} stroke="#27272a" strokeWidth={2} />
                    <Line 
                      type="monotone" 
                      dataKey="bankroll" 
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 shadow-sm relative overflow-hidden">
              <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Total Net Profit</p>
              <p className={`text-7xl font-black mt-2 tracking-tighter ${stats.total >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${stats.total.toFixed(2)}
              </p>
              <div className="mt-4 pt-4 border-t border-zinc-800/50 flex justify-between items-center">
                <span className="text-zinc-600 text-xs font-black uppercase tracking-widest">Total Invested</span>
                <span className="text-zinc-400 font-mono text-sm font-bold">${stats.totalBuyIns.toFixed(2)}</span>
              </div>
            </div>

            {/* NEW: Global Jackpot Card */}
            <div className="bg-zinc-900/50 p-8 rounded-3xl border border-yellow-500/30 shadow-sm relative overflow-hidden">
              <p className="text-yellow-500 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <Trophy size={16} /> Current Jackpot
              </p>
              <p className="text-7xl font-black mt-2 tracking-tighter text-white">
                ${globalJackpot.toFixed(2)}
              </p>
              <div className="mt-4 pt-4 border-t border-zinc-800/50">
                 <span className="text-zinc-600 text-xs font-black uppercase tracking-widest">Community Pool</span>
              </div>
            </div>

            <div className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 shadow-sm">
              <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Win Rate</p>
              <p className="text-7xl font-black mt-2 tracking-tighter text-yellow-500">{stats.winRate}%</p>
            </div>
            <div className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 shadow-sm">
              <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Sessions</p>
              <p className="text-7xl font-black mt-2 tracking-tighter">{stats.count}</p>
            </div>
          </div>

          {/* ... rest of the component remains the same ... */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
             <div className="bg-zinc-900/30 p-6 rounded-3xl border border-zinc-800/50 flex items-center gap-6">
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
                  <Trophy size={20} />
                </div>
                <div>
                  <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Best Cash Out</p>
                  <p className="text-xl font-black italic text-white">${stats.biggestWin}</p>
                </div>
             </div>
             <div className="bg-zinc-900/30 p-6 rounded-3xl border border-zinc-800/50 flex items-center gap-6">
                <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500">
                  <Zap size={20} />
                </div>
                <div>
                  <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Best Comeback</p>
                  <p className="text-xl font-black italic text-white">+${stats.comeback.toFixed(2)}</p>
                </div>
             </div>
             <div className="bg-zinc-900/30 p-6 rounded-3xl border border-zinc-800/50 flex items-center gap-6">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Last 5 Trend</p>
                  <p className={`text-xl font-black italic ${stats.trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {stats.trend >= 0 ? '+' : ''}${stats.trend.toFixed(2)}
                  </p>
                </div>
             </div>
          </div>

          <div className="bg-zinc-900/30 p-8 rounded-[2.5rem] border border-zinc-800/50 mb-12 shadow-2xl">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] mb-3">Session Distribution</h3>
                <div className="flex gap-4 items-baseline">
                  <span className="text-green-500 font-black text-3xl italic tracking-tighter">{stats.wins} WINS</span>
                  <span className="text-zinc-800 font-mono text-xl">/</span>
                  <span className="text-red-500 font-black text-3xl italic tracking-tighter">{stats.losses} LOSSES</span>
                </div>
              </div>
            </div>

            <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800/50 shadow-inner">
              <div 
                className="h-full bg-green-500 transition-all duration-1000" 
                style={{ width: `${(stats.wins / stats.count) * 100}%` }}
              />
              <div 
                className="h-full bg-red-500 transition-all duration-1000" 
                style={{ width: `${(stats.losses / stats.count) * 100}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-6 mt-8">
              <div className="bg-zinc-950/40 p-6 rounded-2xl border border-zinc-800/30">
                <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mb-2">Best Win</p>
                <p className="text-green-500 font-black text-2xl tracking-tighter italic">
                  +${stats.bestWin.toFixed(2)}
                </p>
              </div>
              <div className="bg-zinc-950/40 p-6 rounded-2xl border border-zinc-800/30 text-right">
                <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mb-2">Worst Loss</p>
                <p className="text-red-500 font-black text-2xl tracking-tighter italic">
                  -${Math.abs(stats.worstLoss).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/40 rounded-[2.5rem] border border-zinc-800 overflow-hidden shadow-2xl mb-12">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-zinc-600 text-[10px] uppercase tracking-[0.2em] border-b border-zinc-800">
                  <th className="p-8 font-black">Session Details</th>
                  <th className="p-8 font-black text-center">Date</th>
                  <th className="p-8 font-black text-right">Net Result</th>
                </tr>
              </thead>
              <tbody>
                {[...results].reverse().map((row) => (
                  <tr 
                    key={row.id} 
                    onClick={() => router.push(`/dashboard/session/${row.session_id}`)}
                    className="border-b border-zinc-800/50 hover:bg-white/[0.02] cursor-pointer transition-colors group"
                  >
                    <td className="p-8 font-bold text-zinc-200">
                      <div className="flex items-center gap-3">
                        Private Session 
                        <ChevronRight size={14} className="text-zinc-700 group-hover:translate-x-1 transition-transform" />
                      </div>
                      <div className="flex gap-2 mt-1">
                        <span className="text-zinc-600 text-[10px] font-mono uppercase tracking-tighter border border-zinc-800 px-2 rounded">
                          {row.final_chips} chips
                        </span>
                        <span className="text-zinc-600 text-[10px] font-mono uppercase tracking-tighter border border-zinc-800 px-2 rounded">
                          {row.rebuys} rebuys
                        </span>
                      </div>
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