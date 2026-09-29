// The words of the Projects and Schedule areas. Sources are our own study
// (sections D.2, D.4, K.5 and K.6) and the products and standards it names;
// what could not be read for the UAE says "sample" on the screens.

// The phases of an installation project (study, workflow 2). "Defects
// liability" is the period after handover in which the contractor repairs
// defects and the customer holds back the retention.
export const PHASES = {
  approvals: { label: 'Design and approvals', tone: 'violet', blurb: 'Drawings, calculations and the authority\'s approval of the drawings, before the work starts.' },
  installation: { label: 'Procurement and installation', tone: 'blue', blurb: 'Materials are bought and the teams install, package by package.' },
  testing: { label: 'Testing and commissioning', tone: 'orange', blurb: 'Every system is tested against its standard and the results are recorded.' },
  handover: { label: 'Handover', tone: 'orange', blurb: 'Snags are closed, the authority inspects, documents are issued and the customer takes over.' },
  retention: { label: 'Defects liability', tone: 'green', blurb: 'The customer holds the retention until the period ends. Defects are repaired at our cost.' },
  complete: { label: 'Complete', tone: 'neutral', blurb: 'The retention is released and the project is closed.' },
};
export const PHASE_ORDER = ['approvals', 'installation', 'testing', 'handover', 'retention', 'complete'];

// For the status badge: a project on hold shows that, whatever its phase.
export const PROJECT_STATUS = {
  ...Object.fromEntries(Object.entries(PHASES).map(([key, p]) => [key, [p.tone, p.label]])),
  on_hold: ['red', 'On hold'],
};

export const VARIATION_STATUS = {
  draft: ['neutral', 'Draft'],
  submitted: ['orange', 'Waiting for the customer'],
  approved: ['green', 'Approved'],
  rejected: ['red', 'Rejected'],
};

export const CLAIM_KIND = { advance: 'Advance', progress: 'Progress', retention: 'Retention release' };
export const CLAIM_STATUS = {
  draft: ['neutral', 'Draft'],
  submitted: ['orange', 'Waiting for the certificate'],
  certified: ['blue', 'Certified'],
  invoiced: ['violet', 'Invoiced'],
  paid: ['green', 'Paid'],
};

export const DOC_KINDS = {
  method: 'Method statement',
  drawings: 'Shop drawings',
  calcs: 'Calculations',
  submittal: 'Material submittal',
  cd_drawings: 'Civil Defence approval of drawings',
  test_report: 'Test report',
  asbuilt: 'As-built drawings',
  om: 'Operation and maintenance manual',
  warranty: 'Warranty certificate',
};
export const DOC_STATUS = {
  planned: ['neutral', 'Not started'],
  draft: ['neutral', 'In preparation'],
  submitted: ['orange', 'Submitted'],
  approved: ['green', 'Approved'],
  rejected: ['red', 'Rejected: resubmit'],
  issued: ['green', 'Issued'],
};
// What is asked at handover: the documents that must be issued, not only approved.
export const HANDOVER_DOCS = ['asbuilt', 'om', 'warranty', 'test_report'];

export const COST_KINDS = { material: 'Materials', labour: 'Labour', subcontract: 'Subcontract', other: 'Other' };
export const COST_STATE = { committed: 'Ordered, not billed yet', incurred: 'Billed or booked' };

export const TASK_STATUS = {
  todo: ['neutral', 'To plan'],
  planned: ['blue', 'Planned'],
  in_progress: ['violet', 'In progress'],
  done: ['green', 'Done'],
};

export const ABSENCE_KINDS = { leave: 'Annual leave', sick: 'Sick leave', training: 'Training', other: 'Not available' };

// The acceptance tests of each kind of system, from the standards that the
// study names (sample wording: the exact test list comes from the consultant's
// specification of each project).
export const TEST_TEMPLATES = {
  fire_alarm: [
    'Device addressing and loop test (NFPA 72)',
    'Cause and effect test of the fire alarm matrix',
    'Battery standby and alarm load test',
    'Sounder sound level test',
    'Interface test: lifts, dampers, door holders',
  ],
  sprinkler: [
    'Hydrostatic pressure test (NFPA 13, 2 hours)',
    'Flow switch and alarm test',
    'Main drain test',
  ],
  hydrant_hose: ['Hose reel and hydrant flow and pressure test'],
  fire_pump: [
    'Pump acceptance test at churn, rated and 150% flow (NFPA 20)',
    'Controller and automatic start test',
  ],
  emergency_lighting: [
    'Full duration test (3 hours, BS 5266)',
    'Mains failure switch-over test',
  ],
  extinguishers: ['Extinguisher placement, signs and tags check'],
  voice_alarm: ['Speech intelligibility test (EN 54-16)', 'Zone announcement test'],
  smoke_control: ['Fan and damper operation test (NFPA 92)'],
};

// What the handover writes into the equipment register: the catalogue item of
// a quotation line, and the kind of system and device it becomes.
export const HANDOVER_MAP = {
  'FA-PNL-2L': ['fire_alarm', 'panel'],
  'FA-PNL-4L': ['fire_alarm', 'panel'],
  'FA-RPT': ['fire_alarm', 'repeater'],
  'FA-SD': ['fire_alarm', 'smoke'],
  'FA-HD': ['fire_alarm', 'heat'],
  'FA-MCP': ['fire_alarm', 'mcp'],
  'FA-SND': ['fire_alarm', 'sounder'],
  'FA-IOM': ['fire_alarm', 'module'],
  'FA-BAT': ['fire_alarm', 'battery'],
  'SP-HEAD': ['sprinkler', 'heads'],
  'SP-ZCV': ['sprinkler', 'valve'],
  'SP-FLOW': ['sprinkler', 'flow'],
  'HY-REEL': ['hydrant_hose', 'reel'],
  'HY-LV': ['hydrant_hose', 'valve'],
  'HY-HYD': ['hydrant_hose', 'hydrant'],
  'PU-EL': ['fire_pump', 'electric'],
  'PU-DI': ['fire_pump', 'diesel'],
  'PU-JP': ['fire_pump', 'jockey'],
  'FE-ABC6': ['extinguishers', 'abc6'],
  'FE-ABC9': ['extinguishers', 'abc9'],
  'FE-CO2': ['extinguishers', 'co2'],
  'FE-FOAM': ['extinguishers', 'foam'],
  'FE-WC': ['extinguishers', 'wetchem'],
  'EL-FIT': ['emergency_lighting', 'fitting'],
  'EL-EXIT': ['emergency_lighting', 'exit'],
  'VA-CTL': ['voice_alarm', 'controller'],
  'VA-SPK': ['voice_alarm', 'speaker'],
  'SC-DMP': ['smoke_control', 'damper'],
};
