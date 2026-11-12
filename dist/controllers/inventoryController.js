import { prisma } from '../lib/prisma.js';
export const getInventoryItems = async (req, res) => {
    try {
        const { category, status, search } = req.query;
        const where = {};
        if (category && category !== 'ALL')
            where.category = category;
        if (status && status !== 'ALL')
            where.status = status;
        if (search) {
            where.OR = [
                { itemCode: { contains: String(search) } },
                { name: { contains: String(search) } },
                { supplier: { contains: String(search) } },
            ];
        }
        const items = await prisma.inventoryItem.findMany({
            where,
            include: {
                transactions: {
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                },
            },
            orderBy: { itemCode: 'asc' },
        });
        return res.json(items);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch inventory items' });
    }
};
export const createInventoryItem = async (req, res) => {
    try {
        const { itemCode, name, category, stockQuantity = 0, minLevel = 10, unit = 'pcs', unitPrice = 0, supplier, location } = req.body;
        if (!itemCode || !name || !category) {
            return res.status(400).json({ error: 'Item code, name, and category are required' });
        }
        const qty = parseInt(stockQuantity);
        const min = parseInt(minLevel);
        let status = 'IN_STOCK';
        if (qty <= 0)
            status = 'OUT_OF_STOCK';
        else if (qty <= min)
            status = 'LOW_STOCK';
        const item = await prisma.inventoryItem.create({
            data: {
                itemCode,
                name,
                category,
                stockQuantity: qty,
                minLevel: min,
                unit,
                unitPrice: parseFloat(unitPrice),
                supplier,
                location,
                status,
            },
        });
        return res.status(201).json(item);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to create inventory item' });
    }
};
export const adjustStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, quantity, notes, referenceTicketId } = req.body; // type: 'STOCK_IN' | 'STOCK_OUT'
        if (!type || !quantity || quantity <= 0) {
            return res.status(400).json({ error: 'Valid transaction type and positive quantity are required' });
        }
        const item = await prisma.inventoryItem.findUnique({ where: { id } });
        if (!item) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        const qty = parseInt(quantity);
        let newStock = item.stockQuantity;
        if (type === 'STOCK_IN') {
            newStock += qty;
        }
        else if (type === 'STOCK_OUT') {
            if (item.stockQuantity < qty) {
                return res.status(400).json({ error: `Insufficient stock. Current stock is only ${item.stockQuantity}` });
            }
            newStock -= qty;
        }
        let status = 'IN_STOCK';
        if (newStock <= 0)
            status = 'OUT_OF_STOCK';
        else if (newStock <= item.minLevel)
            status = 'LOW_STOCK';
        // Transaction-safe update
        const [updatedItem, transaction] = await prisma.$transaction([
            prisma.inventoryItem.update({
                where: { id },
                data: { stockQuantity: newStock, status },
            }),
            prisma.inventoryTransaction.create({
                data: {
                    itemId: id,
                    type,
                    quantity: qty,
                    previousStock: item.stockQuantity,
                    newStock,
                    notes,
                    referenceTicketId,
                    performedById: req.user?.id,
                },
            }),
        ]);
        await prisma.auditLog.create({
            data: {
                userId: req.user?.id,
                action: 'INVENTORY_ADJUSTED',
                entityType: 'INVENTORY',
                entityId: id,
                details: `${type === 'STOCK_IN' ? 'Stock Added' : 'Stock Issued'}: ${qty} ${item.unit} of ${item.name}. New balance: ${newStock}.`,
            },
        });
        return res.json({ item: updatedItem, transaction });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to adjust inventory stock' });
    }
};
