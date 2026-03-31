import { getAllPosts } from '@/lib/posts'
import Link from 'next/link'

export default function Home() {
  const posts = getAllPosts()

  return (
    <>
      <h1 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: '#6b7280' }}>
        最新記事
      </h1>
      {posts.length === 0 ? (
        <p style={{ color: '#9ca3af' }}>記事がまだありません。しばらくお待ちください。</p>
      ) : (
        <div className="post-list">
          {posts.map(post => (
            <Link key={post.slug} href={`/posts/${encodeURIComponent(post.slug)}`} className="post-card">
              <h2>{post.title}</h2>
              <div className="post-meta">{post.published_at}</div>
              {post.one_comment && (
                <div className="post-comment">💬 {post.one_comment}</div>
              )}
              <div className="tags">
                {post.tags.map(t => <span key={t} className="tag">{t}</span>)}
                {post.industry_tags.map(t => <span key={t} className="tag industry">{t}</span>)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
