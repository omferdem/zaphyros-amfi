-- TEST-BOT derslerinin bot verilerini siler (SQL Editor'de çalıştırılır). Gerçek şubelere dokunmaz.
delete from public.responses where session_id in (select s.id from public.sessions s join public.courses c on c.id = s.course_id where c.ad like 'TEST-BOT%');
delete from public.session_players where session_id in (select s.id from public.sessions s join public.courses c on c.id = s.course_id where c.ad like 'TEST-BOT%');
