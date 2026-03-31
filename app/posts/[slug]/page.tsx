import { getAllPosts, getPost } from '@/lib/posts'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  return getAllPosts().map(p => ({ slug: encodeURIComponent(p.slug) }))
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  // URLデコードしてファイル名に戻す
  const slug = decodeURIComponent(params.slug)
  try {
    const { meta, html } = await getPost(slug)
    return (
      <>
        <Link href="/" className="back-link">← 一覧に戻る</Link>
        <article className="post-detail">
          <h1>{meta.title}</h1>
          <div className="post-meta" style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
            {meta.published_at}
          </div>
          <div className="tags" style={{ marginBottom: '1rem' }}>
            {(meta.tags ?? []).map((t: string) => <span key={t} className="tag">{t}</span>)}
            {(meta.industry_tags ?? []).map((t: string) => <span key={t} className="tag industry">{t}</span>)}
          </div>
          <div className="post-body" dangerouslySetInnerHTML={{ __html: html }} />
          <div className="service-banner">
            📧 このメディアは <a href="https://www.meruhaikun.com/" target="_blank" rel="noopener noreferrer">メール配信システム「める配くん」</a> が運営しています。中小企業のメール配信・MA・CRMをシンプルに。
          </div>
        </article>
      </>
    )
  } catch {
    notFound()
  }
}
