import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkHtml from 'remark-html'

const postsDir = path.join(process.cwd(), 'posts')

export type PostMeta = {
  slug: string
  title: string
  published_at: string
  tags: string[]
  industry_tags: string[]
  relevance: string
  one_comment?: string
}

export function getAllPosts(): PostMeta[] {
  if (!fs.existsSync(postsDir)) return []

  const files = fs.readdirSync(postsDir)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'))

  return files.map(filename => {
    const slug = filename.replace(/\.md$/, '')
    const raw = fs.readFileSync(path.join(postsDir, filename), 'utf8')
    const { data } = matter(raw)
    return {
      slug,
      title:         data.title         ?? slug,
      published_at:  data.published_at  ?? '',
      tags:          data.tags          ?? [],
      industry_tags: data.industry_tags ?? [],
      relevance:     data.relevance     ?? 'medium',
      one_comment:   data.one_comment,
    }
  }).sort((a, b) => b.published_at.localeCompare(a.published_at))
}

export async function getPost(slug: string) {
  const filepath = path.join(postsDir, `${slug}.md`)
  const raw = fs.readFileSync(filepath, 'utf8')
  const { data, content } = matter(raw)

  const processed = await remark().use(remarkHtml).process(content)
  const html = processed.toString()

  return { meta: data as PostMeta & { original_url?: string; original_title?: string }, html }
}
