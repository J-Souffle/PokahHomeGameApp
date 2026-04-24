'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/client'
import { useParams } from 'next/navigation'

export default function HostLobby() {
  const params = useParams()
  const sessionId = params.id as string
  const supabase = createClient()
  
  const [players, setPlayers] = useState<any[]>([])
  const [sessionData, setSessionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const getData = useCallback(async () => {
    if (!sessionId) return
    
    // 1. Fetch Session Details (Buy-in and Join Code)
    const { data: session } = await supabase
      .from('poker_sessions')
      .select('join_code, buy_in, status')
      .eq('id', sessionId)
      .single()
    
    if (session) setSessionData(session)

    // 2. Fetch Player Results (NO JOIN HERE TO PREVENT profiles_1 ERROR)
    const { data: results, error: pError } = await supabase
      .from('player_results')
      .select('id, user_id, has_paid, rebuys')
      .eq('session_id', sessionId)
    
    if (pError) {
      console.error("Fetch Error:", pError.message)
      setLoading(false)
      return
    }

    if (results && results.length > 0) {
      // 3. Fetch Profiles separately based on the user_ids found
      const userIds = results.map(r => r.user_id)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)

      // 4. Manually combine the player data with their names
      const combined = results.map(r => ({
        ...r,
        display_name: profileData?.find(p => p.id === r.user_id)?.display_name || `Player ${r.user_id.slice(0,4)}`
      }))

      // Sort: Put unpaid players at the top so the host sees who needs to pay
      setPlayers(combined.sort((a, b) => (a.has_paid === b.has_paid ? 0 : a.has_paid ? 1 : -1)))
    } else {
      setPlayers([])
    }
    
    setLoading(false)
  }, [sessionId, supabase])

  useEffect(() => {
    getData()
    
    // Real-time listener: Updates names/status instantly when players join or mark as paid
    const channel = supabase
      .channel(`host-lobby-sync-${sessionId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'player_results', 
        filter: `session_id=eq.${sessionId}` 
      }, () => getData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, getData, supabase])

  const togglePaid = async (id: string, current: boolean) => {
    await supabase.from('player_results').update({ has_paid: !current }).eq('id', id)
  }

  const addRebuy = async (id: string, current: number) => {
    await supabase.from('player_results').update({ rebuys: current + 1 }).eq('id', id)
  }

  const startGame = async () => {
    await supabase.from('poker_sessions').update({ status: 'active' }).eq('id', sessionId)
  }

  if (loading) return (
    <div className="p-8 bg-zinc-950 min-h-screen flex items-center justify-center">
      <div className="text-white font-mono uppercase tracking-[0.3em] text-xs animate-pulse">
        Syncing Command Center...
      </div>
    </div>
  )

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white">Command Center</h2>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">Join Code:</p>
              <span className="bg-yellow-500 text-black px-4 py-1 rounded-xl font-black text-2xl shadow-lg shadow-yellow-500/10">
                {sessionData?.join_code || '----'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Active Players</p>
            <p className="text-3xl font-black italic text-yellow-500">{players.length}</p>
          </div>
        </div>

        {/* Players List */}
        <div className="grid gap-4 mb-10">
          {players.length === 0 ? (
            <div className="border-2 border-dashed border-zinc-900 rounded-[2.5rem] py-24 text-center">
              <p className="text-zinc-800 font-black uppercase italic tracking-[0.2em] animate-pulse">
                Awaiting Player Signals...
              </p>
            </div>
          ) : (
            players.map(player => (
              <div key={player.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] flex justify-between items-center transition-all hover:border-zinc-700">
                <div>
                  <p className="font-black text-xl italic uppercase tracking-tight">
                    {player.display_name}
                  </p>
                  <p className="text-zinc-500 text-[10px] uppercase font-mono mt-1 tracking-widest">
                    Rebuys: <span className="text-yellow-500 font-bold">{player.rebuys}</span>
                    <span className="mx-2 text-zinc-800">|</span>
                    Total: <span className="text-white font-bold">${(1 + player.rebuys) * (sessionData?.buy_in || 0)}</span>
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => togglePaid(player.id, player.has_paid)}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${
                      player.has_paid 
                        ? 'bg-green-500/10 border-green-500/50 text-green-500' 
                        : 'bg-red-500/10 border-red-500/50 text-red-500 animate-pulse'
                    }`}
                  >
                    {player.has_paid ? 'Paid' : 'Mark Paid'}
                  </button>
                  <button 
                    onClick={() => addRebuy(player.id, player.rebuys)}
                    className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    + Rebuy
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Start Game Action */}
        <button 
          onClick={startGame}
          disabled={sessionData?.status === 'active' || players.length === 0}
          className={`w-full py-6 rounded-[2rem] font-black uppercase italic text-lg transition-all shadow-xl ${
            sessionData?.status === 'active' 
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
              : 'bg-zinc-100 text-black hover:scale-[1.01] active:scale-95'
          }`}
        >
          {sessionData?.status === 'active' ? 'Game in Progress' : 'Start Engine'}
        </button>
      </div>
    </div>
  )
}