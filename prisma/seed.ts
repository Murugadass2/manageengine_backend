import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Hotel Dazzle Drop Enterprise Database...');

  // 1. SLA Policies
  const slaPolicies = [
    { priority: 'CRITICAL', name: 'Critical Emergency SLA', responseMinutes: 15, resolutionMinutes: 120, escalationRole: 'HOTEL_MANAGER' },
    { priority: 'HIGH', name: 'High Priority Operational SLA', responseMinutes: 30, resolutionMinutes: 240, escalationRole: 'DEPT_MANAGER' },
    { priority: 'MEDIUM', name: 'Medium Standard Service SLA', responseMinutes: 120, resolutionMinutes: 720, escalationRole: 'DEPT_MANAGER' },
    { priority: 'LOW', name: 'Low Routine Request SLA', responseMinutes: 240, resolutionMinutes: 1440, escalationRole: 'TECHNICIAN' },
  ];

  for (const sla of slaPolicies) {
    await prisma.sLAPolicy.upsert({
      where: { priority: sla.priority },
      update: sla,
      create: sla,
    });
  }
  console.log('✔ SLA Policies seeded');

  // 2. Departments
  const deptData = [
    { name: 'IT Support', code: 'IT', description: 'Enterprise hardware, network, software, and POS support' },
    { name: 'Housekeeping', code: 'HK', description: 'Guest rooms, floor cleanliness, linen, and amenities' },
    { name: 'Maintenance', code: 'MAINT', description: 'Civil infrastructure, HVAC, furniture, and general hotel repairs' },
    { name: 'Electrical', code: 'ELEC', description: 'Power distribution, lighting, generators, and UPS systems' },
    { name: 'Plumbing', code: 'PLUMB', description: 'Water supply, drainage, sanitary fixtures, and boilers' },
    { name: 'Front Office', code: 'FO', description: 'Reception, concierge, luggage desk, and guest relation desks' },
    { name: 'Security', code: 'SEC', description: 'Surveillance, access control, fire safety, and emergency response' },
    { name: 'Food & Beverage', code: 'FNB', description: 'Restaurants, banquet halls, room dining, and bar service' },
    { name: 'Kitchen', code: 'KTCH', description: 'Culinary production, cold storage, and kitchen appliances' },
    { name: 'HR', code: 'HR', description: 'Human resources, staff relations, training, and onboarding' },
    { name: 'Finance', code: 'FIN', description: 'Accounts, billing audits, supplier invoices, and cashiering' },
    { name: 'Purchase & Inventory', code: 'PURCH', description: 'Procurement, stockroom management, and inventory logistics' },
    { name: 'Administration', code: 'ADMIN', description: 'Executive operations, compliance, licenses, and legal' },
  ];

  const departments: Record<string, any> = {};
  for (const d of deptData) {
    departments[d.code] = await prisma.department.upsert({
      where: { code: d.code },
      update: d,
      create: d,
    });
  }
  console.log('✔ 13 Departments seeded');

  // 3. Password hash
  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const customAdminPasswordHash = await bcrypt.hash('admin@123', 10);

  // 4. Users
  // Custom Super Admin requested by user
  await prisma.user.upsert({
    where: { email: 'admin12@gmail.com' },
    update: {
      passwordHash: customAdminPasswordHash,
      role: 'SUPER_ADMIN',
    },
    create: {
      name: 'System Administrator',
      email: 'admin12@gmail.com',
      passwordHash: customAdminPasswordHash,
      role: 'SUPER_ADMIN',
      employeeCode: 'ADM-001',
      phone: '+91 98765 43210',
      status: 'ACTIVE',
      departmentId: departments['ADMIN'].id,
    },
  });

  // Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dazzledrop.com' },
    update: {},
    create: {
      name: 'Rajesh Sharma',
      email: 'admin@dazzledrop.com',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
      employeeCode: 'EMP-001',
      phone: '+91 98765 00001',
      status: 'ACTIVE',
      departmentId: departments['ADMIN'].id,
    },
  });

  // Hotel Manager
  const hotelManager = await prisma.user.upsert({
    where: { email: 'manager@dazzledrop.com' },
    update: {},
    create: {
      name: 'Vikram Singhania',
      email: 'manager@dazzledrop.com',
      passwordHash: defaultPasswordHash,
      role: 'HOTEL_MANAGER',
      employeeCode: 'EMP-002',
      phone: '+91 98765 00002',
      status: 'ACTIVE',
      departmentId: departments['ADMIN'].id,
    },
  });

  // Department Managers
  const itManager = await prisma.user.upsert({
    where: { email: 'prakash.it@dazzledrop.com' },
    update: {},
    create: {
      name: 'Prakash Nair',
      email: 'prakash.it@dazzledrop.com',
      passwordHash: defaultPasswordHash,
      role: 'DEPT_MANAGER',
      employeeCode: 'EMP-010',
      phone: '+91 98765 00010',
      status: 'ACTIVE',
      departmentId: departments['IT'].id,
    },
  });
  await prisma.department.update({ where: { id: departments['IT'].id }, data: { managerId: itManager.id } });

  const maintManager = await prisma.user.upsert({
    where: { email: 'kumar.maint@dazzledrop.com' },
    update: {},
    create: {
      name: 'Kumar Swamy',
      email: 'kumar.maint@dazzledrop.com',
      passwordHash: defaultPasswordHash,
      role: 'DEPT_MANAGER',
      employeeCode: 'EMP-012',
      phone: '+91 98765 00012',
      status: 'ACTIVE',
      departmentId: departments['MAINT'].id,
    },
  });
  await prisma.department.update({ where: { id: departments['MAINT'].id }, data: { managerId: maintManager.id } });

  const elecManager = await prisma.user.upsert({
    where: { email: 'suresh.elec@dazzledrop.com' },
    update: {},
    create: {
      name: 'Suresh Reddy',
      email: 'suresh.elec@dazzledrop.com',
      passwordHash: defaultPasswordHash,
      role: 'DEPT_MANAGER',
      employeeCode: 'EMP-013',
      phone: '+91 98765 00013',
      status: 'ACTIVE',
      departmentId: departments['ELEC'].id,
    },
  });
  await prisma.department.update({ where: { id: departments['ELEC'].id }, data: { managerId: elecManager.id } });

  const plumbManager = await prisma.user.upsert({
    where: { email: 'ravi.plumb@dazzledrop.com' },
    update: {},
    create: {
      name: 'Ravi Teja',
      email: 'ravi.plumb@dazzledrop.com',
      passwordHash: defaultPasswordHash,
      role: 'DEPT_MANAGER',
      employeeCode: 'EMP-014',
      phone: '+91 98765 00014',
      status: 'ACTIVE',
      departmentId: departments['PLUMB'].id,
    },
  });
  await prisma.department.update({ where: { id: departments['PLUMB'].id }, data: { managerId: plumbManager.id } });

  const hkManager = await prisma.user.upsert({
    where: { email: 'divya.hk@dazzledrop.com' },
    update: {},
    create: {
      name: 'Divya Menon',
      email: 'divya.hk@dazzledrop.com',
      passwordHash: defaultPasswordHash,
      role: 'DEPT_MANAGER',
      employeeCode: 'EMP-011',
      phone: '+91 98765 00011',
      status: 'ACTIVE',
      departmentId: departments['HK'].id,
    },
  });
  await prisma.department.update({ where: { id: departments['HK'].id }, data: { managerId: hkManager.id } });

  // Technicians
  const techArun = await prisma.user.upsert({
    where: { email: 'arun.tech@dazzledrop.com' },
    update: {},
    create: {
      name: 'Arun Kumar',
      email: 'arun.tech@dazzledrop.com',
      passwordHash: defaultPasswordHash,
      role: 'TECHNICIAN',
      employeeCode: 'TECH-101',
      phone: '+91 98765 10101',
      status: 'ACTIVE',
      departmentId: departments['MAINT'].id,
    },
  });

  const techPriya = await prisma.user.upsert({
    where: { email: 'priya.it@dazzledrop.com' },
    update: {},
    create: {
      name: 'Priya Patel',
      email: 'priya.it@dazzledrop.com',
      passwordHash: defaultPasswordHash,
      role: 'TECHNICIAN',
      employeeCode: 'TECH-102',
      phone: '+91 98765 10102',
      status: 'ACTIVE',
      departmentId: departments['IT'].id,
    },
  });

  const techManoj = await prisma.user.upsert({
    where: { email: 'manoj.elec@dazzledrop.com' },
    update: {},
    create: {
      name: 'Manoj Das',
      email: 'manoj.elec@dazzledrop.com',
      passwordHash: defaultPasswordHash,
      role: 'TECHNICIAN',
      employeeCode: 'TECH-103',
      phone: '+91 98765 10103',
      status: 'ACTIVE',
      departmentId: departments['ELEC'].id,
    },
  });

  // Employees / Requesters
  const empRamesh = await prisma.user.upsert({
    where: { email: 'ramesh.emp@dazzledrop.com' },
    update: {},
    create: {
      name: 'Ramesh Kumar',
      email: 'ramesh.emp@dazzledrop.com',
      passwordHash: defaultPasswordHash,
      role: 'EMPLOYEE',
      employeeCode: 'EMP-201',
      phone: '+91 98765 20201',
      status: 'ACTIVE',
      departmentId: departments['HK'].id,
    },
  });

  const empSneha = await prisma.user.upsert({
    where: { email: 'sneha.fo@dazzledrop.com' },
    update: {},
    create: {
      name: 'Sneha Kapoor',
      email: 'sneha.fo@dazzledrop.com',
      passwordHash: defaultPasswordHash,
      role: 'EMPLOYEE',
      employeeCode: 'EMP-202',
      phone: '+91 98765 20202',
      status: 'ACTIVE',
      departmentId: departments['FO'].id,
    },
  });

  console.log('✔ Users & Staff seeded');

  // 5. Assets
  const assetDell = await prisma.asset.upsert({
    where: { assetTag: 'AS-001' },
    update: {},
    create: {
      assetTag: 'AS-001',
      name: 'Dell Latitude 5420 Laptop',
      category: 'COMPUTERS',
      serialNumber: 'DL-LAT-884920',
      location: 'IT Helpdesk Floor 1',
      status: 'ACTIVE',
      cost: 72000,
      departmentId: departments['IT'].id,
      assignedUserId: techPriya.id,
    },
  });

  const assetPrinter = await prisma.asset.upsert({
    where: { assetTag: 'AS-002' },
    update: {},
    create: {
      assetTag: 'AS-002',
      name: 'HP LaserJet Pro 400 M401dne',
      category: 'PRINTERS',
      serialNumber: 'HP-LJP-44129',
      location: 'Front Desk Reception',
      status: 'ACTIVE',
      cost: 34000,
      departmentId: departments['FO'].id,
      assignedUserId: empSneha.id,
    },
  });

  const assetCCTV = await prisma.asset.upsert({
    where: { assetTag: 'AS-003' },
    update: {},
    create: {
      assetTag: 'AS-003',
      name: 'Hikvision 4K IP Dome Camera',
      category: 'SECURITY',
      serialNumber: 'HK-CAM-90123',
      location: 'Main Lobby & Porte-Cochere',
      status: 'ACTIVE',
      cost: 18500,
      departmentId: departments['SEC'].id,
    },
  });

  const assetScanner = await prisma.asset.upsert({
    where: { assetTag: 'AS-004' },
    update: {},
    create: {
      assetTag: 'AS-004',
      name: 'Honeywell Xenon 1900G 2D Scanner',
      category: 'SCANNERS',
      serialNumber: 'HW-SC-55012',
      location: 'Administration Records',
      status: 'ACTIVE',
      cost: 14000,
      departmentId: departments['ADMIN'].id,
    },
  });

  const assetServer = await prisma.asset.upsert({
    where: { assetTag: 'AS-005' },
    update: {},
    create: {
      assetTag: 'AS-005',
      name: 'Dell PowerEdge R740 Server Rack',
      category: 'SERVERS',
      serialNumber: 'DL-PE-990184',
      location: 'Central Server Room B1',
      status: 'ACTIVE',
      cost: 380000,
      departmentId: departments['IT'].id,
    },
  });

  const assetACRoom205 = await prisma.asset.upsert({
    where: { assetTag: 'AS-006' },
    update: {},
    create: {
      assetTag: 'AS-006',
      name: 'Daikin Inverter Split AC 2.0 Ton',
      category: 'HVAC',
      serialNumber: 'DK-AC-205-99',
      location: 'Room 205',
      status: 'UNDER_MAINTENANCE',
      cost: 54000,
      departmentId: departments['MAINT'].id,
    },
  });

  console.log('✔ Assets seeded');

  // 6. Inventory Items
  const inventoryItems = [
    { itemCode: 'INV-1001', name: 'Cat6 High Speed Network Cable (5m)', category: 'IT', stockQuantity: 150, minLevel: 50, unit: 'pcs', unitPrice: 220, supplier: 'Schneider Electric', status: 'IN_STOCK' },
    { itemCode: 'INV-1002', name: 'Logitech B100 Optical USB Mouse', category: 'IT', stockQuantity: 120, minLevel: 30, unit: 'pcs', unitPrice: 380, supplier: 'Logitech India', status: 'IN_STOCK' },
    { itemCode: 'INV-1003', name: 'Dell Wired Multimedia USB Keyboard', category: 'IT', stockQuantity: 100, minLevel: 30, unit: 'pcs', unitPrice: 650, supplier: 'Dell Distributors', status: 'IN_STOCK' },
    { itemCode: 'INV-1004', name: 'HP LaserJet 85A Black Toner Cartridge', category: 'IT', stockQuantity: 25, minLevel: 10, unit: 'pcs', unitPrice: 3200, supplier: 'HP Commercial', status: 'LOW_STOCK' },
    { itemCode: 'INV-1005', name: 'Samsung EVO 1TB SATA SSD', category: 'IT', stockQuantity: 15, minLevel: 5, unit: 'pcs', unitPrice: 7800, supplier: 'TechData India', status: 'IN_STOCK' },
    { itemCode: 'INV-1006', name: 'Havells 15W Warm White LED Downlight', category: 'ELECTRICAL', stockQuantity: 85, minLevel: 40, unit: 'pcs', unitPrice: 420, supplier: 'Havells India Ltd', status: 'IN_STOCK' },
    { itemCode: 'INV-1007', name: '1/2-inch Brass Ball Valve Heavy Duty', category: 'PLUMBING', stockQuantity: 40, minLevel: 15, unit: 'pcs', unitPrice: 310, supplier: 'Jaquar Fittings', status: 'IN_STOCK' },
    { itemCode: 'INV-1008', name: 'DuPont Suva R-410A Refrigerant Canister (10kg)', category: 'HVAC', stockQuantity: 4, minLevel: 5, unit: 'cylinder', unitPrice: 8500, supplier: 'Cooling Supplies Inc', status: 'LOW_STOCK' },
  ];

  for (const inv of inventoryItems) {
    await prisma.inventoryItem.upsert({
      where: { itemCode: inv.itemCode },
      update: inv,
      create: inv,
    });
  }
  console.log('✔ Inventory items seeded');

  // 7. Realistic Tickets
  // Ticket 1: The flagship Room 205 AC scenario from the prompt & layout
  const now = new Date();
  const created2HoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const responseDue = new Date(created2HoursAgo.getTime() + 30 * 60 * 1000); // 30m response
  const resolutionDue = new Date(created2HoursAgo.getTime() + 4 * 60 * 60 * 1000); // 4h resolution (2 hours left)

  const ticketRoom205 = await prisma.ticket.upsert({
    where: { ticketNumber: 'HD-2026-000123' },
    update: {},
    create: {
      ticketNumber: 'HD-2026-000123',
      subject: 'AC not cooling in Room 205',
      description: 'The guest in Room 205 reported that the AC unit is blowing ambient warm air and not cooling properly despite thermostat set to 20°C. Urgent inspection needed before evening guest return.',
      type: 'MAINTENANCE_REQUEST',
      priority: 'HIGH',
      impact: 'HIGH',
      urgency: 'HIGH',
      status: 'IN_PROGRESS',
      location: 'Room 205 (2nd Floor Deluxe Wing)',
      requesterId: empRamesh.id,
      departmentId: departments['MAINT'].id,
      assignedTechnicianId: techArun.id,
      assetId: assetACRoom205.id,
      responseDueAt: responseDue,
      resolutionDueAt: resolutionDue,
      firstRespondedAt: new Date(created2HoursAgo.getTime() + 15 * 60 * 1000),
      createdAt: created2HoursAgo,
    },
  });

  // Comments for Room 205
  await prisma.ticketComment.createMany({
    data: [
      {
        ticketId: ticketRoom205.id,
        userId: empRamesh.id,
        content: 'Guest requested resolution before 5:00 PM. I left a temporary tower fan in the suite for comfort.',
        isInternal: false,
        createdAt: new Date(created2HoursAgo.getTime() + 10 * 60 * 1000),
      },
      {
        ticketId: ticketRoom205.id,
        userId: techArun.id,
        content: 'Inspected compressor and filters. Compressor capacitor is humming; preparing replacement capacitor and refrigerant pressure test.',
        isInternal: true, // internal technician note
        createdAt: new Date(created2HoursAgo.getTime() + 40 * 60 * 1000),
      },
    ],
  });

  // Work log for Room 205
  await prisma.ticketWorkLog.create({
    data: {
      ticketId: ticketRoom205.id,
      technicianId: techArun.id,
      hoursSpent: 1.2,
      description: 'Disassembled AC indoor blower casing, cleaned condenser coils, and diagnosed faulty 45uF dual run capacitor.',
    },
  });

  // History for Room 205
  await prisma.ticketHistory.createMany({
    data: [
      { ticketId: ticketRoom205.id, actorId: empRamesh.id, action: 'TICKET_CREATED', details: 'Ticket HD-2026-000123 raised by Ramesh Kumar' },
      { ticketId: ticketRoom205.id, actorId: maintManager.id, action: 'ASSIGNMENT', fieldChanged: 'assignedTechnician', oldValue: 'Unassigned', newValue: 'Arun Kumar', details: 'Automated skill-based routing to Arun Kumar' },
      { ticketId: ticketRoom205.id, actorId: techArun.id, action: 'STATUS_CHANGE', fieldChanged: 'status', oldValue: 'ASSIGNED', newValue: 'ACCEPTED', details: 'Technician accepted assignment' },
      { ticketId: ticketRoom205.id, actorId: techArun.id, action: 'STATUS_CHANGE', fieldChanged: 'status', oldValue: 'ACCEPTED', newValue: 'IN_PROGRESS', details: 'Technician reached Room 205 and initiated diagnostics' },
    ],
  });

  // Additional realistic tickets
  const otherTickets = [
    {
      ticketNumber: 'HD-2026-000124',
      subject: 'AC leaking water heavily onto carpet in Suite 402',
      description: 'Water leaking continuously from the ceiling AC duct into Suite 402. Floor carpet is dampening.',
      type: 'INCIDENT',
      priority: 'CRITICAL',
      impact: 'HIGH',
      urgency: 'CRITICAL',
      status: 'OPEN',
      location: 'Suite 402 (Presidential Wing)',
      requesterId: empSneha.id,
      departmentId: departments['MAINT'].id,
      assignedTechnicianId: null,
      responseDueAt: new Date(now.getTime() + 15 * 60 * 1000),
      resolutionDueAt: new Date(now.getTime() + 120 * 60 * 1000),
    },
    {
      ticketNumber: 'HD-2026-000125',
      subject: 'Front desk billing printer paper feed jam and line streaks',
      description: 'HP LaserJet printer at Front Desk Counter 2 is jamming on every print and producing dark vertical lines on guest folios.',
      type: 'IT_SUPPORT',
      priority: 'MEDIUM',
      impact: 'MEDIUM',
      urgency: 'MEDIUM',
      status: 'IN_PROGRESS',
      location: 'Front Desk Counter 2',
      requesterId: empSneha.id,
      departmentId: departments['IT'].id,
      assignedTechnicianId: techPriya.id,
      assetId: assetPrinter.id,
      responseDueAt: new Date(now.getTime() + 60 * 60 * 1000),
      resolutionDueAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
    },
    {
      ticketNumber: 'HD-2026-000126',
      subject: 'Grand Ballroom chandelier central dimmer bulb flickering',
      description: 'During morning banquet briefing, two circuit sections on the Grand Ballroom central chandelier were flickering intermittently.',
      type: 'MAINTENANCE_REQUEST',
      priority: 'LOW',
      impact: 'LOW',
      urgency: 'LOW',
      status: 'ASSIGNED',
      location: 'Grand Ballroom Floor 1',
      requesterId: empRamesh.id,
      departmentId: departments['ELEC'].id,
      assignedTechnicianId: techManoj.id,
      responseDueAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      resolutionDueAt: new Date(now.getTime() + 20 * 60 * 60 * 1000),
    },
    {
      ticketNumber: 'HD-2026-000127',
      subject: 'Guest WiFi portal authentication timeout on 3rd floor',
      description: 'Several guests on the 3rd floor reported the captive portal does not load room verification page.',
      type: 'IT_SUPPORT',
      priority: 'HIGH',
      impact: 'HIGH',
      urgency: 'HIGH',
      status: 'RESOLVED',
      location: '3rd Floor East Wing',
      requesterId: empSneha.id,
      departmentId: departments['IT'].id,
      assignedTechnicianId: techPriya.id,
      responseDueAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      resolutionDueAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      resolvedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      resolutionNotes: 'Restarted Ruckus ZoneDirector access point gateway cluster AP-301 through AP-312. Verified captive portal authentication latency <200ms.',
      satisfactionRating: 5,
    },
    {
      ticketNumber: 'HD-2026-000128',
      subject: 'Room 108 electronic RFID door lock battery low warning',
      description: 'Assa Abloy door lock flashing red indicator showing critical low battery alert.',
      type: 'INCIDENT',
      priority: 'MEDIUM',
      impact: 'MEDIUM',
      urgency: 'MEDIUM',
      status: 'CLOSED',
      location: 'Room 108',
      requesterId: empRamesh.id,
      departmentId: departments['SEC'].id,
      assignedTechnicianId: techArun.id,
      responseDueAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      resolutionDueAt: new Date(now.getTime() - 18 * 60 * 60 * 1000),
      resolvedAt: new Date(now.getTime() - 19 * 60 * 60 * 1000),
      closedAt: new Date(now.getTime() - 18 * 60 * 60 * 1000),
      resolutionNotes: 'Replaced 4x AA lithium cells and recalibrated lock strike plate. Tested with Master and Guest RFID cards.',
      satisfactionRating: 5,
    },
    {
      ticketNumber: 'HD-2026-000129',
      subject: 'Main kitchen walk-in freezer temperature alert (-10°C instead of -18°C)',
      description: 'Cold storage sensor alarmed. Temperature rose 8 degrees above safe threshold for premium meat cuts.',
      type: 'INCIDENT',
      priority: 'CRITICAL',
      impact: 'HIGH',
      urgency: 'CRITICAL',
      status: 'IN_PROGRESS',
      location: 'Main Production Kitchen B1',
      requesterId: empRamesh.id,
      departmentId: departments['MAINT'].id,
      assignedTechnicianId: techArun.id,
      responseDueAt: new Date(now.getTime() + 10 * 60 * 1000),
      resolutionDueAt: new Date(now.getTime() + 90 * 60 * 1000),
    },
    {
      ticketNumber: 'HD-2026-000130',
      subject: 'Lobby luxury aroma diffuser fragrance oil refill',
      description: 'Signature Dazzle Amber aroma scent in the grand lobby entrance is depleted.',
      type: 'GENERAL_REQUEST',
      priority: 'LOW',
      impact: 'LOW',
      urgency: 'LOW',
      status: 'OPEN',
      location: 'Grand Lobby Atrium',
      requesterId: empSneha.id,
      departmentId: departments['HK'].id,
      assignedTechnicianId: null,
      responseDueAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      resolutionDueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    },
  ];

  for (const t of otherTickets) {
    await prisma.ticket.upsert({
      where: { ticketNumber: t.ticketNumber },
      update: {},
      create: {
        ...t,
        createdAt: new Date(now.getTime() - Math.floor(Math.random() * 8 + 1) * 3600 * 1000),
      },
    });
  }
  console.log('✔ Tickets seeded');

  // 8. Maintenance Schedules
  const maintSchedules = [
    {
      equipmentName: 'Daikin VRV Central AC Chiller Units (Floor 2 Wing)',
      category: 'HVAC',
      location: 'Floor 2 Mechanical Shaft',
      frequency: 'MONTHLY',
      nextScheduledDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
      assignedTechnicianId: techArun.id,
      checklistJson: JSON.stringify([
        { task: 'Clean washable pre-filters and check electrostatic filters', done: true },
        { task: 'Inspect refrigerant suction and discharge pressures', done: false },
        { task: 'Check thermostatic expansion valve response', done: false },
        { task: 'Tighten electrical terminals and inspect contactor contacts', done: false },
      ]),
    },
    {
      equipmentName: 'Cummins 500kVA Standby Diesel Generator',
      category: 'ELECTRICAL',
      location: 'Substation Yard Basement B2',
      frequency: 'MONTHLY',
      nextScheduledDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
      assignedTechnicianId: techManoj.id,
      checklistJson: JSON.stringify([
        { task: 'Test automatic mains failure (AMF) transfer switch', done: false },
        { task: 'Check diesel fuel reserve and fuel line filters', done: true },
        { task: 'Inspect battery electrolyte levels and terminal voltage', done: false },
      ]),
    },
    {
      equipmentName: 'OTIS Passenger Elevator #1 & #2 Safety Inspection',
      category: 'ELEVATOR',
      location: 'Main Tower Shaft',
      frequency: 'QUARTERLY',
      nextScheduledDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
      assignedTechnicianId: techArun.id,
      checklistJson: JSON.stringify([
        { task: 'Emergency brake drop test and overspeed governor inspection', done: false },
        { task: 'Door interlock safety switches and optical curtains check', done: false },
        { task: 'Cabin intercom communication link to 24/7 security desk', done: true },
      ]),
    },
  ];

  for (const ms of maintSchedules) {
    await prisma.maintenanceSchedule.create({ data: ms });
  }
  console.log('✔ Maintenance schedules seeded');

  // 9. Approvals
  const approvalsData = [
    {
      requestNo: 'APR-1001',
      title: 'Additional Budget for HVAC Chiller Compressor Overhaul',
      description: 'Emergency procurement of hermetic scroll compressor kit for 2nd floor chillers.',
      amount: 50000,
      status: 'PENDING',
      ticketId: ticketRoom205.id,
      requesterId: maintManager.id,
      approverId: hotelManager.id,
    },
    {
      requestNo: 'APR-1002',
      title: 'New Software License Renewal for Oracle Hospitality Opera Cloud',
      description: 'Annual enterprise subscription renewal for 35 concurrent front desk and back-office terminals.',
      amount: 25000,
      status: 'PENDING',
      requesterId: itManager.id,
      approverId: hotelManager.id,
    },
    {
      requestNo: 'APR-1003',
      title: 'Emergency Replacement of 4K Security Surveillance Switch',
      description: 'Replacement of burned POE+ gigabit switch powering lobby and ballroom perimeter cameras.',
      amount: 42000,
      status: 'APPROVED',
      requesterId: itManager.id,
      approverId: hotelManager.id,
      reason: 'Approved immediately due to critical guest safety and insurance compliance mandate.',
      decidedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
    },
  ];

  for (const app of approvalsData) {
    await prisma.approval.upsert({
      where: { requestNo: app.requestNo },
      update: {},
      create: app,
    });
  }
  console.log('✔ Approvals seeded');

  // 10. Knowledge Base Articles
  const kbArticles = [
    {
      title: 'WiFi Connection & Captive Portal Troubleshooting Guide',
      slug: 'wifi-connection-guide',
      category: 'IT_SUPPORT',
      summary: 'Step-by-step resolution steps for guest WiFi authentication issues, portal redirect failures, and VIP fast-lane credentials.',
      content: `## Guest WiFi Connection Guide\n\n### Standard Guest Network Connection\n1. Instruct guest to connect to SSID: **DazzleDrop-Guest-5G**\n2. Open any browser and navigate to \`wifi.dazzledrop.com\`\n3. Enter Room Number and Guest Last Name\n\n### If Captive Portal Does Not Auto-Pop\n- Navigate to \`http://192.168.1.1\` or \`http://captive.apple.com\`\n- Ensure Private WiFi Address is disabled in phone Wi-Fi settings during verification.\n- If issue persists, check if room AP is power-cycled via IT dashboard.`,
      authorId: itManager.id,
      viewsCount: 342,
      helpfulCount: 48,
    },
    {
      title: 'Room Thermostat & AC Unit Quick Calibration Protocol',
      slug: 'ac-troubleshooting-steps',
      category: 'MAINTENANCE',
      summary: 'Instructions for hotel staff to verify thermostat modes, clear sensor error codes (E1/E4), and override master energy savers.',
      content: `## In-Room AC Thermostat Calibration\n\n### Rapid Reset Procedure\n1. Press and hold **TEMP UP** and **FAN SPEED** simultaneously for 5 seconds until \`CF\` displays.\n2. Ensure Mode is set to **COOL** (Snowflake icon), not AUTO or DEHUMIDIFY.\n3. Verify balcony sliding door contact sensor is magnetically aligned; AC shuts down automatically if balcony door is ajar.\n4. If error code **E4** shows, contact Maintenance immediately for refrigerant low-pressure inspection.`,
      authorId: maintManager.id,
      viewsCount: 289,
      helpfulCount: 42,
    },
    {
      title: 'Front Desk & Back Office Printer Setup & Toner Replacement',
      slug: 'printer-setup-guide',
      category: 'IT_SUPPORT',
      summary: 'Procedures for clearing feed jams, swapping HP 85A toners, and reconnecting network print spoolers.',
      content: `## Front Office Printer Care\n\n1. Always pull paper jam gently along the paper path direction, never against the roller gear.\n2. When replacing toner, gently rock the cartridge horizontally 5 times before sliding into the bay.\n3. If printer goes offline in Windows, restart the Print Spooler service or run \`ping 10.10.20.45\`.`,
      authorId: itManager.id,
      viewsCount: 195,
      helpfulCount: 31,
    },
    {
      title: 'Room Service Incident & VIP Guest Escalation Process',
      slug: 'room-service-process',
      category: 'FRONT_OFFICE',
      summary: 'Protocol for managing delayed orders, dietary incident reports, and immediate Duty Manager dispatch.',
      content: `## VIP Service Incident Protocol\n\n- If food delivery exceeds 30 minutes past confirmed delivery time, notify F&B Manager immediately.\n- Any allergy complaint triggers immediate replacement + Duty Manager visit with Executive Chef.\n- Log an incident ticket with priority **HIGH** under Food & Beverage queue.`,
      authorId: hotelManager.id,
      viewsCount: 164,
      helpfulCount: 29,
    },
    {
      title: 'Hotel Emergency Contacts, Safety Protocols & Code Blue',
      slug: 'emergency-contacts',
      category: 'GENERAL',
      summary: 'Comprehensive hotline list for Chief Security Officer, local emergency services, and medical desk.',
      content: `## Hotel Emergency Directory\n\n- **Security Control Room 24/7**: Ext. 999 / Direct: +91 98765 00999\n- **Duty General Manager**: Ext. 101\n- **Engineering Master Control**: Ext. 800\n- **Nearest Hospital Ambulance**: 108 / Hotel Medical Partner: 022-2655-0000`,
      authorId: admin.id,
      viewsCount: 512,
      helpfulCount: 88,
    },
  ];

  for (const kb of kbArticles) {
    await prisma.knowledgeArticle.upsert({
      where: { slug: kb.slug },
      update: {},
      create: kb,
    });
  }
  console.log('✔ Knowledge Base articles seeded');

  // 11. Audit Logs
  await prisma.auditLog.createMany({
    data: [
      { userId: admin.id, action: 'SYSTEM_INITIALIZED', entityType: 'SYSTEM', details: 'Hotel Dazzle Drop Service Desk platform configured and initialized.', ipAddress: '10.0.0.1' },
      { userId: empRamesh.id, action: 'TICKET_CREATED', entityType: 'TICKET', entityId: ticketRoom205.id, details: 'Created ticket HD-2026-000123 for Room 205 AC issue.', ipAddress: '10.0.4.22' },
      { userId: maintManager.id, action: 'TICKET_ASSIGNED', entityType: 'TICKET', entityId: ticketRoom205.id, details: 'Assigned HD-2026-000123 to technician Arun Kumar.', ipAddress: '10.0.2.15' },
      { userId: techArun.id, action: 'STATUS_CHANGED', entityType: 'TICKET', entityId: ticketRoom205.id, details: 'Changed status of HD-2026-000123 from ACCEPTED to IN_PROGRESS.', ipAddress: '10.0.3.45' },
      { userId: hotelManager.id, action: 'APPROVAL_GRANTED', entityType: 'APPROVAL', details: 'Approved APR-1003 for emergency security switch replacement.', ipAddress: '10.0.1.10' },
    ],
  });
  console.log('✔ Audit logs seeded');

  // 12. Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: techArun.id,
        title: 'New High Priority Ticket Assigned',
        message: 'Ticket HD-2026-000123 (AC not cooling in Room 205) has been assigned to you. SLA due in 2 hours.',
        type: 'TICKET',
        linkUrl: '/tickets/HD-2026-000123',
      },
      {
        userId: hotelManager.id,
        title: 'Pending Budget Approval Request',
        message: 'Kumar Swamy submitted APR-1001 for ₹50,000 for HVAC Chiller Overhaul awaiting your review.',
        type: 'APPROVAL',
        linkUrl: '/approvals',
      },
      {
        userId: empRamesh.id,
        title: 'Ticket Status Updated to In Progress',
        message: 'Technician Arun Kumar has accepted and started work on your ticket HD-2026-000123.',
        type: 'TICKET',
        linkUrl: '/tickets/HD-2026-000123',
      },
      {
        userId: admin.id,
        title: 'SLA Performance Alert',
        message: 'Overall hotel service desk SLA compliance reached 96.5% for current operational period.',
        type: 'SLA',
        linkUrl: '/reports',
      },
    ],
  });
  console.log('✔ Notifications seeded');

  console.log('Database seeding completed successfully for HOTEL DAZZLE DROP!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
