"use client"
import { useState, useEffect } from "react"

const REPO = "inabat-tech/teammax_media"
const BRANCH = "main"

async function ghApi(pat, path, method = "GET", body = null) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: body ? JSON.stringify(body) : null,
  })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  return res.json()
}

async function getFile(pat, path) {
  const d = await ghApi(pat, path)
  return { content: decodeURIComponent(escape(atob(d.content.replace(/\n/g, "")))), sha: d.sha }
}

async function putFile(pat, path, content, sha, msg) {
  return ghApi(pat, path, "PUT", {
    message: msg,
    content: btoa(unescape(encodeURIComponent(content))),
    sha, branch: BRANCH,
  })
}

async function deleteFile(pat, path, sha, msg) {
  return ghApi(pat, path, "DELETE", { message: msg, sha, branch: BRANCH })
}

function parseFeeds(script) {
  const m = script.match(/RSS_FEEDS\s*=\s*\[([\s\S]*?)\]/)
  if (!m) return []
  const feeds = [], re = /\{"name":\s*"([^"]+)",\s*"url":\s*"([^"]+)"\}/g
  let hit
  while ((hit = re.exec(m[1])) !== null) feeds.push({ name: hit[1], url: hit[2] })
  return feeds
}

function serializeFeeds(script, feeds) {
  const block = feeds.map(f => `    {"name": "${f.name}", "url": "${f.url}"},`).join("\n")
  return script.replace(/RSS_FEEDS\s*=\s*\[[\s\S]*?\]/, `RSS_FEEDS = [\n${block}\n]`)
}

function parseMeta(content) {
  const fm = {}
  const m = content.match(/^---\n([\s\S]*?)\n---/)
  if (m) m[1].split("\n").forEach(line => {
    const i = line.indexOf(":")
    if (i === -1) return
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, "$1")
  })
  const sumM = content.match(/## 要約\n\n([\s\S]*?)\n\n## 編集部/)
  const comM = content.match(/## 編集部コメント\n\n> ([^\n]*)/)
  fm.summary = sumM ? sumM[1] : ""
  fm.comment = comM ? comM[1] : ""
  return fm
}

function applyEdit(content, title, summary, comment) {
  let r = content.replace(/^(---\n[\s\S]*?)title: "[^"]*"/, `$1title: "${title}"`)
  r = r.replace(/(## 要約\n\n)([\s\S]*?)(\n\n## 編集部)/, `$1${summary}$3`)
  r = r.replace(/(## 編集部コメント\n\n> )([^\n]*)/, `$1${comment}`)
  return r
}

export default function AdminPage() {
  const [pat, setPat] = useState("")
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState("posts")
  const [posts, setPosts] = useState([])
  const [feeds, setFeeds] = useState([])
  const [editing, setEditing] = useState(null)
  const [eTitle, setETitle] = useState("")
  const [eSummary, setESummary] = useState("")
  const [eComment, setEComment] = useState("")
  const [newName, setNewName] = useState("")
  const [newKw, setNewKw] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState("")
  const [htmlTitle, setHtmlTitle] = useState("")
  const [htmlDesc, setHtmlDesc] = useState("")
  const [siteTitle, setSiteTitle] = useState("")
  const [siteDesc, setSiteDesc] = useState("")

  const [running, setRunning] = useState(false)

  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 3500) }

  const runWorkflow = async () => {
    setRunning(true)
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/actions/workflows/fetch_news.yml/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${pat}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github+json",
          },
          body: JSON.stringify({ ref: BRANCH }),
        }
      )
      if (res.status === 204) {
        notify("✅ ワークフローを開始しました！1〜2分で記事が更新されます")
      } else {
        notify("❌ 実行に失敗しました（status: " + res.status + "）")
      }
    } catch (e) {
      notify("❌ " + e.message)
    }
    setRunning(false)
  }

  const login = async () => {
    setLoading(true)
    try { await ghApi(pat, "posts"); setAuthed(true) }
    catch { notify("❌ PATが無効です") }
    setLoading(false)
  }

  const loadPosts = async () => {
    setLoading(true)
    try {
      const files = (await ghApi(pat, "posts")).filter(f => f.name.endsWith(".md") && f.name !== ".gitkeep")
      const loaded = await Promise.all(files.map(async f => {
        const { content, sha } = await getFile(pat, `posts/${f.name}`)
        return { name: f.name, sha, content, ...parseMeta(content) }
      }))
      setPosts(loaded.sort((a, b) => b.name.localeCompare(a.name)))
    } catch (e) { notify("❌ " + e.message) }
    setLoading(false)
  }

  const loadFeeds = async () => {
    setLoading(true)
    try {
      const { content } = await getFile(pat, "scripts/fetch_and_summarize.py")
      setFeeds(parseFeeds(content))
    } catch (e) { notify("❌ " + e.message) }
    setLoading(false)
  }

  const loadSettings = async () => {
    setLoading(true)
    try {
      const { content } = await getFile(pat, "app/layout.tsx")
      const titleM = content.match(/title:\s*['"]([^'"]+)['"]/)
      const descM = content.match(/description:\s*['"]([^'"]+)['"]/)
      const siteTitleM = content.match(/className="site-title"[^>]*>([^<]+)<\/a>/)
      const siteDescM = content.match(/className="site-desc"[^>]*>\s*([^{<\/]+)/)
      setHtmlTitle(titleM ? titleM[1] : "")
      setHtmlDesc(descM ? descM[1] : "")
      setSiteTitle(siteTitleM ? siteTitleM[1].trim() : "")
      setSiteDesc(siteDescM ? siteDescM[1].trim().replace(/\s*\/\s*$/, "").trim() : "")
    } catch (e) { notify("❌ " + e.message) }
    setLoading(false)
  }

  const saveSettings = async () => {
    setLoading(true)
    try {
      const { content, sha } = await getFile(pat, "app/layout.tsx")
      let updated = content
      updated = updated.replace(/(title:\s*)['"][^'"]+['"]/, `$1"${htmlTitle}"`)
      updated = updated.replace(/(description:\s*)['"][^'"]+['"]/, `$1"${htmlDesc}"`)
      updated = updated.replace(/(className="site-title"[^>]*>)[^<]+(<\/a>)/, `$1${siteTitle}$2`)
      updated = updated.replace(/(className="site-desc"[^>]*>\s*)[^{<\/]+(\s*\/\s*{)/, `$1${siteDesc} $2`)
      await putFile(pat, "app/layout.tsx", updated, sha, "update: site settings")
      notify("✅ 保存しました！数分後にサイトに反映されます")
    } catch (e) { notify("❌ " + e.message) }
    setLoading(false)
  }

  useEffect(() => {
    if (!authed) return
    if (tab === "posts") loadPosts()
    else if (tab === "feeds") loadFeeds()
    else if (tab === "settings") loadSettings()
  }, [authed, tab])

  const savePost = async () => {
    setLoading(true)
    try {
      const updated = applyEdit(editing.content, eTitle, eSummary, eComment)
      await putFile(pat, `posts/${editing.name}`, updated, editing.sha, `edit: ${editing.name}`)
      notify("✅ 保存しました"); setEditing(null); await loadPosts()
    } catch (e) { notify("❌ " + e.message) }
    setLoading(false)
  }

  const delPost = async (p) => {
    if (!confirm(`「${p.title}」を削除しますか？`)) return
    setLoading(true)
    try {
      await deleteFile(pat, `posts/${p.name}`, p.sha, `delete: ${p.name}`)
      notify("🗑️ 削除しました"); await loadPosts()
    } catch (e) { notify("❌ " + e.message) }
    setLoading(false)
  }

  const saveFeeds = async (nf) => {
    const { content, sha } = await getFile(pat, "scripts/fetch_and_summarize.py")
    await putFile(pat, "scripts/fetch_and_summarize.py", serializeFeeds(content, nf), sha, "update: RSS feeds")
    setFeeds(nf)
  }

  const addFeed = async () => {
    if (!newName || (!newKw && !newUrl)) { notify("❌ 名前とURL/キーワードを入力してください"); return }
    setLoading(true)
    try {
      const url = newKw ? `https://news.google.com/rss/search?q=${encodeURIComponent(newKw)}&hl=ja&gl=JP&ceid=JP:ja` : newUrl
      await saveFeeds([...feeds, { name: newName, url }])
      setNewName(""); setNewKw(""); setNewUrl("")
      notify("✅ フィードを追加しました")
    } catch (e) { notify("❌ " + e.message) }
    setLoading(false)
  }

  const delFeed = async (i) => {
    if (!confirm(`「${feeds[i].name}」を削除しますか？`)) return
    setLoading(true)
    try { await saveFeeds(feeds.filter((_, j) => j !== i)); notify("🗑️ 削除しました") }
    catch (e) { notify("❌ " + e.message) }
    setLoading(false)
  }

  const iSt = { width:"100%", padding:"8px 10px", border:"1px solid #d1d5db", borderRadius:6, fontSize:13, boxSizing:"border-box" }
  const taSt = { ...iSt, resize:"vertical" }
  const btn = (c) => ({ background:c, color:"#fff", border:"none", borderRadius:6, padding:"7px 18px", cursor:"pointer", fontSize:13 })
  const lbl = { fontSize:12, color:"#6b7280", display:"block", marginBottom:4 }
  const card = { background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:"14px 18px", marginBottom:10 }
  const TABS = [["posts","📄 記事管理"],["feeds","📡 フィード管理"],["settings","⚙️ サイト設定"]]

  if (!authed) return (
    <div style={{ maxWidth:400, margin:"80px auto", padding:24, background:"#fff", borderRadius:12, border:"1px solid #e5e7eb" }}>
      <h1 style={{ fontSize:18, fontWeight:700, color:"#1e3a5f", marginBottom:4 }}>📧 管理画面</h1>
      <p style={{ fontSize:12, color:"#9ca3af", marginBottom:20 }}>GitHub PATでログイン</p>
      <input type="password" value={pat} onChange={e=>setPat(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&login()} placeholder="ghp_xxxxxxxxxxxx"
        style={{ ...iSt, marginBottom:12 }} />
      <button onClick={login} disabled={loading} style={btn("#3b82f6")}>{loading?"確認中...":"ログイン"}</button>
    </div>
  )

  return (
    <div style={{ maxWidth:860, margin:"0 auto", padding:"1.5rem", fontFamily:"sans-serif", fontSize:14 }}>
      {toast && <div style={{ position:"fixed", top:20, right:20, background:"#1e3a5f", color:"#fff", padding:"10px 18px", borderRadius:8, zIndex:999 }}>{toast}</div>}
      <div style={{ display:"flex", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:700, color:"#1e3a5f", margin:0 }}>📧 める配くん 管理画面</h1>
          <a href="/" style={{ fontSize:12, color:"#9ca3af" }}>← サイトに戻る</a>
        </div>
        <button onClick={()=>setAuthed(false)} style={{ marginLeft:"auto", background:"#f3f4f6", border:"none", borderRadius:6, padding:"6px 14px", cursor:"pointer", fontSize:12 }}>ログアウト</button>
      </div>

      <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"12px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:600, fontSize:13, color:"#166534" }}>🚀 ニュース取得・更新</div>
          <div style={{ fontSize:12, color:"#4ade80", color:"#15803d" }}>最新ニュースを今すぐ取得してサイトを更新します</div>
        </div>
        <button onClick={runWorkflow} disabled={running}
          style={{ background: running ? "#9ca3af" : "#16a34a", color:"#fff", border:"none", borderRadius:6, padding:"8px 20px", cursor: running ? "not-allowed" : "pointer", fontSize:13, fontWeight:600, whiteSpace:"nowrap" }}>
          {running ? "⏳ 実行中..." : "▶ 今すぐ実行"}
        </button>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {TABS.map(([t,label])=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:"8px 18px", borderRadius:6, border:"none", cursor:"pointer", fontSize:13, background:tab===t?"#3b82f6":"#f3f4f6", color:tab===t?"#fff":"#374151", fontWeight:tab===t?700:400 }}>{label}</button>
        ))}
      </div>

      {tab==="posts" && !editing && <>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <span style={{ fontWeight:600 }}>記事一覧（{posts.length}件）</span>
          <button onClick={loadPosts} disabled={loading} style={{ background:"#f3f4f6", border:"none", borderRadius:6, padding:"4px 12px", cursor:"pointer", fontSize:12 }}>🔄 更新</button>
        </div>
        {loading && <p style={{ color:"#9ca3af" }}>読み込み中...</p>}
        {posts.map(p=>(
          <div key={p.name} style={card}>
            <div style={{ fontWeight:600, color:"#1e3a5f", marginBottom:2 }}>{p.title}</div>
            <div style={{ fontSize:11, color:"#9ca3af", marginBottom:8 }}>{p.published_at} · {p.name}</div>
            {p.summary && <div style={{ fontSize:12, color:"#4b5563", marginBottom:8 }}>{String(p.summary).slice(0,100)}...</div>}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>{setEditing(p);setETitle(p.title||"");setESummary(p.summary||"");setEComment(p.comment||"")}} style={btn("#3b82f6")}>✏️ 編集</button>
              <button onClick={()=>delPost(p)} style={btn("#ef4444")}>🗑️ 削除</button>
            </div>
          </div>
        ))}
      </>}

      {tab==="posts" && editing && (
        <div style={card}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
            <span style={{ fontWeight:700, fontSize:15 }}>記事を編集</span>
            <button onClick={()=>setEditing(null)} style={{ marginLeft:"auto", background:"#f3f4f6", border:"none", borderRadius:6, padding:"5px 14px", cursor:"pointer", fontSize:12 }}>← 戻る</button>
          </div>
          <div style={{ fontSize:11, color:"#9ca3af", marginBottom:12 }}>{editing.name}</div>
          <div style={{ marginBottom:14 }}><label style={lbl}>タイトル</label><input value={eTitle} onChange={e=>setETitle(e.target.value)} style={iSt} /></div>
          <div style={{ marginBottom:14 }}><label style={lbl}>要約</label><textarea value={eSummary} onChange={e=>setESummary(e.target.value)} rows={5} style={taSt} /></div>
          <div style={{ marginBottom:16 }}><label style={lbl}>編集部コメント</label><input value={eComment} onChange={e=>setEComment(e.target.value)} style={iSt} /></div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={savePost} disabled={loading} style={btn("#3b82f6")}>{loading?"保存中...":"💾 保存"}</button>
            <button onClick={()=>setEditing(null)} style={{ background:"#f3f4f6", border:"none", borderRadius:6, padding:"7px 16px", cursor:"pointer", fontSize:13 }}>キャンセル</button>
          </div>
        </div>
      )}

      {tab==="feeds" && <>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <span style={{ fontWeight:600 }}>RSSフィード（{feeds.length}件）</span>
          <button onClick={loadFeeds} disabled={loading} style={{ background:"#f3f4f6", border:"none", borderRadius:6, padding:"4px 12px", cursor:"pointer", fontSize:12 }}>🔄 更新</button>
        </div>
        {loading && <p style={{ color:"#9ca3af" }}>読み込み中...</p>}
        {feeds.map((f,i)=>(
          <div key={i} style={{ ...card, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600, color:"#1e3a5f" }}>{f.name}</div>
              <div style={{ fontSize:11, color:"#9ca3af", wordBreak:"break-all" }}>{f.url}</div>
            </div>
            <button onClick={()=>delFeed(i)} style={btn("#ef4444")}>🗑️</button>
          </div>
        ))}
        <div style={{ ...card, marginTop:20 }}>
          <div style={{ fontWeight:600, marginBottom:14 }}>➕ フィードを追加</div>
          <div style={{ marginBottom:10 }}><label style={lbl}>フィード名</label><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="例：Google News メール配信" style={iSt} /></div>
          <div style={{ marginBottom:10 }}><label style={lbl}>Google Newsキーワード（URLを自動生成）</label><input value={newKw} onChange={e=>setNewKw(e.target.value)} placeholder="例：メール配信 開封率" style={iSt} /></div>
          <div style={{ marginBottom:12 }}><label style={lbl}>または RSS URLを直接入力</label><input value={newUrl} onChange={e=>setNewUrl(e.target.value)} placeholder="https://example.com/feed/" style={iSt} /></div>
          {newKw && <div style={{ fontSize:11, color:"#3b82f6", marginBottom:10 }}>生成URL: https://news.google.com/rss/search?q={encodeURIComponent(newKw)}&hl=ja&gl=JP&ceid=JP:ja</div>}
          <button onClick={addFeed} disabled={loading} style={btn("#3b82f6")}>{loading?"追加中...":"➕ 追加する"}</button>
        </div>
      </>}

      {tab==="settings" && (
        <div style={card}>
          <div style={{ display:"flex", alignItems:"center", marginBottom:20 }}>
            <span style={{ fontWeight:700, fontSize:15 }}>⚙️ サイト設定</span>
            <button onClick={loadSettings} disabled={loading} style={{ marginLeft:"auto", background:"#f3f4f6", border:"none", borderRadius:6, padding:"4px 12px", cursor:"pointer", fontSize:12 }}>🔄 再読み込み</button>
          </div>
          {loading && <p style={{ color:"#9ca3af" }}>読み込み中...</p>}
          <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:6, padding:"10px 14px", marginBottom:20, fontSize:12, color:"#92400e" }}>
            ⚠️ 保存するとVercelが自動デプロイされ、数分後に反映されます
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ ...lbl, fontWeight:600, color:"#374151", marginBottom:6 }}>📄 HTMLタイトル（ブラウザのタブ）</label>
            <input value={htmlTitle} onChange={e=>setHtmlTitle(e.target.value)} placeholder="例：める配くん メディア" style={iSt} />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ ...lbl, fontWeight:600, color:"#374151", marginBottom:6 }}>📝 メタディスクリプション（検索結果の説明）</label>
            <textarea value={htmlDesc} onChange={e=>setHtmlDesc(e.target.value)} rows={3} placeholder="例：メール担当者が賢くなれる場所。" style={taSt} />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ ...lbl, fontWeight:600, color:"#374151", marginBottom:6 }}>🏷️ サイトタイトル（ヘッダー）</label>
            <input value={siteTitle} onChange={e=>setSiteTitle(e.target.value)} placeholder="例：📧 める配くん メディア" style={iSt} />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ ...lbl, fontWeight:600, color:"#374151", marginBottom:6 }}>💬 サイト説明文（ヘッダー下）</label>
            <input value={siteDesc} onChange={e=>setSiteDesc(e.target.value)} placeholder="例：メール担当者が賢くなれる場所" style={iSt} />
          </div>
          <button onClick={saveSettings} disabled={loading} style={btn("#3b82f6")}>{loading?"保存中...":"💾 サイト設定を保存"}</button>
        </div>
      )}
    </div>
  )
}
