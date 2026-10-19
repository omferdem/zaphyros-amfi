export interface Ders {
  id: string
  subject_id: string
  ad: string
  kod: string | null
  donem: string | null
  olusturuldu: string
}

export interface Ogrenci {
  id: string
  course_id: string
  ogrenci_no: string
  ad_soyad: string
}

export interface Oturum {
  id: string
  course_id: string
  baslik: string | null
  yoklama_acik: boolean
  basladi: string
  bitti: string | null
  lesson_id: string | null
  aktif_adim: string | null
  soru_durum: 'acik' | 'sonuc' | null
}

/** Dönemler arasında ortak ders içeriği: akışlar ve sunumlar buna bağlıdır. */
export interface Icerik {
  id: string
  ad: string
}

export interface Sunum {
  id: string
  subject_id: string
  ad: string
  kaynak: 'pdf' | 'pptx' | 'ppt'
  durum: 'hazir' | 'cevriliyor' | 'hata'
  sayfa_sayisi: number
  metinler: string[]
  olusturuldu: string
}

export interface Akis {
  id: string
  subject_id: string
  ad: string
  olusturuldu: string
}

export interface Soru {
  id: string
  subject_id: string
  soru: string
  dogru: string
  yanlislar: string[]
  sure_sn: number
  ek: Record<string, string>
  olusturuldu: string
}

export type AdimTuru = 'yoklama' | 'slayt' | 'soru'

export interface Adim {
  id: string
  lesson_id: string
  sira: number
  tur: AdimTuru
  presentation_id: string | null
  sayfa_no: number | null
  question_id: string | null
}

/** Öğrenci ve kumandanın gördüğü ders durumu (ders_durumu / kumanda_durumu RPC'leri). */
export interface DersDurumu {
  ders: string
  baslik: string | null
  bitti: boolean
  yoklama_acik: boolean
  adim: {
    id: string
    tur: AdimTuru
    sira: number
    toplam: number
    sunum: string | null
    sayfa_no: number | null
    sayfa_sayisi: number | null
    metin: string | null
    // Soru adımında
    soru?: string
    secenekler?: string[]
    sure_sn?: number
    soru_durum?: 'acik' | 'sonuc' | null
    kalan_ms?: number | null
    cevap_sayisi?: number
    dogru_index?: number | null
    dagilim?: number[] | null
  } | null
}

export interface PuanSatiri {
  ad: string
  puan: number
  dogru: number
  sira: number
}

export interface Yoklama {
  session_id: string
  student_id: string
  yontem: 'qr' | 'elle'
  zaman: string
}
