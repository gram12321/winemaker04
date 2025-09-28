import { RangeAdjustmentConfig } from '../types/balanceRulesTypes';

// Range adjustment rules - simple, clean configuration
export const RANGE_ADJUSTMENTS: RangeAdjustmentConfig = {
  acidity: {
    above: {
      rangeShifts: [
        {
          target: 'sweetness',
          shiftPerUnit: -0.15,
          name: "Acidity-Sweetness Inverse",
          description: "High acidity reduces optimal sweetness range",
          requirement: "(acidity above normal)"
        }
      ]
    },
    below: {
      rangeShifts: [
        {
          target: 'sweetness',
          shiftPerUnit: -0.15,
          name: "Acidity-Sweetness Inverse",
          description: "Low acidity affects sweetness range",
          requirement: "(acidity below normal)"
        }
      ]
    }
  },
  body: {
    above: {
      rangeShifts: [
        {
          target: 'spice',
          shiftPerUnit: 0.08,
          name: "Body-Spice Correlation",
          description: "High body increases optimal spice range",
          requirement: "(body above normal)"
        },
        {
          target: 'tannins',
          shiftPerUnit: 0.08,
          name: "Body-Tannin Correlation",
          description: "High body increases optimal tannin range",
          requirement: "(body above normal)"
        }
      ]
    },
    below: {
      rangeShifts: [
        {
          target: 'spice',
          shiftPerUnit: 0.08,
          name: "Body-Spice Correlation",
          description: "Low body affects spice range",
          requirement: "(body below normal)"
        },
        {
          target: 'tannins',
          shiftPerUnit: 0.08,
          name: "Body-Tannin Correlation",
          description: "Low body affects tannin range",
          requirement: "(body below normal)"
        }
      ]
    }
  },
  sweetness: {
    above: {
      rangeShifts: [
        {
          target: 'acidity',
          shiftPerUnit: -0.10,
          name: "Sweetness-Acidity Inverse",
          description: "High sweetness reduces optimal acidity range",
          requirement: "(sweetness above normal)"
        }
      ]
    },
    below: {
      rangeShifts: [
        {
          target: 'acidity',
          shiftPerUnit: -0.10,
          name: "Sweetness-Acidity Inverse",
          description: "Low sweetness affects acidity range",
          requirement: "(sweetness below normal)"
        }
      ]
    }
  },
  tannins: {
    above: {
      rangeShifts: [
        {
          target: 'body',
          shiftPerUnit: 0.10,
          name: "Tannin-Body Correlation",
          description: "High tannins increase optimal body range",
          requirement: "(tannins above normal)"
        },
        {
          target: 'aroma',
          shiftPerUnit: 0.08,
          name: "Tannin-Aroma Correlation",
          description: "High tannins increase optimal aroma range",
          requirement: "(tannins above normal)"
        },
        {
          target: 'sweetness',
          shiftPerUnit: -0.05,
          name: "Tannin-Sweetness Inverse",
          description: "High tannins reduce optimal sweetness range",
          requirement: "(tannins above normal)"
        }
      ]
    },
    below: {
      rangeShifts: [
        {
          target: 'body',
          shiftPerUnit: 0.10,
          name: "Tannin-Body Correlation",
          description: "Low tannins affect body range",
          requirement: "(tannins below normal)"
        },
        {
          target: 'aroma',
          shiftPerUnit: 0.08,
          name: "Tannin-Aroma Correlation",
          description: "Low tannins affect aroma range",
          requirement: "(tannins below normal)"
        },
        {
          target: 'sweetness',
          shiftPerUnit: -0.05,
          name: "Tannin-Sweetness Inverse",
          description: "Low tannins affect sweetness range",
          requirement: "(tannins below normal)"
        }
      ]
    }
  },
  aroma: {
    above: {
      rangeShifts: [
        {
          target: 'body',
          shiftPerUnit: 0.06,
          name: "Aroma-Body Correlation",
          description: "High aroma increases optimal body range",
          requirement: "(aroma above normal)"
        }
      ]
    },
    below: {
      rangeShifts: [
        {
          target: 'body',
          shiftPerUnit: 0.06,
          name: "Aroma-Body Correlation",
          description: "Low aroma affects body range",
          requirement: "(aroma below normal)"
        }
      ]
    }
  },
  spice: {
    above: {
      rangeShifts: []
    },
    below: {
      rangeShifts: []
    }
  }
};
