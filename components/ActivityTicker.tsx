'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/client'
import Marquee from 'react-fast-marquee'

export default function ActivityTicker() {
  const supabase = createClient()
  const [events, setEvents] = useState<string[]>([
    "Welcome to the High Table",
    "Configure your session to begin..."
  ])

  useEffect(() => {
    const channel = supabase
      .channel('table-db-changes')
      // Listen for NEW sessions created
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poker_sessions' }, 
        (payload) => {
          const msg = `🎲 New Session: "${payload.new.name || 'Private'}" was just created!`
          setEvents(prev => [msg, ...prev].slice(0, 5))
      })
      // Listen for NEW cash-outs/results
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'player_results' }, 
        (payload) => {
          const profit = payload.new.final_chips - (payload.new.rebuys * 20) // adjust math as needed
          const msg = `💰 Cash Out: Someone just finished ${profit >= 0 ? '+' : ''}$${profit}!`
          setEvents(prev => [msg, ...prev].slice(0, 5))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="bg-yellow-500/10 border-y border-yellow-500/20 py-2 overflow-hidden">
      <Marquee gradient={false} speed={40}>
        {events.map((event, i) => (
          <span key={i} className="text-[10px] font-black uppercase italic text-yellow-500 mx-12 tracking-widest">
            {event}
          </span>
        ))}
      </Marquee>
    </div>
  )
}