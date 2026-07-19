import { createElement, lazy, Suspense, type ComponentType } from 'react';
import type { ActivitiesFeature } from './featureTypes';
import { calculateActivityStaffWorkPreview, getActivityStaffWorkContext } from './services/activityWorkPreviewService';
import { calculateClearingWork } from './services/workcalculators/clearingWorkCalculator';
import { calculateCrushingWork, validateCrushingBatch } from './services/workcalculators/crushingWorkCalculator';
import { calculateFermentationWork } from './services/workcalculators/fermentationWorkCalculator';
import { calculateHarvestWork } from './services/workcalculators/harvestingWorkCalculator';
import { calculateLandSearchWork } from './services/workcalculators/landSearchWorkCalculator';
import { calculateLenderSearchCost, calculateLenderSearchWork } from './services/workcalculators/lenderSearchWorkCalculator';
import { calculateResearchCost, calculateResearchWork } from './services/workcalculators/researchWorkCalculator';
import { calculateEmptyStorageVesselWork } from './services/workcalculators/storageVesselMaintenanceWorkCalculator';
import { calculateTakeLoanWork } from './services/workcalculators/takeLoanWorkCalculator';
import { DEFAULT_VINE_DENSITY, WORK_CATEGORY_INFO, getClearingTask, getTaskTypeDisplayName, isStaffSpecializationCategory, getStaffSpecializationDisplayName } from './constants/activityConstants';

const manager = () => import('./services/activitymanagers/activityManager');
const bookkeeping = () => import('./services/activitymanagers/bookkeepingManager');

const ActivityPanel = lazy(() => import('./ui/ActivityPanel').then(module => ({ default: module.ActivityPanel })));
const LandSearchOptionsModal = lazy(() => import('./ui/modals/LandSearchOptionsModal').then(module => ({ default: module.LandSearchOptionsModal })));
const LandSearchResultsModal = lazy(() => import('./ui/modals/LandSearchResultsModal').then(module => ({ default: module.LandSearchResultsModal })));
const PlantingOptionsModal = lazy(() => import('./ui/modals/PlantingOptionsModal'));
const HarvestOptionsModal = lazy(() => import('./ui/modals/HarvestOptionsModal'));
const ClearingOptionsModal = lazy(() => import('./ui/modals/ClearingOptionsModal'));
const StaffSearchOptionsModal = lazy(() => import('./ui/modals/StaffSearchOptionsModal').then(module => ({ default: module.StaffSearchOptionsModal })));
const StaffSearchResultsModal = lazy(() => import('./ui/modals/StaffSearchResultsModal').then(module => ({ default: module.StaffSearchResultsModal })));
const CrushingOptionsModal = lazy(() => import('./ui/modals/CrushingOptionsModal'));
const FermentationOptionsModal = lazy(() => import('./ui/modals/FermentationOptionsModal').then(module => ({ default: module.FermentationOptionsModal })));

const renderLazy = (component: ComponentType<any>, props: object = {}) =>
  createElement(Suspense, { fallback: null }, createElement(component, props));

export const activitiesFeature: ActivitiesFeature = {
  config: { defaultVineDensity: DEFAULT_VINE_DENSITY },
  catalog: { workCategoryInfo: WORK_CATEGORY_INFO, getClearingTask, getTaskTypeDisplayName, isStaffSpecializationCategory, getStaffSpecializationDisplayName },
  lifecycle: {
    create: options => manager().then(({ createActivity }) => createActivity(options)),
    createWithResult: options => manager().then(({ createActivityWithResult }) => createActivityWithResult(options)),
    update: (id, updates) => manager().then(({ updateActivity }) => updateActivity(id, updates)),
    pause: id => manager().then(({ pauseActivity }) => pauseActivity(id)),
    resume: id => manager().then(({ resumeActivity }) => resumeActivity(id)),
    activate: (id, params) => manager().then(({ activateActivityWithParams }) => activateActivityWithParams(id, params)),
    completeNow: id => manager().then(({ completeActivityNow }) => completeActivityNow(id)),
    cancel: id => manager().then(({ cancelActivity }) => cancelActivity(id)),
    remove: id => manager().then(({ removeActivity }) => removeActivity(id)),
    clearPendingLandSearchResults: () => import('./services/activitymanagers/landSearchManager').then(({ clearPendingLandSearchResults }) => clearPendingLandSearchResults()),
    clearPendingStaffCandidates: () => import('./services/activitymanagers/staffSearchManager').then(({ clearPendingCandidates }) => clearPendingCandidates()),
  },
  reads: {
    getAll: () => manager().then(({ getAllActivities }) => getAllActivities()),
    getById: id => manager().then(({ getActivityById }) => getActivityById(id)),
    getByTarget: targetId => manager().then(({ getActivitiesByTarget }) => getActivitiesByTarget(targetId)),
    getProgress: id => manager().then(({ getActivityProgress }) => getActivityProgress(id)),
  },
  work: {
    getContext: getActivityStaffWorkContext,
    getPreview: calculateActivityStaffWorkPreview,
    calculateClearing: calculateClearingWork,
    calculateCrushing: calculateCrushingWork,
    validateCrushingBatch,
    calculateFermentation: calculateFermentationWork,
    calculateHarvest: calculateHarvestWork,
    calculateLandSearch: calculateLandSearchWork,
    calculateLenderSearch: calculateLenderSearchWork,
    calculateLenderSearchCost,
    calculateResearch: calculateResearchWork,
    calculateResearchCost,
    calculateEmptyStorageVessel: calculateEmptyStorageVesselWork,
    calculateTakeLoan: calculateTakeLoanWork,
  },
  ticks: {
    progress: () => manager().then(({ progressActivities }) => progressActivities()),
    checkAndTriggerBookkeeping: (...args) => bookkeeping().then(({ checkAndTriggerBookkeeping }) => checkAndTriggerBookkeeping(...args)),
  },
  setup: { initialize: () => manager().then(({ initializeActivitySystem }) => initializeActivitySystem()) },
  ui: {
    renderActivityPanel: () => renderLazy(ActivityPanel),
    renderLandSearchOptions: props => renderLazy(LandSearchOptionsModal, props),
    renderLandSearchResults: props => renderLazy(LandSearchResultsModal, props),
    renderPlantingOptions: props => renderLazy(PlantingOptionsModal, props),
    renderHarvestOptions: props => renderLazy(HarvestOptionsModal, props),
    renderClearingOptions: props => renderLazy(ClearingOptionsModal, props),
    renderStaffSearchOptions: props => renderLazy(StaffSearchOptionsModal, props),
    renderStaffSearchResults: props => renderLazy(StaffSearchResultsModal, props),
    renderCrushingOptions: props => renderLazy(CrushingOptionsModal, props),
    renderFermentationOptions: props => renderLazy(FermentationOptionsModal, props),
  },
};
