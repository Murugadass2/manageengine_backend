import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
export const getUsers = async (req, res) => {
    try {
        const { role, departmentId, search } = req.query;
        const where = {};
        if (role && role !== 'ALL')
            where.role = role;
        if (departmentId && departmentId !== 'ALL')
            where.departmentId = departmentId;
        if (search) {
            where.OR = [
                { name: { contains: String(search) } },
                { email: { contains: String(search) } },
                { employeeCode: { contains: String(search) } },
            ];
        }
        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                employeeCode: true,
                phone: true,
                status: true,
                createdAt: true,
                department: { select: { id: true, name: true, code: true } },
                _count: {
                    select: {
                        assignedTickets: { where: { status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } } },
                        requestedTickets: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json(users);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch users' });
    }
};
export const createUser = async (req, res) => {
    try {
        // Only Admin / SUPER_ADMIN can create employees
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Access denied: Only Admin can create employee IDs' });
        }
        const { name, email, employeeCode, role, departmentId, phone, password } = req.body;
        if (!name || !email || !employeeCode) {
            return res.status(400).json({ error: 'Name, email, and employee ID/code are required' });
        }
        // Check unique email
        const existingEmail = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });
        if (existingEmail) {
            return res.status(400).json({ error: 'A user with this email address already exists' });
        }
        // Check unique employeeCode
        const existingCode = await prisma.user.findUnique({
            where: { employeeCode },
        });
        if (existingCode) {
            return res.status(400).json({ error: 'A user with this Employee ID code already exists' });
        }
        const defaultPassword = password || 'Password@123';
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        const newUser = await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                employeeCode,
                role: role || 'EMPLOYEE',
                departmentId: departmentId || null,
                phone: phone || null,
                passwordHash,
                status: 'ACTIVE',
            },
            include: {
                department: true,
            },
        });
        // Record Audit Log
        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'EMPLOYEE_CREATED',
                entityType: 'USER',
                entityId: newUser.id,
                details: `Admin ${req.user.name} created Employee ${newUser.name} with ID: ${newUser.employeeCode} (${newUser.role})`,
                ipAddress: req.ip || '127.0.0.1',
            },
        });
        return res.status(201).json({
            message: 'Employee ID created successfully',
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                employeeCode: newUser.employeeCode,
                phone: newUser.phone,
                status: newUser.status,
                department: newUser.department,
            },
        });
    }
    catch (error) {
        console.error('Error creating employee:', error);
        return res.status(500).json({ error: 'Failed to create employee', message: error.message });
    }
};
export const updateProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { name, phone } = req.body;
        const updated = await prisma.user.update({
            where: { id: userId },
            data: { name, phone },
            include: { department: true },
        });
        return res.json(updated);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to update profile' });
    }
};
