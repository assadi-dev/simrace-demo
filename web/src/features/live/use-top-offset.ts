import { useCallback } from "react"

/**
 * Ref a poser sur un element : ecrit dans sa variable CSS `--top-offset` sa distance (px) au
 * haut du document. La mosaique et la vue en grand en deduisent la hauteur visible sous
 * l'en-tete (100svh - --top-offset), pour tenir dans la fenetre. Mise a jour quand la fenetre
 * ou la page change de taille (l'en-tete passe sur deux lignes, par exemple).
 * Ref fonction (React 19, avec nettoyage) : la mesure demarre quand l'element apparait, meme
 * apres un chargement. Pas d'etat React : rien ne se redessine.
 */
export function useTopOffset() {
  return useCallback((element: HTMLElement | null) => {
    if (!element) return
    const update = () => {
      const top = element.getBoundingClientRect().top + window.scrollY
      element.style.setProperty("--top-offset", `${Math.round(top)}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    window.addEventListener("resize", update)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [])
}
