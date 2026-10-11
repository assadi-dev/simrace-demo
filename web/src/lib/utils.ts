import { createCn } from "cn/config"

/*
 * Fusion de classes Tailwind. Les tailles de texte du design system (index.css, design.md 4)
 * doivent etre declarees : sinon `text-badge` et `text-success-text` passent pour deux couleurs
 * en conflit et la taille est supprimee. Importer `cn` d'ici, jamais du paquet (regle ESLint).
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "metric",
            "page-title",
            "metric-sm",
            "brand",
            "card-title",
            "nav",
            "label",
            "caption",
            "table-head",
            "badge",
            "meta",
            "micro",
            "eyebrow",
          ],
        },
      ],
    },
  },
})
