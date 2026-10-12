import { useLayoutEffect, type RefObject } from "react"

/**
 * Ecrit dans la variable CSS `--grid-top` de l'element sa distance (px) au haut du document.
 * La mosaique en deduit la hauteur visible sous l'en-tete (100svh - --grid-top). Mise a jour
 * quand la fenetre ou la page change de taille (l'en-tete passe sur deux lignes, par exemple).
 * Pas d'etat React : rien ne se redessine.
 */
export function useGridTop(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      const top = element.getBoundingClientRect().top + window.scrollY
      element.style.setProperty("--grid-top", `${Math.round(top)}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    window.addEventListener("resize", update)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [ref])
}
