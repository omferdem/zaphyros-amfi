/** Ekranın sol altında duran, tıklanmayan altın sarısı "zaphyros" marka yazısı. */
export default function Marka() {
  return (
    <div aria-hidden className="pointer-events-none fixed bottom-2 left-3 z-10 select-none">
      <span className="marka-yazi text-[10px] sm:text-xs">zaphyros</span>
    </div>
  )
}
