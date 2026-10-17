'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/client'
import Link from 'next/link'
import { ChevronLeft, CheckCircle2, AlertCircle, Trash2, RefreshCw } from 'lucide-react'

interface RsvpSummaryItem {
  id: string
  user_id: string
  availability: string
  created_at: string
  display_name?: string
  full_name?: string
}

export default function RsvpListPage() {
  const [rsvps, setRsvps] = useState<RsvpSummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const supabase = createClient()

  const fetchRsvps = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('rsvp_summary')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) console.error('RSVP Fetch Error:', error)
    if (data) setRsvps(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchRsvps()
  }, [fetchRsvps])

  const handleClearRsvps = async () => {
  const confirmClear = window.confirm(
    'Are you sure you want to clear all RSVPs? This will wipe the list so players can sign up fresh for next week.'
  )
  if (!confirmClear) return

  setResetting(true)

  // Use gte('created_at', '1970-01-01') to target all rows cleanly in Supabase JS
  const { error } = await supabase
    .from('rsvps')
    .delete()
    .gte('created_at', '1970-01-01')

  setResetting(false)

  if (error) {
    console.error('Failed to clear RSVPs:', error.message)
    alert('Error clearing RSVPs: ' + error.message)
  } else {
    // Clear local state immediately for instant feedback
    setRsvps([])
  }
}

  const saturdayList = rsvps.filter(r => r.availability === 'Saturday' || r.availability === 'Both')
  const sundayList = rsvps.filter(r => r.availability === 'Sunday' || r.availability === 'Both')

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8 font-sans max-w-5xl mx-auto">
      <Link 
        href="/dashboard" 
        className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 font-black italic text-[10px] tracking-widest uppercase"
      >
        <ChevronLeft size={14} /> Back to Dashboard
      </Link>

      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none">
            Weekend <span className="text-yellow-500">Headcount</span>
          </h1>
          <p className="text-zinc-500 text-[10px] mt-2 font-mono uppercase tracking-[0.3em]">
            Session Sign-Ups &amp; Availability
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchRsvps}
            disabled={loading}
            className="bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white px-4 py-3 rounded-2xl font-black text-[10px] tracking-widest uppercase flex items-center gap-2 cursor-pointer transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          
          <button
            onClick={handleClearRsvps}
            disabled={resetting || rsvps.length === 0}
            className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white disabled:opacity-40 disabled:hover:bg-red-500/10 disabled:hover:text-red-400 px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest uppercase flex items-center gap-2 cursor-pointer transition-all"
          >
            <Trash2 size={14} /> Clear All RSVPs
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Saturday Session */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-black italic uppercase text-white">Saturday Session</h2>
              <p className="text-zinc-500 text-[10px] font-mono uppercase">7:00 PM Start</p>
            </div>
            <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 ${
              saturdayList.length >= 4 ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
            }`}>
              {saturdayList.length >= 4 ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {saturdayList.length}/4 Players
            </div>
          </div>

          <div className="space-y-3">
            {saturdayList.length > 0 ? (
              saturdayList.map((player) => (
                <div key={player.id} className="p-4 bg-zinc-950/50 border border-zinc-800/60 rounded-2xl flex justify-between items-center">
                  <span className="font-bold text-sm uppercase">{player.display_name || player.full_name || 'Agent'}</span>
                  <span className="text-[9px] font-mono uppercase text-zinc-500">{player.availability === 'Both' ? 'Both Days' : 'Sat Only'}</span>
                </div>
              ))
            ) : (
              <p className="text-zinc-600 text-xs font-mono uppercase italic text-center py-8">
                {loading ? 'Fetching signups...' : 'No responses yet'}
              </p>
            )}
          </div>
        </div>

        {/* Sunday Session */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-black italic uppercase text-white">Sunday Session</h2>
              <p className="text-zinc-500 text-[10px] font-mono uppercase">7:00 PM Start</p>
            </div>
            <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 ${
              sundayList.length >= 4 ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
            }`}>
              {sundayList.length >= 4 ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {sundayList.length}/4 Players
            </div>
          </div>

          <div className="space-y-3">
            {sundayList.length > 0 ? (
              sundayList.map((player) => (
                <div key={player.id} className="p-4 bg-zinc-950/50 border border-zinc-800/60 rounded-2xl flex justify-between items-center">
                  <span className="font-bold text-sm uppercase">{player.display_name || player.full_name || 'Agent'}</span>
                  <span className="text-[9px] font-mono uppercase text-zinc-500">{player.availability === 'Both' ? 'Both Days' : 'Sun Only'}</span>
                </div>
              ))
            ) : (
              <p className="text-zinc-600 text-xs font-mono uppercase italic text-center py-8">
                {loading ? 'Fetching signups...' : 'No responses yet'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}