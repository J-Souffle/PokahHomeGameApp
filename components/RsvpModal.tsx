'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/client'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2, Users, X, Clock } from 'lucide-react'

interface Attendee {
  user_id: string
  rsvp_date: string
  name: string
}

export default function RsvpModal({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [allAttendees, setAllAttendees] = useState<Attendee[]>([])
  const [activeDate, setActiveDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Fetch RSVPs when modal opens
  useEffect(() => {
    async function fetchRsvpData() {
      if (!isOpen) return

      // Fetch user's active RSVP dates
      if (userId) {
        const { data: userRsvps } = await supabase
          .from('rsvps')
          .select('rsvp_date')
          .eq('user_id', userId)

        if (userRsvps) {
          setSelectedDates(userRsvps.map((r) => r.rsvp_date))
        }
      }

      // Fetch all global RSVPs to count headcounts per date
      const { data: rsvpSummary } = await supabase
        .from('rsvp_summary')
        .select('user_id, rsvp_date, display_name, full_name')

      if (rsvpSummary) {
        const mapped = rsvpSummary.map((item: any) => ({
          user_id: item.user_id,
          rsvp_date: item.rsvp_date,
          name: item.display_name || item.full_name || 'Agent'
        }))
        setAllAttendees(mapped)
      }
    }

    fetchRsvpData()
  }, [userId, isOpen, supabase])

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)

    const startingDayOfWeek = firstDayOfMonth.getDay()
    const totalDays = lastDayOfMonth.getDate()

    const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = []

    // Padding previous month days
    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevDate = new Date(year, month, -startingDayOfWeek + i + 1)
      days.push({
        dateStr: prevDate.toISOString().split('T')[0],
        dayNum: prevDate.getDate(),
        isCurrentMonth: false
      })
    }

    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true
      })
    }

    return days
  }, [currentMonth])

  // Toggle RSVP status for a specific date
  const toggleRsvpForDate = async (dateStr: string) => {
    if (!userId) return
    setLoading(true)

    const isCurrentlySelected = selectedDates.includes(dateStr)

    if (isCurrentlySelected) {
      // Remove RSVP
      await supabase
        .from('rsvps')
        .delete()
        .eq('user_id', userId)
        .eq('rsvp_date', dateStr)

      setSelectedDates((prev) => prev.filter((d) => d !== dateStr))
      setAllAttendees((prev) => prev.filter((a) => !(a.user_id === userId && a.rsvp_date === dateStr)))
    } else {
      // Add RSVP
      await supabase.from('rsvps').upsert(
        {
          user_id: userId,
          rsvp_date: dateStr,
          availability: 'Going'
        },
        { onConflict: 'user_id, rsvp_date' }
      )

      setSelectedDates((prev) => [...prev, dateStr])
      setAllAttendees((prev) => [
        ...prev,
        { user_id: userId, rsvp_date: dateStr, name: 'You' }
      ])
    }

    setLoading(false)
  }

  const attendeesForActiveDate = allAttendees.filter((a) => a.rsvp_date === activeDate)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-zinc-900 border border-zinc-800 text-yellow-500 px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-2 uppercase cursor-pointer"
      >
        <CalendarIcon size={14} /> RSVP Calendar
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-6 md:p-8 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-6 right-6 text-zinc-500 hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-2xl font-black italic uppercase tracking-tight text-white mb-1">
              Poker Schedule
            </h3>
            <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-6 flex items-center gap-1.5">
              <Clock size={12} className="text-yellow-500" /> All sessions start at 7:00 PM
            </p>

            {/* Calendar Controls */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-black text-sm uppercase italic text-yellow-500 tracking-wider">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
              <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1.5 mb-6">
              {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
                const isToday = dateStr === todayStr
                const isRSVPed = selectedDates.includes(dateStr)
                const countForDay = allAttendees.filter((a) => a.rsvp_date === dateStr).length

                return (
                  <button
                    key={dateStr}
                    disabled={loading || !isCurrentMonth}
                    onClick={() => {
                      setActiveDate(dateStr)
                      toggleRsvpForDate(dateStr)
                    }}
                    className={`h-14 rounded-2xl border p-1 flex flex-col justify-between items-center transition-all relative cursor-pointer ${
                      !isCurrentMonth ? 'opacity-20 border-transparent cursor-not-allowed' : ''
                    } ${
                      isToday ? 'ring-2 ring-yellow-500 border-yellow-500' : 'border-zinc-800/80 bg-zinc-950/50'
                    } ${
                      isRSVPed ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="flex w-full justify-between items-center px-1">
                      <span className={`text-xs font-black ${isToday ? 'text-yellow-500' : ''}`}>
                        {dayNum}
                      </span>
                      {isRSVPed && <CheckCircle2 size={10} className="text-yellow-500" />}
                    </div>

                    <div className="flex items-center gap-1">
                      {countForDay > 0 && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-0.5">
                          <Users size={8} /> {countForDay}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Day Detail View */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 text-left">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <span className="text-xs font-black uppercase text-zinc-200 font-mono block">
                    {new Date(activeDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-[10px] font-mono text-yellow-500 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                    <Clock size={10} /> 7:00 PM Start
                  </span>
                </div>
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                  attendeesForActiveDate.length >= 4 
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
                    : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-500'
                }`}>
                  {attendeesForActiveDate.length}/4 Required
                </span>
              </div>

              {attendeesForActiveDate.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {attendeesForActiveDate.map((a, i) => (
                    <span key={i} className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-200 px-2.5 py-1 rounded-lg font-bold">
                      {a.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-600 text-[10px] font-mono uppercase italic mt-1">
                  No players signed up for this date yet
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}