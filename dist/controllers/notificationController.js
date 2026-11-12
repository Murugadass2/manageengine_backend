import { prisma } from '../lib/prisma.js';
export const getNotifications = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        const unreadCount = await prisma.notification.count({
            where: { userId, isRead: false },
        });
        return res.json({ notifications, unreadCount });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });
        return res.json(notification);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to update notification' });
    }
};
export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user?.id;
        await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
};
