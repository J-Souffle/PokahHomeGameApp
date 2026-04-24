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
    
    // 1. Fetch Session Status
    const { data: session } = await supabase
      .from('poker_sessions')
      .select('join_code, buy_in, status')
      .eq('id', sessionId)
      .single()
    
    if (session) setSessionData(session)

    // 2. Fetch Player Results
    const { data: results, error: pError } = await supabase
      .from('player_results')
      .select('id, user_id, has_paid, rebuys')
      .eq('session_id', sessionId)
    
    if (pError) {
      setLoading(false)
      return
    }

    // 3. Fetch Names Defensively
    if (results && results.length > 0) {
      const userIds = results.map(r => r.user_id).filter(Boolean)
      
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name') // Matches your database
          .in('id', userIds)

        const combined = results.map(r => ({
          ...r,
          display_name: profileData?.find(p => p.id === r.user_id)?.full_name || `Player ${r.user_id.slice(0,4)}`
        }))
        setPlayers(combined)
      } catch (err) {
        console.error("Name fetch failed, using fallbacks:", err)
        setPlayers(results.map(r => ({ ...r, display_name: `Player ${r.user_id.slice(0,4)}` })))
      }
    } else {
      setPlayers([])
    }
    
    setLoading(false)
  }, [sessionId, supabase])

  useEffect(() => {
    getData()
    
    const channel = supabase
      .channel(`host-lobby-sync-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_results', filter: `session_id=eq.${sessionId}` }, () => getData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'poker_sessions', filter: `id=eq.${sessionId}` }, () => getData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, getData, supabase])

  const handleStartGame = async () => {
  const { data, error, count } = await supabase
    .from('poker_sessions')
    .update({ status: 'active' })
    .eq('id', sessionId)
    .select(); // Adding .select() forces it to return the updated row

  if (error) {
    console.error("Database Error:", error.message);
  } else if (!data || data.length === 0) {
    console.error("RLS Block: The update ran but 0 rows were changed. Check your RLS policies!");
  } else {
    console.log("Engine actually started in DB:", data[0].status);
    setSessionData(data[0]);
  }
};

  const togglePaid = async (id: string, current: boolean) => {
    await supabase.from('player_results').update({ has_paid: !current }).eq('id', id)
  }

  const addRebuy = async (id: string, current: number) => {
    await supabase.from('player_results').update({ rebuys: current + 1 }).eq('id', id)
  }

  if (loading) return <div className="p-8 bg-zinc-950 min-h-screen text-white font-mono text-center">Syncing...</div>

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
      <div className="max-w-4xl mx-auto">
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
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
              sessionData?.status === 'active' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-zinc-800 border-zinc-700 text-zinc-500'
            }`}>
              {sessionData?.status === 'active' ? '● Live' : 'Preparing'}
            </span>
          </div>
        </div>

        <div className="grid gap-4 mb-10">
          {players.map(player => (
            <div key={player.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] flex justify-between items-center">
              <div>
                <p className="font-black text-xl italic uppercase tracking-tight">{player.display_name}</p>
                <p className="text-zinc-500 text-[10px] uppercase font-mono mt-1">Rebuys: {player.rebuys}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => togglePaid(player.id, player.has_paid)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase border ${player.has_paid ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-red-500/10 border-red-500 text-red-500'}`}>
                  {player.has_paid ? 'Paid' : 'Unpaid'}
                </button>
                <button onClick={() => addRebuy(player.id, player.rebuys)} className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase">+ Rebuy</button>
              </div>
            </div>
          ))}
        </div>

        {sessionData?.status === 'waiting' ? (
          <button onClick={handleStartGame} className="w-full py-6 bg-white text-black rounded-[2rem] font-black uppercase italic text-lg hover:scale-[1.01] transition-all">
            Start Engine
          </button>
        ) : (
          <button className="w-full py-6 bg-red-600 text-white rounded-[2rem] font-black uppercase italic text-lg">
            End Game & Settlement
          </button>
        )}
      </div>
    </div>
  )
}