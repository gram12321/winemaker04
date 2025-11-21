import { describe, it, expect } from 'vitest';
import {
  calculateGrapeSuitabilityMetrics,
  calculateGrapeSuitabilityContribution
} from '@/lib/services/vineyard/vineyardValueCalc';
import type { GrapeVariety, Aspect } from '@/lib/types/types';

describe('calculateGrapeSuitabilityMetrics', () => {
  it('calculates suitability for a well-matched grape and region', () => {
    // Sangiovese in Tuscany should have good suitability
    const metrics = calculateGrapeSuitabilityMetrics(
      'Sangiovese',
      'Tuscany',
      'Italy',
      300,
      'South',
      ['Clay', 'Limestone']
    );

    expect(metrics.overall).toBeGreaterThan(0.5);
    expect(metrics.overall).toBeLessThanOrEqual(1.0);
    expect(metrics.region).toBeGreaterThan(0);
    expect(metrics.altitude).toBeGreaterThanOrEqual(0);
    expect(metrics.sunExposure).toBeGreaterThanOrEqual(0);
    expect(metrics.soil).toBeGreaterThanOrEqual(0);
  });

  it('throws error when country or region is missing', () => {
    expect(() => {
      calculateGrapeSuitabilityMetrics(
        'Sangiovese',
        '',
        'Italy',
        300,
        'South',
        ['Clay']
      );
    }).toThrow(/Missing params/);

    expect(() => {
      calculateGrapeSuitabilityMetrics(
        'Sangiovese',
        'Tuscany',
        '',
        300,
        'South',
        ['Clay']
      );
    }).toThrow(/Missing params/);
  });

  it('throws error for unsupported country', () => {
    expect(() => {
      calculateGrapeSuitabilityMetrics(
        'Sangiovese',
        'Unknown',
        'UnknownCountry',
        300,
        'South',
        ['Clay']
      );
    }).toThrow(/No data for country/);
  });

  it('returns suitability metrics within 0-1 range', () => {
    const metrics = calculateGrapeSuitabilityMetrics(
      'Chardonnay',
      'Bourgogne',
      'France',
      250,
      'East',
      ['Limestone', 'Clay']
    );

    expect(metrics.region).toBeGreaterThanOrEqual(0);
    expect(metrics.region).toBeLessThanOrEqual(1);
    expect(metrics.altitude).toBeGreaterThanOrEqual(0);
    expect(metrics.altitude).toBeLessThanOrEqual(1);
    expect(metrics.sunExposure).toBeGreaterThanOrEqual(0);
    expect(metrics.sunExposure).toBeLessThanOrEqual(1);
    expect(metrics.soil).toBeGreaterThanOrEqual(0);
    expect(metrics.soil).toBeLessThanOrEqual(1);
    expect(metrics.overall).toBeGreaterThanOrEqual(0);
    expect(metrics.overall).toBeLessThanOrEqual(1);
  });

  it('calculates altitude suitability correctly for different altitudes', () => {
    const lowAltitude = calculateGrapeSuitabilityMetrics(
      'Tempranillo',
      'Rioja',
      'Spain',
      200, // Below preferred range
      'South',
      ['Clay-Limestone']
    );

    const optimalAltitude = calculateGrapeSuitabilityMetrics(
      'Tempranillo',
      'Rioja',
      'Spain',
      550, // Within preferred range (350-760)
      'South',
      ['Clay-Limestone']
    );

    const highAltitude = calculateGrapeSuitabilityMetrics(
      'Tempranillo',
      'Rioja',
      'Spain',
      900, // Above preferred range
      'South',
      ['Clay-Limestone']
    );

    // Optimal altitude should have better suitability than extremes
    expect(optimalAltitude.altitude).toBeGreaterThan(lowAltitude.altitude);
    expect(optimalAltitude.altitude).toBeGreaterThan(highAltitude.altitude);
  });

  it('handles different aspect orientations', () => {
    const southAspect = calculateGrapeSuitabilityMetrics(
      'Pinot Noir',
      'Bourgogne',
      'France',
      250,
      'South', // More sun exposure
      ['Clay', 'Limestone']
    );

    const northAspect = calculateGrapeSuitabilityMetrics(
      'Pinot Noir',
      'Bourgogne',
      'France',
      250,
      'North', // Less sun exposure
      ['Clay', 'Limestone']
    );

    // Sun exposure should differ based on aspect
    // (exact values depend on grape preferences, but should be different)
    expect(southAspect.sunExposure).not.toBe(northAspect.sunExposure);
  });

  it('handles soil preferences correctly', () => {
    const preferredSoil = calculateGrapeSuitabilityMetrics(
      'Pinot Noir',
      'Bourgogne',
      'France',
      250,
      'South',
      ['Clay', 'Limestone'] // Preferred soils for Pinot Noir
    );

    const nonPreferredSoil = calculateGrapeSuitabilityMetrics(
      'Pinot Noir',
      'Bourgogne',
      'France',
      250,
      'South',
      ['Sand'] // Less ideal for Pinot Noir
    );

    // Preferred soil should have better suitability
    expect(preferredSoil.soil).toBeGreaterThan(nonPreferredSoil.soil);
  });

  it('handles missing soil types gracefully', () => {
    const metrics = calculateGrapeSuitabilityMetrics(
      'Sangiovese',
      'Tuscany',
      'Italy',
      300,
      'South',
      undefined
    );

    // Should still calculate suitability without soil
    expect(metrics.overall).toBeGreaterThanOrEqual(0);
    expect(metrics.overall).toBeLessThanOrEqual(1);
  });

  it('weighted overall suitability considers all factors', () => {
    const metrics = calculateGrapeSuitabilityMetrics(
      'Chardonnay',
      'Bourgogne',
      'France',
      300,
      'South',
      ['Limestone', 'Clay']
    );

    // Overall should be a weighted combination of all factors
    // It shouldn't be just the average or max of individual factors
    expect(metrics.overall).toBeGreaterThan(0);
    expect(metrics.overall).toBeLessThanOrEqual(1);
    
    // Overall should be influenced by all components
    // (not necessarily equal to any single component due to weighting)
    const allComponents = [
      metrics.region,
      metrics.altitude,
      metrics.sunExposure,
      metrics.soil
    ];
    const minComponent = Math.min(...allComponents);
    const maxComponent = Math.max(...allComponents);
    
    // Overall should generally be within the range of components
    expect(metrics.overall).toBeGreaterThanOrEqual(minComponent * 0.5);
    expect(metrics.overall).toBeLessThanOrEqual(maxComponent * 1.5);
  });
});

describe('calculateGrapeSuitabilityContribution', () => {
  it('returns 1.0 (neutral) when grape is not planted', () => {
    const contribution = calculateGrapeSuitabilityContribution(
      null,
      'Tuscany',
      'Italy',
      300,
      'South',
      ['Clay']
    );

    expect(contribution).toBe(1.0);
  });

  it('returns overall suitability when grape is planted', () => {
    const contribution = calculateGrapeSuitabilityContribution(
      'Sangiovese',
      'Tuscany',
      'Italy',
      300,
      'South',
      ['Clay', 'Limestone']
    );

    const metrics = calculateGrapeSuitabilityMetrics(
      'Sangiovese',
      'Tuscany',
      'Italy',
      300,
      'South',
      ['Clay', 'Limestone']
    );

    // Contribution should match overall suitability
    expect(contribution).toBe(metrics.overall);
  });

  it('handles all grape varieties correctly', () => {
    const grapes: GrapeVariety[] = [
      'Barbera',
      'Chardonnay',
      'Pinot Noir',
      'Primitivo',
      'Sauvignon Blanc',
      'Tempranillo',
      'Sangiovese'
    ];

    grapes.forEach(grape => {
      const contribution = calculateGrapeSuitabilityContribution(
        grape,
        'Tuscany', // Using Italy region
        'Italy',
        300,
        'South',
        ['Clay']
      );

      expect(contribution).toBeGreaterThanOrEqual(0);
      expect(contribution).toBeLessThanOrEqual(1);
    });
  });
});

