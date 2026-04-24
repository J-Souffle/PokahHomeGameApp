'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/client'
import { useParams } from 'next/navigation'

export default function PlayerLiveView() {
  const { id: sessionId } = useParams()
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

      // If the game is done, fetch everyone's names for the leaderboard
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

  if (!myResult) return <div className="min-h-screen bg-zinc-950 text-white p-8 font-mono animate-pulse">Syncing...</div>

  const myProfit = (myResult.final_chips || 0) - ((1 + myResult.rebuys) * session.buy_in)

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* HEADER SECTION */}
      <div className="text-center mb-10">
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
          session?.status === 'active' ? 'bg-green-500/10 border-green-500 text-green-500' : 
          session?.status === 'completed' ? 'bg-blue-500/10 border-blue-500 text-blue-500' :
          'bg-yellow-500/10 border-yellow-500 text-yellow-500'
        }`}>
          {session?.status === 'active' ? '● Game Live' : 
           session?.status === 'completed' ? 'Settlement Final' : 
           'Waiting for Host'}
        </span>
        <h1 className="text-2xl font-black italic uppercase mt-4 tracking-tighter">{myResult.display_name}</h1>
      </div>

      {session?.status === 'completed' ? (
        /* POST-GAME RECAP VIEW */
        <div className="space-y-6">
          <div className="bg-white text-black rounded-[2.5rem] p-8 text-center shadow-2xl">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-1">Your Payout</h2>
            <p className="text-zinc-400 font-mono text-[10px] uppercase mb-6 tracking-widest text-center">Results Confirmed</p>
            
            <div className="flex justify-between items-center border-b border-zinc-100 pb-4 mb-4">
              <span className="font-black uppercase text-[10px] tracking-widest text-zinc-400">Cash Out</span>
              <span className="font-mono text-2xl font-bold">${myResult.final_chips || 0}</span>
            </div>

            <div className="pt-2">
              <p className="text-[10px] font-black uppercase text-zinc-400 mb-1">Net Gain/Loss</p>
              <p className={`text-6xl font-black tracking-tighter ${myProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {myProfit >= 0 ? '+' : ''}${myProfit}
              </p>
            </div>
          </div>

          {/* MINI LEADERBOARD */}
          <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem]">
            <p className="text-[10px] font-black uppercase text-zinc-500 mb-4 tracking-widest">Global Rankings</p>
            <div className="space-y-3">
              {leaderboard.map((entry, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm font-bold uppercase italic"><span className="text-zinc-600 mr-2">#{i+1}</span>{entry.name}</span>
                  <span className={`font-mono text-sm ${entry.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {entry.profit >= 0 ? '+' : ''}${entry.profit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* LIVE GAME VIEW */
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 mb-6 text-center shadow-xl">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Current Pot</p>
            <p className="text-6xl font-black tracking-tighter">${potSize}</p>
          </div>

          <div className={`p-6 rounded-[2rem] border flex items-center justify-between mb-4 transition-all ${
            myResult.has_paid ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
          }`}>
            <div>
              <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Entry Status</p>
              <p className={`font-black uppercase italic text-sm mt-1 ${myResult.has_paid ? 'text-green-500' : 'text-red-500'}`}>
                {myResult.has_paid ? 'Cleared' : 'Pending Payment'}
              </p>
            </div>
            {!myResult.has_paid && (
              <button onClick={handleMarkAsPaid} className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-white/5 active:scale-95 transition-all">
                I have Paid
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}