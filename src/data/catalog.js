import {
  BellRingIcon,
  CogIcon,
  CookingPotIcon,
  CylinderIcon,
  DropletsIcon,
  FireExtinguisherIcon,
  LightbulbIcon,
  PipetteIcon,
  Volume2Icon,
  WindIcon,
} from 'lucide-react';

// What a fire and safety contractor keeps at a site: systems, and the devices
// inside them. The standards are the ones the research names for each kind
// of system; the service intervals (in months) are SAMPLES: the real interval
// comes from the standard, the authority, and the contract.
export const SYSTEM_TYPES = {
  fire_alarm: {
    label: 'Fire alarm system',
    icon: BellRingIcon,
    standard: 'NFPA 72',
    devices: {
      panel: { label: 'Fire alarm control panel', prefix: 'FACP', months: 12 },
      smoke: { label: 'Smoke detector', prefix: 'SD', months: 12 },
      heat: { label: 'Heat detector', prefix: 'HD', months: 12 },
      mcp: { label: 'Manual call point', prefix: 'MCP', months: 12 },
      sounder: { label: 'Sounder / strobe', prefix: 'SND', months: 12 },
      module: { label: 'Input / output module', prefix: 'IOM', months: 12 },
      repeater: { label: 'Repeater panel', prefix: 'RP', months: 12 },
      battery: { label: 'Battery and charger', prefix: 'BAT', months: 6 },
    },
  },
  sprinkler: {
    label: 'Sprinkler system',
    icon: DropletsIcon,
    standard: 'NFPA 25',
    devices: {
      valve: { label: 'Alarm / zone control valve', prefix: 'ZCV', months: 3 },
      flow: { label: 'Water flow switch', prefix: 'WFS', months: 6 },
      heads: { label: 'Sprinkler heads (zone)', prefix: 'SPK', months: 12 },
      tank: { label: 'Fire water tank', prefix: 'TNK', months: 12 },
      drain: { label: 'Main drain / inspector test', prefix: 'DRN', months: 12 },
    },
  },
  fire_pump: {
    label: 'Fire pump set',
    icon: CogIcon,
    standard: 'NFPA 25',
    devices: {
      electric: { label: 'Electric fire pump', prefix: 'EFP', months: 3 },
      diesel: { label: 'Diesel fire pump', prefix: 'DFP', months: 3 },
      jockey: { label: 'Jockey pump', prefix: 'JP', months: 3 },
      controller: { label: 'Pump controller', prefix: 'PC', months: 3 },
    },
  },
  hydrant_hose: {
    label: 'Hydrants and hose reels',
    icon: PipetteIcon,
    standard: 'NFPA 25',
    devices: {
      reel: { label: 'Hose reel', prefix: 'HR', months: 12 },
      valve: { label: 'Landing valve / riser outlet', prefix: 'LV', months: 12 },
      hydrant: { label: 'External fire hydrant', prefix: 'FH', months: 12 },
      inlet: { label: 'Fire brigade inlet', prefix: 'FBI', months: 12 },
    },
  },
  extinguishers: {
    label: 'Portable extinguishers',
    icon: FireExtinguisherIcon,
    standard: 'NFPA 10',
    devices: {
      abc6: { label: 'ABC powder 6 kg', prefix: 'FE', months: 12 },
      abc9: { label: 'ABC powder 9 kg', prefix: 'FE', months: 12 },
      co2: { label: 'CO₂ 5 kg', prefix: 'FE', months: 12 },
      foam: { label: 'Foam 9 L', prefix: 'FE', months: 12 },
      water: { label: 'Water 9 L', prefix: 'FE', months: 12 },
      wetchem: { label: 'Wet chemical 6 L', prefix: 'FE', months: 12 },
    },
  },
  emergency_lighting: {
    label: 'Emergency lighting',
    icon: LightbulbIcon,
    standard: 'BS 5266',
    devices: {
      fitting: { label: 'Emergency light fitting', prefix: 'EL', months: 12 },
      exit: { label: 'Exit sign', prefix: 'EX', months: 12 },
      central: { label: 'Central battery unit', prefix: 'CBU', months: 12 },
    },
  },
  clean_agent: {
    label: 'Clean-agent suppression',
    icon: CylinderIcon,
    standard: 'NFPA 2001',
    devices: {
      cylinder: { label: 'Agent cylinder', prefix: 'CYL', months: 6 },
      release: { label: 'Release control panel', prefix: 'RCP', months: 6 },
      nozzles: { label: 'Nozzle set', prefix: 'NZ', months: 12 },
    },
  },
  kitchen_hood: {
    label: 'Kitchen hood suppression',
    icon: CookingPotIcon,
    standard: 'NFPA 17A / 96',
    devices: {
      cylinder: { label: 'Wet chemical cylinder', prefix: 'WCC', months: 6 },
      links: { label: 'Fusible links and detection', prefix: 'FL', months: 6 },
      gasvalve: { label: 'Gas shut-off valve', prefix: 'GSV', months: 6 },
      pull: { label: 'Manual pull station', prefix: 'MPS', months: 6 },
    },
  },
  smoke_control: {
    label: 'Smoke control',
    icon: WindIcon,
    standard: 'NFPA 92',
    devices: {
      fan: { label: 'Smoke extract fan', prefix: 'SEF', months: 12 },
      damper: { label: 'Smoke damper', prefix: 'SDM', months: 12 },
      stair: { label: 'Stair pressurisation fan', prefix: 'SPF', months: 12 },
    },
  },
  voice_alarm: {
    label: 'Voice alarm',
    icon: Volume2Icon,
    standard: 'EN 54-16',
    devices: {
      controller: { label: 'Voice alarm controller', prefix: 'VAC', months: 12 },
      speaker: { label: 'Speaker zone', prefix: 'SPZ', months: 12 },
      phone: { label: 'Fireman telephone', prefix: 'FT', months: 12 },
    },
  },
};

export const SYSTEM_TYPE_OPTIONS = Object.entries(SYSTEM_TYPES).map(([value, t]) => ({
  value,
  label: t.label,
  sub: t.standard,
}));

export const deviceTypeOptions = (systemType) =>
  Object.entries(SYSTEM_TYPES[systemType]?.devices ?? {}).map(([value, d]) => ({
    value,
    label: d.label,
    sub: `Service every ${d.months} months`,
  }));

// Where a customer's business sits. Used for filters and to shape the data.
export const SEGMENTS = [
  'Residential',
  'Hospitality',
  'Healthcare',
  'Education',
  'Retail',
  'Industrial',
  'Office',
  'Food and beverage',
  'Facilities management',
  'Contractor',
  'Data centre',
];

export const BUILDING_TYPES = [
  'Residential tower',
  'Villa',
  'Office tower',
  'Hotel',
  'Hospital / clinic',
  'School',
  'Shopping mall',
  'Supermarket / shop',
  'Restaurant / kitchen',
  'Warehouse',
  'Factory',
  'Data centre',
  'Workshop',
  'Staff accommodation',
  'Under construction',
];

export const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];

export const PAYMENT_TERMS = ['Cash', 'Advance', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];

export const CONTACT_ROLES = {
  decision: 'Decision maker',
  building: 'Building / facilities',
  accounts: 'Accounts',
  site: 'Site contact',
  technical: 'Technical',
};
