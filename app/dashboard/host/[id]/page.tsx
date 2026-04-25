'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Target, MousePointer2, Trophy, Crosshair } from 'lucide-react'

export default function HostLobby() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  const supabase = useMemo(() => createClient(), [])
  
  const [players, setPlayers] = useState<any[]>([])
  const [sessionData, setSessionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [finalChips, setFinalChips] = useState<{[key: string]: number}>({})

  const togglePaid = async (playerId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('player_results')
      .update({ has_paid: !currentStatus })
      .eq('id', playerId)
    
    if (error) console.error("DEBUG ERR: Toggle paid failed:", error.message)
  }

  const handleRemovePlayer = async (playerId: string) => {
    const confirmRemoval = confirm("Kick this player from the session?")
    if (!confirmRemoval) return

    const { error } = await supabase
      .from('player_results')
      .delete()
      .eq('id', playerId)

    if (error) {
      console.error("DEBUG ERR: Remove failed:", error.message)
      alert("Failed to remove player.")
    }
  }

  const getData = useCallback(async () => {
    if (!sessionId) return
    
    try {
      const { data: session, error: sError } = await supabase
        .from('poker_sessions')
        .select('join_code, buy_in, status, bounty_target_id, bounty_amount, last_rebuy_name, last_rebuy_time')
        .eq('id', sessionId)
        .single()
      
      if (sError) throw sError
      if (session) setSessionData(session)

      const { data: results, error: pError } = await supabase
        .from('player_results')
        .select('id, user_id, has_paid, rebuys, final_chips, click_count, bounty_earned')
        .eq('session_id', sessionId)
      
      if (pError) throw pError

      if (results && results.length > 0) {
        const userIds = results.map(r => r.user_id).filter(Boolean)
        const { data: profileData, error: profError } = await supabase
          .from('profiles')
          .select('id, full_name, display_name')
          .in('id', userIds)

        if (profError) console.error("Profile fetch error:", profError.message)

        const combined = results.map(r => {
          const profile = profileData?.find(p => p.id === r.user_id);
          return {
            ...r,
            display_name: profile?.display_name || profile?.full_name || `Player ${r.user_id.slice(0,4)}`
          }
        })
        setPlayers(combined)
      } else {
        setPlayers([])
      }
    } catch (err: any) {
      console.error("DEBUG ERR: Data Fetch Error:", err.message)
    } finally {
      setLoading(false)
    }
  }, [sessionId, supabase])

  useEffect(() => {
    if (!sessionId) return;
    getData()

    const channel = supabase
      .channel(`host-lobby-sync-${sessionId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'player_results', 
        filter: `session_id=eq.${sessionId}` 
      }, () => getData())
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'poker_sessions', 
        filter: `id=eq.${sessionId}` 
      }, () => getData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, getData, supabase])

  const handleStartGame = async () => {
    await supabase.from('poker_sessions').update({ status: 'active' }).eq('id', sessionId)
  }

  const handleEndGame = async () => {
    await supabase.from('poker_sessions').update({ status: 'completed' }).eq('id', sessionId)
  }

  const triggerRebuy = async (playerId: string, displayName: string, currentRebuys: number) => {
    const playerUpdate = supabase
      .from('player_results')
      .update({ 
        rebuys: (currentRebuys || 0) + 1,
        has_paid: false 
      })
      .eq('id', playerId)

    const sessionUpdate = supabase
      .from('poker_sessions')
      .update({ 
        last_rebuy_name: `${displayName} REBOUGHT`,
        last_rebuy_time: new Date().toISOString()
      })
      .eq('id', sessionId)

    await Promise.all([playerUpdate, sessionUpdate])
  }

  const handleSetBounty = async (userId: string, playerName: string) => {
    const amount = prompt(`Set bounty reward for ${playerName}:`, "5")
    if (!amount) return

    const { error } = await supabase
      .from('poker_sessions')
      .update({ 
        bounty_target_id: userId,
        bounty_amount: parseFloat(amount)
      })
      .eq('id', sessionId)

    if (error) console.error("DEBUG ERR: Bounty failed:", error.message)
  }

  const handleClaimBounty = async (winnerId: string, winnerName: string) => {
    if (!sessionData?.bounty_target_id) return
    const target = players.find(p => p.user_id === sessionData.bounty_target_id)
    const confirmKnockout = confirm(`Confirm ${winnerName} knocked out ${target?.display_name || 'Target'}?`)
    
    if (!confirmKnockout) return

    const winnerResult = players.find(p => p.user_id === winnerId)
    
    // Update winner earnings and clear session bounty + set praise message
    const winnerUpdate = supabase
      .from('player_results')
      .update({ bounty_earned: (winnerResult?.bounty_earned || 0) + sessionData.bounty_amount })
      .eq('id', winnerResult.id)

    const sessionUpdate = supabase
      .from('poker_sessions')
      .update({ 
        bounty_target_id: null,
        last_rebuy_name: `${winnerName.toUpperCase()} COLLECTED THE BOUNTY!`,
        last_rebuy_time: new Date().toISOString()
      })
      .eq('id', sessionId)

    await Promise.all([winnerUpdate, sessionUpdate])
  }

  const saveFinalResults = async () => {
    const updates = players.map(player => {
      const chips = finalChips[player.user_id] || 0
      return supabase.from('player_results').update({ final_chips: chips }).eq('id', player.id)
    })
    await Promise.all(updates)
    alert("Settlement Finalized!")
    router.push('/dashboard') 
  }

  const clickChampionId = useMemo(() => {
    if (players.length === 0) return null
    const topPlayer = players.reduce((prev, current) => 
      ((prev.click_count || 0) > (current.click_count || 0)) ? prev : current
    )
    return (topPlayer.click_count || 0) > 0 ? topPlayer.user_id : null
  }, [players])

  if (loading) return <div className="p-8 bg-zinc-950 min-h-screen text-white font-mono text-center flex items-center justify-center uppercase tracking-widest">Syncing Command Center...</div>

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans pb-32">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-10">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-3 bg-zinc-900 rounded-2xl hover:bg-zinc-800 border border-zinc-800 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </Link>
            <div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Command Center</h2>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-zinc-500 font-mono text-[10px] uppercase">Join Code:</p>
                <span className="bg-yellow-500 text-black px-4 py-1 rounded-xl font-black text-2xl">{sessionData?.join_code || '----'}</span>
              </div>
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

        {sessionData?.bounty_target_id && sessionData?.status !== 'completed' && (
          <div className="mb-8 p-6 bg-yellow-500/5 border border-yellow-500/20 rounded-[2rem] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-black shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                <Target size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500/60">Priority Target</p>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                  {players.find(p => p.user_id === sessionData.bounty_target_id)?.display_name || "Target Marked"}
                </h3>
              </div>
            </div>
            <div className="text-right font-mono">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Reward Pool</p>
              <p className="text-3xl font-black text-yellow-500">${sessionData.bounty_amount}</p>
            </div>
          </div>
        )}

        {sessionData?.status === 'completed' ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black uppercase italic text-yellow-500 tracking-tight">Final Settlement</h3>
              {clickChampionId && (
                <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 rounded-2xl">
                  <Trophy size={14} className="text-yellow-500" />
                  <span className="text-[10px] font-black uppercase text-yellow-500">Click Champion</span>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {players.map(player => {
                const totalIn = (1 + (player.rebuys || 0)) * (sessionData?.buy_in || 0)
                const chips = finalChips[player.user_id] || 0
                const profit = chips + (player.bounty_earned || 0) - totalIn
                
                return (
                  <div key={player.id} className="flex items-center justify-between bg-zinc-950/50 p-5 rounded-3xl border border-zinc-800/50">
                    <div className="flex items-center gap-4">
                      <button onClick={() => togglePaid(player.id, player.has_paid)} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${player.has_paid ? 'bg-green-500 border-green-400 text-black' : 'border-zinc-800 text-zinc-800'}`}>
                        {player.has_paid && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                      </button>
                      <div>
                        <p className="font-black text-xl uppercase italic leading-tight flex items-center gap-2">
                          {player.display_name} {player.user_id === clickChampionId && <Trophy size={16} className="text-yellow-500" />}
                        </p>
                        <div className="flex gap-3">
                          <p className={`text-[10px] font-mono uppercase ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {profit >= 0 ? 'Collect' : 'Payout'}: ${Math.abs(profit)}
                          </p>
                          {player.bounty_earned > 0 && <p className="text-[10px] font-mono uppercase text-yellow-500">Bounties: ${player.bounty_earned}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className="text-zinc-600 font-mono text-[10px] uppercase">Final Chips:</span>
                       <input 
                        type="number"
                        className="bg-black border border-zinc-800 rounded-xl px-4 py-2 w-24 text-right font-black text-yellow-500 focus:border-yellow-500 outline-none transition-colors"
                        onChange={(e) => setFinalChips({...finalChips, [player.user_id]: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                )
              })}
              <button onClick={saveFinalResults} className="w-full mt-4 py-6 bg-yellow-500 text-black rounded-3xl font-black uppercase italic text-lg shadow-xl hover:bg-yellow-400 transition-all">
                Finalize & Close Session
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 mb-10">
              {players.map(player => (
                <div key={player.id} className={`bg-zinc-900 border p-6 rounded-[2rem] flex justify-between items-center transition-all ${sessionData?.bounty_target_id === player.user_id ? 'border-yellow-500' : 'border-zinc-800'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-black text-xl italic uppercase tracking-tight">{player.display_name}</p>
                      {(player.click_count || 0) > 0 && (
                        <div className="flex items-center gap-1 bg-zinc-800 px-2 py-1 rounded-lg">
                          <MousePointer2 size={10} className="text-zinc-500" />
                          <span className="text-[10px] font-mono text-zinc-400">{player.click_count}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-zinc-500 text-[10px] uppercase font-mono mt-1">
                      In for: <span className="text-white">${(1 + (player.rebuys || 0)) * (sessionData?.buy_in || 0)}</span>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {sessionData?.bounty_target_id && sessionData?.bounty_target_id !== player.user_id && (
                      <button onClick={() => handleClaimBounty(player.user_id, player.display_name)} className="p-3 rounded-2xl bg-red-600/20 border border-red-600/40 text-red-500 hover:bg-red-600 hover:text-white transition-all group">
                        <Crosshair size={16} strokeWidth={3} className="group-hover:scale-110" />
                      </button>
                    )}
                    <button onClick={() => handleSetBounty(player.user_id, player.display_name)} className={`p-3 rounded-2xl border transition-all ${sessionData?.bounty_target_id === player.user_id ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-yellow-500'}`}>
                      <Target size={16} strokeWidth={3} />
                    </button>
                    <button onClick={() => togglePaid(player.id, player.has_paid)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase border transition-colors ${player.has_paid ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-red-500/10 border-red-500 text-red-500'}`}>
                      {player.has_paid ? 'Paid' : 'Unpaid'}
                    </button>
                    <button onClick={() => triggerRebuy(player.id, player.display_name, player.rebuys)} className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-zinc-200">
                      + Rebuy
                    </button>
                    <button onClick={() => handleRemovePlayer(player.id)} className="bg-zinc-800 text-zinc-500 hover:text-red-500 px-4 py-3 rounded-2xl border border-transparent hover:border-red-500/20">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={sessionData?.status === 'waiting' ? handleStartGame : handleEndGame} className={`w-full py-6 rounded-[2rem] font-black uppercase italic text-lg transition-all ${sessionData?.status === 'waiting' ? 'bg-white text-black' : 'bg-red-600 text-white'}`}>
              {sessionData?.status === 'waiting' ? 'Start Engine' : 'End Game & Settle'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}