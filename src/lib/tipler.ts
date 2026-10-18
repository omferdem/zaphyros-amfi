export interface Ders {
  id: string
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
}

export interface Yoklama {
  session_id: string
  student_id: string
  yontem: 'qr' | 'elle'
  zaman: string
}
