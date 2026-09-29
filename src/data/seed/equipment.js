import { addDays } from '../../lib/dates.js';
import { SYSTEM_TYPES } from '../catalog.js';

// Systems and devices of the sample sites. A "system" is what the contractor
// installed and maintains; a "device" row is one item or a group of the same
// item in one place (a group has a quantity and a tag range), the way a
// contractor's register keeps 600 smoke detectors. Dates are relative to
// today, so the demo always shows a mix of "ok", "due soon" and "overdue".
// Makes and models are generic examples, not a statement about the real site.

export function buildEquipment(T) {
  const systems = {};
  const devices = {};
  const tagCounters = {};
  let sysN = 0;
  let devN = 0;
  const pad = (n, w) => String(n).padStart(w, '0');

  // add(site, type, name, location, installedYear, lastVisitDaysAgo, rows)
  // row: [deviceType, qty, location, { make, model, last, months, condition }]
  const add = (siteId, type, name, location, installedYear, last, rows) => {
    const id = `sys_${++sysN}`;
    systems[id] = {
      id, siteId, type, name, location,
      installedOn: `${installedYear}-06-01`,
      status: 'in_service',
      notes: '',
    };
    for (const [devType, qty, loc, o = {}] of rows) {
      const def = SYSTEM_TYPES[type].devices[devType];
      const key = `${siteId}:${def.prefix}`;
      const first = (tagCounters[key] ?? 0) + 1;
      tagCounters[key] = first + qty - 1;
      const tag =
        qty === 1
          ? `${def.prefix}-${pad(first, 2)}`
          : `${def.prefix}-${pad(first, 3)} to ${def.prefix}-${pad(first + qty - 1, 3)}`;
      const did = `dev_${++devN}`;
      devices[did] = {
        id: did,
        systemId: id,
        siteId,
        type: devType,
        qty,
        tag,
        location: loc,
        make: o.make ?? '',
        model: o.model ?? '',
        serial: o.serial ?? '',
        installedOn: `${installedYear}-06-01`,
        lastServiced: addDays(T, -(o.last ?? last)),
        intervalMonths: o.months ?? def.months,
        condition: o.condition ?? 'ok',
      };
    }
    return id;
  };

  // ---- Marina Crest Towers: a 46-floor residential tower, all systems -----
  const m = 'site_marina';
  add(m, 'fire_alarm', 'Fire alarm system', 'Fire command centre, podium', 2016, 300, [
    ['panel', 1, 'Fire command centre, podium', { make: 'Notifier', model: 'Addressable panel, 4 loops', serial: 'NF-16-40871' }],
    ['repeater', 2, 'Main lobby and parking P1 security desk', { make: 'Notifier', model: 'LCD repeater' }],
    ['smoke', 640, 'Apartment corridors, lift lobbies, plant rooms, levels 1 to 46', { make: 'Notifier', model: 'Addressable photoelectric' }],
    ['heat', 48, 'Amenity kitchens, parking, plant rooms', { make: 'Notifier', model: 'Addressable rate-of-rise' }],
    ['mcp', 184, 'Stair exits and lobbies, all levels'],
    ['sounder', 260, 'Corridors, all levels'],
    ['module', 120, 'Lifts, fire dampers, pumps, door holders'],
    ['battery', 1, 'Fire command centre', { last: 200, make: 'Yuasa', model: '2 x 12 V 38 Ah' }],
  ]);
  add(m, 'sprinkler', 'Sprinkler system, apartments and parking', 'Riser rooms, all levels', 2016, 80, [
    ['valve', 46, 'Floor riser rooms, levels 1 to 46', { make: 'Viking', model: 'Zone control valve' }],
    ['flow', 46, 'Floor riser rooms, levels 1 to 46', { last: 150 }],
    ['heads', 2400, 'Apartments, corridors, parking', { last: 320 }],
    ['tank', 2, 'Roof tank and basement tank', { last: 240 }],
    ['drain', 2, 'Main riser and basement', { last: 240 }],
  ]);
  add(m, 'fire_pump', 'Fire pump room', 'Basement 2', 2016, 60, [
    ['electric', 1, 'Basement 2 pump room', { make: 'Grundfos', model: 'Split-case, 750 gpm' }],
    ['diesel', 1, 'Basement 2 pump room', { make: 'Clarke', model: 'Diesel engine, 750 gpm' }],
    ['jockey', 1, 'Basement 2 pump room'],
    ['controller', 2, 'Basement 2 pump room'],
  ]);
  add(m, 'hydrant_hose', 'Wet risers and hose reels', 'Stair cores A to D', 2016, 250, [
    ['valve', 92, 'Landing valves in stair cores'],
    ['reel', 46, 'One per floor, corridor'],
    ['inlet', 2, 'Podium entrance'],
  ]);
  add(m, 'extinguishers', 'Portable extinguishers', 'All levels', 2016, 330, [
    ['abc6', 138, 'Corridors and lift lobbies, all levels', { make: 'Kidde' }],
    ['co2', 12, 'Electrical rooms and fire command centre', { make: 'Kidde' }],
  ]);
  add(m, 'emergency_lighting', 'Emergency lighting', 'Stairs and corridors', 2016, 270, [
    ['fitting', 410, 'Stairs and corridors, all levels'],
    ['exit', 180, 'Exit doors, all levels'],
  ]);
  add(m, 'smoke_control', 'Stair pressurisation and car-park ventilation', 'Stair cores and basements', 2016, 210, [
    ['stair', 4, 'Stair cores A to D, roof'],
    ['fan', 6, 'Basements 1 and 2'],
  ]);

  // ---- Harbour View Residences -------------------------------------------
  const h = 'site_harbour';
  add(h, 'fire_alarm', 'Fire alarm system', 'Ground floor security room', 2013, 400, [
    ['panel', 1, 'Security room', { make: 'Siemens', model: 'Addressable panel, 2 loops' }],
    ['smoke', 380, 'Corridors and lift lobbies'],
    ['heat', 30, 'Kitchens of amenity floors, plant rooms'],
    ['mcp', 120, 'Stair exits'],
    ['sounder', 150, 'Corridors'],
    ['battery', 1, 'Security room', { last: 150 }],
  ]);
  add(h, 'sprinkler', 'Sprinkler system', 'Riser rooms', 2013, 100, [
    ['valve', 38, 'Floor riser rooms'],
    ['flow', 38, 'Floor riser rooms', { last: 170 }],
    ['heads', 1500, 'Corridors and parking', { last: 350 }],
  ]);
  add(h, 'extinguishers', 'Portable extinguishers', 'All levels', 2013, 380, [
    ['abc6', 96, 'Corridors, all levels'],
    ['co2', 8, 'Electrical rooms'],
  ]);

  // ---- Gulf Meridian Hotel -------------------------------------------------
  const g = 'site_meridian';
  add(g, 'fire_alarm', 'Fire alarm system', 'Security control room', 2011, 110, [
    ['panel', 2, 'Security control room (networked)', { make: 'Notifier', model: 'Addressable panel, 6 loops' }],
    ['smoke', 720, 'Guest rooms, corridors, back of house'],
    ['heat', 60, 'Kitchens, laundry, plant rooms'],
    ['mcp', 140, 'Exits, corridors'],
    ['sounder', 420, 'Guest rooms and corridors'],
    ['module', 260, 'Lifts, dampers, door holders, kitchen shut-offs'],
  ]);
  add(g, 'voice_alarm', 'Voice alarm system', 'Security control room', 2011, 130, [
    ['controller', 1, 'Security control room'],
    ['speaker', 96, 'Public areas and corridors, all zones'],
    ['phone', 12, 'Stair landings'],
  ]);
  add(g, 'sprinkler', 'Sprinkler system', 'Riser rooms and roof tank', 2011, 45, [
    ['valve', 32, 'Floor riser rooms'],
    ['flow', 32, 'Floor riser rooms', { last: 130 }],
    ['heads', 3600, 'Guest rooms, corridors, back of house', { last: 200 }],
    ['tank', 2, 'Roof and basement', { last: 200 }],
  ]);
  add(g, 'fire_pump', 'Fire pump room', 'Basement 1', 2011, 45, [
    ['electric', 1, 'Basement 1 pump room'],
    ['diesel', 1, 'Basement 1 pump room'],
    ['jockey', 1, 'Basement 1 pump room'],
  ]);
  add(g, 'kitchen_hood', 'Kitchen hood suppression, main kitchen', 'Main kitchen, level 1', 2018, 150, [
    ['cylinder', 4, 'Main kitchen hoods', { make: 'Ansul', model: 'Wet chemical, 6 gal' }],
    ['links', 4, 'Main kitchen hoods'],
    ['gasvalve', 1, 'Main kitchen'],
    ['pull', 2, 'Kitchen exits'],
  ]);
  add(g, 'clean_agent', 'Clean-agent system, server room', 'Server room, level 2', 2018, 120, [
    ['cylinder', 3, 'Server room, level 2', { make: 'Kidde', model: 'FM-200, 105 kg', months: 6 }],
    ['release', 1, 'Server room, level 2'],
    ['nozzles', 6, 'Server room ceiling void', { last: 120 }],
  ]);
  add(g, 'extinguishers', 'Portable extinguishers', 'All levels', 2011, 200, [
    ['abc6', 110, 'Corridors, back of house'],
    ['co2', 26, 'Electrical rooms, kitchens'],
    ['wetchem', 14, 'Kitchens'],
  ]);

  // ---- Gulf Meridian Staff Accommodation -----------------------------------
  const gs = 'site_meridian_staff';
  add(gs, 'fire_alarm', 'Fire alarm system', 'Ground floor lobby', 2009, 330, [
    ['panel', 1, 'Ground floor lobby', { make: 'Morley', model: 'Conventional, 16 zones' }],
    ['smoke', 210, 'Rooms and corridors'],
    ['mcp', 32, 'Stairs and exits'],
    ['sounder', 40, 'Corridors'],
  ]);
  add(gs, 'extinguishers', 'Portable extinguishers', 'All floors', 2009, 350, [
    ['abc6', 40, 'Corridors, all floors'],
    ['co2', 4, 'Electrical rooms'],
  ]);

  // ---- Palm Grove Medical Centre -------------------------------------------
  const p = 'site_palm';
  add(p, 'fire_alarm', 'Fire alarm system', 'Reception, ground floor', 2015, 340, [
    ['panel', 1, 'Reception', { make: 'Bosch', model: 'Addressable panel, 2 loops' }],
    ['smoke', 260, 'Wards, corridors, theatres'],
    ['heat', 18, 'Kitchen, plant rooms, sterilisation'],
    ['mcp', 44, 'Exits and corridors'],
    ['sounder', 90, 'Corridors, wards'],
    ['battery', 1, 'Reception', { last: 120 }],
  ]);
  add(p, 'sprinkler', 'Sprinkler system', 'Riser room, level 1', 2015, 30, [
    ['valve', 6, 'Floor riser rooms'],
    ['heads', 700, 'Corridors, offices, wards', { last: 350 }],
    ['flow', 6, 'Floor riser rooms', { last: 140 }],
  ]);
  add(p, 'extinguishers', 'Portable extinguishers', 'All floors', 2015, 340, [
    ['abc6', 32, 'Corridors'],
    ['co2', 10, 'Electrical rooms, theatres'],
    ['water', 6, 'Waiting areas'],
  ]);
  add(p, 'emergency_lighting', 'Emergency lighting', 'All floors', 2015, 200, [
    ['fitting', 150, 'Corridors, wards'],
    ['exit', 46, 'Exit doors'],
    ['central', 1, 'Battery room, basement'],
  ]);

  // ---- Sahara Logistics Park, phases 1 and 2 -------------------------------
  const s1 = 'site_sahara1';
  add(s1, 'sprinkler', 'ESFR sprinkler system, warehouses A to C', 'Valve rooms A, B, C', 2019, 60, [
    ['valve', 6, 'Valve rooms A, B, C', { make: 'Tyco', model: 'Alarm check valve' }],
    ['flow', 6, 'Valve rooms', { last: 120 }],
    ['heads', 5200, 'Warehouses A to C', { last: 300 }],
    ['drain', 3, 'Valve rooms', { last: 300 }],
  ]);
  add(s1, 'fire_pump', 'Fire pump house', 'Pump house, north gate', 2019, 84, [
    ['electric', 1, 'Pump house', { make: 'Armstrong', model: 'Horizontal split-case, 1500 gpm' }],
    ['diesel', 1, 'Pump house', { make: 'Armstrong', model: 'Diesel driven, 1500 gpm' }],
    ['jockey', 1, 'Pump house'],
    ['controller', 2, 'Pump house'],
  ]);
  add(s1, 'hydrant_hose', 'Yard hydrants', 'Warehouse perimeter', 2019, 275, [
    ['hydrant', 14, 'Warehouse perimeter ring main'],
    ['inlet', 2, 'Gate 2 and pump house'],
  ]);
  add(s1, 'fire_alarm', 'Fire alarm system', 'Security room, gate 2', 2019, 200, [
    ['panel', 1, 'Security room, gate 2', { make: 'Notifier', model: 'Addressable panel, 2 loops' }],
    ['smoke', 96, 'Offices and mezzanines'],
    ['mcp', 36, 'Exits'],
    ['sounder', 48, 'Warehouses and offices'],
    ['module', 30, 'Sprinkler switches, doors'],
  ]);
  add(s1, 'extinguishers', 'Portable extinguishers', 'Warehouses A to C', 2019, 345, [
    ['abc9', 70, 'Warehouse columns and docks'],
    ['co2', 6, 'Electrical rooms'],
  ]);

  const s2 = 'site_sahara2';
  add(s2, 'sprinkler', 'ESFR sprinkler system, warehouses D to F', 'Valve rooms D, E, F', 2021, 35, [
    ['valve', 6, 'Valve rooms D, E, F'],
    ['heads', 4400, 'Warehouses D to F', { last: 270 }],
    ['flow', 6, 'Valve rooms', { last: 100 }],
  ]);
  add(s2, 'fire_pump', 'Fire pump house', 'Pump house, south gate', 2021, 35, [
    ['electric', 1, 'Pump house'],
    ['diesel', 1, 'Pump house'],
    ['jockey', 1, 'Pump house'],
  ]);
  add(s2, 'fire_alarm', 'Fire alarm system', 'Security room, gate 3', 2021, 260, [
    ['panel', 1, 'Security room, gate 3'],
    ['smoke', 72, 'Offices and mezzanines'],
    ['mcp', 30, 'Exits'],
    ['sounder', 40, 'Warehouses and offices'],
  ]);
  add(s2, 'extinguishers', 'Portable extinguishers', 'Warehouses D to F', 2021, 280, [
    ['abc9', 60, 'Warehouse columns and docks'],
  ]);

  // ---- Falcon Ridge Business Tower -----------------------------------------
  const f = 'site_falcon';
  add(f, 'fire_alarm', 'Fire alarm system', 'Fire command centre, ground floor', 2018, 160, [
    ['panel', 1, 'Fire command centre', { make: 'Siemens', model: 'Addressable panel, 6 loops' }],
    ['smoke', 520, 'Offices, corridors, lift lobbies'],
    ['heat', 24, 'Pantries and plant rooms'],
    ['mcp', 96, 'Stair exits'],
    ['sounder', 190, 'Corridors'],
    ['module', 80, 'Lifts, dampers, pumps'],
  ]);
  add(f, 'sprinkler', 'Sprinkler system', 'Riser rooms', 2018, 20, [
    ['valve', 32, 'Floor riser rooms'],
    ['flow', 32, 'Floor riser rooms', { last: 160 }],
    ['heads', 3100, 'Offices, corridors, parking', { last: 340 }],
  ]);
  add(f, 'fire_pump', 'Fire pump room', 'Basement 2', 2018, 20, [
    ['electric', 1, 'Basement 2'],
    ['diesel', 1, 'Basement 2'],
    ['jockey', 1, 'Basement 2'],
  ]);
  add(f, 'extinguishers', 'Portable extinguishers', 'All levels', 2018, 210, [
    ['abc6', 120, 'Corridors, all levels'],
    ['co2', 16, 'Electrical rooms'],
  ]);
  add(f, 'emergency_lighting', 'Emergency lighting', 'Stairs and corridors', 2018, 300, [
    ['fitting', 300, 'Stairs, corridors'],
    ['exit', 120, 'Exit doors'],
  ]);

  // ---- Desert Rose restaurants and central kitchen --------------------------
  const restaurant = (siteId, last, hoods) => {
    add(siteId, 'fire_alarm', 'Fire alarm system', 'Manager office', 2019, last, [
      ['panel', 1, 'Manager office', { make: 'Morley', model: 'Conventional, 8 zones' }],
      ['smoke', 10, 'Dining and storage'],
      ['heat', 6, 'Kitchen'],
      ['mcp', 3, 'Exits'],
      ['sounder', 5, 'Dining, kitchen, corridor'],
    ]);
    add(siteId, 'kitchen_hood', 'Kitchen hood suppression', 'Main kitchen', 2019, last, [
      ['cylinder', hoods, 'Main kitchen hoods', { make: 'Ansul', model: 'Wet chemical' }],
      ['links', hoods, 'Main kitchen hoods'],
      ['gasvalve', 1, 'Kitchen'],
      ['pull', 1, 'Kitchen exit'],
    ]);
    add(siteId, 'extinguishers', 'Portable extinguishers', 'Kitchen and dining', 2019, last + 100, [
      ['abc6', 4, 'Dining and storage'],
      ['co2', 1, 'Electrical panel'],
      ['wetchem', 2, 'Kitchen'],
    ]);
  };
  restaurant('site_rose_bb', 215, 2);
  restaurant('site_rose_jlt', 260, 2);
  add('site_rose_kitchen', 'kitchen_hood', 'Kitchen hood suppression', 'Central kitchen, ground floor', 2019, 205, [
    ['cylinder', 6, 'Central kitchen hoods', { make: 'Ansul', model: 'Wet chemical' }],
    ['links', 6, 'Central kitchen hoods'],
    ['gasvalve', 2, 'Central kitchen'],
    ['pull', 3, 'Kitchen exits'],
  ]);
  add('site_rose_kitchen', 'fire_alarm', 'Fire alarm system', 'Security office', 2019, 205, [
    ['panel', 1, 'Security office'],
    ['smoke', 34, 'Offices and storage'],
    ['heat', 14, 'Kitchens'],
    ['mcp', 8, 'Exits'],
    ['sounder', 12, 'Corridors'],
  ]);
  add('site_rose_kitchen', 'extinguishers', 'Portable extinguishers', 'Central kitchen', 2019, 300, [
    ['abc6', 12, 'Corridors, storage'],
    ['wetchem', 6, 'Kitchens'],
    ['co2', 2, 'Electrical room'],
  ]);

  // ---- Oasis Cold Storage ----------------------------------------------------
  const o = 'site_oasis';
  add(o, 'sprinkler', 'Sprinkler system (dry-pipe in cold rooms)', 'Valve room', 2017, 150, [
    ['valve', 4, 'Valve room', { last: 60 }],
    ['heads', 1800, 'Warehouse and cold rooms', { last: 290 }],
    ['flow', 4, 'Valve room', { last: 150 }],
  ]);
  add(o, 'fire_alarm', 'Fire alarm system', 'Office, loading dock', 2017, 250, [
    ['panel', 1, 'Loading dock office'],
    ['smoke', 60, 'Office, corridors, plant room'],
    ['heat', 20, 'Cold rooms'],
    ['mcp', 12, 'Exits'],
    ['sounder', 18, 'Warehouse'],
  ]);
  add(o, 'extinguishers', 'Portable extinguishers', 'Warehouse', 2017, 320, [
    ['abc9', 30, 'Warehouse columns'],
    ['co2', 4, 'Electrical rooms'],
  ]);

  // ---- Bright Minds International School ------------------------------------
  const b = 'site_bright';
  add(b, 'fire_alarm', 'Fire alarm system', 'Front office', 2014, 170, [
    ['panel', 1, 'Front office', { make: 'Notifier', model: 'Addressable panel, 2 loops' }],
    ['smoke', 240, 'Classrooms and corridors'],
    ['heat', 12, 'Canteen, plant rooms'],
    ['mcp', 40, 'Corridors, exits'],
    ['sounder', 110, 'Corridors, classrooms'],
  ]);
  add(b, 'sprinkler', 'Sprinkler system', 'Riser room', 2014, 70, [
    ['valve', 4, 'Riser rooms'],
    ['heads', 900, 'Corridors, assembly hall', { last: 250 }],
  ]);
  add(b, 'extinguishers', 'Portable extinguishers', 'All floors', 2014, 355, [
    ['abc6', 48, 'Corridors'],
    ['co2', 6, 'Labs, server room'],
    ['wetchem', 2, 'Canteen kitchen'],
  ]);
  add(b, 'emergency_lighting', 'Emergency lighting', 'All floors', 2014, 240, [
    ['fitting', 180, 'Corridors, stairs'],
    ['exit', 64, 'Exit doors'],
  ]);

  // ---- Al Barsha Central Mall -------------------------------------------------
  const ml = 'site_mall';
  add(ml, 'fire_alarm', 'Fire alarm system', 'Fire command centre, ground', 2012, 90, [
    ['panel', 3, 'Fire command centre (networked)', { make: 'Siemens', model: 'Addressable panel, 8 loops' }],
    ['smoke', 1100, 'Mall corridors, shops, back of house'],
    ['heat', 140, 'Food court kitchens, plant rooms'],
    ['mcp', 210, 'Exits and corridors'],
    ['sounder', 380, 'Mall corridors, shops'],
    ['module', 340, 'Shutters, dampers, escalators, pumps'],
  ]);
  add(ml, 'voice_alarm', 'Voice alarm system', 'Fire command centre', 2012, 105, [
    ['controller', 1, 'Fire command centre'],
    ['speaker', 420, 'Mall, parking, back of house'],
    ['phone', 20, 'Stair landings'],
  ]);
  add(ml, 'sprinkler', 'Sprinkler system', 'Valve rooms', 2012, 25, [
    ['valve', 14, 'Valve rooms, all levels'],
    ['flow', 14, 'Valve rooms', { last: 100 }],
    ['heads', 6800, 'Mall, parking, shops', { last: 180 }],
    ['tank', 3, 'Basement tanks', { last: 180 }],
  ]);
  add(ml, 'fire_pump', 'Fire pump room', 'Basement 2', 2012, 25, [
    ['electric', 2, 'Basement 2 pump room'],
    ['diesel', 1, 'Basement 2 pump room'],
    ['jockey', 2, 'Basement 2 pump room'],
    ['controller', 3, 'Basement 2 pump room'],
  ]);
  add(ml, 'smoke_control', 'Smoke extraction', 'Roof plant deck', 2012, 240, [
    ['fan', 18, 'Roof plant deck, basements'],
    ['damper', 64, 'Ducts, all levels'],
  ]);
  add(ml, 'emergency_lighting', 'Emergency lighting', 'Mall, parking and back of house', 2012, 215, [
    ['fitting', 860, 'Mall corridors, parking, back of house'],
    ['exit', 340, 'Exits and escape routes, all levels'],
  ]);
  add(ml, 'extinguishers', 'Portable extinguishers', 'Mall and shops', 2012, 260, [
    ['abc6', 180, 'Corridors, service areas'],
    ['co2', 30, 'Electrical rooms'],
    ['wetchem', 24, 'Food court kitchens'],
  ]);

  // ---- Al Mansoori Villa -------------------------------------------------------
  add('site_khalid', 'extinguishers', 'Portable extinguishers', 'Villa', 2020, 350, [
    ['abc6', 3, 'Kitchen, garage, first floor landing'],
    ['co2', 1, 'Electrical panel'],
  ]);
  add('site_khalid', 'fire_alarm', 'Fire alarm system (villa)', 'Ground floor hall', 2020, 350, [
    ['panel', 1, 'Ground floor hall', { make: 'Morley', model: 'Conventional, 4 zones' }],
    ['smoke', 12, 'Rooms and corridors'],
    ['heat', 2, 'Kitchen'],
    ['sounder', 3, 'Corridors'],
  ]);

  // ---- Al Wasl Auto Service Centre ----------------------------------------------
  add('site_wasl', 'extinguishers', 'Portable extinguishers', 'Workshop', 2016, 400, [
    ['abc6', 8, 'Workshop bays', { condition: 'ok' }],
    ['co2', 2, 'Electrical panel, paint booth'],
    ['foam', 4, 'Paint and oil store'],
  ]);

  // ---- Green Valley supermarkets ---------------------------------------------------
  const supermarket = (siteId, last) => {
    add(siteId, 'fire_alarm', 'Fire alarm system', 'Store office', 2017, last, [
      ['panel', 1, 'Store office', { make: 'Notifier', model: 'Addressable panel, 1 loop' }],
      ['smoke', 48, 'Sales floor, storeroom'],
      ['heat', 10, 'Bakery, plant room'],
      ['mcp', 8, 'Exits'],
      ['sounder', 14, 'Sales floor'],
    ]);
    add(siteId, 'extinguishers', 'Portable extinguishers', 'Sales floor', 2017, last + 40, [
      ['abc6', 16, 'Sales floor columns'],
      ['co2', 2, 'Electrical room'],
      ['wetchem', 2, 'Bakery'],
    ]);
    add(siteId, 'emergency_lighting', 'Emergency lighting', 'Sales floor', 2017, last + 60, [
      ['fitting', 40, 'Sales floor, storeroom'],
      ['exit', 10, 'Exits'],
    ]);
  };
  supermarket('site_gv1', 240);
  supermarket('site_gv2', 280);

  // ---- Crescent Bay Dental Clinic ------------------------------------------------------
  add('site_crescent', 'extinguishers', 'Portable extinguishers', 'Clinic', 2021, 300, [
    ['abc6', 3, 'Reception, corridor, lab'],
    ['co2', 1, 'Server cupboard'],
  ]);

  // ---- Nexus Data Centre --------------------------------------------------------------------
  const n = 'site_nexus';
  add(n, 'clean_agent', 'Clean-agent system, data halls', 'Data halls 1 to 4', 2020, 70, [
    ['cylinder', 16, 'Data halls 1 to 4', { make: 'Kidde', model: 'Novec 1230, 180 kg', months: 6 }],
    ['release', 4, 'Data halls 1 to 4'],
    ['nozzles', 48, 'Ceiling and under-floor voids', { last: 250 }],
  ]);
  add(n, 'fire_alarm', 'Fire alarm and aspirating detection', 'Security control room', 2020, 100, [
    ['panel', 1, 'Security control room', { make: 'Siemens', model: 'Addressable panel, 4 loops' }],
    ['smoke', 380, 'Data halls (ceiling and under-floor), corridors'],
    ['module', 60, 'Release and shut-down interfaces'],
    ['mcp', 30, 'Exits'],
    ['sounder', 60, 'Corridors, halls'],
  ]);
  add(n, 'extinguishers', 'Portable extinguishers', 'Data halls and plant', 2020, 265, [
    ['co2', 24, 'Data halls, UPS rooms'],
    ['abc6', 10, 'Offices'],
  ]);

  // ---- Mussafah Steel Works (Abu Dhabi) and Sharjah Plastics ----------------------------------
  const ms = 'site_mussafah';
  add(ms, 'fire_alarm', 'Fire alarm system', 'Plant control room', 2016, 190, [
    ['panel', 1, 'Plant control room'],
    ['smoke', 90, 'Offices, control rooms'],
    ['heat', 60, 'Furnace hall, workshops'],
    ['mcp', 26, 'Exits'],
    ['sounder', 32, 'Plant and offices'],
  ]);
  add(ms, 'hydrant_hose', 'Hydrants and hose reels', 'Plant perimeter', 2016, 280, [
    ['hydrant', 10, 'Plant perimeter'],
    ['reel', 22, 'Plant hall'],
  ]);
  add(ms, 'extinguishers', 'Portable extinguishers', 'Plant', 2016, 330, [
    ['abc9', 44, 'Plant hall, workshops'],
    ['co2', 10, 'Electrical rooms'],
  ]);
  const sj = 'site_sharjah';
  add(sj, 'sprinkler', 'Sprinkler system', 'Valve room', 2015, 110, [
    ['valve', 3, 'Valve room', { last: 70 }],
    ['heads', 1600, 'Production hall, warehouse', { last: 290 }],
  ]);
  add(sj, 'fire_alarm', 'Fire alarm system', 'Reception', 2015, 200, [
    ['panel', 1, 'Reception'],
    ['smoke', 70, 'Offices, production hall'],
    ['mcp', 14, 'Exits'],
    ['sounder', 20, 'Production hall'],
  ]);
  add(sj, 'extinguishers', 'Portable extinguishers', 'Factory', 2015, 340, [
    ['abc9', 30, 'Production hall'],
    ['co2', 6, 'Electrical rooms'],
  ]);

  return { systems, devices };
}
