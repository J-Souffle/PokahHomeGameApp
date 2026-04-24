'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/client'
import { useParams } from 'next/navigation'

export default function PlayerLiveView() {
  const { id: sessionId } = useParams()
  const supabase = createClient()
  const [session, setSession] = useState<any>(null)
  const [myResult, setMyResult] = useState<any>(null)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [totalRebuys, setTotalRebuys] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get Session Info
      const { data: sess } = await supabase
        .from('poker_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()
      setSession(sess)

      // Get All Results to calculate pot
      const { data: allResults } = await supabase
        .from('player_results')
        .select('*')
        .eq('session_id', sessionId)
      
      const me = allResults?.find(r => r.user_id === user.id)
      setMyResult(me)
      setTotalPlayers(allResults?.length || 0)
      setTotalRebuys(allResults?.reduce((acc, r) => acc + r.rebuys, 0) || 0)
    }

    fetchData()

    // Listen for Host updates (Rebuys, Paid Status, Pot changes)
    const channel = supabase
      .channel(`live-game-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_results', filter: `session_id=eq.${sessionId}` }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'poker_sessions', filter: `id=eq.${sessionId}` }, fetchData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  const potSize = useMemo(() => {
    if (!session) return 0
    return (totalPlayers + totalRebuys) * session.buy_in
  }, [session, totalPlayers, totalRebuys])

  if (!session || !myResult) return <div className="p-8 text-white font-mono animate-pulse">Connecting to The Lab...</div>

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 font-sans">
      {/* Header / Game Status */}
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4">
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${
            session.status === 'active' ? 'bg-green-500/10 border-green-500/50 text-green-500' : 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500'
          }`}>
            {session.status === 'active' ? '● Game in Progress' : 'Waiting for Host'}
          </span>
        </div>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">Live Session</h1>
        <p className="text-zinc-500 text-[10px] font-mono uppercase mt-1">Code: {session.join_code}</p>
      </div>

      {/* Main Stats Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl mb-6">
        <div className="text-center border-b border-zinc-800 pb-6 mb-6">
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Pot</p>
          <p className="text-5xl font-black text-white tracking-tighter">${potSize}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mb-1">Your Entry</p>
            <p className="text-xl font-bold">${session.buy_in}</p>
          </div>
          <div>
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mb-1">Rebuys ({myResult.rebuys})</p>
            <p className="text-xl font-bold">${myResult.rebuys * session.buy_in}</p>
          </div>
        </div>
      </div>

      {/* Status Badges */}
      <div className="space-y-4">
        <div className={`flex items-center justify-between p-5 rounded-2xl border ${
          myResult.has_paid ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
        }`}>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Payment Status</p>
          <span className={`font-black text-xs uppercase italic ${myResult.has_paid ? 'text-green-500' : 'text-red-500'}`}>
            {myResult.has_paid ? 'Confirmed Paid' : 'Awaiting Payment'}
          </span>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Invested</p>
          <span className="text-yellow-500 font-black text-xl italic">
            ${(1 + myResult.rebuys) * session.buy_in}
          </span>
        </div>
      </div>

      {/* Footer Info */}
      <p className="text-zinc-600 text-[10px] mt-12 text-center font-mono uppercase leading-relaxed">
        Session data is updated in real-time by the host. <br/>
        Chip counts will be entered when the game ends.
      </p>
    </div>
  )
}