// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = {
  title: "サッカー、バスケ、バレー、陸上、スポーツのユニフォーム　お役立ちニュース！",
  description: "ユニフォーム担当者に役立つ場所。世界のユニフォームニュースを",
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header>
          <div className="container">
            <a href="/" className="site-title">チームユニフォームTeammaxニュース</a>
            <p className="site-desc">
              チームスポーツのユニフォーム情報
            </p>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer>
          <div className="container">
            <p>Teammax が運営するメディアです</p>
          </div>
        </footer>
      </body>
    </html>
  )
}
