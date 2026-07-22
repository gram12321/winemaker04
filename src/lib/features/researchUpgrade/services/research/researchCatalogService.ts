import { RESEARCH_PROJECTS, type ResearchProject } from '../../constants/researchCatalog';

export function getResearchProject(id: string): ResearchProject | undefined {
  return RESEARCH_PROJECTS.find(project => project.id === id);
}

export function getResearchProjectsByCategory(category: ResearchProject['category']): ResearchProject[] {
  return RESEARCH_PROJECTS.filter(project => project.category === category);
}
