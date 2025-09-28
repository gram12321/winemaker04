import { RuleConfig } from '../types/balanceRulesTypes';

// Rule configuration - supports both cross-trait and non-cross-trait for both penalties and synergies
export const RULES: RuleConfig = {
  penalties: [
    // Acidity penalties
    {
      sources: ['acidity'],
      targets: ['sweetness'],
      condition: (wine) => wine.acidity > 0.7 && wine.sweetness > 0.6,
      name: "Clashing Sweetness",
      description: "High acidity makes sweet wines taste overly tart and unbalanced.",
      requirement: "(acidity>0.7, sweetness>0.6)",
      k: 0.4, // High scaling - acidity/sweetness clash is very noticeable
      p: 1.5, // High power - effect compounds quickly
      cap: 2.0
    },
    {
      sources: ['acidity'],
      targets: ['aroma'],
      condition: (wine) => wine.acidity < 0.5 && wine.body > 0.7,
      name: "Low Acidity Overpower",
      description: "Low acidity with high body creates dull, heavy wines.",
      requirement: "(acidity<0.5, body>0.7)",
      k: 0.3, // Moderate scaling - acidity affects aroma perception
      p: 1.3, // Moderate power - builds up gradually
      cap: 2.0
    },
    {
      sources: ['acidity'],
      targets: ['sweetness'],
      condition: (wine) => wine.acidity < 0.3,
      name: "Fixed Sweetness Penalty",
      description: "Low acidity creates fixed penalty on sweetness regardless of acidity level.",
      requirement: "(acidity<0.3)",
      k: 0.15, // Lower scaling - this is a fixed penalty, not scaling
      p: 1.0, // Linear - fixed penalty doesn't compound
      cap: 0.15 // Fixed penalty
    },
    
    // Body penalties
    {
      sources: ['body'],
      targets: ['aroma'],
      condition: (wine) => wine.body > 0.7 && wine.aroma < 0.5,
      name: "Heavy Body Overpower",
      description: "High body without matching aroma creates dull, heavy wines.",
      requirement: "(body>0.7, aroma<0.5)",
      k: 0.25, // Moderate scaling - body/aroma mismatch is noticeable
      p: 1.4, // Higher power - heavy wines become dull quickly
      cap: 0.36
    },
    {
      sources: ['body'],
      targets: ['tannins'],
      condition: (wine) => wine.body < 0.5 && wine.tannins > 0.7,
      name: "Astringent Tannins",
      description: "High tannins without sufficient body create harsh, astringent wines.",
      requirement: "(tannins>0.7, body<0.5)",
      k: 0.35, // High scaling - tannin/body mismatch is very harsh
      p: 1.6, // Very high power - astringency compounds rapidly
      cap: 0.36
    },
    
    // Sweetness penalties
    {
      sources: ['sweetness'],
      targets: ['spice'],
      condition: (wine) => wine.sweetness > 0.7 && wine.spice > 0.6,
      name: "Sweet-Spice Clash",
      description: "High sweetness clashes with high spice, creating an unbalanced wine.",
      requirement: "(sweetness>0.7, spice>0.6)",
      k: 0.45, // Very high scaling - sweet/spice clash is extremely noticeable
      p: 1.7, // Very high power - this clash becomes unbearable quickly
      cap: 0.2
    },
    {
      sources: ['sweetness'],
      targets: ['acidity'],
      condition: (wine) => wine.sweetness < 0.4 && wine.acidity > 0.6,
      name: "Acid-Sweet Imbalance",
      description: "Low sweetness with high acidity creates overly tart wines.",
      requirement: "(sweetness<0.4, acidity>0.6)",
      k: 0.3, // Moderate scaling - tartness is noticeable but not extreme
      p: 1.3, // Moderate power - builds up gradually
      cap: 0.24
    },
    
    // Tannin penalties
    {
      sources: ['tannins'],
      targets: ['sweetness'],
      condition: (wine) => wine.tannins > 0.7 && wine.sweetness > 0.5,
      name: "Tannin-Sweet Clash",
      description: "High tannins clash with sweet wines, creating harsh, unbalanced wines.",
      requirement: "(tannins>0.7, sweetness>0.5)",
      k: 0.4, // High scaling - tannin/sweet clash is very harsh
      p: 1.5, // High power - harshness compounds quickly
      cap: 0.5
    },
    {
      sources: ['tannins'],
      targets: ['aroma'],
      condition: (wine) => wine.tannins > 0.7 && wine.aroma < 0.6,
      name: "Tannin-Aroma Overpower",
      description: "High tannins overpower low aroma, creating dull wines.",
      requirement: "(tannins>0.7, aroma<0.6)",
      k: 0.25, // Moderate scaling - tannins can mask aroma
      p: 1.4, // Higher power - overpowering effect builds up
      cap: 0.3
    },
    {
      sources: ['tannins'],
      targets: ['body'],
      condition: (wine) => wine.tannins < 0.4 && wine.body > 0.6,
      name: "Weak Tannin Structure",
      description: "Low tannins with high body create weak, flabby wines.",
      requirement: "(tannins<0.4, body>0.6)",
      k: 0.3, // Moderate scaling - flabby wines are noticeable
      p: 1.3, // Moderate power - flabbiness develops gradually
      cap: 2.0
    },
    
    // Aroma penalties
    {
      sources: ['aroma'],
      targets: ['body'],
      condition: (wine) => wine.aroma > 0.7 && wine.body < 0.6,
      name: "Aroma-Body Mismatch",
      description: "High aroma without matching body creates unbalanced wines.",
      requirement: "(aroma>0.7, body<0.6)",
      k: 0.2, // Lower scaling - aroma/body mismatch is subtle
      p: 1.2, // Standard power - builds up normally
      cap: 0.3
    },
    {
      sources: ['aroma'],
      targets: ['spice'],
      condition: (wine) => wine.aroma < 0.4 && wine.spice > 0.6,
      name: "Aroma-Spice Imbalance",
      description: "Low aroma with high spice creates harsh, unbalanced wines.",
      requirement: "(aroma<0.4, spice>0.6)",
      k: 0.25, // Moderate scaling - spice without aroma is harsh
      p: 1.4, // Higher power - harshness compounds quickly
      cap: 0.24
    },
    
    // Spice penalties
    {
      sources: ['spice'],
      targets: ['acidity'],
      condition: (wine) => wine.spice > 0.7 && wine.acidity > 0.6,
      name: "Spice-Acid Clash",
      description: "High spice clashes with high acidity, creating harsh, unbalanced wines.",
      requirement: "(spice>0.7, acidity>0.6)",
      k: 0.4, // High scaling - spice/acid clash is very harsh
      p: 1.6, // Very high power - harshness compounds rapidly
      cap: 0.5
    },
    {
      sources: ['spice'],
      targets: ['body'],
      condition: (wine) => wine.spice > 0.8 && wine.body < 0.4,
      name: "Spice-Body Overwhelm",
      description: "High spice overwhelms light-bodied wines, making them feel thin and unbalanced.",
      requirement: "(spice>0.8, body<0.4)",
      k: 0.5, // Very high scaling - overwhelming spice is very noticeable
      p: 1.8, // Very high power - overwhelming effect compounds rapidly
      cap: 2.0
    },
    {
      sources: ['spice'],
      targets: ['body'],
      condition: (wine) => wine.spice < 0.3 && wine.body > 0.7,
      name: "Flat Heavy Body",
      description: "Low spice makes high body wines feel flat and lifeless.",
      requirement: "(spice<0.3, body>0.7)",
      k: 0.25, // Moderate scaling - flat wines are noticeable
      p: 1.3, // Moderate power - flatness develops gradually
      cap: 0.3
    }
  ],
  
  synergies: [
    // Cross-trait synergies (characteristics affect each other positively)
    {
      sources: ['acidity'],
      targets: ['tannins'],
      condition: (wine) => wine.acidity > 0.7 && wine.tannins > 0.7,
      name: "Bold Red Structure",
      description: "High acidity + high tannins create classic, structured red wines.",
      requirement: "(acidity>0.7, tannins>0.7)",
      k: 0.3, // Moderate scaling - structure synergy is noticeable
      p: 1.3, // Moderate power - synergy builds up gradually
      cap: 0.75
    },
    {
      sources: ['acidity'],
      targets: ['aroma'],
      condition: (wine) => wine.acidity > 0.6 && wine.aroma > 0.7,
      name: "Bright & Aromatic",
      description: "High aroma with good acidity creates fresh, lively wines.",
      requirement: "(aroma>0.7, acidity>0.6)",
      k: 0.25, // Moderate scaling - bright wines are pleasant
      p: 1.2, // Standard power - synergy builds normally
      cap: 0.5
    },
    
    // Non-cross-trait synergies (characteristics benefit themselves)
    {
      sources: ['body', 'spice'],
      targets: ['body', 'spice'],
      condition: (wine) => wine.body >= 0.6 && wine.body <= 0.8 && wine.spice >= 0.6 && wine.spice <= 0.8,
      name: "Balanced Body & Spice",
      description: "When body and spice are both in the balanced range, they work harmoniously.",
      requirement: "(body 0.6-0.8, spice 0.6-0.8)",
      k: 0.25, // Moderate scaling - balanced wines are pleasant
      p: 1.1, // Lower power - balance is subtle but important
      cap: 0.75
    },
    {
      sources: ['tannins', 'body', 'spice'],
      targets: ['tannins', 'body', 'spice'],
      condition: (wine) => wine.tannins > 0.7 && wine.body > 0.6 && wine.spice > 0.5,
      name: "Powerful Red Blend",
      description: "Tannins, body, and spice combine for complex, age-worthy reds.",
      requirement: "(tannins>0.7, body>0.6, spice>0.5)",
      k: 0.35, // Higher scaling - complex wines are very rewarding
      p: 1.4, // Higher power - complexity compounds well
      cap: 0.65
    },
    {
      sources: ['aroma', 'sweetness', 'body'],
      targets: ['aroma', 'sweetness', 'body'],
      condition: (wine) => wine.aroma > 0.6 && wine.sweetness > 0.6 && wine.body > 0.7,
      name: "Dessert Wine Body",
      description: "Rich aroma, sweetness, and body create luxurious dessert wines.",
      requirement: "(aroma>0.6, sweetness>0.6, body>0.7)",
      k: 0.3, // Moderate scaling - dessert wines are luxurious
      p: 1.3, // Moderate power - luxury compounds nicely
      cap: 0.7
    },
    {
      sources: ['acidity', 'sweetness'],
      targets: ['acidity', 'sweetness'],
      condition: (wine) => wine.acidity >= 0.4 && wine.acidity <= 0.6 && wine.sweetness >= 0.4 && wine.sweetness <= 0.6,
      name: "Classic Balance",
      description: "Acidity and sweetness in harmony - the foundation of great wine.",
      requirement: "(acidity 0.4-0.6, sweetness 0.4-0.6)",
      k: 0.4, // High scaling - classic balance is fundamental
      p: 1.1, // Lower power - balance is foundational, not compounding
      cap: 0.6
    },
    {
      sources: ['aroma', 'body'],
      targets: ['aroma', 'body'],
      condition: (wine) => wine.aroma > wine.body && wine.sweetness >= 0.4 && wine.sweetness <= 0.6,
      name: "Elegant Complexity",
      description: "Aroma leads body with balanced sweetness for refined wines.",
      requirement: "(aroma>body, sweetness 0.4-0.6)",
      k: 0.25, // Moderate scaling - elegance is subtle but important
      p: 1.2, // Standard power - elegance builds normally
      cap: 0.6
    }
  ]
};
