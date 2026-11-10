// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => {
  const invalidate = () => ({ invalidate: vi.fn().mockResolvedValue(undefined) });
  return { stamp: { revision: 1, navigationRevision: 1 }, query: vi.fn(), utils: { templates: invalidate(), freeSites: invalidate(), creativeSpace: invalidate(), templateCategories: invalidate(), creativeCategories: invalidate(), siteContent: { navigation: invalidate(), get: invalidate(), page: invalidate() } } };
});
vi.mock('@/lib/trpc', () => ({ trpc: { sharedContent: { revision: { useQuery: (...args: unknown[]) => { mocks.query(...args); return { data: mocks.stamp }; } } }, useUtils: () => mocks.utils } }));
import { useSharedContentSync } from './useSharedContentSync';
function Host() { useSharedContentSync(); return null; }
beforeEach(() => { vi.clearAllMocks(); mocks.stamp = { revision: 1, navigationRevision: 1 }; });
afterEach(cleanup);
describe('lightweight cross-device revision watcher', () => {
  it('does not fetch the complete libraries on identical revision checks', () => {
    const view = render(<Host />);
    mocks.stamp = { revision: 1, navigationRevision: 1 };
    view.rerender(<Host />);
    expect(mocks.utils.templates.invalidate).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledWith(undefined, expect.objectContaining({ refetchInterval: 2000, refetchIntervalInBackground: false }));
  });
  it('refreshes active shared sections on a content change without touching administrative structure', () => {
    const view = render(<Host />);
    mocks.stamp = { revision: 2, navigationRevision: 1 };
    view.rerender(<Host />);
    expect(mocks.utils.templates.invalidate).toHaveBeenCalledOnce();
    expect(mocks.utils.freeSites.invalidate).toHaveBeenCalledOnce();
    expect(mocks.utils.creativeSpace.invalidate).toHaveBeenCalledOnce();
    expect(mocks.utils.siteContent.get.invalidate).not.toHaveBeenCalled();
  });
  it('updates published navigation labels only after a structure publication', () => {
    const view = render(<Host />);
    mocks.stamp = { revision: 1, navigationRevision: 2 };
    view.rerender(<Host />);
    expect(mocks.utils.siteContent.navigation.invalidate).toHaveBeenCalledOnce();
    expect(mocks.utils.templates.invalidate).not.toHaveBeenCalled();
  });
});
