'use client'

import { Clock3, Eye } from 'lucide-react'
import { StoryBar } from '@/components/spaktok/story-bar'
import { mockStories } from '@/lib/mock-data'

interface StoriesScreenProps {
  onStoryClick: (storyId: string) => void
  onAddStory: () => void
}

export function StoriesScreen({ onStoryClick, onAddStory }: StoriesScreenProps) {
  return (
    <section className="min-h-dvh pb-28" aria-labelledby="stories-heading">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-background/90 backdrop-blur-xl safe-top">
        <div className="mx-auto max-w-5xl px-4 pb-4 pt-5">
          <h1 id="stories-heading" className="text-2xl font-bold text-white">القصص</h1>
          <p className="mt-1 text-sm text-white/60">لحظات قصيرة من الأشخاص الذين تتابعهم</p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl">
        <section aria-label="قصتك وقصص جديدة" className="border-b border-white/5 py-2">
          <StoryBar onStoryClick={onStoryClick} onAddStory={onAddStory} />
        </section>

        <section className="px-4 py-5" aria-labelledby="stories-list-heading">
          <div className="mb-4 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-white/60" aria-hidden="true" />
            <h2 id="stories-list-heading" className="text-base font-semibold text-white">قصص حديثة</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {mockStories.map((story) => (
              <button
                key={story.id}
                type="button"
                onClick={() => onStoryClick(story.id)}
                aria-label={`عرض قصة ${story.user.displayName}`}
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-900 text-right press-effect"
              >
                <img
                  src={story.mediaUrl || story.user.avatar || '/placeholder.svg'}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  crossOrigin="anonymous"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />
                <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] text-white backdrop-blur-sm">
                  <Eye className="h-3 w-3" aria-hidden="true" />
                  {story.isViewed ? 'تمت المشاهدة' : 'جديدة'}
                </span>
                <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
                  <img
                    src={story.user.avatar || '/placeholder.svg'}
                    alt=""
                    className="h-9 w-9 rounded-full border-2 border-white object-cover"
                    loading="lazy"
                    crossOrigin="anonymous"
                  />
                  <span className="truncate text-sm font-semibold text-white">{story.user.displayName}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}
