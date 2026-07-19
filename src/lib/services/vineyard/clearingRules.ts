import { activitiesFeature } from '@/lib/features/activities';

export function calculateClearingHealth(
  currentHealth: number,
  tasks: Record<string, boolean>,
  replantingIntensity = 100,
): number {
  const intensity = replantingIntensity / 100;
  let health = currentHealth;

  for (const taskId of ['clear-vegetation', 'remove-debris']) {
    const task = tasks[taskId] ? activitiesFeature.catalog.getClearingTask(taskId) : undefined;
    if (task && 'healthImprovement' in task && task.healthImprovement) {
      health = Math.min(1, health + task.healthImprovement);
    }
  }

  for (const taskId of ['uproot-vines', 'replant-vines']) {
    const task = tasks[taskId] ? activitiesFeature.catalog.getClearingTask(taskId) : undefined;
    if (task && 'setHealth' in task && task.setHealth !== undefined) {
      health = health * (1 - intensity) + task.setHealth * intensity;
    }
  }

  return Math.max(0.1, Math.min(1, health));
}
