import { intentFor } from './notification-actions';

describe('intentFor', () => {
  it('boutons de la notification de demande : approuver / refuser', () => {
    expect(intentFor('approve', { type: 'reward_requested', requestId: 'r1' })).toEqual({ kind: 'approve', requestId: 'r1' });
    expect(intentFor('reject', { type: 'reward_requested', requestId: 'r1' })).toEqual({ kind: 'reject', requestId: 'r1' });
  });
  it('un bouton sans requestId ne déclenche aucune action métier', () => {
    expect(intentFor('approve', { type: 'reward_requested' })).toEqual({ kind: 'navigate', href: '/more/points' });
  });
  it('un simple tap ouvre l’écran concerné', () => {
    expect(intentFor('default', { type: 'reward_requested', requestId: 'r1' })).toEqual({ kind: 'navigate', href: '/more/points' });
    expect(intentFor('default', { type: 'goal_achieved' })).toEqual({ kind: 'navigate', href: '/more/goals' });
    expect(intentFor('default', { type: 'task_assigned' })).toEqual({ kind: 'navigate', href: '/(tabs)/today' });
    expect(intentFor('default', { type: 'reminder_start' })).toEqual({ kind: 'navigate', href: '/(tabs)/today' });
  });
  it('tâche cochée : Duyệt / Từ chối agissent sur la tâche, un tap ouvre la file', () => {
    expect(intentFor('approve', { type: 'task_completed', taskId: 't1' })).toEqual({ kind: 'validate_task', taskId: 't1' });
    expect(intentFor('reject', { type: 'task_completed', taskId: 't1' })).toEqual({ kind: 'reject_task', taskId: 't1' });
    expect(intentFor('default', { type: 'task_completed', taskId: 't1' })).toEqual({ kind: 'navigate', href: '/approvals' });
    expect(intentFor('approve', { type: 'task_completed' })).toEqual({ kind: 'navigate', href: '/approvals' });
  });
  it('tâche validée / refusée (enfant) : ouvre l’accueil', () => {
    expect(intentFor('default', { type: 'task_validated' })).toEqual({ kind: 'navigate', href: '/(tabs)/today' });
    expect(intentFor('default', { type: 'task_rejected' })).toEqual({ kind: 'navigate', href: '/(tabs)/today' });
  });
  it('type inconnu : rien', () => {
    expect(intentFor('default', {})).toEqual({ kind: 'none' });
    expect(intentFor('default', { type: 'x' })).toEqual({ kind: 'none' });
  });
});
