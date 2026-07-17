type CompanyActivationHook = (companyId: string) => void | Promise<void>;

const activationHooks = new Set<CompanyActivationHook>();

export function registerCompanyActivationHook(hook: CompanyActivationHook): () => void {
  activationHooks.add(hook);
  return () => activationHooks.delete(hook);
}

export async function notifyCompanyActivated(companyId: string): Promise<void> {
  await Promise.all([...activationHooks].map((hook) => hook(companyId)));
}
