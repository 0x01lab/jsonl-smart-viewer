import '../index.css'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

const SITE_URL = 'https://0x01lab.github.io/jsonl-smart-viewer'
const SITE_TITLE = 'JSONL Smart Viewer — 高性能 JSONL 文件查看器'
const SITE_DESCRIPTION =
  '100% 浏览器本地运行的 JSONL 文件查看器。支持 GB 级文件、60fps 虚拟滚动、Rust WASM 解析、动态列提取、隐私安全。'
const OG_IMAGE = `${SITE_URL}/og-image.png`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: SITE_TITLE },
      { name: 'description', content: SITE_DESCRIPTION },
      { name: 'keywords', content: 'JSONL, JSON Lines, viewer, file viewer, WASM, Rust, virtual scroll, data viewer' },
      { name: 'author', content: '0x01lab' },
      { name: 'theme-color', content: '#0a0a0a' },
      // Open Graph
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:title', content: SITE_TITLE },
      { property: 'og:description', content: SITE_DESCRIPTION },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:locale', content: 'zh_CN' },
      { property: 'og:site_name', content: 'JSONL Smart Viewer' },
      // Twitter
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: SITE_TITLE },
      { name: 'twitter:description', content: SITE_DESCRIPTION },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
    links: [
      { rel: 'canonical', href: SITE_URL },
      { rel: 'icon', href: `${SITE_URL}/favicon.svg`, type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: `${SITE_URL}/apple-touch-icon.png` },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
