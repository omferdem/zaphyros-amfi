/** Akademik dönem (ör. "2026-2027 Güz"). Gelecek dönemler önceden açılabilir. */
export interface Donem {
  id: string
  ad: string
  baslangic: string
}

/** Bir dönemdeki ders şubesi: kendi sınıf listesi, oturumları ve yoklaması vardır. */
export interface Ders {
  id: string
  subject_id: string
  term_id: string
  ad: string
  kod: string | null
  donem: string | null
  sube: string | null
  /** Şubenin kaç yoklama (hafta ya da ders) alacağı ve birimi */
  yoklama_sayisi?: number
  yoklama_birimi?: 'hafta' | 'ders'
  olusturuldu: string
}

/** Hafta planında bir şubenin bir akışla yaptığı oturum (şube x hafta özeti). */
export interface PlanSatiri {
  course_id: string
  lesson_id: string
  oturum_id: string
  basladi: string
  katilan: number
  mevcut: number
}

export interface Ogrenci {
  id: string
  course_id: string
  ogrenci_no: string
  ad_soyad: string
  /** Misafir öğrencide: asıl kaydın (başka şubedeki) kimliği */
  asil_id?: string | null
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
  telefon_modu: boolean
  /** Oturumun ait olduğu yoklama haftası (boşsa ek ders ya da yoklamasız oturum) */
  hafta_no?: number | null
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
  gorseller_hazir: boolean
  olusturuldu: string
}

export interface Akis {
  id: string
  subject_id: string
  ad: string
  sira: number
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

export type AdimTuru = 'yoklama' | 'slayt' | 'soru' | 'fikir' | 'oylama' | 'video' | 'oyun'

/** Etkinlik adımlarının ayarı: fikir ve oylamada soru, oylamada iki etiket, videoda adres ve başlık. */
export interface AdimAyari {
  soru?: string
  etiketler?: string[]
  url?: string
  baslik?: string
  /** Oyun adımında: 'takim' | 'halat' | 'hoca' | 'merdiven' */
  oyun?: string
  aciklama?: string
  /** Fikir ve oylama adımında cevap süresi (saniye); yoksa süresiz */
  sure_sn?: number
  /** Fikir adımının kipi: 'bulut' (varsayılan), 'firtina' ya da 'acik' */
  mod?: 'bulut' | 'firtina' | 'acik'
  /** Metin kartı: adresi olmayan video adımı; metin baslik alanında durur */
  kart?: boolean
  /** Hocanın bu adım için notu (yalnızca düzenleme ekranında görünür) */
  not?: string
}

export interface Adim {
  id: string
  lesson_id: string
  sira: number
  tur: AdimTuru
  presentation_id: string | null
  sayfa_no: number | null
  question_id: string | null
  ayar: AdimAyari
}

/** Öğrenci ve kumandanın gördüğü ders durumu (ders_durumu / kumanda_durumu RPC'leri). */
export interface DersDurumu {
  ders: string
  baslik: string | null
  bitti: boolean
  yoklama_acik: boolean
  telefon_modu?: boolean
  adim: {
    id: string
    tur: AdimTuru
    sira: number
    toplam: number
    sunum: string | null
    sayfa_no: number | null
    sayfa_sayisi: number | null
    metin: string | null
    /** Telefon modunda slayt görselinin depo yolu */
    gorsel?: string | null
    // Soru adımında
    soru?: string
    secenekler?: string[]
    sure_sn?: number
    soru_durum?: 'acik' | 'sonuc' | null
    kalan_ms?: number | null
    cevap_sayisi?: number
    dogru_index?: number | null
    dagilim?: number[] | null
    // Beyin fırtınası, oylama ve video adımlarında (soru, soru_durum ve cevap_sayisi alanları ortaktır)
    video?: string | null
    fikirler?: { m: string; n: number }[]
    /** Fikir adımının kipi: kelime bulutu, beyin fırtınası ya da açık uçlu soru */
    mod?: 'bulut' | 'firtina' | 'acik'
    /** Açık uçlu soruda cevaplar hoca yansıtana kadar perdeye gönderilmez */
    gizli_cevap?: boolean
    etiketler?: string[]
    /** Oylamada sonuç açıklanınca [sol, sağ] oy sayısı */
    sayilar?: number[] | null
    gerekceler?: { t: number; m: string }[] | null
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
  /** Başka şubede misafir olarak katıldığı için bu şubenin oturumunda var sayılan kayıt (gerçek kayıt değil) */
  baska_sube?: boolean
}
