// The Log sheet's header action. It's hidden while the Finish sheet is open, so only one
// Finish (or Done) button shows at a time: the Finish sheet carries its own.

export type LogHeaderAction = 'Finish' | 'Done';

export function logHeaderAction(state: { hasSession: boolean; editing: boolean; finishing: boolean }): LogHeaderAction | undefined {
  if (!state.hasSession || state.finishing) return undefined;
  return state.editing ? 'Done' : 'Finish';
}
