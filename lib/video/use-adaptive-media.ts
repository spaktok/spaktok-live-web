'use client'

import { useEffect, useRef, useState } from 'react'
import { isHlsManifest } from './media-source'
import type Hls from 'hls.js'

/** Owns the HLS engine while a reel is active. MP4 stays a native video. */
export function useAdaptiveMedia(
  mediaRef: React.RefObject<HTMLVideoElement | null>,
  url: string,
  active: boolean,
  saveData: boolean,
  retrySerial: number,
  onReadyToPlay: () => void,
  onPlaybackFailure: () => void,
) {
  const [quality, setQuality] = useState<string | null>(null)
  const callbackRef = useRef({ onReadyToPlay, onPlaybackFailure })
  callbackRef.current = { onReadyToPlay, onPlaybackFailure }

  useEffect(() => {
    const media = mediaRef.current
    if (!media || !active || !isHlsManifest(url)) {
      setQuality(null)
      return
    }
    let disposed = false
    let engine: Hls | null = null
    const setNativeSource = () => {
      if (disposed) return
      media.src = url
      media.load()
      callbackRef.current.onReadyToPlay()
    }
    // Native HLS is generally less overhead on Apple platforms.
    const nativeHls = Boolean(media.canPlayType('application/vnd.apple.mpegurl'))
    const applePlatform = navigator.vendor.toLowerCase().includes('apple')
    if (nativeHls && applePlatform) {
      setQuality('Auto · HLS')
      setNativeSource()
    } else {
      void import('hls.js').then(({ default: HlsPlayer }) => {
        if (disposed) return
        if (!HlsPlayer.isSupported()) {
          if (nativeHls) {
            setQuality('Auto · HLS')
            setNativeSource()
          } else callbackRef.current.onPlaybackFailure()
          return
        }
        engine = new HlsPlayer({
          capLevelToPlayerSize: true,
          startLevel: saveData ? 0 : -1,
          maxBufferLength: saveData ? 4 : 8,
          maxMaxBufferLength: saveData ? 8 : 18,
          backBufferLength: 3,
          maxBufferSize: saveData ? 5_000_000 : 12_000_000,
          abrEwmaDefaultEstimate: saveData ? 450_000 : 1_500_000,
        })
        const current = engine
        current.on(HlsPlayer.Events.MANIFEST_PARSED, () => {
          if (!disposed) callbackRef.current.onReadyToPlay()
        })
        current.on(HlsPlayer.Events.LEVEL_SWITCHED, (_event, data) => {
          if (disposed) return
          const height = current.levels[data.level]?.height
          if (typeof height === 'number' && height > 0) setQuality(`${height}p · Auto`)
        })
        current.on(HlsPlayer.Events.ERROR, (_event, data) => {
          if (disposed || !data.fatal) return
          // No endless retry loop: show a recoverable error to the viewer.
          callbackRef.current.onPlaybackFailure()
        })
        current.attachMedia(media)
        current.loadSource(url)
      }).catch(() => {
        if (!disposed) {
          if (nativeHls) setNativeSource()
          else callbackRef.current.onPlaybackFailure()
        }
      })
    }

    return () => {
      disposed = true
      engine?.destroy()
      media.pause()
      media.removeAttribute('src')
      media.load()
    }
  }, [mediaRef, url, active, saveData, retrySerial])

  return { isAdaptive: isHlsManifest(url), quality }
}
