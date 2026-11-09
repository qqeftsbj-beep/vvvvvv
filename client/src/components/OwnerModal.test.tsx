// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OwnerModal from './OwnerModal';
afterEach(() => cleanup());
describe('OwnerModal portal isolation', () => {
  it('renders outside transformed page and restores body scroll/focus on close', () => {
    const trigger = document.createElement('button'); document.body.appendChild(trigger); trigger.focus();
    const onClose = vi.fn();
    const { container, unmount } = render(<div style={{transform:'scale(1)'}}><OwnerModal open onClose={onClose} title="نافذة اختبار"><input aria-label="محتوى" /></OwnerModal></div>);
    const dialog = screen.getByRole('dialog', {name:'نافذة اختبار'});
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, {key:'Escape'}); expect(onClose).toHaveBeenCalledTimes(1);
    unmount(); expect(document.body.style.overflow).toBe(''); expect(document.activeElement).toBe(trigger); trigger.remove();
  });
  it('does not close from input clicks or while a save/upload is pending', () => {
    const onClose = vi.fn();
    render(<OwnerModal open closeDisabled onClose={onClose} title="حفظ"><input aria-label="حقل" /></OwnerModal>);
    fireEvent.mouseDown(screen.getByLabelText('حقل')); fireEvent.keyDown(document, {key:'Escape'});
    expect(onClose).not.toHaveBeenCalled();
  });
});
