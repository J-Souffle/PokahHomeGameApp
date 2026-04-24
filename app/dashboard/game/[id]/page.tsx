'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/client'
import { useParams } from 'next/navigation'

export default function PlayerLiveView() {
  const { id: sessionId } = useParams()
  const supabase = createClient()
  const [session, setSession] = useState<any>(null)
  const [myResult, setMyResult] = useState<any>(null)
  const [stats, setStats] = useState({ totalPlayers: 0, totalRebuys: 0 })

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: sess } = await supabase.from('poker_sessions').select('*').eq('id', sessionId).single()
    setSession(sess)

    const { data: allResults } = await supabase.from('player_results').select('*').eq('session_id', sessionId)
    if (allResults) {
      const me = allResults.find(r => r.user_id === user.id)
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
      setMyResult(me ? { ...me, display_name: profile?.display_name } : null)
      setStats({
        totalPlayers: allResults.length,
        totalRebuys: allResults.reduce((acc, r) => acc + (r.rebuys || 0), 0)
      })
    }
  }, [sessionId, supabase])

  useEffect(() => {
  fetchData();

  const channel = supabase
    .channel(`player-session-sync-${sessionId}`)
    // Listen for players joining/paying
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'player_results', 
      filter: `session_id=eq.${sessionId}` 
    }, fetchData)
    // Listen for the Host hitting "Start Engine"
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'poker_sessions', 
      filter: `id=eq.${sessionId}` 
    }, (payload) => {
      console.log("Session status updated!", payload.new.status);
      fetchData();
    })
    .subscribe();

  return () => { supabase.removeChannel(channel) };
}, [sessionId, fetchData, supabase]);

  const handleMarkAsPaid = async () => {
    if (myResult) await supabase.from('player_results').update({ has_paid: true }).eq('id', myResult.id)
  }

  const potSize = useMemo(() => {
    if (!session) return 0
    return (stats.totalPlayers + stats.totalRebuys) * session.buy_in
  }, [session, stats])

  if (!myResult) return <div className="min-h-screen bg-zinc-950 text-white p-8 font-mono animate-pulse">Syncing...</div>

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="text-center mb-10">
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${session?.status === 'active' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-yellow-500/10 border-yellow-500 text-yellow-500'}`}>
          {session?.status === 'active' ? '● Game Live' : 'Waiting for Host'}
        </span>
        <h1 className="text-2xl font-black italic uppercase mt-4">{myResult.display_name}</h1>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 mb-6 text-center">
        <p className="text-zinc-500 text-[10px] font-black uppercase">Total Pot</p>
        <p className="text-5xl font-black">${potSize}</p>
      </div>

      <div className={`p-6 rounded-3xl border flex items-center justify-between mb-4 ${myResult.has_paid ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
        <p className="text-[10px] font-black uppercase text-zinc-500">Status</p>
        {myResult.has_paid ? (
          <span className="text-green-500 font-black italic uppercase text-xs">Paid</span>
        ) : (
          <button onClick={handleMarkAsPaid} className="bg-white text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase">I have Paid</button>
        )}
      </div>
    </div>
  )
}