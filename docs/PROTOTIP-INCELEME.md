# Gemini Prototipi İncelemesi

Dosya: `docs/prototip-gemini.html` (AmfiOS Studio v6.0). İnceleme tarihi: 18 Ekim 2026.

## Sonuç

Görsel bir prototip. Arayüz dili ve modül fikirleri değerli, kod temel alınmayacak. Tüm sistem tek tarayıcıda simüle edilmiş; öğrenci "telefonu" aynı sayfadaki bir çizim. Gerçek sistem için hoca ekranı, öğrenci cihazları ve aradaki sunucu ayrı ayrı kurulmalı.

## Açılışta çöken yerler
- Script sonunda `init()` çağrılıyor ama tanımlı değil; sayfa ilk anda hata verip boş kalıyor.
- `updateAttendanceWidgets()` sayfada olmayan `headerAttendanceCount` öğesine yazıyor; "VAR" butonu hata veriyor.
- "+ Hafta Ekle" ile eklenen haftada soru listesi boş; quiz adımında `% 0` hatası.

## Eksik ya da sahte çalışan kısımlar
- QR kod üretilmiyor.
- Quiz'de doğru/yanlış kontrolü ve puan yok; her şıkta başarı sesi çalıyor.
- Kovalamaca oyununda Başlat/Durdur hiçbir şeyi değiştirmiyor; hoca karakteri hareket etmiyor.
- Video, Beyin Fırtınası, Şeytanın Avukatı, Halat Çekme yalnızca başlık gösteriyor.
- PPTX: görseller alınmıyor, slayt sırası garanti değil (slide10 < slide2), slayt geçişi yok.
- XLSX ve mammoth kütüphaneleri yükleniyor ama kullanılmıyor; sınıf listesi tablosu doldurulmuyor.
- Tailwind CDN ve `lucide@latest` üretim için uygun değil (sürüm sabit değil).

## Korunacak fikirler
- Koyu, cam efektli arayüz dili
- Haftalık müfredat şeridi ve 8 adımlı ders senaryosu
- Web Audio API ile dosyasız ses efektleri
- Modüller: QR yoklama, slayt, video, beyin fırtınası, şeytanın avukatı, quiz, halat çekme, kovalamaca
