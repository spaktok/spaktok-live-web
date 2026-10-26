'use client'

import { Home, Compass, BookOpen, Plus, MessageCircle, User } from 'lucide-react'
import type { TabType } from '@/lib/types'
import { cn } from '@/lib/utils'

interface BottomNavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

const tabs = [
  { id: 'home' as TabType, icon: Home, label: 'الرئيسية' },
  { id: 'discover' as TabType, icon: Compass, label: 'اكتشف' },
  { id: 'stories' as TabType, icon: BookOpen, label: 'القصص' },
  { id: 'create' as TabType, icon: Plus, label: 'إنشاء', isCreate: true },
  { id: 'chat' as TabType, icon: MessageCircle, label: 'المحادثات' },
  { id: 'profile' as TabType, icon: User, label: 'حسابي' },
]

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 safe-bottom">
      <div className="spak-content-width spak-bottom-bar mb-2 overflow-hidden rounded-[1.5rem] border border-[#a8beff]/15">
        <div className="flex items-center justify-around px-1 py-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            
            if (tab.isCreate) {
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  aria-label={tab.label}
                  className="relative flex items-center justify-center -mt-6 press-effect"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#6f92fa]/25 blur-lg" />
                  <div className="relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a9beff] via-[#819ffe] to-[#5379ee] text-[#0d1b2a] shadow-[0_10px_26px_rgba(72,116,255,0.38)] ring-4 ring-[#0d1222]">
                    <Icon className="size-7 text-[#07132f]" strokeWidth={2.75} />
                  </div>
                </button>
              )
            }
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 rounded-xl transition-all press-effect focus-visible:outline-2 focus-visible:outline-[#a8beff]",
                  isActive ? "bg-white/[0.08] text-white" : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                )}
              >
                <div className="relative">
                  <Icon 
                    className={cn(
                      "w-6 h-6 transition-all",
                      isActive && "text-[#ffffff]"
                    )} 
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#ffffff] neon-cyan" />
                  )}

                </div>
                <span className={cn(
                  "whitespace-nowrap text-[9px] font-medium",
                  isActive && "text-glow-cyan"
                )}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
