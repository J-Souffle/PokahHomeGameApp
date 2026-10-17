'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/client'
import { Calendar, CheckCircle2, Users, X } from 'lucide-react'

export default function RsvpModal({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [attendeeCount, setAttendeeCount] = useState<number>(0)
  const supabase = createClient()

  useEffect(() => {
    async function fetchRsvpData() {
      // Fetch current user's RSVP
      if (userId) {
        const { data } = await supabase
          .from('rsvps')
          .select('availability')
          .eq('user_id', userId)
          .single()

        if (data) setSelectedOption(data.availability)
      }

      // Fetch overall headcount for upcoming sessions (Saturday, Sunday, or Both)
      const { data: allRsvps } = await supabase
        .from('rsvps')
        .select('availability')
        .in('availability', ['Saturday', 'Sunday', 'Both'])

      if (allRsvps) {
        setAttendeeCount(allRsvps.length)
      }
    }

    if (isOpen) {
      fetchRsvpData()
    }
  }, [userId, isOpen, supabase])

  const handleRsvp = async (option: string) => {
    setLoading(true)
    setSelectedOption(option)

    const { error } = await supabase
      .from('rsvps')
      .upsert({ user_id: userId, availability: option }, { onConflict: 'user_id' })

    setLoading(false)
    if (!error) {
      setSaved(true)
      // Refresh count
      const { data: allRsvps } = await supabase
        .from('rsvps')
        .select('availability')
        .in('availability', ['Saturday', 'Sunday', 'Both'])
      
      if (allRsvps) setAttendeeCount(allRsvps.length)

      setTimeout(() => setSaved(false), 2000)
    } else {
      console.error('RSVP submission error:', error.message)
    }
  }

  const options = [
    { label: 'Saturday @ 7:00 PM', value: 'Saturday' },
    { label: 'Sunday @ 7:00 PM', value: 'Sunday' },
    { label: 'Both Days', value: 'Both' },
    { label: 'Cannot Make It', value: 'Neither' }
  ]

  const hasMinimumPlayers = attendeeCount >= 4

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-zinc-900 border border-zinc-800 text-yellow-500 px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-2 uppercase cursor-pointer"
      >
        <Calendar size={14} /> RSVP
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-6 right-6 text-zinc-500 hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-2xl font-black italic uppercase tracking-tight text-white mb-1">
              Upcoming Weekend RSVP
            </h3>
            <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-6">
              Saturday &amp; Sunday starting at 7:00 PM
            </p>

            {/* Threshold Banner */}
            <div className={`p-4 rounded-2xl border mb-6 flex items-center justify-between ${
              hasMinimumPlayers 
                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500'
            }`}>
              <div className="flex items-center gap-3">
                <Users size={18} />
                <div>
                  <p className="font-black text-xs uppercase tracking-wider">
                    {attendeeCount} Agent{attendeeCount !== 1 ? 's' : ''} Signed Up
                  </p>
                  <p className="text-[10px] font-mono opacity-80 uppercase">
                    {hasMinimumPlayers ? '⚡ Game On! Minimum reached.' : `Requires 4+ players to proceed (${4 - attendeeCount} needed)`}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {options.map((opt) => {
                const isSelected = selectedOption === opt.value
                return (
                  <button
                    key={opt.value}
                    disabled={loading}
                    onClick={() => handleRsvp(opt.value)}
                    className={`w-full p-4 rounded-2xl border text-left font-black text-xs uppercase tracking-wider transition-all flex justify-between items-center cursor-pointer ${
                      isSelected
                        ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500'
                        : 'bg-zinc-950/50 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <CheckCircle2 size={16} className="text-yellow-500" />}
                  </button>
                )
              })}
            </div>

            {saved && (
              <p className="text-green-500 font-mono text-[10px] uppercase tracking-widest text-center mt-4">
                RSVP Saved Successfully!
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}