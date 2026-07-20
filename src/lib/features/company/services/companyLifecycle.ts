import type { CompanyActivationHook } from '../featureTypes';

const activationHooks = new Set<CompanyActivationHook>();

export function registerActivationHook(hook: CompanyActivationHook): () => void {
  activationHooks.add(hook);
  return () => activationHooks.delete(hook);
}

export async function notifyActivated(companyId: string): Promise<void> {
  await Promise.all([...activationHooks].map((hook) => hook(companyId)));
}
