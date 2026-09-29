import { newId } from '../lib/ids.js';
import { SYSTEM_TYPES } from './catalog.js';

// How a maintenance contract is priced from the equipment register: each kind
// of device has a yearly rate per unit (an item of the catalogue), and the
// quantity is the number of devices the register holds. A rate can be per 100
// units (sprinkler heads, speakers). Devices with no rate are "included" in
// the price of their system. The rates are samples.
const RATE = {
  fire_alarm: { panel: ['AMC-FA-BASE'], smoke: ['AMC-FA-DET'], heat: ['AMC-FA-DET'], mcp: ['AMC-FA-MCP'], sounder: ['AMC-FA-SND'] },
  sprinkler: { valve: ['AMC-SP-ZONE'], heads: ['AMC-SP-HEADS', 100] },
  fire_pump: { electric: ['AMC-PUMP'], diesel: ['AMC-PUMP'], jockey: ['AMC-PUMP'] },
  hydrant_hose: { reel: ['AMC-HOSE'], valve: ['AMC-HOSE'] },
  extinguishers: {
    abc6: ['AMC-FE'], abc9: ['AMC-FE'], co2: ['AMC-FE'], foam: ['AMC-FE'], water: ['AMC-FE'], wetchem: ['AMC-FE'],
  },
  emergency_lighting: { fitting: ['AMC-EL'], exit: ['AMC-EL'] },
  kitchen_hood: { cylinder: ['AMC-KH'] },
  clean_agent: { cylinder: ['AMC-CA'] },
  smoke_control: { fan: ['AMC-FAN'], stair: ['AMC-FAN'] },
  voice_alarm: { speaker: ['AMC-VA', 100] },
};

/**
 * The sections and lines of a contract quotation for the given systems of a
 * site: one section per system, one line per rated kind of device.
 *   items:   the catalogue rows keyed by code
 *   devices: every device row (they are filtered by system)
 */
export function amcSections(systems, devices, itemsByCode, makeId = newId) {
  const sections = [];
  const lines = [];
  for (const system of systems) {
    const rates = RATE[system.type] ?? {};
    const sectionId = makeId('sec');
    const perItem = new Map();
    for (const d of devices.filter((x) => x.systemId === system.id)) {
      const rate = rates[d.type];
      if (!rate) continue;
      const [code, per = 1] = rate;
      perItem.set(code, (perItem.get(code) ?? 0) + d.qty / per);
    }
    if (perItem.size === 0) continue;
    sections.push({ id: sectionId, title: system.name, systemId: system.id });
    for (const [code, qty] of perItem) {
      const item = itemsByCode[code];
      if (!item) continue;
      lines.push({
        id: makeId('ln'),
        sectionId,
        itemId: item.id,
        systemId: system.id,
        description: item.name,
        unit: item.unit,
        qty: Math.ceil(qty),
        cost: item.cost,
        price: item.price,
      });
    }
  }
  return { sections, lines };
}

// What a system is covered for, in words, for the coverage panel.
export const coverageNote = (system) => `${SYSTEM_TYPES[system.type].standard} · ${system.location}`;
