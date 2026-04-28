'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Target, MousePointer2, Trophy, Crosshair, Zap, UserCheck, Plus, Minus, Coins } from 'lucide-react'

export default function HostLobby() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  const supabase = useMemo(() => createClient(), [])
  
  const [players, setPlayers] = useState<any[]>([])
  const [sessionData, setSessionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [finalChips, setFinalChips] = useState<{[key: string]: number}>({})
  const [globalJackpot, setGlobalJackpot] = useState(0)

  // UPDATED: Precision-safe jackpot updates with cents support
  const updateJackpot = async (amount: number) => {
    const newAmount = Math.max(0, parseFloat((globalJackpot + amount).toFixed(2)))
    
    // Optimistic update for immediate feedback
    setGlobalJackpot(newAmount)

    await supabase
      .from('global_settings')
      .update({ jackpot_amount: newAmount })
      .eq('id', 'poker_config')
  }

  // NIT RULE: Mark player as having played a hand
  const markPlayed = async (playerId: string) => {
    await supabase
      .from('player_results')
      .update({ has_nit_token: false })
      .eq('id', playerId)
  }

  // HOST NIT RESET: Force clears the penalty and increments count
  const handleHostNitReset = async () => {
    const activeNits = players.filter(p => p.has_nit_token);
    if (activeNits.length !== 1) return;
    const loser = activeNits[0];
    
    try {
      await supabase
        .from('player_results')
        .update({ nit_count: (loser.nit_count || 0) + 1 })
        .eq('id', loser.id);

      const { error } = await supabase
        .from('player_results')
        .update({ has_nit_token: true })
        .eq('session_id', sessionId); 

      if (error) throw error;
      getData();
    } catch (err) {
      console.error("Host Reset Error:", err);
    }
  }

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
        .select('*')
        .eq('id', sessionId)
        .single()
      
      if (sError) throw sError
      if (session) setSessionData(session)

      const [resultsRes, jackpotRes] = await Promise.all([
        supabase.from('player_results').select('*').eq('session_id', sessionId),
        supabase.from('global_settings').select('jackpot_amount').eq('id', 'poker_config').single()
      ])
      
      if (resultsRes.error) throw resultsRes.error
      if (jackpotRes.data) setGlobalJackpot(jackpotRes.data.jackpot_amount || 0)

      if (resultsRes.data && resultsRes.data.length > 0) {
        const userIds = resultsRes.data.map(r => r.user_id).filter(Boolean)
        const { data: profileData, error: profError } = await supabase
          .from('profiles')
          .select('id, full_name, display_name')
          .in(userIds.length > 0 ? 'id' : ['none'], userIds)

        if (profError) console.error("Profile fetch error:", profError.message)

        const combined = resultsRes.data.map(r => {
          const profile = profileData?.find(p => p.id === r.user_id);
          return {
            ...r,
            display_name: profile?.display_name || profile?.full_name || `Player ${r.user_id?.slice(0,4)}`
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
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'global_settings'
      }, (payload) => {
        // Specifically update jackpot state if it changed in DB
        if (payload.new && payload.new.jackpot_amount !== undefined) {
          setGlobalJackpot(payload.new.jackpot_amount)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, getData, supabase])

  const handleStartGame = async () => {
    const sessionUpdate = supabase
      .from('poker_sessions')
      .update({ status: 'active' })
      .eq('id', sessionId)

    const nitReset = supabase
      .from('player_results')
      .update({ has_nit_token: true })
      .eq('session_id', sessionId)

    await Promise.all([sessionUpdate, nitReset])
    getData()
  }

  const handleEndGame = async () => {
    const confirmEnd = confirm("End session and start settlement? This resets payment status for final payouts.")
    if (!confirmEnd) return

    try {
      const sessionUpdate = supabase
        .from('poker_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId)

      const playerUpdate = supabase
        .from('player_results')
        .update({ has_paid: false })
        .eq('session_id', sessionId)

      await Promise.all([sessionUpdate, playerUpdate])
      getData()
    } catch (err) {
      console.error("End Game Error:", err)
    }
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

  const activeNitPlayers = players.filter(p => p.has_nit_token);

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

        {/* JACKPOT CONTROL CARD */}
        <div className="mb-8 p-8 bg-zinc-900 border border-yellow-500/30 rounded-[3rem] shadow-[0_0_50px_rgba(234,179,8,0.05)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center text-black shadow-[0_0_30px_rgba(234,179,8,0.4)]">
                <Trophy size={32} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500/60 mb-1">Global Jackpot Pool</p>
                <h3 className="text-5xl font-black italic uppercase tracking-tighter text-white font-mono">
                  ${globalJackpot.toFixed(2)}
                </h3>
              </div>
            </div>
            
            <div className="flex flex-col gap-4 w-full md:w-auto">
              {/* Main Controls */}
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => updateJackpot(-5)} className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl hover:bg-red-500/10 hover:border-red-500/50 transition-all text-zinc-500 hover:text-red-500">
                  <Minus size={20} />
                </button>
                <button onClick={() => updateJackpot(-1)} className="px-6 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-[10px] font-black hover:text-red-500 transition-all">-$1</button>
                <button onClick={() => updateJackpot(1)} className="px-6 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-[10px] font-black hover:text-green-500 transition-all">+$1</button>
                <button onClick={() => updateJackpot(5)} className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl hover:bg-green-500/10 hover:border-green-500/50 transition-all text-zinc-500 hover:text-green-500">
                  <Plus size={20} />
                </button>
              </div>

              {/* Cent Controls Row */}
              <div className="flex items-center justify-center gap-2 border-t border-zinc-800/50 pt-4">
                <button onClick={() => updateJackpot(-0.25)} className="px-3 py-2 bg-zinc-950/50 border border-zinc-800 rounded-xl text-[9px] font-black text-zinc-500 hover:text-red-400">-.25¢</button>
                <button onClick={() => updateJackpot(-0.01)} className="px-3 py-2 bg-zinc-950/50 border border-zinc-800 rounded-xl text-[9px] font-black text-zinc-500 hover:text-red-400">-.01¢</button>
                <div className="mx-2 text-zinc-700"><Coins size={14}/></div>
                <button onClick={() => updateJackpot(0.01)} className="px-3 py-2 bg-zinc-950/50 border border-zinc-800 rounded-xl text-[9px] font-black text-zinc-500 hover:text-green-400">+.01¢</button>
                <button onClick={() => updateJackpot(0.25)} className="px-3 py-2 bg-zinc-950/50 border border-zinc-800 rounded-xl text-[9px] font-black text-zinc-500 hover:text-green-400">+.25¢</button>
              </div>
            </div>
          </div>
        </div>

        {/* NIT TRACKER (ONLY WHILE ACTIVE) */}
        {sessionData?.status === 'active' && (
          <div className="mb-8 p-6 bg-zinc-900 border border-zinc-800 rounded-[2.5rem]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                <Zap size={14} className="text-red-500" /> Nit Tokens Active: {activeNitPlayers.length}
              </h3>
              {activeNitPlayers.length === 1 && (
                <button 
                  onClick={handleHostNitReset}
                  className="bg-red-600 text-white px-4 py-1 rounded-xl text-[10px] font-black uppercase hover:bg-red-500 transition-colors"
                >
                  Force Reset & Penalty
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {activeNitPlayers.map(player => (
                <button 
                  key={player.id} 
                  onClick={() => markPlayed(player.id)}
                  className="p-4 bg-red-500/10 border border-red-500/50 rounded-2xl flex flex-col items-center hover:bg-green-500/10 hover:border-green-500 transition-all group"
                >
                  <span className="text-xs font-black uppercase italic text-red-500 group-hover:text-green-500 transition-colors">{player.display_name}</span>
                  <span className="text-[8px] mt-1 font-bold text-red-500/40 uppercase group-hover:text-green-500/60 transition-colors">Mark Played</span>
                </button>
              ))}
              {activeNitPlayers.length === 0 && (
                <button 
                  onClick={async () => {
                    await supabase.from('player_results').update({ has_nit_token: true }).eq('session_id', sessionId);
                    getData();
                  }}
                  className="col-span-full text-center py-4 text-zinc-700 text-[10px] font-black uppercase italic tracking-widest hover:text-white transition-colors"
                >
                  Click to start a new Nit Round
                </button>
              )}
            </div>
          </div>
        )}

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
                          {player.display_name} 
                          {player.user_id === clickChampionId && <Trophy size={16} className="text-yellow-500" />}
                          {player.has_nit_token && <Zap size={14} className="text-red-500" />}
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
                      <p className="font-black text-xl italic uppercase tracking-tight flex items-center gap-2">
                        {player.display_name}
                        {player.has_nit_token === false && <UserCheck size={14} className="text-green-500" />}
                      </p>
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