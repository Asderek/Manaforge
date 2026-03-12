"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Project = {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
};

export default function ProjectsPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showNewForm, setShowNewForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/projects`, { credentials: 'include' });
                const data = await res.json();
                if (data.success) {
                    setProjects(data.projects);
                } else {
                    setError(data.error || 'Failed to load projects');
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, [apiUrl]);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const res = await fetch(`${apiUrl}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: newName })
            });
            const data = await res.json();
            if (data.success) {
                router.push(`/projects/${data.project.id}`);
            } else {
                setError(data.error || 'Failed to create project');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteProject = async (projectId: string) => {
        if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) return;
        try {
            const res = await fetch(`${apiUrl}/api/projects/${projectId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setProjects(prev => prev.filter(p => p.id !== projectId));
            }
        } catch (err: any) {
            alert(err.message);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <main className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
                    <button
                        onClick={() => setShowNewForm(!showNewForm)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors text-sm"
                    >
                        + New Project
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                        <p>{error}</p>
                    </div>
                )}

                {showNewForm && (
                    <form onSubmit={handleCreateProject} className="mb-8 bg-blue-50/60 rounded-lg shadow-md p-6 border border-blue-100">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Create New Project</h2>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                placeholder="Project name (e.g., Mono Red Burn)"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={creating || !newName.trim()}
                                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-md transition-colors disabled:opacity-50"
                            >
                                {creating ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </form>
                )}

                {projects.length === 0 ? (
                    <div className="bg-blue-50/60 rounded-lg shadow-md p-12 text-center border border-blue-100">
                        <h2 className="text-xl font-semibold text-gray-700 mb-2">No projects yet</h2>
                        <p className="text-gray-500 mb-6">Create your first deck to get started building proxy sheets.</p>
                        <button
                            onClick={() => setShowNewForm(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
                        >
                            + Create Your First Project
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {projects.map((project) => (
                            <div key={project.id} className="bg-blue-50/60 rounded-lg shadow-sm border border-blue-100 p-6 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between">
                                    <Link href={`/projects/${project.id}`} className="flex-1 group">
                                        <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                            {project.name}
                                        </h2>
                                        {project.description && (
                                            <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                                        )}
                                        <p className="text-xs text-gray-400 mt-2">
                                            Updated {new Date(project.updated_at).toLocaleDateString()}
                                        </p>
                                    </Link>
                                    <button
                                        onClick={() => handleDeleteProject(project.id)}
                                        className="text-red-400 hover:text-red-600 transition-colors text-sm font-medium ml-4"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
