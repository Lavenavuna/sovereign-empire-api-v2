const DEFAULT_TARGET_STATES = ['TX'];
const BASE_REQUIRED_LEGAL_FIELDS = [
  'sellerDisclosureProvidedAt',
  'buyerDisclosureProvidedAt',
  'attorneyReviewedTemplate',
  'disclosureVersion',
  'marketingMode'
];

const LEGAL_FIELD_SCHEMA = {
  sellerDisclosureProvidedAt: { type: 'timestamp', description: 'Seller disclosure confirmation timestamp' },
  buyerDisclosureProvidedAt: { type: 'timestamp', description: 'Buyer disclosure confirmation timestamp' },
  attorneyReviewedTemplate: { type: 'boolean_true', description: 'Attorney-reviewed contract/disclosure template confirmed' },
  disclosureVersion: { type: 'non_empty_string', description: 'Versioned disclosure artifact identifier' },
  marketingMode: { type: 'enum', allowed: ['contract_only'], description: 'Marketing mode (must remain contract_only)' },
  separateDisclosureDocumentProvidedAt: { type: 'timestamp', description: 'Separate disclosure statement delivered timestamp' },
  wholesalerRegistrationId: { type: 'non_empty_string', description: 'Wholesaler registration ID where state registration is required' },
  sellerCancellationWindowDays: { type: 'number', description: 'Seller cancellation window disclosed in days' },
  sellerCancellationWindowDisclosedAt: { type: 'timestamp', description: 'Cancellation window disclosure timestamp' },
  contractSignedAt: { type: 'timestamp', description: 'Contract signed timestamp for state close deadline calculations' },
  closeDeadlineAt: { type: 'timestamp', description: 'Documented contractual close deadline timestamp' }
};

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
    marketingRule: 'Market contractual interest, not the property as owner/agent',
    regulatory: {
      maturity: 'active',
      registrationRequired: false,
      separateDisclosureDocumentRequired: false,
      sellerCancellationWindowDays: null,
      maxClosingDaysFromContract: null,
      requiredLegalFields: BASE_REQUIRED_LEGAL_FIELDS
    }
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
    marketingRule: 'Do not market as owner/agent when assigning contractual rights',
    regulatory: {
      maturity: 'provisional',
      registrationRequired: false,
      separateDisclosureDocumentRequired: false,
      sellerCancellationWindowDays: null,
      maxClosingDaysFromContract: null,
      requiredLegalFields: BASE_REQUIRED_LEGAL_FIELDS
    }
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
    marketingRule: 'Do not market as owner/agent when assigning contractual rights',
    regulatory: {
      maturity: 'provisional',
      registrationRequired: false,
      separateDisclosureDocumentRequired: false,
      sellerCancellationWindowDays: null,
      maxClosingDaysFromContract: null,
      requiredLegalFields: BASE_REQUIRED_LEGAL_FIELDS
    }
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
    marketingRule: 'Do not market as owner/agent when assigning contractual rights',
    regulatory: {
      maturity: 'provisional',
      registrationRequired: false,
      separateDisclosureDocumentRequired: false,
      sellerCancellationWindowDays: null,
      maxClosingDaysFromContract: null,
      requiredLegalFields: BASE_REQUIRED_LEGAL_FIELDS
    }
  },
  OH: {
    stateCode: 'OH',
    stateName: 'Ohio',
    model: 'assignment_with_disclosure',
    class: 'enhanced-disclosure',
    statutes: ['State-specific review required'],
    requiredDisclosures: [
      'separate written disclosure statement delivered before assignment activity',
      'equitable-interest disclosure to seller and end buyer'
    ],
    marketingRule: 'Do not market as owner/agent when assigning contractual rights',
    regulatory: {
      maturity: 'placeholder',
      registrationRequired: false,
      separateDisclosureDocumentRequired: true,
      sellerCancellationWindowDays: null,
      maxClosingDaysFromContract: null,
      requiredLegalFields: [
        ...BASE_REQUIRED_LEGAL_FIELDS,
        'separateDisclosureDocumentProvidedAt'
      ]
    }
  },
  CT: {
    stateCode: 'CT',
    stateName: 'Connecticut',
    model: 'assignment_with_disclosure',
    class: 'registered-wholesaler',
    statutes: ['State-specific review required'],
    requiredDisclosures: [
      'separate written disclosure statement delivered before assignment activity',
      'seller cancellation window disclosure and deadline traceability'
    ],
    marketingRule: 'Do not market as owner/agent when assigning contractual rights',
    regulatory: {
      maturity: 'placeholder',
      registrationRequired: true,
      separateDisclosureDocumentRequired: true,
      sellerCancellationWindowDays: 3,
      maxClosingDaysFromContract: 90,
      requiredLegalFields: [
        ...BASE_REQUIRED_LEGAL_FIELDS,
        'separateDisclosureDocumentProvidedAt',
        'wholesalerRegistrationId',
        'sellerCancellationWindowDays',
        'sellerCancellationWindowDisclosedAt',
        'contractSignedAt',
        'closeDeadlineAt'
      ]
    }
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

function hasNonEmptyString(value) {
  return Boolean(String(value || '').trim());
}

function asFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getProfileRequiredLegalFields(profile) {
  return profile?.regulatory?.requiredLegalFields || BASE_REQUIRED_LEGAL_FIELDS;
}

function validateLegalField(field, legal) {
  const value = legal[field];
  switch (field) {
    case 'sellerDisclosureProvidedAt':
      return hasDisclosureTimestamp(value) ? null : 'Missing seller disclosure confirmation timestamp';
    case 'buyerDisclosureProvidedAt':
      return hasDisclosureTimestamp(value) ? null : 'Missing buyer disclosure confirmation timestamp';
    case 'attorneyReviewedTemplate':
      return value === true ? null : 'Attorney-reviewed contract/disclosure template is not confirmed';
    case 'disclosureVersion':
      return hasNonEmptyString(value) ? null : 'Missing disclosureVersion for audit traceability';
    case 'marketingMode':
      if (!hasNonEmptyString(value)) return 'marketingMode is required and must be contract_only';
      return value === 'contract_only' ? null : 'Marketing mode must be contract_only for assignment workflow';
    case 'separateDisclosureDocumentProvidedAt':
      return hasDisclosureTimestamp(value) ? null : 'Missing separate disclosure document confirmation timestamp';
    case 'wholesalerRegistrationId':
      return hasNonEmptyString(value) ? null : 'Missing wholesaler registration ID for this state';
    case 'sellerCancellationWindowDays': {
      const n = asFiniteNumber(value);
      return n !== null && n > 0 ? null : 'sellerCancellationWindowDays must be a positive number';
    }
    case 'sellerCancellationWindowDisclosedAt':
      return hasDisclosureTimestamp(value) ? null : 'Missing seller cancellation window disclosure timestamp';
    case 'contractSignedAt':
      return hasDisclosureTimestamp(value) ? null : 'Missing contractSignedAt timestamp for state close deadline checks';
    case 'closeDeadlineAt':
      return hasDisclosureTimestamp(value) ? null : 'Missing closeDeadlineAt timestamp for state close deadline checks';
    default:
      return hasNonEmptyString(value) ? null : `Missing required legal field: ${field}`;
  }
}

function addDaysIso(value, days) {
  const parsed = parseTimestamp(value);
  if (!parsed) return null;
  const date = new Date(parsed);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
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

  const requiredFields = getProfileRequiredLegalFields(profile);
  for (const field of requiredFields) {
    const error = validateLegalField(field, legal);
    if (error) errors.push(error);
  }

  const regulatory = profile?.regulatory || {};
  if (regulatory.registrationRequired && !hasNonEmptyString(legal.wholesalerRegistrationId)) {
    errors.push(`${stateCode} requires a wholesaler registration ID`);
  }

  if (regulatory.separateDisclosureDocumentRequired && !hasDisclosureTimestamp(legal.separateDisclosureDocumentProvidedAt)) {
    errors.push(`${stateCode} requires separate written disclosure delivery timestamp`);
  }

  if (Number.isFinite(regulatory.sellerCancellationWindowDays)) {
    const disclosedDays = asFiniteNumber(legal.sellerCancellationWindowDays);
    if (disclosedDays === null) {
      errors.push(`${stateCode} requires sellerCancellationWindowDays to be recorded`);
    } else if (disclosedDays < regulatory.sellerCancellationWindowDays) {
      errors.push(
        `${stateCode} requires seller cancellation window >= ${regulatory.sellerCancellationWindowDays} day(s)`
      );
    }
    if (!hasDisclosureTimestamp(legal.sellerCancellationWindowDisclosedAt)) {
      errors.push(`${stateCode} requires seller cancellation window disclosure timestamp`);
    }
  }

  if (Number.isFinite(regulatory.maxClosingDaysFromContract)) {
    const contractSignedAt = parseTimestamp(
      legal.contractSignedAt || deal.dispositionTimeline?.contractSignedAt || deal.sourceEconomics?.contractDate
    );
    if (!contractSignedAt) {
      errors.push(`${stateCode} requires contractSignedAt before close gating can proceed`);
    } else {
      const deadline = addDaysIso(contractSignedAt, regulatory.maxClosingDaysFromContract);
      const documentedDeadline = parseTimestamp(legal.closeDeadlineAt);
      if (!documentedDeadline) {
        errors.push(`${stateCode} requires closeDeadlineAt for compliance traceability`);
      } else if (deadline && documentedDeadline > deadline) {
        errors.push(
          `${stateCode} close deadline exceeds ${regulatory.maxClosingDaysFromContract}-day statutory cap from contract date`
        );
      }

      const actualClose = parseTimestamp(
        deal.dispositionTimeline?.closeDate || deal.sourceEconomics?.closeDate || deal.closedAt
      );
      if (deadline && actualClose && actualClose > deadline) {
        errors.push(`${stateCode} deal closed outside ${regulatory.maxClosingDaysFromContract}-day compliance window`);
      }
    }
  }

  if (profile?.regulatory?.maturity === 'placeholder') {
    warnings.push(`${stateCode} profile is placeholder-only; validate active statute text with licensed counsel before execution`);
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
      requiredLegalFields: BASE_REQUIRED_LEGAL_FIELDS
    },
    legalFieldSchema: LEGAL_FIELD_SCHEMA
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
