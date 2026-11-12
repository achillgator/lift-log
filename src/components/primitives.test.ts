// Server-render the primitives to check their markup: states, labels and roles.
import { describe, expect, test } from 'vitest';
import { render } from 'svelte/server';
import type { LoggedSet } from '../db/types';
import Banner from './Banner.svelte';
import EmptyState from './EmptyState.svelte';
import ListRow from './ListRow.svelte';
import SegmentedControl from './SegmentedControl.svelte';
import SetRow from './SetRow.svelte';
import Stepper from './Stepper.svelte';
import Switch from './Switch.svelte';
import Toast from './Toast.svelte';

const set: LoggedSet = {
  id: 's1', sessionId: 'x', exerciseId: 'e', order: 0, setNo: 2,
  targetWeightLb: 135, targetReps: 5, done: false, skipped: false,
};

describe('SetRow', () => {
  test('planned shows the target and offers done as planned', () => {
    const { body } = render(SetRow, { props: { set } });
    expect(body).toContain('135 lb × 5');
    expect(body).toContain('aria-pressed="false"');
    expect(body).toContain('mark done as planned');
    expect(body).toContain('class="setrow planned');
  });
  test('edited and skipped are labelled', () => {
    expect(render(SetRow, { props: { set: { ...set, done: true, weightLb: 140, reps: 5 } } }).body).toContain('Edited');
    expect(render(SetRow, { props: { set: { ...set, skipped: true } } }).body).toContain('Skipped');
  });
  test('typo guard asks "Did you mean"', () => {
    const { body } = render(SetRow, { props: { set: { ...set, done: true, weightLb: 1350, reps: 5 } } });
    expect(body).toContain('Did you mean 135 lb?');
  });
  test('expanded editor has steppers and set actions', () => {
    const { body } = render(SetRow, { props: { set, expanded: true, onskip: () => {}, onremove: () => {} } });
    expect(body).toContain('Decrease Weight');
    expect(body).toContain('Skip set');
    expect(body).toContain('Remove set');
  });
});

describe('other primitives', () => {
  test('Stepper labels both buttons', () => {
    const { body } = render(Stepper, { props: { label: 'Reps', value: 5 } });
    expect(body).toContain('aria-label="Decrease Reps"');
    expect(body).toContain('aria-label="Increase Reps"');
    expect(body).toContain('value="5"');
  });
  test('SegmentedControl is a radio group', () => {
    const { body } = render(SegmentedControl, { props: { label: 'Range', value: 'b', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } });
    expect(body).toContain('role="radiogroup"');
    expect(body.match(/aria-checked="true"/g)?.length).toBe(1);
  });
  test('Switch exposes its state', () => {
    expect(render(Switch, { props: { label: 'Auto-increase', checked: true } }).body).toContain('aria-checked="true"');
  });
  test('Toast shows Undo only with a handler', () => {
    expect(render(Toast, { props: { message: 'Set removed', onundo: () => {} } }).body).toContain('Undo');
    expect(render(Toast, { props: { message: 'Saved' } }).body).not.toContain('Undo');
  });
  test('Banner, EmptyState and ListRow render their text', () => {
    expect(render(Banner, { props: { title: 'Back up your log', actionLabel: 'Export', onaction: () => {} } }).body).toContain('Export');
    expect(render(EmptyState, { props: { message: 'No workouts yet.' } }).body).toContain('No workouts yet.');
    expect(render(ListRow, { props: { label: 'Routines', href: '#/settings/routines' } }).body).toContain('href="#/settings/routines"');
  });
});
