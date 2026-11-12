import { prisma } from '../lib/prisma.js';
import { generateTicketNumber, calculateSLADeadlines } from './ticketController.js';
export const getMaintenanceSchedules = async (req, res) => {
    try {
        const { status, category } = req.query;
        const where = {};
        if (status && status !== 'ALL')
            where.status = status;
        if (category && category !== 'ALL')
            where.category = category;
        const schedules = await prisma.maintenanceSchedule.findMany({
            where,
            include: {
                assignedTechnician: { select: { id: true, name: true, employeeCode: true, email: true } },
            },
            orderBy: { nextScheduledDate: 'asc' },
        });
        const parsed = schedules.map((s) => ({
            ...s,
            checklist: s.checklistJson ? JSON.parse(s.checklistJson) : [],
        }));
        return res.json(parsed);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch maintenance schedules' });
    }
};
export const createMaintenanceSchedule = async (req, res) => {
    try {
        const { equipmentName, category, location, frequency = 'MONTHLY', nextScheduledDate, assignedTechnicianId, checklist } = req.body;
        if (!equipmentName || !category || !location) {
            return res.status(400).json({ error: 'Equipment name, category, and location are required' });
        }
        const schedule = await prisma.maintenanceSchedule.create({
            data: {
                equipmentName,
                category,
                location,
                frequency,
                nextScheduledDate: nextScheduledDate ? new Date(nextScheduledDate) : new Date(Date.now() + 7 * 86400000),
                assignedTechnicianId: assignedTechnicianId || null,
                checklistJson: checklist ? JSON.stringify(checklist) : '[]',
            },
        });
        return res.status(201).json(schedule);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to create maintenance schedule' });
    }
};
export const updateTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, checklist } = req.body;
        const updateData = {};
        if (status)
            updateData.status = status;
        if (checklist)
            updateData.checklistJson = JSON.stringify(checklist);
        if (status === 'COMPLETED')
            updateData.lastCompletedDate = new Date();
        const schedule = await prisma.maintenanceSchedule.update({
            where: { id },
            data: updateData,
        });
        return res.json(schedule);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to update maintenance schedule' });
    }
};
// One-click convert schedule to active maintenance ticket
export const convertToTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const schedule = await prisma.maintenanceSchedule.findUnique({
            where: { id },
        });
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        // Find maintenance department
        const maintDept = await prisma.department.findFirst({
            where: { code: 'MAINT' },
        });
        const ticketNumber = await generateTicketNumber();
        const { responseDueAt, resolutionDueAt } = await calculateSLADeadlines('HIGH');
        const ticket = await prisma.ticket.create({
            data: {
                ticketNumber,
                subject: `Scheduled Maintenance: ${schedule.equipmentName}`,
                description: `Routine scheduled ${schedule.frequency.toLowerCase()} preventive maintenance for ${schedule.equipmentName} at ${schedule.location}.`,
                type: 'MAINTENANCE_REQUEST',
                priority: 'HIGH',
                status: schedule.assignedTechnicianId ? 'ASSIGNED' : 'OPEN',
                location: schedule.location,
                departmentId: maintDept ? maintDept.id : schedule.assignedTechnicianId,
                assignedTechnicianId: schedule.assignedTechnicianId,
                requesterId: req.user.id,
                responseDueAt,
                resolutionDueAt,
            },
        });
        await prisma.maintenanceSchedule.update({
            where: { id },
            data: { status: 'IN_PROGRESS' },
        });
        return res.status(201).json(ticket);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to generate ticket from schedule' });
    }
};
