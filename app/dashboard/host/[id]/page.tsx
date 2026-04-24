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
    
    // 1. Fetch Session Details
    const { data: session } = await supabase
      .from('poker_sessions')
      .select('join_code, buy_in')
      .eq('id', sessionId)
      .single()
    if (session) setSessionData(session)

    // 2. Fetch Player Results (NO JOIN HERE TO PREVENT CRASH)
    const { data: results, error: pError } = await supabase
      .from('player_results')
      .select('id, user_id, has_paid, rebuys')
      .eq('session_id', sessionId)
    
    if (pError) {
      console.error("Fetch Error:", pError.message)
      return
    }

    if (results && results.length > 0) {
      // 3. Fetch Profiles separately to avoid the "profiles_1" error
      const userIds = results.map(r => r.user_id)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)

      // 4. Manually combine them in JavaScript
      const combined = results.map(r => ({
        ...r,
        display_name: profileData?.find(p => p.id === r.user_id)?.display_name || `Player ${r.user_id.slice(0,4)}`
      }))

      setPlayers(combined)
    } else {
      setPlayers([])
    }
    setLoading(false)
  }, [sessionId, supabase])

  useEffect(() => {
    getData()
    const channel = supabase
      .channel(`host-sync-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_results', filter: `session_id=eq.${sessionId}` }, getData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, getData, supabase])

  const togglePaid = async (id: string, current: boolean) => {
    await supabase.from('player_results').update({ has_paid: !current }).eq('id', id)
  }

  const addRebuy = async (id: string, current: number) => {
    await supabase.from('player_results').update({ rebuys: current + 1 }).eq('id', id)
  }

  if (loading) return <div className="p-8 text-white font-mono text-center">Syncing...</div>

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-10 text-yellow-500">Host Dashboard</h2>
        
        <div className="grid gap-4">
          {players.map(player => (
            <div key={player.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] flex justify-between items-center">
              <div>
                <p className="font-black text-xl italic uppercase">{player.display_name}</p>
                <p className="text-zinc-500 text-[10px] uppercase font-mono mt-1">Rebuys: {player.rebuys}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => togglePaid(player.id, player.has_paid)}
                  className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase border transition-all ${
                    player.has_paid ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-red-500/10 border-red-500 text-red-500'
                  }`}
                >
                  {player.has_paid ? 'Paid' : 'Unpaid'}
                </button>
                <button 
                  onClick={() => addRebuy(player.id, player.rebuys)}
                  className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase"
                >
                  + Rebuy
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}