
import { db } from './db';
import { resources } from '@/schema';
import { asc, eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

export type Resource = {
  id: number;
  leagueId: number;
  group: string;
  title: string;
  url: string;
  touch_id?: string | null;
};

const _getResources = unstable_cache(
  async (leagueId: number) => {
    try {
      const allResources = await db.select().from(resources)
        .where(eq(resources.leagueId, leagueId))
        .orderBy(asc(resources.sortOrder), resources.group, resources.title);
      return allResources.reduce((acc: Record<string, { title: string; url: string }[]>, resource) => {
        const group = resource.group ?? 'General';
        if (!acc[group]) acc[group] = [];
        acc[group].push({ title: resource.title, url: resource.url ?? '' });
        return acc;
      }, {});
    } catch (error) {
      console.error("❌ Database Resources Error:", error);
      return {};
    }
  },
  ['resources-data'],
  { revalidate: 60, tags: ['resources'] }
);

export async function getResources(leagueId = 1) {
  return _getResources(leagueId);
}

export async function addResource(resource: Omit<Resource, 'id'>, coachName: string) {
    await db.insert(resources).values({
        ...resource,
        touch_id: coachName,
    });
}

export async function updateResource(id: number, resource: Partial<Omit<Resource, 'id'>>, coachName: string) {
    await db.update(resources).set({
        ...resource,
        touch_id: coachName,
    }).where(eq(resources.id, id));
}

export async function deleteResource(id: number) {
    await db.delete(resources).where(eq(resources.id, id));
}