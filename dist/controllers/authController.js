import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
const JWT_SECRET = process.env.JWT_SECRET || 'hotel-dazzle-drop-super-secret-jwt-key-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const createToken = (user) => {
    return jwt.sign({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        departmentId: user.departmentId,
        employeeCode: user.employeeCode,
    }, JWT_SECRET, { expiresIn: '7d' });
};
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            include: { department: true },
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Record login audit log
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'USER_LOGIN',
                entityType: 'AUTH',
                entityId: user.id,
                details: `User ${user.name} (${user.role}) logged in successfully.`,
                ipAddress: req.ip || '127.0.0.1',
            },
        });
        const token = createToken(user);
        return res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                employeeCode: user.employeeCode,
                phone: user.phone,
                department: user.department,
                departmentId: user.departmentId,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error during login' });
    }
};
export const getCurrentUser = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { department: true },
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            employeeCode: user.employeeCode,
            phone: user.phone,
            department: user.department,
            departmentId: user.departmentId,
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch user profile' });
    }
};
export const switchDemoRole = async (req, res) => {
    try {
        const { role, email } = req.body;
        let user;
        if (email) {
            user = await prisma.user.findUnique({
                where: { email },
                include: { department: true },
            });
        }
        else if (role) {
            user = await prisma.user.findFirst({
                where: { role },
                include: { department: true },
            });
        }
        if (!user) {
            return res.status(404).json({ error: `No active user found for role: ${role}` });
        }
        const token = createToken(user);
        return res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                employeeCode: user.employeeCode,
                phone: user.phone,
                department: user.department,
                departmentId: user.departmentId,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to switch demo role' });
    }
};
