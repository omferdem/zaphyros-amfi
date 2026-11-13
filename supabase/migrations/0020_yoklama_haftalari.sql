-- 0020: Yoklama haftaları (yoklama şubeye bağlı, akıştan bağımsız)
--
-- Kullanıcı isteği (13 Kasım 2026): yoklama haftalık akışların içinde değil, sınıfın (şubenin) içinde olsun. Hoca şubede kaç
-- yoklama alacağını (ör. 15 hafta ya da 30 ders) belirler; hangi hafta derse girerse o haftanın yoklamasını açar, öğrenciler
-- karekodu okutur, sonra hoca akışa geçer. Bir akış iki hafta sürebilir, bir haftanın yoklaması hangi akıştan verilirse
-- verilsin aynıdır. Aynı gün o haftanın yoklaması yeniden açılırsa yeni gelenler aynı yoklamaya yazılır.
-- * courses.yoklama_sayisi: şubenin yoklama sayısı (1-60, varsayılan 15); courses.yoklama_birimi: 'hafta' ya da 'ders'.
-- * sessions.hafta_no: oturumun hangi yoklama haftasına ait olduğu (boşsa ek ders ya da yoklamasız oturum).
--   Bir şubede bir hafta numarası yalnızca bir oturumda bulunabilir; haftanın yoklaması yeniden açılırsa o oturum kullanılır.

alter table public.courses
  add column yoklama_sayisi smallint not null default 15 check (yoklama_sayisi between 1 and 60),
  add column yoklama_birimi text not null default 'hafta' check (yoklama_birimi in ('hafta', 'ders'));

alter table public.sessions
  add column hafta_no smallint check (hafta_no between 1 and 60);

create unique index sessions_hafta_tekil on public.sessions (course_id, hafta_no) where hafta_no is not null;
