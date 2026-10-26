'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, RotateCcw, Sparkles, Wand2, Star, Clock3, ScanFace } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  backgroundModes,
  beautySliders,
  colorSliders,
  createStudioState,
  filterPresets,
  fxList,
  faceFxCatalog,
  presetCategories,
  type BackgroundMode,
  type FxId,
  type PresetCategory,
  type StudioState,
} from '@/lib/filter-engine/params'
import { gradeToState, type Grade } from '@/lib/filter-engine/ai-grade'
import { useStudioStrings } from '@/lib/filter-engine/strings'

const backgroundLabel: Record<BackgroundMode, string> = { none: 'bgNone', blur: 'bgBlur', splash: 'bgSplash', studio: 'bgStudio' }
const fxLabel: Record<FxId, string> = {
  none: 'fxNone',
  'rgb-split': 'fxRgbSplit',
  glitch: 'fxGlitch',
  vhs: 'fxVhs',
  shake: 'fxShake',
  'zoom-blur': 'fxZoomBlur',
  'light-leak': 'fxLightLeak',
  duotone: 'fxDuotone',
  mirror: 'fxMirror',
  kaleido: 'fxKaleido',
  fisheye: 'fxFisheye',
  pixel: 'fxPixel',
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', active ? 'bg-white text-black' : 'bg-white/10 text-white/75')}
    >
      {children}
    </button>
  )
}

export type StudioTab = 'face' | 'filters' | 'adjust' | 'beauty' | 'effects' | 'ai'

interface StudioPanelProps {
  state: StudioState
  onChange: (next: StudioState) => void
  captureFrame: () => string | null
  tabs?: StudioTab[]
}

const categories = presetCategories

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const display = Math.round(value * 100)
  const bipolar = min < 0
  const percent = ((value - min) / (max - min)) * 100
  const origin = bipolar ? 50 : 0
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-xs text-white/70">
        <span>{label}</span>
        <span className="tabular-nums text-white">{bipolar && display > 0 ? `+${display}` : display}</span>
      </span>
      <span className="relative flex h-6 items-center">
        <span className="absolute inset-x-0 h-1 rounded-full bg-white/15" />
        <span
          className="absolute h-1 rounded-full bg-[#3155ff]"
          style={{ left: `${Math.min(origin, percent)}%`, width: `${Math.abs(percent - origin)}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={0.01}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          onDoubleClick={() => onChange(bipolar ? 0 : min)}
          className="studio-range relative w-full"
          aria-label={label}
        />
      </span>
    </label>
  )
}

export function StudioPanel({ state, onChange, captureFrame, tabs = ['face', 'filters', 'adjust', 'beauty', 'effects', 'ai'] }: StudioPanelProps) {
  const { s, language } = useStudioStrings()
  const [tab, setTab] = useState<StudioTab>(tabs[0])
  const [category, setCategory] = useState<PresetCategory | 'favorites'>('trending')
  const [favorites, setFavorites] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [prompt, setPrompt] = useState('')
  const [aiState, setAiState] = useState<'idle' | 'working' | 'error'>('idle')
  const [aiSummary, setAiSummary] = useState<string | null>(null)

  useEffect(() => {
    // Device-local preferences without server cost, identifiers, or facial data.
    try {
      const saved = JSON.parse(localStorage.getItem('spaktok.studio.favorites.v1') || '[]') as unknown
      const last = JSON.parse(localStorage.getItem('spaktok.studio.recent.v1') || '[]') as unknown
      if(Array.isArray(saved))setFavorites(saved.filter(v=>typeof v==='string'&&filterPresets.some(p=>p.id===v)).slice(0,30))
      if(Array.isArray(last))setRecent(last.filter(v=>typeof v==='string'&&filterPresets.some(p=>p.id===v)).slice(0,8))
    } catch {/* private browsing storage may be unavailable */}
  }, [])

  const selectPreset = (id: string) => {
    onChange({ ...state, presetId: id, intensity: id===state.presetId?state.intensity:1 })
    const updated=[id,...recent.filter(item=>item!==id)].slice(0,8)
    setRecent(updated)
    try {localStorage.setItem('spaktok.studio.recent.v1',JSON.stringify(updated))}catch{}
  }

  const toggleFavorite = (id:string) => {
    const updated=favorites.includes(id)?favorites.filter(v=>v!==id):[id,...favorites].slice(0,30)
    setFavorites(updated)
    try {localStorage.setItem('spaktok.studio.favorites.v1',JSON.stringify(updated))}catch{}
  }

  const runAi = async (request?: string) => {
    const image = captureFrame()
    if (!image) return
    setAiState('working')
    setAiSummary(null)
    try {
      const response = await fetch('/api/ai/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, prompt: request || undefined, locale: language }),
      })
      if (!response.ok) throw new Error('ai-failed')
      const grade: Grade = await response.json()
      onChange(gradeToState(grade))
      setAiSummary(grade.summary)
      setAiState('idle')
    } catch {
      setAiState('error')
    }
  }

  const visiblePresets = category==='favorites'
    ? filterPresets.filter(p=>favorites.includes(p.id))
    : filterPresets.filter(p=>p.id==='original'||p.category===category)

  return (
    <div className="flex flex-col gap-3 rounded-t-3xl bg-black/75 pb-3 pt-3 backdrop-blur-xl">
      <div className="min-h-32 px-4">
        {tab === 'face' && (
          <div className="flex flex-col gap-3" dir="rtl">
            <div className="flex items-center justify-between">
              <div><p className="text-[10px] font-bold tracking-[.16em] text-[#a8beff]">SPAKTOK FACE AR</p>
              <p className="mt-1 text-xs text-white/65">أقنعة تتحرك مع وجهك أثناء التصوير</p></div>
              <ScanFace className="size-6 text-[#a5baff]" aria-hidden="true"/>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {faceFxCatalog.map(effect=>(
                <button type="button" key={effect.id}
                  onClick={()=>onChange({...state,face:{...state.face,id:effect.id}})}
                  aria-pressed={state.face.id===effect.id} aria-label={effect.name}
                  className="flex min-w-[78px] shrink-0 flex-col items-center gap-1.5">
                  <span className={cn('flex size-[68px] items-center justify-center rounded-[22px] border-2 bg-gradient-to-br text-3xl transition',
                    state.face.id===effect.id
                      ? 'border-[#b9caff] from-[#4764c3]/70 to-[#202c63] shadow-[0_8px_25px_rgba(87,126,246,.23)]'
                      : 'border-white/10 from-white/10 to-white/[.03]')}>{effect.icon}</span>
                  <span className={cn('max-w-[80px] text-center text-[11px]',
                    state.face.id===effect.id?'font-bold text-white':'text-white/60')}>{effect.name}</span>
                </button>
              ))}
            </div>
            {state.face.id!=='none'&&(
              <Slider label="قوة القناع" value={state.face.strength} min={0} max={1}
                onChange={strength=>onChange({...state,face:{...state.face,strength}})}/>
            )}
            <p className="text-[11px] leading-5 text-white/45">تعمل الأقنعة عند اكتشاف الوجه أمام الكاميرا. نقاط الوجه تُعالج على جهازك فقط.</p>
          </div>
        )}
        {tab === 'filters' && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-4 overflow-x-auto scrollbar-hide" role="tablist" aria-label="تصنيفات الفلاتر">
              <button onClick={()=>setCategory('favorites')} aria-pressed={category==='favorites'}
                className={cn('inline-flex shrink-0 items-center gap-1 text-xs font-semibold',category==='favorites'?'text-[#acc4ff]':'text-white/50')}>
                <Star className="size-3.5"/> المفضلة {favorites.length || ''}
              </button>
              {categories.map((value) => (
                <button
                  key={value}
                  onClick={() => setCategory(value)}
                  className={cn('shrink-0 text-xs font-semibold transition-colors', category === value ? 'text-white' : 'text-white/45')}
                  aria-pressed={category === value}
                >
                  {s(value)}
                </button>
              ))}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {visiblePresets.map((preset) => {
                const active = state.presetId === preset.id
                return (
                  <div key={preset.id} className="relative flex shrink-0 flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => selectPreset(preset.id)}
                    className="flex flex-col items-center gap-1.5"
                    aria-pressed={active}
                    aria-label={`فلتر ${preset.name}`}
                  >
                    <span
                      className={cn('relative flex h-14 w-14 items-center justify-center rounded-2xl border-2 transition-all', active ? 'border-white' : 'border-transparent')}
                      style={{ backgroundColor: preset.swatch }}
                    >
                      {active && <Check className="h-5 w-5 text-white drop-shadow" />}
                    </span>
                    <span className={cn('text-[11px]', active ? 'text-white' : 'text-white/60')}>{preset.name}</span>
                  </button>
                  {preset.id!=='original'&&
                    <button type="button" className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full border border-white/20 bg-[#0c1424]/90 text-[#b8c9ff]"
                      onClick={()=>toggleFavorite(preset.id)} aria-label={favorites.includes(preset.id)?'حذف من المفضلة':'حفظ في المفضلة'}
                      aria-pressed={favorites.includes(preset.id)}>
                      <Star className="size-3" fill={favorites.includes(preset.id)?'currentColor':'none'}/>
                    </button>}
                  </div>
                )
              })}
            </div>
            {category==='favorites'&&visiblePresets.length===0&&
              <p className="py-3 text-center text-xs text-white/50">اضغط النجمة بجانب أي فلتر ليظهر هنا.</p>}
            {recent.length>0&&category==='trending'&&
              <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap py-1">
                <Clock3 className="size-3.5 shrink-0 text-white/45"/>
                {recent.slice(0,4).map(id=><button type="button" key={id} onClick={()=>selectPreset(id)}
                  className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/75">{filterPresets.find(p=>p.id===id)?.name}</button>)}
              </div>}
            {state.presetId !== 'original' && (
              <Slider label={s('intensity')} value={state.intensity} min={0} max={1} onChange={(intensity) => onChange({ ...state, intensity })} />
            )}
          </div>
        )}

        {tab === 'adjust' && (
          <div className="grid max-h-44 grid-cols-1 gap-3 overflow-y-auto pe-1 sm:grid-cols-2">
            {colorSliders.map(({ key, min, max }) => (
              <Slider
                key={key}
                label={s(key)}
                value={state.color[key]}
                min={min}
                max={max}
                onChange={(value) => onChange({ ...state, color: { ...state.color, [key]: value } })}
              />
            ))}
          </div>
        )}

        {tab === 'beauty' && (
          <div className="grid max-h-44 grid-cols-1 gap-3 overflow-y-auto pe-1 sm:grid-cols-2">
            {beautySliders.map((key) => (
              <Slider
                key={key}
                label={s(key)}
                value={state.beauty[key]}
                min={0}
                max={1}
                onChange={(value) => onChange({ ...state, beauty: { ...state.beauty, [key]: value } })}
              />
            ))}
          </div>
        )}

        {tab === 'effects' && (
          <div className="flex max-h-48 flex-col gap-3 overflow-y-auto pe-1">
            <span className="text-xs font-semibold text-white/60">{s('background')}</span>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {backgroundModes.map((mode) => (
                <Chip
                  key={mode}
                  active={state.effects.background === mode}
                  onClick={() =>
                    onChange({
                      ...state,
                      effects: { ...state.effects, background: mode, backgroundBlur: mode === 'none' ? 0 : state.effects.backgroundBlur || 0.7 },
                    })
                  }
                >
                  {s(backgroundLabel[mode] as never)}
                </Chip>
              ))}
            </div>
            {state.effects.background !== 'none' && (
              <Slider
                label={s('strength')}
                value={state.effects.backgroundBlur}
                min={0}
                max={1}
                onChange={(backgroundBlur) => onChange({ ...state, effects: { ...state.effects, backgroundBlur } })}
              />
            )}
            <span className="text-xs font-semibold text-white/60">{s('cameraFx')}</span>
            <div className="grid grid-cols-4 gap-2">
              {fxList.map((fx) => (
                <Chip key={fx} active={state.effects.fx === fx} onClick={() => onChange({ ...state, effects: { ...state.effects, fx } })}>
                  {s(fxLabel[fx] as never)}
                </Chip>
              ))}
            </div>
            {state.effects.fx !== 'none' && (
              <Slider
                label={s('fxAmount')}
                value={state.effects.fxAmount}
                min={0}
                max={1}
                onChange={(fxAmount) => onChange({ ...state, effects: { ...state.effects, fxAmount } })}
              />
            )}
          </div>
        )}

        {tab === 'ai' && (
          <div className="flex flex-col gap-3">
            <p className="text-pretty text-xs leading-relaxed text-white/60">{aiSummary || s('aiHint')}</p>
            <button
              onClick={() => runAi()}
              disabled={aiState === 'working'}
              className="flex items-center justify-center gap-2 rounded-full bg-[#3155ff] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {aiState === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {aiState === 'working' ? s('aiWorking') : s('autoEnhance')}
            </button>
            <form
              className="flex items-center gap-2 rounded-full bg-white/10 ps-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (prompt.trim()) runAi(prompt.trim())
              }}
            >
              <input
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={s('aiPlaceholder')}
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/40"
                aria-label={s('aiPlaceholder')}
              />
              <button type="submit" disabled={aiState === 'working' || !prompt.trim()} className="m-1 flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40">
                <Sparkles className="h-3.5 w-3.5" />
                {s('aiApply')}
              </button>
            </form>
            {aiState === 'error' && <p className="text-xs text-[#ff6b6b]" role="alert">{s('aiFailed')}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-white/10 px-2 pt-2">
        <div className="flex flex-1 justify-around">
          {tabs.map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn('flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', tab === value ? 'bg-white text-black' : 'text-white/60')}
              aria-pressed={tab === value}
            >
              {value === 'ai' && <Sparkles className="h-3.5 w-3.5" />}
              {value === 'face' && <ScanFace className="h-3.5 w-3.5" />}
              {value === 'face' ? 'أقنعة الوجه' : s(value)}
            </button>
          ))}
        </div>
        <button onClick={() => onChange(createStudioState())} className="flex h-8 w-8 items-center justify-center rounded-full text-white/60" aria-label={s('reset')}>
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
