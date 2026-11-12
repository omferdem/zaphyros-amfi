import { describe, expect, it } from 'vitest'
import { videoAdresi, youtubeGomme } from './video'

describe('videoAdresi', () => {
  it('yalnızca https kabul eder', () => {
    expect(videoAdresi('https://example.com/v.mp4')).toBe('https://example.com/v.mp4')
    expect(videoAdresi('  https://youtu.be/abcdEFG1234  ')).toBe('https://youtu.be/abcdEFG1234')
    expect(videoAdresi('http://example.com/v')).toBeNull()
    expect(videoAdresi('javascript:alert(1)')).toBeNull()
    expect(videoAdresi('https://')).toBeNull()
    expect(videoAdresi('https://a b.com/x')).toBeNull()
  })
})

describe('youtubeGomme', () => {
  const beklenen = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'
  it('farklı YouTube biçimlerini gömme adresine çevirir', () => {
    expect(youtubeGomme('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(beklenen)
    expect(youtubeGomme('https://youtu.be/dQw4w9WgXcQ')).toBe(beklenen)
    expect(youtubeGomme('https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=x')).toBe(beklenen)
    expect(youtubeGomme('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(beklenen)
    expect(youtubeGomme('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(beklenen)
  })
  it('başlangıç saniyesini korur', () => {
    expect(youtubeGomme('https://youtu.be/dQw4w9WgXcQ?t=90')).toBe(beklenen + '&start=90')
  })
  it('YouTube olmayan ya da bozuk adresleri reddeder', () => {
    expect(youtubeGomme('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(youtubeGomme('https://www.youtube.com/watch?v=<script>')).toBeNull()
    expect(youtubeGomme('https://www.youtube.com/')).toBeNull()
    expect(youtubeGomme('bozuk')).toBeNull()
  })
})
