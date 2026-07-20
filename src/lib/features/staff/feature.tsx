import { createElement, lazy, Suspense, type ComponentType } from 'react';
import type { StaffFeature } from './featureTypes';
import * as competency from './services/competencyService';
import * as factory from './services/staffFactory';
import * as presentation from './services/staffPresentationService';
import * as teams from './services/teamDefinitions';
import * as wages from './services/wageCalculations';

const StaffWorkspace = lazy(() => import('./ui/StaffWorkspace').then(module => ({ default: module.StaffPage })));
const StaffModal = lazy(() => import('./ui/StaffModal'));
const StaffSkillBarsList = lazy(() => import('./ui/StaffSkillBar').then(module => ({ default: module.StaffSkillBarsList })));

const renderLazy = <Props extends object>(component: ComponentType<Props>, props: Props) =>
  createElement(Suspense, { fallback: null }, createElement(component, props));

export const staffFeature: StaffFeature = {
  records: {
    create: factory.createStaff,
    add: staff => import('./services/staffService').then(({ addStaff }) => addStaff(staff)),
    remove: staffId => import('./services/staffService').then(({ removeStaff }) => removeStaff(staffId)),
    getAll: () => import('./services/staffService').then(({ getAllStaff }) => getAllStaff()),
    getById: staffId => import('./services/staffService').then(({ getStaffById }) => getStaffById(staffId)),
  },
  recruitment: {
    generateSkills: factory.generateRandomSkills,
    getRandomFirstName: factory.getRandomFirstName,
    getRandomLastName: factory.getRandomLastName,
    getRandomNationality: factory.getRandomNationality,
  },
  competency: {
    calculateEffectiveSkill: competency.calculateEffectiveSkill,
    awardExperience: (staffId, amount, categories) => import('./services/staffService').then(({ awardExperience }) => awardExperience(staffId, amount, categories)),
  },
  teams: {
    create: teams.createTeam,
    getForCategory: teams.getTeamForCategory,
    getDefault: () => import('./services/teamService').then(({ getDefaultTeams }) => getDefaultTeams()),
    add: team => import('./services/teamService').then(({ addTeam }) => addTeam(team)),
    update: team => import('./services/teamService').then(({ updateTeam }) => updateTeam(team)),
    remove: teamId => import('./services/teamService').then(({ removeTeam }) => removeTeam(teamId)),
    assign: (staffId, teamId) => import('./services/teamService').then(({ assignStaffToTeam }) => assignStaffToTeam(staffId, teamId)),
    removeMember: (staffId, teamId) => import('./services/teamService').then(({ removeStaffFromTeam }) => removeStaffFromTeam(staffId, teamId)),
  },
  wages: {
    calculate: wages.calculateWage,
    getDistinctRoleSkillGroupCount: wages.getDistinctSpecializationSkillGroupCount,
    getColorClass: wages.getWageColorClass,
    calculateTotalWeekly: wages.calculateTotalWeeklyWages,
    calculateTotalSeasonal: wages.calculateTotalSeasonalWages,
    calculateTotalYearly: wages.calculateTotalYearlyWages,
    processSeasonal: (staff, skipNotification) => import('./services/wageService').then(({ processSeasonalWages }) => processSeasonalWages(staff, skipNotification)),
    processFounderDistributions: (staff, previousYear) => import('./services/wageService').then(({ processYearlyFounderDistributions }) => processYearlyFounderDistributions(staff, previousYear)),
  },
  founders: { buyout: staffId => import('./services/staffService').then(({ buyoutFounder }) => buyoutFounder(staffId)) },
  presentation: { getExperience: presentation.getStaffExperiencePresentation },
  setup: {
    async initialize() {
      const [{ initializeStaffSystem }, { initializeTeamsSystem }] = await Promise.all([
        import('./services/staffService'),
        import('./services/teamService'),
      ]);
      await Promise.all([initializeStaffSystem(), initializeTeamsSystem()]);
    },
  },
  ui: {
    renderWorkspace: props => renderLazy(StaffWorkspace, props),
    renderStaffModal: props => renderLazy(StaffModal, props),
    renderSkillBars: props => renderLazy(StaffSkillBarsList, props),
  },
};
