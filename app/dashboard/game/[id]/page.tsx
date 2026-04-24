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
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Get Session Rules
    const { data: sess } = await supabase.from('poker_sessions').select('*').eq('id', sessionId).single()
    setSession(sess)

    // 2. Get Results (Separate fetch to avoid profiles_1 join error)
    const { data: allResults } = await supabase.from('player_results').select('*').eq('session_id', sessionId)
    
    if (allResults) {
      const me = allResults.find(r => r.user_id === user.id)
      setMyResult(me)
      setStats({
        totalPlayers: allResults.length,
        totalRebuys: allResults.reduce((acc, r) => acc + (r.rebuys || 0), 0)
      })

      // 3. Fetch Display Name separately
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
      if (profile && me) {
        setMyResult({ ...me, display_name: profile.display_name })
      }
    }
    setLoading(false)
  }, [sessionId, supabase])

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel(`player-sync-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_results', filter: `session_id=eq.${sessionId}` }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, fetchData, supabase])

  // THE NEW BUTTON LOGIC
  const handleMarkAsPaid = async () => {
    if (!myResult) return
    const { error } = await supabase
      .from('player_results')
      .update({ has_paid: true })
      .eq('id', myResult.id)
    
    if (error) console.error("Payment sync failed:", error.message)
  }

  const potSize = useMemo(() => {
    if (!session) return 0
    return (stats.totalPlayers + stats.totalRebuys) * session.buy_in
  }, [session, stats])

  if (loading || !myResult) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-white font-mono animate-pulse uppercase text-xs tracking-widest">Entering Lab...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 font-sans">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">
          {myResult.display_name || 'Anonymous'}
        </h1>
        <p className="text-zinc-500 text-[10px] font-mono uppercase mt-1">Room: {session?.join_code}</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 mb-6 shadow-2xl">
        <p className="text-zinc-500 text-[10px] font-black uppercase text-center mb-1">Total Pot</p>
        <p className="text-5xl font-black text-white text-center tracking-tighter">${potSize}</p>
      </div>

      <div className="space-y-4">
        {/* PAYMENT STATUS CARD WITH BUTTON */}
        <div className={`p-6 rounded-3xl border flex items-center justify-between transition-all ${
          myResult.has_paid ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
        }`}>
          <div>
            <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Your Tab</p>
            <p className={`text-sm font-black italic uppercase ${myResult.has_paid ? 'text-green-500' : 'text-red-500'}`}>
              {myResult.has_paid ? 'Paid' : 'Unpaid'}
            </p>
          </div>

          {!myResult.has_paid && (
            <button 
              onClick={handleMarkAsPaid}
              className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase italic hover:bg-zinc-200 active:scale-95 shadow-lg"
            >
              Mark as Paid
            </button>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex justify-between items-center">
          <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Investment</p>
          <p className="text-xl font-black text-yellow-500 italic">
            ${(1 + (myResult.rebuys || 0)) * (session?.buy_in || 0)}
          </p>
        </div>
      </div>
    </div>
  )
}