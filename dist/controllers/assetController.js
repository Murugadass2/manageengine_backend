import { prisma } from '../lib/prisma.js';
export const getAssets = async (req, res) => {
    try {
        const { category, departmentId, status, search } = req.query;
        const where = {};
        if (category && category !== 'ALL')
            where.category = category;
        if (departmentId && departmentId !== 'ALL')
            where.departmentId = departmentId;
        if (status && status !== 'ALL')
            where.status = status;
        if (search) {
            where.OR = [
                { assetTag: { contains: String(search) } },
                { name: { contains: String(search) } },
                { location: { contains: String(search) } },
                { serialNumber: { contains: String(search) } },
            ];
        }
        const assets = await prisma.asset.findMany({
            where,
            include: {
                department: { select: { id: true, name: true, code: true } },
                assignedUser: { select: { id: true, name: true, employeeCode: true } },
                _count: { select: { tickets: true } },
            },
            orderBy: { assetTag: 'asc' },
        });
        return res.json(assets);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch assets' });
    }
};
export const createAsset = async (req, res) => {
    try {
        const { assetTag, name, category, serialNumber, location, departmentId, cost, assignedUserId, status = 'ACTIVE' } = req.body;
        if (!assetTag || !name || !category) {
            return res.status(400).json({ error: 'Asset tag, name, and category are required' });
        }
        const asset = await prisma.asset.create({
            data: {
                assetTag,
                name,
                category,
                serialNumber: serialNumber || null,
                location: location || null,
                departmentId: departmentId || null,
                cost: cost ? parseFloat(cost) : null,
                assignedUserId: assignedUserId || null,
                status,
            },
        });
        await prisma.auditLog.create({
            data: {
                userId: req.user?.id,
                action: 'ASSET_CREATED',
                entityType: 'ASSET',
                entityId: asset.id,
                details: `Asset ${asset.assetTag} (${asset.name}) registered.`,
            },
        });
        return res.status(201).json(asset);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to create asset. Asset Tag may already exist.' });
    }
};
export const updateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, location, departmentId, cost, status, assignedUserId } = req.body;
        const asset = await prisma.asset.update({
            where: { id },
            data: {
                name,
                category,
                location,
                departmentId,
                cost: cost ? parseFloat(cost) : undefined,
                status,
                assignedUserId,
            },
        });
        return res.json(asset);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to update asset' });
    }
};
