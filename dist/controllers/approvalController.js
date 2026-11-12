import { prisma } from '../lib/prisma.js';
export const getApprovals = async (req, res) => {
    try {
        const { status } = req.query;
        const where = {};
        if (status && status !== 'ALL')
            where.status = status;
        const approvals = await prisma.approval.findMany({
            where,
            include: {
                requester: { select: { id: true, name: true, employeeCode: true, email: true } },
                approver: { select: { id: true, name: true, email: true } },
                ticket: { select: { id: true, ticketNumber: true, subject: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json(approvals);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch approvals' });
    }
};
export const createApproval = async (req, res) => {
    try {
        const { title, description, amount, ticketId } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        const count = await prisma.approval.count();
        const requestNo = `APR-${(1001 + count).toString()}`;
        // Find hotel manager or super admin as default approver
        const hotelManager = await prisma.user.findFirst({
            where: { role: 'HOTEL_MANAGER' },
        });
        const approval = await prisma.approval.create({
            data: {
                requestNo,
                title,
                description,
                amount: amount ? parseFloat(amount) : null,
                ticketId: ticketId || null,
                requesterId: req.user.id,
                approverId: hotelManager ? hotelManager.id : null,
                status: 'PENDING',
            },
        });
        if (hotelManager) {
            await prisma.notification.create({
                data: {
                    userId: hotelManager.id,
                    title: `New Approval Request: ${requestNo}`,
                    message: `${req.user?.name} submitted "${title}" for ₹${amount || 0} requiring your authorization.`,
                    type: 'APPROVAL',
                    linkUrl: '/approvals',
                },
            });
        }
        return res.status(201).json(approval);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to create approval request' });
    }
};
export const processApproval = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body; // status: 'APPROVED' | 'REJECTED'
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
        }
        const approval = await prisma.approval.findUnique({
            where: { id },
            include: { requester: true },
        });
        if (!approval) {
            return res.status(404).json({ error: 'Approval request not found' });
        }
        const updated = await prisma.approval.update({
            where: { id },
            data: {
                status,
                reason: reason || (status === 'APPROVED' ? 'Approved by management' : 'Rejected by management'),
                decidedAt: new Date(),
                approverId: req.user?.id,
            },
        });
        await prisma.auditLog.create({
            data: {
                userId: req.user?.id,
                action: status === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
                entityType: 'APPROVAL',
                entityId: id,
                details: `Request ${approval.requestNo} (${approval.title}) was ${status} by ${req.user?.name}. Remarks: ${reason || 'N/A'}`,
            },
        });
        // Notify requester
        await prisma.notification.create({
            data: {
                userId: approval.requesterId,
                title: `Approval Request ${status}: ${approval.requestNo}`,
                message: `Your request "${approval.title}" has been ${status.toLowerCase()} by ${req.user?.name}.`,
                type: 'APPROVAL',
                linkUrl: '/approvals',
            },
        });
        return res.json(updated);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to process approval' });
    }
};
