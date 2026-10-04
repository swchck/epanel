// A deliberately small Markdown subset for notes and instructions: emphasis, code, links, lists
// and paragraphs. Hand-rolled because full parsers cost 30+ KB and would still need a sanitizer;
// here the source is escaped first, so the only HTML in the output is the tags emitted below.

const SAFE_HREF = /^(https?:|mailto:|tel:)/i

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function emphasis(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_(?!\s)(.+?)_(?!\w)/g, '$1<em>$2</em>')
}

function inline(s: string): string {
  // code spans and URLs are parked behind placeholders so emphasis never reaches inside them
  const parked: string[] = []
  const park = (html: string) => `\uE000${parked.push(html) - 1}\uE000`
  const html = escape(s)
    .replace(/`([^`]+)`/g, (_, c: string) => park(`<code>${c}</code>`))
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text: string, href: string) => {
      const url = href.replace(/&amp;/g, '&')
      return SAFE_HREF.test(url) ? park(`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${emphasis(text)}</a>`) : m
    })
  return emphasis(html).replace(/\uE000(\d+)\uE000/g, (_, i: string) => parked[Number(i)]!)
}

/**
 * Renders the supported Markdown subset to HTML that is safe to put in v-html.
 */
export function renderMarkdown(src: string): string {
  const out: string[] = []
  // widened by hand: the flush closures reassign it, which TS narrowing cannot follow
  let list = null as { tag: 'ul' | 'ol'; items: string[] } | null
  let para: string[] = []

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`)
    para = []
  }
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`)
    list = null
  }

  for (const line of src.replace(/\r\n?/g, '\n').split('\n')) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const item = bullet ?? numbered
    if (item) {
      flushPara()
      const tag = bullet ? 'ul' : 'ol'
      if (list?.tag !== tag) flushList()
      list ??= { tag, items: [] }
      list.items.push(item[1]!)
    } else if (!line.trim()) {
      flushPara()
      flushList()
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return out.join('')
}
