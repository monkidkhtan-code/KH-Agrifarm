/**
 * KH AGRIFARM - SPRAY ADVISORY & CHEMICAL ANALYSIS ENGINE
 */

const KNOWN_AGROCHEMICALS = {
  "solomon": {
    type: "Insecticide",
    category: "Pesticide",
    active: "Imidacloprid + Beta-cyfluthrin",
    target: "Thrips, Aphids, Whiteflies, Caterpillar",
    rainfast: "2-4 hours",
    notes: "Systemic + Contact mode of action. Avoid during peak bee foraging."
  },
  "sivanto": {
    type: "Insecticide",
    category: "Pesticide",
    active: "Flupyradifurone",
    target: "Whiteflies, Aphids, Leafhoppers, Psyllids",
    rainfast: "2 hours",
    notes: "Modern targeted systemic insecticide, rapid feeding cessation."
  },
  "sivento": {
    type: "Insecticide",
    category: "Pesticide",
    active: "Flupyradifurone",
    target: "Whiteflies, Aphids, Leafhoppers",
    rainfast: "2 hours",
    notes: "Targeted systemic insecticide."
  },
  "mancozeb": {
    type: "Fungicide",
    category: "Fungicide",
    active: "Mancozeb (Dithiocarbamate)",
    target: "Anthracnose, Early Blight, Leaf Spot, Downy Mildew",
    rainfast: "3-4 hours (Needs sticker/Super Gummy in rainy season)",
    notes: "Multi-site contact protectant fungicide. Preventative application."
  },
  "plenum": {
    type: "Insecticide",
    category: "Pesticide",
    active: "Pymetrozine 50% WG",
    target: "Aphids, Plant Hoppers, Whiteflies",
    rainfast: "2-3 hours",
    notes: "Specific sucking pest feeding blocker. Highly selective."
  },
  "sanmite": {
    type: "Acaricide / Miticide",
    category: "Pesticide",
    active: "Pyridaben 20% WP",
    target: "Red Spider Mites, Broad Mites, Thrips",
    rainfast: "3 hours",
    notes: "Rapid knockdown of mite nymphs & adults."
  },
  "inveris": {
    type: "Insecticide",
    category: "Pesticide",
    active: "Afidopyropen (Inscalis)",
    target: "Whiteflies, Aphids, Scales",
    rainfast: "2 hours",
    notes: "BASF novel chordotonal organ modulator."
  },
  "bio-botava": {
    type: "Bio-Insecticide",
    category: "Organic / Botanical",
    active: "Matrine / Botanical Extracts",
    target: "Broad-spectrum insect repellent & mild fungal suppression",
    rainfast: "1-2 hours",
    notes: "Organic formulation, minimal pre-harvest interval."
  },
  "neem oil": {
    type: "Organic Repellent",
    category: "Organic / Botanical",
    active: "Azadirachtin",
    target: "Mites, Thrips, Whiteflies, Leafminers",
    rainfast: "2-3 hours",
    notes: "Growth regulator & antifeedant. Spray late evening to avoid leaf scorch."
  },
  "super gummy": {
    type: "Adjuvant / Sticker",
    category: "Spreader Sticker",
    active: "Surfactant & Latex Spreader Sticker",
    target: "Enhances rainfastness and droplet retention",
    rainfast: "Rapid adherence",
    notes: "Mix with sprays during rainy or unpredictable weather."
  },
  "rainstato": {
    type: "Adjuvant / Rainfast Agent",
    category: "Spreader Sticker",
    active: "Silicone & Polymer Deposition Agent",
    target: "Prevents wash-off during rain",
    rainfast: "Immediate",
    notes: "Crucial tank-mix partner for fungicides in monsoon season."
  },
  "luna experience": {
    type: "Fungicide",
    category: "Fungicide",
    active: "Fluopyram + Tebuconazole",
    target: "Anthracnose, Powdery Mildew, Gummy Stem Blight",
    rainfast: "2 hours",
    notes: "Translaminar and systemic dual mode of action."
  },
  "funguran": {
    type: "Fungicide / Bactericide",
    category: "Copper Protectant",
    active: "Copper Hydroxide",
    target: "Bacterial Spot, Canker, Downy Mildew",
    rainfast: "3 hours",
    notes: "Preventative copper barrier."
  },
  "super amino": {
    type: "Foliar Nutrition",
    category: "Foliar",
    active: "L-Amino Acids & Peptide Chelate",
    target: "Vegetative vigor, stress relief & nutrient uptake",
    rainfast: "1-2 hours",
    notes: "Enhances chlorophyll synthesis and crop vigor."
  },
  "oliga chitosan": {
    type: "Bio-Stimulant / Elicitor",
    category: "Foliar",
    active: "Oligo-Chitosan",
    target: "Systemic Acquired Resistance (SAR) against pathogens",
    rainfast: "1-2 hours",
    notes: "Boosts plant natural immune defense against fungal/viral attacks."
  }
};

class SprayAdvisoryEngine {
  /**
   * Evaluate spray condition given current weather and 12-hr forecast
   */
  static evaluateSprayWindow(weatherData) {
    if (!weatherData || !weatherData.hourlyForecast) {
      return {
        status: "optimal",
        level: "optimal",
        title: "Optimal to Spray",
        badgeClass: "advisory-optimal",
        description: "Dry weather forecast. Clear window for foliar and chemical applications.",
        rainRiskPercent: 10,
        driftRisk: "Low"
      };
    }

    const hourly = weatherData.hourlyForecast;
    const next3HoursRain = hourly.slice(0, 3).reduce((max, h) => Math.max(max, h.prob), 0);
    const next6HoursRain = hourly.slice(0, 6).reduce((max, h) => Math.max(max, h.prob), 0);
    const currentWind = weatherData.windSpeed || 8;

    let driftRisk = "Low (< 10 km/h)";
    if (currentWind > 18) driftRisk = "High (> 18 km/h - high drift risk)";
    else if (currentWind > 12) driftRisk = "Moderate (12-18 km/h)";

    // Condition 1: High rain risk in next 2 hours or current rain
    if (weatherData.rainCurrent > 0 || next3HoursRain >= 60) {
      return {
        status: "danger",
        level: "danger",
        title: "Do Not Spray (Rain Imminent)",
        badgeClass: "advisory-danger",
        description: `High rain risk (${next3HoursRain}% chance within 3 hours). Chemical will wash off before drying. Postpone foliar/spray operations.`,
        rainRiskPercent: next3HoursRain,
        driftRisk: driftRisk,
        recommendation: "Postpone foliar sprays. Root fertigation / drip can proceed normally."
      };
    }

    // Condition 2: Moderate rain risk or moderate winds
    if (next6HoursRain >= 35 || currentWind > 16) {
      return {
        status: "caution",
        level: "caution",
        title: "Caution: Rain / Wind Warning",
        badgeClass: "advisory-caution",
        description: `Rain probability reaches ${next6HoursRain}% within 6 hours. Ensure you add adjuvant (Super Gummy or Rainstato) for rainfast adhesion.`,
        rainRiskPercent: next6HoursRain,
        driftRisk: driftRisk,
        recommendation: "Use rainfast adjuvants (Super Gummy / Rainstato) and fine droplet spray."
      };
    }

    // Condition 3: Optimal
    return {
      status: "optimal",
      level: "optimal",
      title: "Optimal to Spray",
      badgeClass: "advisory-optimal",
      description: `Clear dry window for next 6+ hours (Rain chance < ${Math.max(next6HoursRain, 15)}%, Wind ${currentWind} km/h). Ideal for chemical uptake.`,
      rainRiskPercent: next6HoursRain,
      driftRisk: driftRisk,
      recommendation: "Excellent window for foliar fertilizers, insecticides & fungicides."
    };
  }

  /**
   * Look up chemical properties and active ingredients
   */
  static analyzeChemical(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    const matches = [];

    for (const [key, details] of Object.entries(KNOWN_AGROCHEMICALS)) {
      if (lower.includes(key)) {
        matches.push({ key, ...details });
      }
    }

    return matches;
  }
}

window.SprayAdvisoryEngine = SprayAdvisoryEngine;
window.KNOWN_AGROCHEMICALS = KNOWN_AGROCHEMICALS;
