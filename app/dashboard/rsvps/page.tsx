import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ChevronLeft, Users, CheckCircle2, AlertCircle } from 'lucide-react'

export default async function RsvpListPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: rsvps, error } = await supabase
    .from('rsvp_summary')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) console.error('RSVP Fetch Error:', error)

  const saturdayList = rsvps?.filter(r => r.availability === 'Saturday' || r.availability === 'Both') || []
  const sundayList = rsvps?.filter(r => r.availability === 'Sunday' || r.availability === 'Both') || []

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8 font-sans max-w-5xl mx-auto">
      <Link 
        href="/dashboard" 
        className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 font-black italic text-[10px] tracking-widest uppercase"
      >
        <ChevronLeft size={14} /> Back to Dashboard
      </Link>

      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none">
          Weekend <span className="text-yellow-500">Headcount</span>
        </h1>
        <p className="text-zinc-500 text-[10px] mt-2 font-mono uppercase tracking-[0.3em]">
          Session Sign-Ups &amp; Availability
        </p>
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
              <p className="text-zinc-600 text-xs font-mono uppercase italic text-center py-8">No responses yet</p>
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
              <p className="text-zinc-600 text-xs font-mono uppercase italic text-center py-8">No responses yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}