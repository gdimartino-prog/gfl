export const revalidate = 60;
import { getResources } from '@/lib/getResources';

export default async function ResourcesPage() {
  const categories = await getResources();

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-4xl font-black uppercase italic mb-8">
        League <span className="text-indigo-600">Resources</span>
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {Object.entries(categories).map(([group, links]: [string, any]) => (
          <div key={group} className="space-y-4">
            <h2 className="text-xl font-bold border-b-2 border-indigo-100 pb-2 text-gray-700 uppercase tracking-tight">
              {group}
            </h2>
            <div className="flex flex-col gap-3">
              {links.map((link: any) => (
                <a 
                  key={link.name} 
                  href={link.url} 
                  target="_blank" 
                  className="p-4 bg-white border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-300 transition-all flex justify-between items-center group"
                >
                  <span className="font-bold text-slate-800">{link.name}</span>
                  <span className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold">Download ↗</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}