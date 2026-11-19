import { expect, test } from 'vitest';
import { logHeaderAction } from './header';

test('the Log sheet shows Finish for a draft and Done when editing a finished workout', () => {
  expect(logHeaderAction({ hasSession: true, editing: false, finishing: false })).toBe('Finish');
  expect(logHeaderAction({ hasSession: true, editing: true, finishing: false })).toBe('Done');
});

test('the header action hides while the Finish sheet is open, so only one Finish shows', () => {
  expect(logHeaderAction({ hasSession: true, editing: false, finishing: true })).toBeUndefined();
  expect(logHeaderAction({ hasSession: true, editing: true, finishing: true })).toBeUndefined();
});

test('no header action before the session has loaded', () => {
  expect(logHeaderAction({ hasSession: false, editing: false, finishing: false })).toBeUndefined();
});
