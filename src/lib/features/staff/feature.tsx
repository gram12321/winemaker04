import { createElement, lazy, Suspense, type ComponentType } from 'react';
import type { StaffFeature } from './featureTypes';
import * as competency from './services/competencyService';
import * as factory from './services/staffFactory';
import * as presentation from './services/staffPresentationService';
import * as teams from './services/teamDefinitions';
import * as wages from './services/wageCalculations';
import { toStaff, toStaffRecord, toStaffTeam, toStaffTeamRecord } from './services/staffModels';

const StaffWorkspace = lazy(() => import('./ui/StaffWorkspace').then(module => ({ default: module.StaffPage })));
const StaffSkillBarsList = lazy(() => import('./ui/StaffSkillBar').then(module => ({ default: module.StaffSkillBarsList })));

const renderLazy = <Props extends object>(component: ComponentType<Props>, props: Props) =>
  createElement(Suspense, { fallback: null }, createElement(component, props));

export const staffFeature: StaffFeature = {
  records: {
    create: input => toStaffRecord(factory.createStaff(input.firstName, input.lastName, input.skillLevel, input.nationality, input.hireDate, input.skills, input.isFounder, input.specializedRoles)),
    add: staff => import('./services/staffService').then(async ({ addStaff }) => {
      const added = await addStaff(toStaff(staff));
      return added ? toStaffRecord(added) : null;
    }),
    remove: staffId => import('./services/staffService').then(({ removeStaff }) => removeStaff(staffId)),
    getAll: () => import('./services/staffService').then(async ({ getAllStaff }) => (await getAllStaff()).map(toStaffRecord)),
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
    create: input => toStaffTeamRecord(teams.createTeam(input.name, input.description, input.defaultTaskTypes, input.icon)),
    getForCategory: (teamRecords, category) => {
      const team = teams.getTeamForCategory(teamRecords.map(toStaffTeam), category);
      return team ? toStaffTeamRecord(team) : null;
    },
    add: team => import('./services/teamService').then(async ({ addTeam }) => toStaffTeamRecord(await addTeam(toStaffTeam(team)))),
    update: team => import('./services/teamService').then(async ({ updateTeam }) => toStaffTeamRecord(await updateTeam(toStaffTeam(team)))),
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
    renderSkillBars: props => renderLazy(StaffSkillBarsList, props),
  },
};
