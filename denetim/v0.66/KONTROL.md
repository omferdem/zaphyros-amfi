# v0.66 görsel kontrol

Otomatik ölçümler (taşma, araç çubuğu tek satır, çakışma, şık görünürlüğü, 40 px düğme) son koşuda ihlalsiz geçti (yoklama, slayt, uzun Zapoot sorusu, ejderha ve merdiven; projeksiyon, telefon 390 ve yatay). Tüm 10 oyun ve 8 ekran boyutunun tam koşusu bir önceki sürümde yapıldı; bu son düzeltmelerden sonra yalnızca yukarıdaki alt küme yeniden koşuldu.

Gözle bakılan dosyalar (diğerleri yalnızca otomatik ölçümle denetlendi, gözle bakılmadı):
- `slayt-metinli__projeksiyon.png`: slayt başlığı ve ilk satır tamamen görünür, araç şeridi slaydın üstünde ayrı, kod şeridi sağ kenarda dikey; metne değmiyor.
- `zapoot-uzun-soru__projeksiyon.png`: en uzun soru kutusuna sığıyor, süre halkası okunuyor.
- `yoklama__projeksiyon-tam.png`: şerit tek satır, karekod ve ders kodu ekranda; alt kısımda adres iki kez görünüyor (eski tasarım, dokunulmadı).
- `oyun-zombi-soru__projeksiyon.png`, `oyun-merdiven-soru__projeksiyon.png`: oyun alanı şeritlerin arasında; zombi sahnesi küçük kart olarak duruyor (eski tasarım).
- `oyun-ejderha-soru__projeksiyon.png`: alt kontrol şeridi sahneye binmiyor; kod şeridinde metin ve giriş karekodu görünüyor.
- `zapoot-uzun-soru__telefon-390.png`: kod şeridi telefonda kapalı başlıyor (önceki hâlde 148 px genişlikle soruyu eziyordu, düzeltildi).

Bilinen eksikler: oyun sahnelerinde karakter etiketleri ile şık çakışması yalnızca Zapoot (oyunsuz) görünümünde giderildi ve ölçüldü; telefon (öğrenci) tarafı bakılmadı. Kalem/lazer, etkinlik lobisi ve karekodla giriş otomatik testle ve canlıda denenmedi.
