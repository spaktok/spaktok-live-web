'use client'

import { Plus } from 'lucide-react'
import { mockStories } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

interface StoryBarProps {
  onStoryClick: (storyId: string) => void
  onAddStory: () => void
}

export function StoryBar({ onStoryClick, onAddStory }: StoryBarProps) {
  return (
    <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
      {/* Add Story Button */}
      <button
        onClick={onAddStory}
        className="flex flex-col items-center gap-2 flex-shrink-0 press-effect"
      >
        <div className="relative w-[72px] h-[72px] rounded-full bg-white p-[3px] flex items-center justify-center shadow-[0_0_18px_rgba(255,255,255,0.35)]">
          <div className="w-full h-full rounded-full bg-[#070b18] flex items-center justify-center">
            <Plus className="w-7 h-7 text-[#ffffff]" strokeWidth={2.5} />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-white flex items-center justify-center border-2 border-[#0a0a14]">
            <Plus className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        </div>
        <span className="text-xs text-white/70">قصتك</span>
      </button>

      {/* Stories */}
      {mockStories.map((story, index) => (
        <button
          key={story.id}
          onClick={() => onStoryClick(story.id)}
          className="flex flex-col items-center gap-2 flex-shrink-0 press-effect"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="relative">
            {/* Gradient Ring */}
            <div 
              className={cn(
                "absolute inset-0 rounded-full p-[3px]",
                story.isViewed 
                  ? "bg-[#13245f]/65" 
                  : "bg-gradient-to-tr from-[#0b1f66] via-[#3155ff] to-[#6d8dff]"
              )}
            >
              <div className="w-full h-full rounded-full bg-[#0a0a14]" />
            </div>
            
            {/* Avatar */}
            <div className="relative w-[72px] h-[72px] p-[4px]">
              <img
                src={story.user.avatar || "/placeholder.svg"}
                alt={story.user.displayName}
                className="w-full h-full rounded-full object-cover"
                crossOrigin="anonymous"
              />
            </div>
            
            {/* Live Badge */}
            {story.user.isLive && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-gradient-to-r from-[#3155ff] to-[#3155ff]/80 text-[9px] font-bold text-white uppercase tracking-wider animate-live-pulse">
                Live
              </div>
            )}
          </div>
          
          <span className={cn(
            "text-xs max-w-[72px] truncate",
            story.isViewed ? "text-white/50" : "text-white"
          )}>
            {story.user.username.split('_')[0]}
          </span>
        </button>
      ))}
    </div>
  )
}
