'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/client'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Trophy, DollarSign, Users, Share2, CheckCircle2, Target, MousePointer2, Zap, AlertTriangle } from 'lucide-react'

export default function PlayerLiveView() {
  const { id: sessionId } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [session, setSession] = useState<any>(null)
  const [myResult, setMyResult] = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [stats, setStats] = useState({ totalPlayers: 0, totalRebuys: 0 })
  const [showAlert, setShowAlert] = useState(false)
  const [localClicks, setLocalClicks] = useState(0)

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch session and results in parallel for speed
    const [sessRes, resultsRes] = await Promise.all([
      supabase.from('poker_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('player_results').select('*').eq('session_id', sessionId)
    ])

    if (sessRes.data) setSession(sessRes.data)

    if (resultsRes.data) {
      const allResults = resultsRes.data
      const me = allResults.find(r => r.user_id === user.id)
      const userIds = allResults.map(r => r.user_id)
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, full_name') 
        .in('id', userIds)

      const playersWithNames = allResults.map(r => {
        const p = profiles?.find(prof => prof.id === r.user_id)
        return {
          ...r,
          display_name: p?.display_name || p?.full_name || `Player ${r.user_id.substring(0, 4)}`
        }
      })

      setAllPlayers(playersWithNames)
      
      const myProfile = profiles?.find(p => p.id === user.id)
      const myDisplayName = myProfile?.display_name || myProfile?.full_name || `Player ${user.id.substring(0, 4)}`
      
      setMyResult(me ? { ...me, display_name: myDisplayName } : null)
      if (me) setLocalClicks(me.click_count || 0)
      
      setStats({
        totalPlayers: allResults.length,
        totalRebuys: allResults.reduce((acc, r) => acc + (r.rebuys || 0), 0)
      })

      if (sessRes.data?.status === 'completed') {
        const ranked = playersWithNames.map(r => {
          const buyInTotal = (1 + (r.rebuys || 0)) * (sessRes.data?.buy_in || 0)
          return {
            id: r.user_id,
            name: r.display_name,
            profit: (r.final_chips || 0) + (r.bounty_earned || 0) - buyInTotal,
            clicks: r.click_count || 0,
            bounties: r.bounty_earned || 0,
            isNit: r.has_nit_token,
            nit_count: r.nit_count || 0
          }
        }).sort((a, b) => b.profit - a.profit)
        
        setLeaderboard(ranked)
      }
    }
  }, [sessionId, supabase])

  // NIT LOGIC: Check if I am the last one holding a token
  const activeNits = allPlayers.filter(p => p.has_nit_token);
  const isLastNit = activeNits.length === 1 && myResult?.has_nit_token;

  // Find the overall session loser for the settlement screen
  const ultimateNitPlayer = useMemo(() => {
    if (allPlayers.length === 0) return null;
    const topNit = [...allPlayers].sort((a, b) => (b.nit_count || 0) - (a.nit_count || 0))[0];
    return (topNit?.nit_count || 0) > 0 ? topNit : null;
  }, [allPlayers]);

  // Haptic feedback for the Last Nit
  useEffect(() => {
    if (isLastNit && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }, [isLastNit]);

  const handleConfirmNitPenalty = async () => {
    if (activeNits.length !== 1) return;
    const ultimateNit = activeNits[0];

    try {
      // OPTIMISTIC UPDATE: Clear UI immediately
      setAllPlayers(prev => prev.map(p => ({ ...p, has_nit_token: true })));

      // 1. Increment the nit_count
      await supabase
        .from('player_results')
        .update({ nit_count: (ultimateNit.nit_count || 0) + 1 })
        .eq('id', ultimateNit.id);

      // 2. Reset ALL tokens
      const { error } = await supabase
        .from('player_results')
        .update({ has_nit_token: true })
        .eq('session_id', sessionId);

      if (error) throw error;
      
      await fetchData(); 
    } catch (err) {
      console.error("Penalty error:", err);
    }
  }

  useEffect(() => {
    if (!sessionId) return
    fetchData()
    const channel = supabase
      .channel(`player-sync-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_results', filter: `session_id=eq.${sessionId}` }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'poker_sessions', filter: `id=eq.${sessionId}` }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, fetchData, supabase])

  useEffect(() => {
    if (session?.last_rebuy_time) {
      const rebuyTime = new Date(session.last_rebuy_time).getTime()
      const now = new Date().getTime()
      
      if (now - rebuyTime < 10000) {
        setShowAlert(true)
        const timer = setTimeout(() => setShowAlert(false), 5000)
        return () => clearTimeout(timer)
      }
    }
  }, [session?.last_rebuy_time])

  const handleButtonClick = async () => {
    if (!myResult || session?.status !== 'active') return
    const newCount = localClicks + 1
    setLocalClicks(newCount)
    
    await supabase
      .from('player_results')
      .update({ click_count: newCount })
      .eq('id', myResult.id)
  }

  const handleMarkAsPaid = async () => {
    if (myResult) await supabase.from('player_results').update({ has_paid: true }).eq('id', myResult.id)
  }

  const handleShare = async () => {
    const myProfitVal = (myResult.final_chips || 0) + (myResult.bounty_earned || 0) - ((1 + myResult.rebuys) * session.buy_in)
    const text = `🃏 Poker Session: ${session?.game_name || 'The Lab'}\n` +
      `👤 Player: ${myResult.display_name}\n` +
      `💰 Cashed Out: $${myResult.final_chips || 0}\n` +
      (myResult.bounty_earned > 0 ? `🎯 Bounties: $${myResult.bounty_earned}\n` : '') +
      `📈 Net: ${myProfitVal >= 0 ? '+' : ''}$${myProfitVal}\n` +
      `🖱️ Total Clicks: ${localClicks}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Poker Results', text: text, url: window.location.href });
      } catch (err) { console.log('Share canceled'); }
    } else {
      navigator.clipboard.writeText(`${text}\n${window.location.href}`);
      alert('Results copied to clipboard!');
    }
  }

  const potSize = useMemo(() => {
    if (!session) return 0
    return (stats.totalPlayers + stats.totalRebuys) * session.buy_in
  }, [session, stats])

  const clickChampionId = useMemo(() => {
    if (allPlayers.length === 0) return null
    const topPlayer = allPlayers.reduce((prev, current) => 
      ((prev.click_count || 0) > (current.click_count || 0)) ? prev : current
    )
    return (topPlayer.click_count || 0) > 0 ? topPlayer.user_id : null
  }, [allPlayers])

  if (!myResult) return <div className="min-h-screen bg-zinc-950 text-white p-8 font-mono animate-pulse flex items-center justify-center italic">Syncing with table...</div>

  const myProfit = (myResult.final_chips || 0) + (myResult.bounty_earned || 0) - ((1 + myResult.rebuys) * session.buy_in)
  const isTarget = session?.bounty_target_id === myResult?.user_id;
  const hasBounty = !!session?.bounty_target_id && session?.status !== 'completed';
  const bountyTargetName = allPlayers.find(p => p.user_id === session?.bounty_target_id)?.display_name || "TARGET";

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 pb-20">
      
      {showAlert && (
        <div className="fixed inset-x-0 top-10 z-[100] px-6 pointer-events-none animate-in fade-in zoom-in slide-in-from-top-10 duration-500">
          <div className="bg-white text-black p-4 rounded-[2rem] shadow-[0_0_50px_rgba(255,255,255,0.3)] flex items-center justify-between border-4 border-yellow-500">
            <div className="flex items-center gap-4">
              <div className="bg-black text-white w-10 h-10 rounded-full flex items-center justify-center animate-bounce">
                {session.last_rebuy_name.includes('COLLECTED') ? '🎯' : '💸'}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 leading-none">Lab Broadcast</p>
                <h4 className="text-lg font-black uppercase italic leading-none mt-1">{session.last_rebuy_name}</h4>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center mb-10 mt-4">
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border tracking-widest ${
          session?.status === 'active' ? 'bg-green-500/10 border-green-500 text-green-500 animate-pulse' : 
          session?.status === 'completed' ? 'bg-blue-500/10 border-blue-500 text-blue-500' :
          'bg-yellow-500/10 border-yellow-500 text-yellow-500'
        }`}>
          {session?.status === 'active' ? '● Game Live' : session?.status === 'completed' ? 'Settlement Final' : 'Waiting for Host'}
        </span>
        <h1 className="text-3xl font-black italic uppercase mt-4 tracking-tighter text-center">{myResult.display_name}</h1>
      </div>

      {session?.status === 'completed' ? (
        <div className="space-y-6 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          <div className={`p-6 rounded-[2.5rem] border transition-all duration-500 ${
            myResult.has_paid ? 'bg-green-500/5 border-green-500/20' : 'bg-yellow-500/5 border-yellow-500/20 animate-pulse'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${
                  myResult.has_paid ? 'bg-green-500 border-green-400 text-black' : 'border-zinc-800 text-zinc-700'
                }`}>
                  {myResult.has_paid ? <CheckCircle2 size={24} strokeWidth={3} /> : <DollarSign size={20} />}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Payout Status</p>
                  <p className={`font-black uppercase italic text-sm mt-0.5 ${myResult.has_paid ? 'text-green-500' : 'text-yellow-500'}`}>
                    {myResult.has_paid ? 'Settlement Confirmed' : 'Waiting for Host...'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ULTIMATE NIT AWARD */}
          {ultimateNitPlayer && (
            <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-[2.5rem] flex items-center justify-between overflow-hidden relative">
              <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Biggest Nit Award</p>
                <h3 className="text-xl font-black italic uppercase text-white">{ultimateNitPlayer.display_name}</h3>
              </div>
              <div className="text-right relative z-10">
                <p className="text-[10px] font-black uppercase text-zinc-500 leading-none">Total Penalties</p>
                <p className="text-3xl font-black text-red-500">{ultimateNitPlayer.nit_count}</p>
              </div>
              <AlertTriangle size={80} className="absolute right-[-10px] top-[-10px] text-red-500/10 rotate-12" />
            </div>
          )}

          <div className="bg-white text-black rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(255,255,255,0.05)] relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 translate-x-10 -translate-y-10 rounded-full ${myProfit >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
            <div className="relative z-10">
              <div className="flex justify-between items-start">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                  <DollarSign size={14} /> Final Payout
                </h2>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-zinc-400">Total Clicks</p>
                  <p className="font-mono font-bold flex items-center justify-end gap-1">
                    {localClicks} {clickChampionId === myResult.user_id && <Trophy size={12} className="text-yellow-600" />}
                  </p>
                </div>
              </div>
              <div className="space-y-4 mt-8">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Total Cashed Out</span>
                  <div className="text-right">
                    <span className="text-3xl font-black font-mono tracking-tighter block">${myResult.final_chips || 0}</span>
                    {myResult.bounty_earned > 0 && <span className="text-[10px] font-black text-yellow-600 uppercase">+ ${myResult.bounty_earned} Bounties</span>}
                  </div>
                </div>
                <div className="h-px bg-zinc-100 w-full" />
                <div className="py-4">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Your Net Performance</span>
                  <div className="flex items-baseline gap-1">
                    <p className={`text-7xl font-black tracking-tighter ${myProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {myProfit >= 0 ? '+' : ''}${myProfit}
                    </p>
                    <span className={`text-xs font-bold uppercase ${myProfit >= 0 ? 'text-green-600/50' : 'text-red-600/50'}`}>USD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem]">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500 mb-6 flex items-center gap-2">
              <Trophy size={14} className="text-yellow-500" /> Room Results
            </h3>
            <div className="space-y-4">
              {leaderboard.map((entry, i) => (
                <div key={i} className={`flex justify-between items-center p-3 rounded-2xl transition-colors ${entry.id === myResult.user_id ? 'bg-zinc-800' : ''}`}>
                  <div className="flex flex-col">
                    <span className={`text-sm font-bold uppercase italic flex items-center gap-2 ${entry.id === myResult.user_id ? 'text-white' : 'text-zinc-400'}`}>
                      {entry.name} {entry.id === clickChampionId && <Trophy size={10} className="text-yellow-500" />}
                    </span>
                    <div className="flex gap-2">
                      <span className={`text-[9px] font-mono uppercase ${entry.id === clickChampionId ? 'text-yellow-500 font-bold' : 'text-zinc-600'}`}>
                        {entry.clicks} clicks {entry.nit_count > 0 && `• ${entry.nit_count} NIT PENALTIES`}
                      </span>
                    </div>
                  </div>
                  <span className={`font-mono text-sm font-bold ${entry.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {entry.profit >= 0 ? '+' : ''}${entry.profit}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <button onClick={() => router.push('/dashboard')} className="w-full group py-6 bg-white text-black rounded-[2rem] font-black uppercase italic tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all">
             <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-1" /> Return to the Lab
          </button>
        </div>
      ) : (
        <div className="max-w-md mx-auto space-y-4">
          
          {/* NIT PENALTY ALERT */}
          {/* NIT PENALTY ALERT */}
{isLastNit && (
  <div className="bg-red-600 text-white p-6 rounded-[2.5rem] shadow-[0_0_50px_rgba(220,38,38,0.5)] animate-in zoom-in duration-300 border-4 border-white/20 mb-6">
    <div className="flex flex-col items-center text-center">
      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
        <AlertTriangle size={32} />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">
        ⚠️ YOU ARE THE ULTIMATE NIT
      </p>
      <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none mb-4">
        PAY EVERYONE 1 BB
      </h2>
      <button 
        onClick={handleConfirmNitPenalty} 
        className="w-full bg-white text-red-600 py-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all hover:bg-zinc-100"
      >
        Penalty Paid — Reset Tokens
      </button>
    </div>
  </div>
)}

{/* OPTIONAL: Show a passive warning to other players so they know who to collect from */}
{!isLastNit && activeNits.length === 1 && (
  <div className="bg-zinc-900 border border-red-500/30 p-4 rounded-[2rem] mb-6 flex items-center gap-4">
    <div className="bg-red-500/20 text-red-500 w-10 h-10 rounded-full flex items-center justify-center">
      <AlertTriangle size={20} />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nit Alert</p>
      <p className="text-sm font-bold uppercase italic">
        Collect 1 BB from <span className="text-red-500">{activeNits[0]?.display_name}</span>
      </p>
    </div>
  </div>
)}

          {hasBounty && (
            <div className={`p-6 rounded-[2.5rem] border-2 flex items-center justify-between overflow-hidden relative shadow-2xl transition-all duration-500 ${
              isTarget ? 'bg-red-500/10 border-red-500 animate-pulse' : 'bg-zinc-900 border-zinc-800'
            }`}>
              <div className="relative z-10">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isTarget ? 'text-red-500' : 'text-yellow-500/60'}`}>
                  {isTarget ? "⚠️ WARNING: YOU ARE THE" : "🎯 PRIORITY TARGET"}
                </p>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter mt-1">{isTarget ? "BOUNTY" : bountyTargetName}</h2>
              </div>
              <div className="text-right relative z-10 font-mono">
                <p className="text-[10px] font-black uppercase text-zinc-500 leading-none">Reward</p>
                <p className="text-3xl font-black text-yellow-500 mt-1">${session.bounty_amount}</p>
              </div>
            </div>
          )}

          <div className="relative group">
            <button onClick={handleButtonClick} className="w-full aspect-square bg-zinc-900 border-8 border-zinc-800 rounded-[3rem] flex flex-col items-center justify-center transition-all active:scale-95 active:bg-zinc-800 active:border-zinc-700 shadow-2xl relative overflow-hidden">
              <MousePointer2 size={48} className="text-zinc-700 mb-4 group-active:text-yellow-500 transition-colors" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-1">Session Taps</p>
              <p className="text-6xl font-black italic tracking-tighter text-white group-active:scale-110 transition-transform">{localClicks}</p>
            </button>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-[2rem] p-6 text-center">
            <p className="text-zinc-500 text-[10px] font-black uppercase mb-1 flex items-center justify-center gap-2">
              <Users size={12} /> Live Pot Value
            </p>
            <p className="text-4xl font-black tracking-tighter text-zinc-300">${potSize}</p>
          </div>

          <div className={`p-6 rounded-[2.5rem] border transition-all duration-500 ${
            myResult.has_paid ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20 animate-pulse'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                  myResult.has_paid ? 'bg-green-500 border-green-400 text-black' : 'border-zinc-800 text-zinc-700'
                }`}>
                  {myResult.has_paid ? <CheckCircle2 size={20} strokeWidth={3} /> : <DollarSign size={16} />}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Buy-In Status</p>
                  <p className={`font-black uppercase italic text-sm mt-0.5 ${myResult.has_paid ? 'text-green-500' : 'text-red-500'}`}>
                    {myResult.has_paid ? 'Transaction Verified' : 'Awaiting Payment'}
                  </p>
                </div>
              </div>
              {!myResult.has_paid && (
                <button onClick={handleMarkAsPaid} className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:scale-105 active:scale-95 transition-all">
                  Confirm Paid
                </button>
              )}
            </div>
          </div>

          <button onClick={() => router.push('/dashboard')} className="w-full group py-6 bg-zinc-900 border border-zinc-800 text-white rounded-[2rem] font-black uppercase italic tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all">
             <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-1" /> Return to the Lab
          </button>
        </div>
      )}
    </div>
  )
}