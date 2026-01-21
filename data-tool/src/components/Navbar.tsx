import { headers } from 'next/headers';

export default async function Navbar() {
    const headersList = await headers();
    const email = headersList.get('x-user-email') || 'Guest';

    return (
        <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-xl text-zinc-900 dark:text-zinc-50">Data Tool</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {email}
                    </span>
                </div>
            </div>
        </nav>
    );
}
