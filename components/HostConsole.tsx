'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/client'

export default function HostConsole({ sessionId }: { sessionId: string }) {
  const supabase = createClient()
  const [players, setPlayers] = useState<any[]>([])
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    const fetchInitialData = async () => {
      console.log("DEBUG: Fetching initial data for session:", sessionId);
      const { data: sessionData } = await supabase
        .from('poker_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()
      setSession(sessionData)

      const { data: playerData } = await supabase
        .from('player_results')
        .select('*, profiles(full_name)')
        .eq('session_id', sessionId)
      
      console.log("DEBUG: Player data fetched:", playerData);
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
        console.log("DEBUG: Realtime change detected!", payload);
        fetchInitialData()
      })
      .subscribe((status) => {
        console.log("DEBUG: Subscription status:", status);
      })

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, supabase])

  const potSize = useMemo(() => {
    if (!session) return 0
    const totalEntries = players.reduce((acc, p) => acc + 1 + (p.rebuys || 0), 0)
    return totalEntries * session.buy_in
  }, [players, session])

  const markPaid = async (id: string, currentStatus: boolean) => {
    console.log(`DEBUG: Toggling payment for ${id}. Current: ${currentStatus}`);
    const { data, error } = await supabase
      .from('player_results')
      .update({ has_paid: !currentStatus })
      .eq('id', id)
      .select()
    
    if (error) console.error("DEBUG ERR: markPaid failed:", error.message);
    else console.log("DEBUG: markPaid success:", data);
  }

  const addRebuy = async (id: string, currentRebuys: number) => {
    console.log(`DEBUG: Adding rebuy for ${id}. Previous count: ${currentRebuys}`);
    const { data, error } = await supabase
      .from('player_results')
      .update({ 
        rebuys: (currentRebuys || 0) + 1,
        has_paid: false 
      })
      .eq('id', id)
      .select()
    
    if (error) console.error("DEBUG ERR: addRebuy failed:", error.message);
    else console.log("DEBUG: addRebuy success (has_paid should be false):", data);
  }

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter leading-none">Command Center</h1>
          <p className="text-zinc-500 font-mono text-[10px] uppercase mt-2">Join Code: <span className="text-yellow-500">{session?.join_code}</span></p>
        </div>
        <div className="text-right">
          <p className="text-zinc-500 text-[10px] font-black uppercase">Total Pot</p>
          <p className="text-3xl font-black text-green-500 leading-none">${potSize}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {players.map(player => (
          <div key={player.id} className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-[2rem] flex justify-between items-center group transition-all hover:border-zinc-700">
            <div>
              <p className="font-black text-xl text-zinc-100 uppercase italic tracking-tight">
                {player.profiles?.full_name || "Guest Player"}
              </p>
              <div className="flex gap-3 mt-1">
                <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Rebuys: {player.rebuys || 0}</span>
                <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">In for: ${ (1 + (player.rebuys || 0)) * (session?.buy_in || 0) }</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => markPaid(player.id, player.has_paid)}
                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${
                  player.has_paid 
                    ? 'bg-green-500/10 border-green-500/50 text-green-500' 
                    : 'bg-red-500/10 border-red-500/50 text-red-500'
                }`}
              >
                {player.has_paid ? 'Paid' : 'Unpaid'}
              </button>

              <button 
                onClick={() => addRebuy(player.id, player.rebuys)}
                className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-zinc-200 transition-transform active:scale-95 shadow-lg shadow-white/5"
              >
                + Rebuy
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}