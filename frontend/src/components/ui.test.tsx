import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { asText, EnumBadge, formatDate, humanizeEnum } from './ui';

describe('value formatters', () => {
  it('humanizeEnum turns SCREAMING_SNAKE into Title Case', () => {
    expect(humanizeEnum('PENDING_APPROVAL')).toBe('Pending Approval');
    expect(humanizeEnum('')).toBe('—');
    expect(humanizeEnum(null)).toBe('—');
  });

  it('humanizeEnum also handles the PascalCase GraphQL wire values', () => {
    // async-graphql renames the model's SCREAMING_SNAKE enum members to
    // PascalCase (confirmed live: ProjectStatus.InProgress, not IN_PROGRESS).
    expect(humanizeEnum('InProgress')).toBe('In Progress');
    expect(humanizeEnum('OnHold')).toBe('On Hold');
    expect(humanizeEnum('Draft')).toBe('Draft');
  });

  it('formatDate handles missing / invalid values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('not-a-date');
    expect(formatDate('2026-01-15T00:00:00Z')).toMatch(/2026/);
  });

  it('asText renders a dash for empty values', () => {
    expect(asText(undefined)).toBe('—');
    expect(asText('')).toBe('—');
    expect(asText(42)).toBe('42');
  });
});

describe('EnumBadge', () => {
  it('renders humanized enum text for the model authoring casing', () => {
    render(<EnumBadge value="CHANGES_REQUESTED" />);
    expect(screen.getByText('Changes Requested')).toBeInTheDocument();
  });

  it('renders humanized enum text for the live PascalCase wire casing', () => {
    render(<EnumBadge value="ChangesRequested" />);
    expect(screen.getByText('Changes Requested')).toBeInTheDocument();
  });
});
