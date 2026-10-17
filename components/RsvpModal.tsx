'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/client'
import { Calendar, CheckCircle2, Users, ChevronDown, ChevronUp, X } from 'lucide-react'

interface Attendee {
  user_id: string
  availability: string
  name: string
}

export default function RsvpModal({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [showAttendeeList, setShowAttendeeList] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchRsvpData() {
      // 1. Fetch current user's RSVP status
      if (userId) {
        const { data } = await supabase
          .from('rsvps')
          .select('availability')
          .eq('user_id', userId)
          .maybeSingle()

        if (data) setSelectedOption(data.availability)
      }

      // 2. Fetch all RSVPs joined with display names from profiles
      const { data: rsvpSummary } = await supabase
        .from('rsvp_summary')
        .select('user_id, availability, display_name, full_name')
        .in('availability', ['Saturday', 'Sunday', 'Both'])

      if (rsvpSummary) {
        const mapped = rsvpSummary.map((item: any) => ({
          user_id: item.user_id,
          availability: item.availability,
          name: item.display_name || item.full_name || 'Agent'
        }))
        setAttendees(mapped)
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
      
      // Refresh attendees list
      const { data: rsvpSummary } = await supabase
        .from('rsvp_summary')
        .select('user_id, availability, display_name, full_name')
        .in('availability', ['Saturday', 'Sunday', 'Both'])

      if (rsvpSummary) {
        setAttendees(
          rsvpSummary.map((item: any) => ({
            user_id: item.user_id,
            availability: item.availability,
            name: item.display_name || item.full_name || 'Agent'
          }))
        )
      }

      setTimeout(() => setSaved(false), 2000)
    } else {
      console.error('RSVP submission error:', error.message)
    }
  }

  const saturdayAttendees = attendees.filter(a => a.availability === 'Saturday' || a.availability === 'Both')
  const sundayAttendees = attendees.filter(a => a.availability === 'Sunday' || a.availability === 'Both')

  const totalGoing = attendees.length
  const hasMinimumPlayers = totalGoing >= 4

  const options = [
    { label: 'Saturday @ 7:00 PM', value: 'Saturday' },
    { label: 'Sunday @ 7:00 PM', value: 'Sunday' },
    { label: 'Both Days', value: 'Both' },
    { label: 'Cannot Make It', value: 'Neither' }
  ]

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
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-6 right-6 text-zinc-500 hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-2xl font-black italic uppercase tracking-tight text-white mb-1">
              Weekend RSVP
            </h3>
            <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-6">
              Saturday &amp; Sunday starting at 7:00 PM
            </p>

            {/* Threshold Banner */}
            <div className={`p-4 rounded-2xl border mb-4 flex items-center justify-between ${
              hasMinimumPlayers 
                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500'
            }`}>
              <div className="flex items-center gap-3">
                <Users size={18} />
                <div>
                  <p className="font-black text-xs uppercase tracking-wider">
                    {totalGoing} Agent{totalGoing !== 1 ? 's' : ''} Signed Up
                  </p>
                  <p className="text-[10px] font-mono opacity-80 uppercase">
                    {hasMinimumPlayers ? '⚡ Minimum reached! Game is ON.' : `Needs 4+ players (${4 - totalGoing} more required)`}
                  </p>
                </div>
              </div>
            </div>

            {/* Toggle Who's Going Dropdown */}
            <button
              onClick={() => setShowAttendeeList(!showAttendeeList)}
              className="w-full mb-6 py-2 px-4 rounded-xl bg-zinc-950/60 border border-zinc-800 text-zinc-400 hover:text-white text-[10px] font-mono uppercase tracking-widest flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>See Who's Playing</span>
              {showAttendeeList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Attendee Lists */}
            {showAttendeeList && (
              <div className="mb-6 space-y-4 bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800/80 text-left">
                <div>
                  <p className="text-yellow-500 font-black text-[10px] uppercase tracking-widest mb-2">
                    Saturday ({saturdayAttendees.length})
                  </p>
                  {saturdayAttendees.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {saturdayAttendees.map(a => (
                        <span key={a.user_id} className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-200 px-2.5 py-1 rounded-lg font-bold">
                          {a.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-600 text-[10px] font-mono uppercase italic">No signups yet</p>
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-800/60">
                  <p className="text-yellow-500 font-black text-[10px] uppercase tracking-widest mb-2">
                    Sunday ({sundayAttendees.length})
                  </p>
                  {sundayAttendees.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {sundayAttendees.map(a => (
                        <span key={a.user_id} className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-200 px-2.5 py-1 rounded-lg font-bold">
                          {a.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-600 text-[10px] font-mono uppercase italic">No signups yet</p>
                  )}
                </div>
              </div>
            )}

            {/* Selection Options */}
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