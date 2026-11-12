import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getArticles = async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    const where: any = { isPublished: true };

    if (category && category !== 'ALL') where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: String(search) } },
        { summary: { contains: String(search) } },
        { content: { contains: String(search) } },
      ];
    }

    const articles = await prisma.knowledgeArticle.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
      orderBy: { viewsCount: 'desc' },
    });

    return res.json(articles);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch knowledge articles' });
  }
};

export const getArticleBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const article = await prisma.knowledgeArticle.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Increment views
    await prisma.knowledgeArticle.update({
      where: { id: article.id },
      data: { viewsCount: { increment: 1 } },
    });

    return res.json(article);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch article' });
  }
};

export const rateHelpful = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await prisma.knowledgeArticle.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
    });
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to rate article' });
  }
};

export const createArticle = async (req: AuthRequest, res: Response) => {
  try {
    const { title, category, summary, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4);

    const article = await prisma.knowledgeArticle.create({
      data: {
        title,
        slug,
        category: category || 'GENERAL',
        summary: summary || title,
        content,
        authorId: req.user?.id,
      },
    });

    return res.status(201).json(article);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to create article' });
  }
};
