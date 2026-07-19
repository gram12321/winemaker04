import { createElement, lazy } from 'react';
import type { ActivitiesFeature } from './featureTypes';
import { calculateActivityStaffWorkPreview, getActivityStaffWorkContext } from './services/activityWorkPreviewService';

const manager = () => import('./services/activitymanagers/activityManager');
const bookkeeping = () => import('./services/activitymanagers/bookkeepingManager');

const ActivityPanel = lazy(() => import('./ui/ActivityPanel').then(module => ({ default: module.ActivityPanel })));

export const activitiesFeature: ActivitiesFeature = {
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
  },
  ticks: {
    progress: () => manager().then(({ progressActivities }) => progressActivities()),
    checkAndTriggerBookkeeping: (...args) => bookkeeping().then(({ checkAndTriggerBookkeeping }) => checkAndTriggerBookkeeping(...args)),
  },
  setup: { initialize: () => manager().then(({ initializeActivitySystem }) => initializeActivitySystem()) },
  ui: {
    renderActivityPanel: () => createElement(ActivityPanel),
  },
};
