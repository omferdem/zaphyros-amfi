import { describe, expect, it } from 'vitest'
import { haftaNo } from './icerikPaketi'

describe('haftaNo', () => {
  it('akış adından hafta numarasını okur', () => {
    expect(haftaNo('5. hafta: Ruh')).toBe(5)
    expect(haftaNo('12 . Hafta Konu')).toBe(12)
  })
  it('numarasız adda null döner', () => {
    expect(haftaNo('Giriş akışı')).toBeNull()
    expect(haftaNo('Yarışma: 3. hafta')).toBeNull()
  })
})
