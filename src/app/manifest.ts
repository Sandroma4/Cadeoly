import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Cadéoly",
    short_name: "Cadéoly",
    description: "Les envies de chacun, le plaisir d’offrir ensemble.",
    start_url: "/",
    scope: "/",
    share_target: {
      action: "/fr/quick-add",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    display: "standalone",
    orientation: "any",
    lang: "fr",
    dir: "ltr",
    categories: ["lifestyle", "shopping"],
    prefer_related_applications: false,
    screenshots: [
      {
        src: "/screenshots/home-mobile-fr.jpg",
        sizes: "382x827",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "Accueil de Cadéoly sur mobile",
      },
      {
        src: "/screenshots/home-desktop-fr.jpg",
        sizes: "1272x795",
        type: "image/jpeg",
        form_factor: "wide",
        label: "Accueil de Cadéoly sur ordinateur",
      },
    ],
    shortcuts: [
      {
        name: "Mes listes de cadeaux",
        short_name: "Mes listes",
        url: "/fr/dashboard/wishlists",
      },
      {
        name: "Ajouter une envie",
        short_name: "Ajouter",
        url: "/fr/quick-add",
      },
    ],
    background_color: "#faf8f5",
    theme_color: "#6543be",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
