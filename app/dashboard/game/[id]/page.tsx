'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Trophy, DollarSign, Users } from 'lucide-react'

export default function PlayerLiveView() {
  const { id: sessionId } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [session, setSession] = useState<any>(null)
  const [myResult, setMyResult] = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [stats, setStats] = useState({ totalPlayers: 0, totalRebuys: 0 })

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: sess } = await supabase.from('poker_sessions').select('*').eq('id', sessionId).single()
    setSession(sess)

    const { data: allResults } = await supabase.from('player_results').select('*').eq('session_id', sessionId)
    
    if (allResults) {
      const me = allResults.find(r => r.user_id === user.id)
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      
      setMyResult(me ? { ...me, display_name: profile?.full_name } : null)
      setStats({
        totalPlayers: allResults.length,
        totalRebuys: allResults.reduce((acc, r) => acc + (r.rebuys || 0), 0)
      })

      if (sess?.status === 'completed') {
        const userIds = allResults.map(r => r.user_id)
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
        
        const ranked = allResults.map(r => {
          const buyInTotal = (1 + (r.rebuys || 0)) * (sess?.buy_in || 0)
          return {
            name: profiles?.find(p => p.id === r.user_id)?.full_name || 'Anonymous',
            profit: (r.final_chips || 0) - buyInTotal
          }
        }).sort((a, b) => b.profit - a.profit)
        
        setLeaderboard(ranked)
      }
    }
  }, [sessionId, supabase])

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel(`player-sync-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_results', filter: `session_id=eq.${sessionId}` }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'poker_sessions', filter: `id=eq.${sessionId}` }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, fetchData, supabase])

  const handleMarkAsPaid = async () => {
    if (myResult) await supabase.from('player_results').update({ has_paid: true }).eq('id', myResult.id)
  }

  const potSize = useMemo(() => {
    if (!session) return 0
    return (stats.totalPlayers + stats.totalRebuys) * session.buy_in
  }, [session, stats])

  if (!myResult) return <div className="min-h-screen bg-zinc-950 text-white p-8 font-mono animate-pulse flex items-center justify-center italic">Syncing with table...</div>

  const myProfit = (myResult.final_chips || 0) - ((1 + myResult.rebuys) * session.buy_in)

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 pb-32">
      {/* HEADER SECTION */}
      <div className="flex flex-col items-center mb-10 mt-4">
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border tracking-widest ${
          session?.status === 'active' ? 'bg-green-500/10 border-green-500 text-green-500 animate-pulse' : 
          session?.status === 'completed' ? 'bg-blue-500/10 border-blue-500 text-blue-500' :
          'bg-yellow-500/10 border-yellow-500 text-yellow-500'
        }`}>
          {session?.status === 'active' ? '● Game Live' : 
           session?.status === 'completed' ? 'Settlement Final' : 
           'Waiting for Host'}
        </span>
        <h1 className="text-3xl font-black italic uppercase mt-4 tracking-tighter text-center">{myResult.display_name}</h1>
      </div>

      {session?.status === 'completed' ? (
        /* --- BEAUTIFIED POST-GAME RECAP --- */
        <div className="space-y-6 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white text-black rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(255,255,255,0.05)] relative overflow-hidden">
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 translate-x-10 -translate-y-10 rounded-full ${myProfit >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
            
            <div className="relative z-10">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 mb-8 flex items-center gap-2">
                <DollarSign size={14} /> Final Payout
              </h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Total Cashed Out</span>
                  <span className="text-3xl font-black font-mono tracking-tighter">${myResult.final_chips || 0}</span>
                </div>
                
                <div className="h-px bg-zinc-100 w-full" />

                <div className="py-4">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Your Net Performance</span>
                  <div className="flex items-baseline gap-1">
                    <p className={`text-7xl font-black tracking-tighter ${myProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {myProfit >= 0 ? '+' : ''}${myProfit}
                    </p>
                    <span className={`text-xs font-bold uppercase ${myProfit >= 0 ? 'text-green-600/50' : 'text-red-600/50'}`}>
                      USD
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DYNAMIC LEADERBOARD CARD */}
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem]">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500 mb-6 flex items-center gap-2">
              <Trophy size={14} className="text-yellow-500" /> Room Results
            </h3>
            <div className="space-y-4">
              {leaderboard.map((entry, i) => (
                <div key={i} className={`flex justify-between items-center p-3 rounded-2xl transition-colors ${entry.name === myResult.display_name ? 'bg-zinc-800' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-zinc-600 w-4">0{i+1}</span>
                    <span className={`text-sm font-bold uppercase italic ${entry.name === myResult.display_name ? 'text-white' : 'text-zinc-400'}`}>
                      {entry.name}
                    </span>
                  </div>
                  <span className={`font-mono text-sm font-bold ${entry.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {entry.profit >= 0 ? '+' : ''}${entry.profit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* PERSISTENT BACK BUTTON */}
          <button 
            onClick={() => router.push('/dashboard')}
            className="w-full group py-6 bg-zinc-900 hover:bg-white text-zinc-400 hover:text-black border border-zinc-800 hover:border-white rounded-[2rem] font-black uppercase italic tracking-widest transition-all duration-300 flex items-center justify-center gap-3"
          >
            <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-1" />
            Return to the Lab
          </button>
        </div>
      ) : (
        /* LIVE GAME VIEW */
        <div className="max-w-md mx-auto space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 text-center shadow-xl">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
              <Users size={12} /> Live Pot Value
            </p>
            <p className="text-7xl font-black tracking-tighter">${potSize}</p>
          </div>

          <div className={`p-6 rounded-[2.5rem] border transition-all duration-500 ${
            myResult.has_paid ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20 animate-pulse'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Buy-In Status</p>
                <p className={`font-black uppercase italic text-sm mt-1 ${myResult.has_paid ? 'text-green-500' : 'text-red-500'}`}>
                  {myResult.has_paid ? 'Transaction Verified' : 'Awaiting Payment'}
                </p>
              </div>
              {!myResult.has_paid && (
                <button 
                  onClick={handleMarkAsPaid} 
                  className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-white/5 hover:scale-105 active:scale-95 transition-all"
                >
                  Confirm Paid
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}