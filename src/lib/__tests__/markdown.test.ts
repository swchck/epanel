import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../markdown'

describe('markdown', () => {
  it('renders emphasis, code and line breaks', () => {
    expect(renderMarkdown('**Только** электрик, *при снятом* напряжении\n`C16`')).toBe('<p><strong>Только</strong> электрик, <em>при снятом</em> напряжении<br><code>C16</code></p>')
  })

  it('renders lists and paragraphs', () => {
    expect(renderMarkdown('Шаги:\n- выключить\n- проверить\n\n1. раз\n2. два')).toBe('<p>Шаги:</p><ul><li>выключить</li><li>проверить</li></ul><ol><li>раз</li><li>два</li></ol>')
  })

  it('escapes html and drops unsafe links', () => {
    expect(renderMarkdown('<img src=x onerror=alert(1)> [x](javascript:alert(1))')).toBe('<p>&lt;img src=x onerror=alert(1)&gt; [x](javascript:alert(1))</p>')
  })

  it('keeps emphasis out of urls and code', () => {
    expect(renderMarkdown('[сайт](https://a.example/x_y_z?a=1&b=2) `a*b*c`')).toBe(
      '<p><a href="https://a.example/x_y_z?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">сайт</a> <code>a*b*c</code></p>',
    )
  })

  it('leaves snake_case and lone asterisks alone', () => {
    expect(renderMarkdown('file_name_here, 2 * 3')).toBe('<p>file_name_here, 2 * 3</p>')
  })
})
