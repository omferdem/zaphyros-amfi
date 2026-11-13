-- 0028: Akışa fotoğraf adımı
--
-- Hoca akışa fotoğraf ekler; perdede ve (telefon modunda) öğrencinin telefonunda video gibi gösterilir.
-- Fotoğraflar herkese açık okunabilir bir depoda durur: dosya yolu ders içeriğinin kimliği ve rastgele bir kimlikten oluşur
-- (tahmin edilemez); listeleme yetkisi yalnızca ilgili hocadadır. Yükleme ve silme yalnızca içeriğin sahibi hocaya açıktır.
-- Fotoğraf adımı mevcut "video" adım türünü kullanır (ayar.url bir fotoğraf adresidir); şema ve RPC'ler değişmez.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('etkinlik-fotograflari', 'etkinlik-fotograflari', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "hoca kendi fotograflarini okur" on storage.objects
  for select to authenticated
  using (bucket_id = 'etkinlik-fotograflari' and public.depo_dersi_benim(name));

create policy "hoca kendi fotograflarini yukler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'etkinlik-fotograflari' and public.depo_dersi_benim(name));

create policy "hoca kendi fotograflarini siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'etkinlik-fotograflari' and public.depo_dersi_benim(name));
