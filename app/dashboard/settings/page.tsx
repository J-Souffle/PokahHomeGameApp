'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/client'
import Link from 'next/link'
import { ChevronLeft, User, LogOut, ShieldCheck, Trophy, Award } from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('') 
  const [jackpot, setJackpot] = useState('')
  const [jackpotWinner, setJackpotWinner] = useState('')
  const [highestEarned, setHighestEarned] = useState('') // New state for Record Win
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function getData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email || '')
        
        const { data: profileData } = await supabase
          .from('profiles')
          .select('display_name, full_name, role')
          .eq('id', user.id)
          .single()
        
        if (profileData) {
          setName(profileData.display_name || profileData.full_name || '')
          setRole(profileData.role || '')
          
          if (profileData.role === 'host') {
            const { data: settings } = await supabase
              .from('global_settings')
              .select('jackpot_amount, jackpot_winner, record_win_amount')
              .eq('id', 'poker_config')
              .single()
            if (settings) {
              setJackpot(settings.jackpot_amount?.toString() || '')
              setJackpotWinner(settings.jackpot_winner || '')
              setHighestEarned(settings.record_win_amount?.toString() || '')
            }
          }
        }
      }
    }
    getData()
  }, [supabase])

  const updateProfile = async () => {
  setLoading(true)
  setMessage('')
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    // 1. Update Profile Alias
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ display_name: name })
      .eq('id', user.id)
    
    if (profileError) console.error("Profile Update Error:", profileError)

    // 2. Update Global Settings
   // 2. Update Global Settings
let settingsError = null
if (role === 'host') {
  const { error } = await supabase
    .from('global_settings')
    .upsert({ 
      id: 'poker_config', // Crucial for upsert to know which row to target
      jackpot_amount: parseFloat(jackpot) || 0,
      jackpot_winner: jackpotWinner,
      record_win_amount: parseFloat(highestEarned) || 0 
    })
  
  settingsError = error
  if (settingsError) console.error("Settings Update Error:", settingsError)
}
    
    if (profileError || settingsError) {
      setMessage('Error updating records. Check console.')
    } else {
      setMessage('Identity & Settings Updated.')
      setTimeout(() => setMessage(''), 3000)
    }
  }
  setLoading(false)
}

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-yellow-500/30 px-4 py-8 md:p-12">
      <div className="max-w-xl mx-auto flex flex-col min-h-[calc(100vh-6rem)]">
        
        <Link 
          href="/dashboard" 
          className="group inline-flex items-center gap-2 text-zinc-600 hover:text-white transition-all mb-8 md:mb-12 font-black italic text-[10px] tracking-[0.3em] uppercase"
        >
          <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Back to the High Table
        </Link>

        <header className="mb-10 md:mb-14">
          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase leading-none">
            USER <span className="text-yellow-500">INTEL</span>
          </h1>
          <div className="h-1.5 w-16 md:w-24 bg-yellow-500 mt-4" />
          <p className="text-zinc-600 mt-6 text-[10px] font-bold tracking-[0.4em] uppercase">Configure your profile</p>
        </header>

        <div className="flex-grow space-y-6">
          <div className="bg-zinc-900/20 border border-zinc-800/50 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl">
            <div className="space-y-8">
              
              <div className="space-y-3">
                <label className="block text-[9px] md:text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] px-1">Login Email</label>
                <div className="w-full bg-zinc-950/50 border border-zinc-900 p-4 md:p-5 rounded-2xl text-zinc-500 font-mono text-xs md:text-sm cursor-not-allowed flex items-center gap-3 overflow-hidden">
                  <ShieldCheck size={16} className="shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-1">Agent Alias (Display Name)</label>
                <div className="relative flex items-center group">
                  <User size={18} className="absolute left-5 p-2 text-zinc-700 group-focus-within:text-yellow-500 transition-colors" />
                  <input 
                    className="w-full bg-zinc-950 border border-zinc-800 p-4 md:p-5 pl-14 rounded-2xl focus:outline-none focus:border-yellow-500 transition-all font-black text-lg md:text-xl uppercase italic tracking-tight placeholder:text-zinc-800"
                    placeholder="ENTER ALIAS..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              {/* HOST-ONLY SECTION */}
              {role === 'host' && (
                <div className="space-y-6 pt-4 border-t border-zinc-800/50">
                  {/* Jackpot Name */}
                  <div className="space-y-3">
                    <label className="block text-[9px] md:text-[10px] font-black text-yellow-500 uppercase tracking-[0.2em] px-1">Jackpot Winner Name</label>
                    <div className="relative flex items-center group">
                      <User size={18} className="absolute left-5 p-2 text-zinc-700 group-focus-within:text-yellow-500 transition-colors" />
                      <input 
                        className="w-full bg-zinc-950 border border-zinc-800 p-4 md:p-5 pl-14 rounded-2xl focus:outline-none focus:border-yellow-500 transition-all font-black text-lg md:text-xl uppercase italic tracking-tight placeholder:text-zinc-800 text-yellow-500"
                        placeholder="WINNER NAME..."
                        value={jackpotWinner}
                        onChange={(e) => setJackpotWinner(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* House Jackpot Amount */}
                  <div className="space-y-3">
                    <label className="block text-[9px] md:text-[10px] font-black text-yellow-500 uppercase tracking-[0.2em] px-1">House Jackpot Amount</label>
                    <div className="relative flex items-center group">
                      <Trophy size={18} className="absolute left-5 p-2 text-zinc-700 group-focus-within:text-yellow-500 transition-colors" />
                      <input 
                        type="number"
                        className="w-full bg-zinc-950 border border-zinc-800 p-4 md:p-5 pl-14 rounded-2xl focus:outline-none focus:border-yellow-500 transition-all font-black text-lg md:text-xl uppercase italic tracking-tight placeholder:text-zinc-800 text-yellow-500"
                        placeholder="0.00"
                        value={jackpot}
                        onChange={(e) => setJackpot(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Record Win Amount */}
                  <div className="space-y-3">
                    <label className="block text-[9px] md:text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] px-1">Record High Score (Leaderboard)</label>
                    <div className="relative flex items-center group">
                      <Award size={18} className="absolute left-5 p-2 text-zinc-700 group-focus-within:text-emerald-500 transition-colors" />
                      <input 
                        type="number"
                        className="w-full bg-zinc-950 border border-zinc-800 p-4 md:p-5 pl-14 rounded-2xl focus:outline-none focus:border-emerald-500 transition-all font-black text-lg md:text-xl uppercase italic tracking-tight placeholder:text-zinc-800 text-emerald-500"
                        placeholder="0.00"
                        value={highestEarned}
                        onChange={(e) => setHighestEarned(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button 
                  onClick={updateProfile}
                  disabled={loading}
                  className="w-full bg-yellow-500 text-black font-black italic py-4 md:py-5 rounded-2xl hover:bg-yellow-400 transition-all uppercase flex items-center justify-center gap-2 group disabled:opacity-50 shadow-[0_10px_30px_-10px_rgba(234,179,8,0.3)] active:scale-[0.98]"
                >
                  {loading ? 'SYNCING...' : 'UPDATE IDENTITY'}
                </button>
                
                {message && (
                  <p className={`text-center font-black italic text-[10px] uppercase tracking-widest animate-pulse mt-6 ${
                    message.includes('Error') ? 'text-red-500' : 'text-yellow-500'
                  }`}>
                    {message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-12 mb-4">
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 text-zinc-800 hover:text-red-500 transition-colors font-black uppercase text-[9px] tracking-[0.4em] py-4"
          >
            <LogOut size={14} />
            Terminate Session (Sign Out)
          </button>
        </footer>
      </div>
    </div>
  )
}