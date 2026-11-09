// @vitest-environment jsdom
import React from 'react';
import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUnsavedNavigation } from './useUnsavedNavigation';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('useUnsavedNavigation', () => {
  it('does not insert fake history entries when editing becomes dirty', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const request = vi.fn();
    const { rerender } = renderHook(({ dirty }) => useUnsavedNavigation(dirty, request), { initialProps: { dirty: false } });
    rerender({ dirty: true });
    expect(push).not.toHaveBeenCalled();
  });

  it('guards internal route pushes and links only when dirty', () => {
    const request = vi.fn();
    const { rerender } = renderHook(({ dirty }) => useUnsavedNavigation(dirty, request), { initialProps: { dirty: false } });
    const originalPath = location.pathname;
    rerender({ dirty: true });
    window.history.pushState({}, '', '/another-page');
    expect(request).toHaveBeenCalledWith({ url: '/another-page' });
    expect(location.pathname).toBe(originalPath);
    const link = document.createElement('a'); link.href = '/next'; document.body.appendChild(link);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(request).toHaveBeenCalledWith({ url: '/next' });
    link.remove();
  });

  it('restores a cancelled Back once, then returns to the real previous page on approval', () => {
    const request = vi.fn();
    const forward = vi.spyOn(window.history, 'forward').mockImplementation(() => undefined);
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined);
    const { result } = renderHook(() => useUnsavedNavigation(true, request));
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({ historyBack: true });
    expect(forward).toHaveBeenCalledTimes(1);
    // Native restoration back to the editor is silent.
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(request).toHaveBeenCalledTimes(1);
    result.current.allowLeave({ historyBack: true });
    expect(go).toHaveBeenCalledWith(-1);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not warn on reload when clean and warns when dirty', () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedNavigation(dirty, vi.fn()), { initialProps: { dirty: false } });
    const clean = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    rerender({ dirty: true });
    const dirty = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});
