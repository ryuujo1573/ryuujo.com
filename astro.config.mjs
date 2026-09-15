// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders } from "astro/config";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import partytown from "@astrojs/partytown";

// https://astro.build/config
export default defineConfig({
  site: "https://ryuujo.com",

  experimental: {
    incrementalBuild: true,
  },
  integrations: [mdx(), sitemap(), react(), partytown()],

  fonts: [],

  vite: {
    plugins: [tailwindcss()],
  },
});
