import type { ReactNode } from 'react'

// A deliberately small Markdown subset. React renders all text safely; raw
// HTML, images, and arbitrary URL protocols are never interpreted.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>
    const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(part)
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>
    return part
  })
}
export default function AssignmentDescription({ value }: { value: string }) {
  const nodes: ReactNode[] = [], lines = value.split('\n')
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (/^[-*] /.test(line)) {
      const items: ReactNode[] = []
      const start = index
      while (index < lines.length && /^[-*] /.test(lines[index])) {
        items.push(<li key={index}>{inline(lines[index].slice(2))}</li>); index++
      }
      index--; nodes.push(<ul key={start}>{items}</ul>)
    } else if (/^#{1,3} /.test(line)) {
      nodes.push(<h3 key={index}>{inline(line.replace(/^#{1,3} /, ''))}</h3>)
    } else nodes.push(<p key={index}>{inline(line) || '\u00a0'}</p>)
  }
  return <div className="assignment-description">{nodes}</div>
}
