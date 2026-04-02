"""
める配くん メディア - RSSニュース取得・要約スクリプト
"""

import os, json, hashlib, requests, re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

CLAUDE_API_KEY = os.environ["CLAUDE_API_KEY"]
OUTPUT_DIR = Path("posts")
MAX_ARTICLES = 10
JST = timezone(timedelta(hours=9))

RSS_FEEDS = [
    {"name": "Google News MA", "url": "https://news.google.com/rss/search?q=marketing+automation&hl=en-US&gl=US&ceid=US:en"},
    {"name": "Google News JP", "url": "https://news.google.com/rss/search?q=%E3%83%A1%E3%83%BC%E3%83%AB%E3%83%9E%E3%83%BC%E3%82%B1%E3%83%86%E3%82%A3%E3%83%B3%E3%82%B0&hl=ja&gl=JP&ceid=JP:ja"},
    {"name": "MarTech", "url": "https://martech.org/feed/"},
    {"name": "Litmus", "url": "https://www.litmus.com/blog/feed/"},
    {"name": "Google News メール配信", "url": "https://news.google.com/rss/search?q=%E3%83%A1%E3%83%BC%E3%83%AB%E9%85%8D%E4%BF%A1&hl=ja&gl=JP&ceid=JP:ja"},
    {"name": "Google News MAツール", "url": "https://news.google.com/rss/search?q=MA%E3%83%84%E3%83%BC%E3%83%AB&hl=ja&gl=JP&ceid=JP:ja"},
    {"name": "ユニフォーム関連Google NewsJP", "url": "https://news.google.com/rss/search?q=%E3%82%B5%E3%83%83%E3%82%AB%E3%83%BC%E3%83%A6%E3%83%8B%E3%83%95%E3%82%A9%E3%83%BC%E3%83%A0%2C%E3%83%90%E3%82%B9%E3%82%B1%E3%83%A6%E3%83%8B%E3%83%95%E3%82%A9%E3%83%BC%E3%83%A0%2C%E3%83%90%E3%83%AC%E3%83%BC%E3%83%9C%E3%83%BC%E3%83%AB%E3%83%A6%E3%83%8B%E3%83%95%E3%82%A9%E3%83%BC%E3%83%A0%2C%E3%83%A9%E3%82%B0%E3%83%93%E3%83%BC%E3%82%B8%E3%83%A3%E3%83%BC%E3%82%B8%2C%E3%83%80%E3%83%B3%E3%82%B9%E3%83%A6%E3%83%8B%E3%83%95%E3%82%A9%E3%83%BC%E3%83%A0%2C%E9%99%B8%E4%B8%8A%E3%83%A6%E3%83%8B%E3%83%95%E3%82%A9%E3%83%BC%E3%83%A0&hl=ja&gl=JP&ceid=JP:ja"},
]


def fetch_rss(feed):
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        res = requests.get(feed["url"], headers=headers, timeout=15)
        res.raise_for_status()
        root = ET.fromstring(res.content)
    except Exception as e:
        print("  [skip] " + feed["name"] + ": " + str(e))
        return []
    articles = []
    for item in root.findall(".//item")[:3]:
        def g(tag):
            el = item.find(tag)
            return el.text.strip() if el is not None and el.text else ""
        title = g("title")
        link = g("link") or g("guid")
        desc = re.sub(r"<[^>]+>", "", g("description") or "")[:600]
        if title and link:
            articles.append({
                "title": title, "url": link,
                "description": desc, "source": feed["name"]
            })
    print("  [" + feed["name"] + "] " + str(len(articles)) + " items")
    return articles


def fetch_all():
    all_a = []
    seen = set()
    for feed in RSS_FEEDS:
        for a in fetch_rss(feed):
            if a["url"] not in seen:
                seen.add(a["url"])
                all_a.append(a)
    print("\n[total] " + str(len(all_a)) + " articles")
    return all_a[:MAX_ARTICLES]


def build_prompt(article):
    title = article.get("title", "")
    content = article.get("description", "")
    source = article.get("source", "")
    json_example = '{"ja_title":"30文字以内タイトル","summary":"3文の要約","tags":["タグ1","タグ2"],"industry_tags":["全業種"],"one_comment":"一言50文字以内"}'
    return (
        "あなたはメール配信SaaSのメディア編集アシスタントです。\n"
        "読者は中小企業のメール担当者です。以下の記事をJSONで要約してください。\n\n"
        "タイトル: " + title + "\n"
        "概要: " + content + "\n"
        "ソース: " + source + "\n\n"
        "JSONのみ返してください（前置き不要）:\n"
        + json_example
    )


def summarize(article):
    prompt = build_prompt(article)
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 500,
        "messages": [{"role": "user", "content": prompt}],
    }
    try:
        res = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers, json=body, timeout=30
        )
        if not res.ok:
            print("  [err] " + str(res.status_code) + ": " + res.text[:100])
            return None
        raw = res.json()["content"][0]["text"].strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        result = json.loads(raw)
        print("  [ok] " + result.get("ja_title", ""))
        return result
    except Exception as e:
        print("  [err] " + str(e))
        return None


def save(article, result, idx):
    OUTPUT_DIR.mkdir(exist_ok=True)
    date_str = datetime.now(JST).strftime("%Y-%m-%d")
    url_hash = hashlib.md5(article.get("url", str(idx)).encode()).hexdigest()[:8]
    slug = date_str + "-" + str(idx).zfill(3) + "-" + url_hash
    filename = OUTPUT_DIR / (slug + ".md")
    if filename.exists():
        print("  [skip] " + filename.name)
        return
    md_lines = [
        "---",
        'title: "' + result.get("ja_title", "") + '"',
        'original_url: "' + article.get("url", "") + '"',
        'source: "' + article.get("source", "") + '"',
        'published_at: "' + date_str + '"',
        "tags: " + json.dumps(result.get("tags", []), ensure_ascii=False),
        "industry_tags: " + json.dumps(result.get("industry_tags", []), ensure_ascii=False),
        "---",
        "",
        "## 要約",
        "",
        result.get("summary", ""),
        "",
        "## 編集部コメント",
        "",
        "> " + result.get("one_comment", ""),
        "",
        "---",
        "",
        "[原文を読む](" + article.get("url", "") + ")",
    ]
    filename.write_text("\n".join(md_lines), encoding="utf-8")
    print("  [saved] " + filename.name)


def main():
    print("=== める配くん start ===")
    articles = fetch_all()
    saved = 0
    for i, article in enumerate(articles):
        print("\n[" + str(i+1) + "/" + str(len(articles)) + "] " + article.get("title", "")[:50])
        result = summarize(article)
        if result:
            save(article, result, i + 1)
            saved += 1
    print("\n=== done: " + str(saved) + " saved ===")


if __name__ == "__main__":
    main()
