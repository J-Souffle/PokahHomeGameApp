'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/client'

export default function HostConsole({ sessionId }: { sessionId: string }) {
  const supabase = createClient()
  const [players, setPlayers] = useState<any[]>([])
  const [session, setSession] = useState<any>(null)

  // Real-time subscription to see players join and update rebuys
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: sessionData } = await supabase
        .from('poker_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()
      setSession(sessionData)

      const { data: playerData } = await supabase
        .from('player_results')
        .select('*, profiles(display_name)')
        .eq('session_id', sessionId)
      setPlayers(playerData || [])
    }

    fetchInitialData()

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'player_results',
        filter: `session_id=eq.${sessionId}` 
      }, (payload) => {
        // Refresh player list on any change
        fetchInitialData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  const potSize = useMemo(() => {
    if (!session) return 0
    const totalEntries = players.reduce((acc, p) => acc + 1 + p.rebuys, 0)
    return totalEntries * session.buy_in
  }, [players, session])

  const markPaid = async (id: string, status: boolean) => {
    await supabase.from('player_results').update({ has_paid: !status }).eq('id', id)
  }

  const addRebuy = async (id: string, count: number) => {
    await supabase.from('player_results').update({ rebuys: count + 1 }).eq('id', id)
  }

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">Command Center</h1>
          <p className="text-zinc-500 font-mono text-[10px] uppercase">Join Code: <span className="text-yellow-500">{session?.join_code}</span></p>
        </div>
        <div className="text-right">
          <p className="text-zinc-500 text-[10px] font-black uppercase">Total Pot</p>
          <p className="text-3xl font-black text-green-500">${potSize}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {players.map(player => (
          <div key={player.id} className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-2xl flex justify-between items-center group">
            <div>
              <p className="font-bold text-lg text-zinc-100">{player.profiles?.display_name || "New Player"}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-zinc-600 text-[10px] font-black uppercase">Rebuys: {player.rebuys}</span>
                <span className="text-zinc-600 text-[10px] font-black uppercase">Invested: ${session?.buy_in * (1 + player.rebuys)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => markPaid(player.id, player.has_paid)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  player.has_paid 
                    ? 'bg-green-500/10 border-green-500/50 text-green-500' 
                    : 'bg-red-500/10 border-red-500/50 text-red-500'
                }`}
              >
                {player.has_paid ? 'Paid' : 'Unpaid'}
              </button>

              <button 
                onClick={() => addRebuy(player.id, player.rebuys)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-zinc-700 transition-colors"
              >
                + Rebuy
              </button>
            </div>
          </div>
        ))}
      </div>

      {players.length > 0 && (
        <button className="w-full mt-12 bg-yellow-500 hover:bg-yellow-400 text-black py-4 rounded-2xl font-black uppercase italic transition-all shadow-lg shadow-yellow-500/10">
          Start Game
        </button>
      )}
    </div>
  )
}