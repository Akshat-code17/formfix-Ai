import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownLite } from './common';

describe('MarkdownLite', () => {
  it('renders bold, italic and lists', () => {
    const { container } = render(
      <MarkdownLite language="en" text={'A **bold** word and _an aside_.\n\n- one\n- two'} />,
    );
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('an aside');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('never interprets raw HTML from a model reply', () => {
    const hostile = '<img src=x onerror="alert(1)"> <script>alert(2)</script> **ok**';
    const { container } = render(<MarkdownLite language="en" text={hostile} />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    // The markup is shown as the text it is.
    expect(container.textContent).toContain('<img src=x');
    expect(container.querySelector('strong')?.textContent).toBe('ok');
  });

  it('tags the block with its language so the right font applies', () => {
    render(<MarkdownLite language="te" text="ఫారం ఏ పత్రాలు అడుగుతోంది?" />);
    expect(screen.getByText('ఫారం ఏ పత్రాలు అడుగుతోంది?').closest('[lang]')).toHaveAttribute(
      'lang',
      'te',
    );
  });
});
