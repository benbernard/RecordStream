import { defineConfig } from "vitepress";

export default defineConfig({
  base: "/RecordStream/",
  title: "RecordStream",
  description: "Your data's new best friend — a toolkit for taming JSON streams",
  head: [
    ["link", { rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    ["link", { rel: "icon", type: "image/png", href: "/favicon.png" }],
  ],
  markdown: {
    config: (md) => {
      // RecordStream uses {{ }} extensively as its keyspec syntax in docs.
      // Vue tries to evaluate {{ }} as template interpolation, which breaks
      // rendering. We escape {{ and }} to HTML entities in inline content
      // so Vue's template compiler ignores them. Fenced code blocks are
      // already wrapped in v-pre by VitePress, so they're unaffected.
      function escapeMustache(str: string): string {
        return str
          .replace(/\{\{/g, "&#123;&#123;")
          .replace(/\}\}/g, "&#125;&#125;");
      }

      // Override text token rendering
      md.renderer.rules.text = (tokens, idx) => {
        const content = md.utils.escapeHtml(tokens[idx].content);
        return escapeMustache(content);
      };

      // Override inline code rendering
      md.renderer.rules.code_inline = (tokens, idx) => {
        const content = md.utils.escapeHtml(tokens[idx].content);
        return `<code>${escapeMustache(content)}</code>`;
      };
    },
  },
  themeConfig: {
    logo: "/logo-small.png",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Reference", link: "/reference/" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "The Pipeline Model", link: "/guide/pipeline" },
            { text: "Story", link: "/guide/story" },
            { text: "Examples", link: "/guide/examples" },
          ],
        },
        {
          text: "Concepts",
          items: [
            { text: "Snippets", link: "/guide/snippets" },
            { text: "Key Specs", link: "/guide/key-specs" },
            { text: "Key Groups", link: "/guide/key-groups" },
            { text: "Aggregators", link: "/guide/aggregators" },
          ],
        },
        {
          text: "Advanced",
          items: [
            { text: "Programmatic API", link: "/guide/programmatic-api" },
            { text: "Performance", link: "/guide/performance" },
            { text: "Cookbook", link: "/guide/cookbook" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Input Operations",
          collapsed: false,
          items: [
            { text: "Overview", link: "/reference/" },
            { text: "fromapache", link: "/reference/fromapache" },
            { text: "fromatomfeed", link: "/reference/fromatomfeed" },
            { text: "fromcsv", link: "/reference/fromcsv" },
            { text: "fromdb", link: "/reference/fromdb" },
            { text: "fromjsonarray", link: "/reference/fromjsonarray" },
            { text: "fromkv", link: "/reference/fromkv" },
            { text: "frommongo", link: "/reference/frommongo" },
            { text: "frommultire", link: "/reference/frommultire" },
            { text: "fromps", link: "/reference/fromps" },
            { text: "fromre", link: "/reference/fromre" },
            { text: "fromsplit", link: "/reference/fromsplit" },
            { text: "fromtcpdump", link: "/reference/fromtcpdump" },
            { text: "fromxferlog", link: "/reference/fromxferlog" },
            { text: "fromxml", link: "/reference/fromxml" },
          ],
        },
        {
          text: "Transform Operations",
          collapsed: false,
          items: [
            { text: "annotate", link: "/reference/annotate" },
            { text: "assert", link: "/reference/assert" },
            { text: "chain", link: "/reference/chain" },
            { text: "collate", link: "/reference/collate" },
            { text: "decollate", link: "/reference/decollate" },
            { text: "delta", link: "/reference/delta" },
            { text: "eval", link: "/reference/eval" },
            { text: "flatten", link: "/reference/flatten" },
            { text: "generate", link: "/reference/generate" },
            { text: "grep", link: "/reference/grep" },
            { text: "join", link: "/reference/join" },
            { text: "multiplex", link: "/reference/multiplex" },
            { text: "normalizetime", link: "/reference/normalizetime" },
            { text: "sort", link: "/reference/sort" },
            { text: "stream2table", link: "/reference/stream2table" },
            { text: "substream", link: "/reference/substream" },
            { text: "topn", link: "/reference/topn" },
            { text: "xform", link: "/reference/xform" },
          ],
        },
        {
          text: "Output Operations",
          collapsed: false,
          items: [
            { text: "tocsv", link: "/reference/tocsv" },
            { text: "todb", link: "/reference/todb" },
            { text: "togdgraph", link: "/reference/togdgraph" },
            { text: "tognuplot", link: "/reference/tognuplot" },
            { text: "tohtml", link: "/reference/tohtml" },
            { text: "tojsonarray", link: "/reference/tojsonarray" },
            { text: "toprettyprint", link: "/reference/toprettyprint" },
            { text: "toptable", link: "/reference/toptable" },
            { text: "totable", link: "/reference/totable" },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/benbernard/RecordStream" },
    ],
    search: {
      provider: "local",
    },
    footer: {
      message: "Released under the MIT License.",
    },
  },
});
