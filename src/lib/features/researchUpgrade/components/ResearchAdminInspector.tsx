import { ResearchWorkspace } from './ResearchWorkspace';

export function ResearchAdminInspector() {
  return <ResearchWorkspace bypassGates={true} readOnly={true} variant="admin" />;
}
