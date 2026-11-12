import { prisma } from '../lib/prisma.js';
export const getDepartments = async (req, res) => {
    try {
        const departments = await prisma.department.findMany({
            include: {
                manager: { select: { id: true, name: true, email: true, phone: true } },
                _count: {
                    select: {
                        users: { where: { role: 'TECHNICIAN' } },
                        tickets: { where: { status: { notIn: ['CLOSED', 'CANCELLED'] } } },
                    },
                },
            },
            orderBy: { name: 'asc' },
        });
        const formatted = departments.map((d) => ({
            id: d.id,
            name: d.name,
            code: d.code,
            description: d.description,
            status: d.status,
            manager: d.manager?.name || 'Unassigned',
            managerId: d.managerId,
            managerEmail: d.manager?.email,
            techniciansCount: d._count.users,
            activeTicketsCount: d._count.tickets,
        }));
        return res.json(formatted);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch departments' });
    }
};
export const createDepartment = async (req, res) => {
    try {
        const { name, code, description, managerId } = req.body;
        if (!name || !code) {
            return res.status(400).json({ error: 'Department name and code are required' });
        }
        const dept = await prisma.department.create({
            data: {
                name,
                code: code.toUpperCase(),
                description,
                managerId: managerId || null,
            },
        });
        await prisma.auditLog.create({
            data: {
                userId: req.user?.id,
                action: 'DEPARTMENT_CREATED',
                entityType: 'DEPARTMENT',
                entityId: dept.id,
                details: `Department ${dept.name} (${dept.code}) created by ${req.user?.name}`,
            },
        });
        return res.status(201).json(dept);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to create department. Code or name may already exist.' });
    }
};
export const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, description, managerId, status } = req.body;
        const dept = await prisma.department.update({
            where: { id },
            data: {
                name,
                code: code?.toUpperCase(),
                description,
                managerId,
                status,
            },
        });
        return res.json(dept);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to update department' });
    }
};
export const getDepartmentTechnicians = async (req, res) => {
    try {
        const { id } = req.params;
        const technicians = await prisma.user.findMany({
            where: {
                departmentId: id,
                role: 'TECHNICIAN',
            },
            select: {
                id: true,
                name: true,
                email: true,
                employeeCode: true,
                status: true,
                _count: {
                    select: {
                        assignedTickets: {
                            where: { status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
                        },
                    },
                },
            },
        });
        return res.json(technicians);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch department technicians' });
    }
};
