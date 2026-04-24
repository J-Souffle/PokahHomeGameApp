'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/client'
import { useParams } from 'next/navigation'

export default function HostLobby() {
  const params = useParams()
  const sessionId = params.id as string
  const supabase = useMemo(() => createClient(), [])
  
  const [players, setPlayers] = useState<any[]>([])
  const [sessionData, setSessionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [finalChips, setFinalChips] = useState<{[key: string]: number}>({})

  const getData = useCallback(async () => {
    if (!sessionId) return
    
    try {
      // 1. Fetch Session Status
      const { data: session, error: sError } = await supabase
        .from('poker_sessions')
        .select('join_code, buy_in, status')
        .eq('id', sessionId)
        .single()
      
      if (sError) throw sError
      if (session) setSessionData(session)

      // 2. Fetch Player Results - Defensively
      const { data: results, error: pError } = await supabase
        .from('player_results')
        .select('id, user_id, has_paid, rebuys, final_chips')
        .eq('session_id', sessionId)
      
      if (pError) {
        console.error("Error fetching player_results:", pError.message)
        return // Stop here if we can't even get the player list
      }

      // 3. Fetch Profiles for names using correct 'full_name' column
      if (results && results.length > 0) {
        const userIds = results.map(r => r.user_id).filter(Boolean)
        
        const { data: profileData, error: profError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds)

        if (profError) console.error("Profile fetch error:", profError.message)

        const combined = results.map(r => ({
          ...r,
          display_name: profileData?.find(p => p.id === r.user_id)?.full_name || `Player ${r.user_id.slice(0,4)}`
        }))
        setPlayers(combined)
      } else {
        setPlayers([])
      }
    } catch (err: any) {
      console.error("Critical Data Fetch Error:", err.message)
    } finally {
      setLoading(false)
    }
  }, [sessionId, supabase])

  useEffect(() => {
    if (!sessionId) return;
    
    getData()

    // Fixed Realtime Channel - ensures UI updates when players join or status changes
    const channel = supabase
      .channel(`host-lobby-sync-${sessionId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'player_results', 
        filter: `session_id=eq.${sessionId}` 
      }, (payload) => {
        console.log("Player change detected:", payload)
        getData()
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'poker_sessions', 
        filter: `id=eq.${sessionId}` 
      }, (payload) => {
        console.log("Session status updated:", payload)
        getData()
      })
      .subscribe((status) => {
        console.log(`Realtime subscription status for ${sessionId}:`, status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, getData, supabase])

  const handleStartGame = async () => {
    const { error } = await supabase
      .from('poker_sessions')
      .update({ status: 'active' })
      .eq('id', sessionId)
    
    if (error) console.error("Start failed:", error.message)
    else await getData() 
  }

  const handleEndGame = async () => {
    const { error } = await supabase
      .from('poker_sessions')
      .update({ status: 'completed' })
      .eq('id', sessionId)
    
    if (error) console.error("End failed:", error.message)
    else await getData()
  }

  const saveFinalResults = async () => {
    const updates = players.map(player => {
      const chips = finalChips[player.user_id] || 0
      return supabase
        .from('player_results')
        .update({ final_chips: chips })
        .eq('id', player.id)
    })
    
    await Promise.all(updates)
    alert("Settlement Finalized!")
  }

  if (loading) return <div className="p-8 bg-zinc-950 min-h-screen text-white font-mono text-center flex items-center justify-center">Initial Syncing...</div>

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter">Command Center</h2>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-zinc-500 font-mono text-[10px] uppercase">Join Code:</p>
              <span className="bg-yellow-500 text-black px-4 py-1 rounded-xl font-black text-2xl">
                {sessionData?.join_code || '----'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase border tracking-widest ${
              sessionData?.status === 'active' ? 'bg-green-500/10 border-green-500 text-green-500' : 
              sessionData?.status === 'completed' ? 'bg-blue-500/10 border-blue-500 text-blue-500' :
              'bg-zinc-800 border-zinc-700 text-zinc-500'
            }`}>
              {sessionData?.status === 'active' ? '● Live' : sessionData?.status === 'completed' ? 'Settling' : 'Preparing'}
            </span>
          </div>
        </div>

        {/* LOBBY / SETTLEMENT LOGIC */}
        {sessionData?.status === 'completed' ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-black uppercase italic text-yellow-500 mb-6">Final Settlement</h3>
            <div className="space-y-6">
              {players.map(player => {
                const totalIn = (1 + (player.rebuys || 0)) * (sessionData?.buy_in || 0)
                const chips = finalChips[player.user_id] || 0
                const profit = chips - totalIn
                return (
                  <div key={player.id} className="flex items-center justify-between border-b border-zinc-800/50 pb-6">
                    <div>
                      <p className="font-black text-xl uppercase italic">{player.display_name}</p>
                      <p className={`text-[10px] font-mono uppercase ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        Net: {profit >= 0 ? '+' : ''}${profit}
                      </p>
                    </div>
                    <input 
                      type="number"
                      className="bg-black border border-zinc-800 rounded-2xl px-4 py-3 w-32 text-right font-black"
                      onChange={(e) => setFinalChips({...finalChips, [player.user_id]: parseInt(e.target.value) || 0})}
                    />
                  </div>
                )
              })}
              <button onClick={saveFinalResults} className="w-full py-6 bg-yellow-500 text-black rounded-3xl font-black uppercase italic text-lg shadow-xl shadow-yellow-500/10">
                Finalize Payouts
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 mb-10">
              {players.length === 0 ? (
                <div className="border-2 border-dashed border-zinc-900 rounded-[2rem] py-20 text-center">
                   <p className="text-zinc-800 font-black uppercase italic tracking-widest animate-pulse">Awaiting Players...</p>
                </div>
              ) : (
                players.map(player => (
                  <div key={player.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] flex justify-between items-center shadow-lg transition-all hover:border-zinc-700">
                    <div>
                      <p className="font-black text-xl italic uppercase tracking-tight">{player.display_name}</p>
                      <p className="text-zinc-500 text-[10px] uppercase font-mono mt-1">
                        In for: <span className="text-white">${(1 + player.rebuys) * (sessionData?.buy_in || 0)}</span>
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => supabase.from('player_results').update({ has_paid: !player.has_paid }).eq('id', player.id)} 
                        className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase border ${player.has_paid ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-red-500/10 border-red-500 text-red-500'}`}>
                        {player.has_paid ? 'Paid' : 'Unpaid'}
                      </button>
                      <button onClick={() => supabase.from('player_results').update({ rebuys: (player.rebuys || 0) + 1 }).eq('id', player.id)} 
                        className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase">+ Rebuy</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button 
              onClick={sessionData?.status === 'waiting' ? handleStartGame : handleEndGame}
              disabled={players.length === 0 && sessionData?.status === 'waiting'}
              className={`w-full py-6 rounded-[2rem] font-black uppercase italic text-lg transition-all ${
                sessionData?.status === 'waiting' ? 'bg-white text-black' : 'bg-red-600 text-white'
              }`}
            >
              {sessionData?.status === 'waiting' ? 'Start Engine' : 'End Game & Settle'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}