const DEFAULT_TARGET_STATES = ['TX'];

const LAW_PROFILES = {
  TX: {
    stateCode: 'TX',
    stateName: 'Texas',
    model: 'assignment_with_disclosure',
    class: 'disclosure-permitted',
    statutes: ['Occupations Code 1101.0045', 'Property Code 5.0205', 'Property Code 5.086'],
    requiredDisclosures: [
      'equitable-interest disclosure to seller before assignment',
      'equitable-interest disclosure to end buyer before assignment'
    ],
    marketingRule: 'Market contractual interest, not the property as owner/agent'
  },
  FL: {
    stateCode: 'FL',
    stateName: 'Florida',
    model: 'assignment_with_disclosure',
    class: 'disclosure-permitted',
    statutes: ['State-specific review required'],
    requiredDisclosures: [
      'equitable-interest disclosure to seller and buyer',
      'contract assignment terms reviewed by counsel'
    ],
    marketingRule: 'Do not market as owner/agent when assigning contractual rights'
  },
  GA: {
    stateCode: 'GA',
    stateName: 'Georgia',
    model: 'assignment_with_disclosure',
    class: 'disclosure-permitted',
    statutes: ['State-specific review required'],
    requiredDisclosures: [
      'equitable-interest disclosure to seller and buyer',
      'contract assignment terms reviewed by counsel'
    ],
    marketingRule: 'Do not market as owner/agent when assigning contractual rights'
  },
  AZ: {
    stateCode: 'AZ',
    stateName: 'Arizona',
    model: 'assignment_with_disclosure',
    class: 'disclosure-permitted',
    statutes: ['State-specific review required'],
    requiredDisclosures: [
      'equitable-interest disclosure to seller and buyer',
      'contract assignment terms reviewed by counsel'
    ],
    marketingRule: 'Do not market as owner/agent when assigning contractual rights'
  }
};

const DISCLOSURE_CLAUSES = {
  TX: 'NOTICE: This offer involves the assignment of contractual rights/equitable interest only. Assignor does not currently hold legal title to the property and is selling/assigning contractual interest, not fee ownership.'
};

const SB17_DESIGNATED_COUNTRIES = ['CN', 'RU', 'IR', 'KP'];

const COUNTRY_ALIASES = {
  CHINA: 'CN',
  CN: 'CN',
  RUSSIA: 'RU',
  RU: 'RU',
  IRAN: 'IR',
  IR: 'IR',
  'NORTH KOREA': 'KP',
  DPRK: 'KP',
  KP: 'KP'
};

function normalizeStateCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return code.length >= 2 ? code.slice(0, 2) : '';
}

function normalizeCountryCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return '';
  return COUNTRY_ALIASES[normalized] || normalized.slice(0, 2);
}

function normalizeCountryCodes(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(normalizeCountryCode).filter(Boolean))];
}

function isDesignatedCountry(code) {
  return SB17_DESIGNATED_COUNTRIES.includes(normalizeCountryCode(code));
}

function getTargetStates(wholesaleState) {
  const configured = wholesaleState?.meta?.compliance?.targetStateCodes;
  if (!Array.isArray(configured) || configured.length === 0) {
    return [...DEFAULT_TARGET_STATES];
  }
  return configured.map(normalizeStateCode).filter(Boolean);
}

function getDealPropertyState(wholesaleState, deal) {
  const property = wholesaleState.properties.find(p => p.id === deal.propertyId);
  return normalizeStateCode(property?.state);
}

function getLawProfile(stateCode) {
  return LAW_PROFILES[stateCode] || null;
}

function parseTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hasDisclosureTimestamp(value) {
  return Boolean(parseTimestamp(value));
}

export function evaluateDealCompliance(wholesaleState, deal) {
  const errors = [];
  const warnings = [];
  const targetStates = getTargetStates(wholesaleState);
  const stateCode = getDealPropertyState(wholesaleState, deal);
  const profile = getLawProfile(stateCode);
  const legal = deal.legal || {};

  if (!stateCode) {
    errors.push('Property state is missing on the linked deal property');
  }

  if (stateCode && !targetStates.includes(stateCode)) {
    errors.push(
      `State ${stateCode} is outside active targeting (${targetStates.join(', ')}). Update compliance target states first.`
    );
  }

  if (stateCode && !profile) {
    errors.push(
      `No legal playbook profile configured for ${stateCode}. Add a profile before sourcing or closing in this state.`
    );
  }

  if (profile && profile.model !== 'assignment_with_disclosure') {
    errors.push(
      `${stateCode} profile is not configured for assignment workflow. Use manual legal review before execution.`
    );
  }

  if (!hasDisclosureTimestamp(legal.sellerDisclosureProvidedAt)) {
    errors.push('Missing seller disclosure confirmation timestamp');
  }

  if (!hasDisclosureTimestamp(legal.buyerDisclosureProvidedAt)) {
    errors.push('Missing buyer disclosure confirmation timestamp');
  }

  if (!legal.attorneyReviewedTemplate) {
    errors.push('Attorney-reviewed contract/disclosure template is not confirmed');
  }

  if (!legal.disclosureVersion || !String(legal.disclosureVersion).trim()) {
    errors.push('Missing disclosureVersion for audit traceability');
  }

  if (legal.marketingMode && legal.marketingMode !== 'contract_only') {
    errors.push('Marketing mode must be contract_only for assignment workflow');
  }

  if (!legal.marketingMode) {
    warnings.push('marketingMode is not set; default should be contract_only');
  }

  return {
    ok: errors.length === 0,
    stateCode,
    profile,
    targetStates,
    errors,
    warnings
  };
}

export function getCompliancePlaybook(wholesaleState) {
  return {
    market: wholesaleState?.meta?.market || 'unknown',
    targetStateCodes: getTargetStates(wholesaleState),
    supportedProfiles: Object.values(LAW_PROFILES),
    defaults: {
      strictMode: true,
      requiredLegalFields: [
        'sellerDisclosureProvidedAt',
        'buyerDisclosureProvidedAt',
        'attorneyReviewedTemplate',
        'disclosureVersion',
        'marketingMode=contract_only'
      ]
    }
  };
}

export function getDisclosureClause(stateCode) {
  const code = normalizeStateCode(stateCode);
  if (!code) return DISCLOSURE_CLAUSES.TX;
  return DISCLOSURE_CLAUSES[code] || DISCLOSURE_CLAUSES.TX;
}

export function applyComplianceSettings(wholesaleState, input) {
  const state = wholesaleState;
  const nextTargetStates = Array.isArray(input?.targetStateCodes)
    ? input.targetStateCodes.map(normalizeStateCode).filter(Boolean)
    : null;

  if (!nextTargetStates || nextTargetStates.length === 0) {
    return {
      success: false,
      error: 'targetStateCodes must be a non-empty array of state codes'
    };
  }

  const unsupported = nextTargetStates.filter(code => !LAW_PROFILES[code]);
  if (unsupported.length) {
    return {
      success: false,
      error: `Unsupported state profile(s): ${unsupported.join(', ')}`
    };
  }

  state.meta = state.meta || {};
  state.meta.compliance = state.meta.compliance || {};
  state.meta.compliance.targetStateCodes = nextTargetStates;
  state.meta.compliance.updatedAt = new Date().toISOString();

  return {
    success: true,
    targetStateCodes: nextTargetStates
  };
}

export function normalizePropertyState(value) {
  return normalizeStateCode(value);
}

export function getSb17DesignatedCountries() {
  return [...SB17_DESIGNATED_COUNTRIES];
}

export function evaluateForeignBuyerRisk(profileInput) {
  const profile = profileInput || {};
  const citizenshipCountries = normalizeCountryCodes(profile.citizenshipCountries);
  const majorityControlCountries = normalizeCountryCodes(profile.majorityControlCountries);
  const domicileCountry = normalizeCountryCode(profile.domicileCountry);
  const entityHeadquartersCountry = normalizeCountryCode(profile.entityHeadquartersCountry);
  const isUsCitizen = Boolean(profile.isUsCitizen);
  const isLawfulPermanentResident = Boolean(profile.isLawfulPermanentResident);
  const isForeignGovernmentAgent = Boolean(profile.isForeignGovernmentAgent);
  const foreignGovernmentAgentCountry = normalizeCountryCode(profile.foreignGovernmentAgentCountry);

  const blockedReasons = [];
  if (!(isUsCitizen || isLawfulPermanentResident)) {
    if (domicileCountry && isDesignatedCountry(domicileCountry)) {
      blockedReasons.push(`Domicile country is designated under TX SB17 (${domicileCountry})`);
    }

    if (citizenshipCountries.length === 1 && isDesignatedCountry(citizenshipCountries[0])) {
      blockedReasons.push(`Only citizenship is a designated SB17 country (${citizenshipCountries[0]})`);
    }

    if (entityHeadquartersCountry && isDesignatedCountry(entityHeadquartersCountry)) {
      blockedReasons.push(`Entity headquarters country is designated under SB17 (${entityHeadquartersCountry})`);
    }

    const designatedControl = majorityControlCountries.filter(isDesignatedCountry);
    if (designatedControl.length) {
      blockedReasons.push(
        `Entity majority control includes designated SB17 country (${designatedControl.join(', ')})`
      );
    }

    if (isForeignGovernmentAgent && isDesignatedCountry(foreignGovernmentAgentCountry)) {
      blockedReasons.push(`Buyer profile indicates designated-country government/party affiliation (${foreignGovernmentAgentCountry})`);
    }
  }

  return {
    blocked: blockedReasons.length > 0,
    blockedReasons,
    checkVersion: 'sb17-2025-09-01',
    screenedAt: new Date().toISOString(),
    designatedCountries: getSb17DesignatedCountries(),
    profile: {
      isUsCitizen,
      isLawfulPermanentResident,
      domicileCountry,
      citizenshipCountries,
      entityHeadquartersCountry,
      majorityControlCountries,
      isForeignGovernmentAgent,
      foreignGovernmentAgentCountry
    }
  };
}
