import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning all inbuilt data from database...');

  // 1. Delete dependent transactional records
  await prisma.ticketComment.deleteMany();
  await prisma.ticketWorkLog.deleteMany();
  await prisma.ticketHistory.deleteMany();
  await prisma.ticketAttachment.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.inventoryTransaction.deleteMany();

  // 2. Delete main operational entities
  await prisma.ticket.deleteMany();
  await prisma.maintenanceSchedule.deleteMany();
  await prisma.knowledgeArticle.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.asset.deleteMany();

  // 3. Clear manager foreign key references from departments to allow deleting demo users
  await prisma.department.updateMany({
    data: { managerId: null },
  });

  // 4. Delete all users EXCEPT the requested admin account (admin12@gmail.com)
  await prisma.user.deleteMany({
    where: {
      email: {
        not: 'admin12@gmail.com',
      },
    },
  });

  // 5. Ensure core system departments exist
  const coreDepartments = [
    { name: 'Administration', code: 'ADMIN', description: 'Executive, compliance and administrative management' },
    { name: 'IT Support', code: 'IT', description: 'Enterprise hardware, network, and software systems' },
    { name: 'Housekeeping', code: 'HK', description: 'Guest rooms, floor cleanliness, and amenities' },
    { name: 'Maintenance', code: 'MAINT', description: 'Civil engineering, HVAC, and hotel repairs' },
    { name: 'Electrical', code: 'ELEC', description: 'Power systems, lighting, and generators' },
    { name: 'Front Office', code: 'FO', description: 'Reception, concierge, and guest relations' },
  ];

  const adminDept = await prisma.department.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: coreDepartments[0],
  });

  for (let i = 1; i < coreDepartments.length; i++) {
    await prisma.department.upsert({
      where: { code: coreDepartments[i].code },
      update: {},
      create: coreDepartments[i],
    });
  }

  // 6. Ensure default SLA policies exist
  const slaPolicies = [
    { priority: 'CRITICAL', name: 'Critical Emergency SLA', responseMinutes: 15, resolutionMinutes: 120, escalationRole: 'SUPER_ADMIN' },
    { priority: 'HIGH', name: 'High Priority Operational SLA', responseMinutes: 30, resolutionMinutes: 240, escalationRole: 'SUPER_ADMIN' },
    { priority: 'MEDIUM', name: 'Medium Standard Service SLA', responseMinutes: 120, resolutionMinutes: 720, escalationRole: 'SUPER_ADMIN' },
    { priority: 'LOW', name: 'Low Routine Request SLA', responseMinutes: 240, resolutionMinutes: 1440, escalationRole: 'SUPER_ADMIN' },
  ];

  for (const sla of slaPolicies) {
    await prisma.sLAPolicy.upsert({
      where: { priority: sla.priority },
      update: sla,
      create: sla,
    });
  }

  // 7. Ensure Admin account exists (admin12@gmail.com / admin@123)
  const adminPasswordHash = await bcrypt.hash('admin@123', 10);
  await prisma.user.upsert({
    where: { email: 'admin12@gmail.com' },
    update: {
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
      departmentId: adminDept.id,
    },
    create: {
      name: 'System Administrator',
      email: 'admin12@gmail.com',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
      employeeCode: 'ADM-001',
      phone: '+91 98765 43210',
      status: 'ACTIVE',
      departmentId: adminDept.id,
    },
  });

  console.log('✔ All dummy tickets, mock assets, inventory, maintenance, logs, and sample users removed.');
  console.log('✔ Clean database ready with admin12@gmail.com as the sole administrator.');
}

main()
  .catch((e) => {
    console.error('Error during database cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
