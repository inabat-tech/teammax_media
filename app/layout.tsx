// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "メールマーケティング　お役立ちニュース！",
  description: "メール担当者が賢くなれる場所。メール配信・MA・CRM の最新情報をわかりやすく。",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header>
          <div className="container">
            <a href="/" className="site-title">メール配信、MA,CRM周りのデジタルマーケティングに役立つニュース</a>
            <p className="site-desc">
              メール担当者が賢くなれる場所 ／{' '}
              <a href="https://www.meruhaikun.com/" target="_blank" rel="noopener noreferrer" className="service-link">
                メール配信システム「める配くん」
              </a>
            </p>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer>
          <div className="container">
            <p>
              <a href="https://www.meruhaikun.com/" target="_blank" rel="noopener noreferrer" className="service-link">
                メール配信システム「める配くん」
              </a>
              {' '}が運営するメディアです
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
