import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabaseAdmin } from '../lib/supabaseClient';

interface TeamMember {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    created_at?: string; // If we want to show it, though it might not be in profiles. We can use auth.users but we only have profiles access.
}

export default function SetariCont() {
    const { profile, session } = useAuth();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Ensure only owners can see this
    const isOwner = !profile?.parent_id;

    useEffect(() => {
        if (!isOwner || !profile?.id) return;
        fetchMembers();
    }, [isOwner, profile?.id]);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email, role')
                .eq('parent_id', profile!.id);

            if (error) throw error;
            setMembers(data || []);
        } catch (err) {
            console.error('Error fetching team members:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Adresa de email și parola sunt obligatorii.');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            // 1. Create the user in Supabase Auth using the Admin API
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName }
            });

            if (authError) throw authError;

            const newUserId = authData.user.id;

            // 2. Add them to the public.profiles table linking them to the owner
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .insert({
                    id: newUserId,
                    full_name: fullName,
                    email: email, // If email is in profiles, otherwise skip
                    role: 'user',
                    parent_id: profile!.id,
                    stores: profile!.stores ? profile!.stores.join(',') : ''
                });

            if (profileError) {
                // If profile creation fails, we should ideally delete the auth user, but for now just show error
                throw profileError;
            }

            // Close modal and refresh
            setShowModal(false);
            setEmail('');
            setPassword('');
            setFullName('');
            fetchMembers();

        } catch (err: any) {
            console.error('Error creating member:', err);
            setError(err?.message || 'A apărut o eroare la crearea utilizatorului.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteMember = async (memberId: string) => {
        if (!confirm('Ești sigur că vrei să ștergi acest membru? Nu se poate anula.')) return;

        try {
            // Delete from auth (cascades to profiles)
            const { error } = await supabaseAdmin.auth.admin.deleteUser(memberId);
            if (error) throw error;
            fetchMembers();
        } catch (err) {
            console.error('Error deleting member:', err);
            alert('A apărut o eroare la ștergerea utilizatorului.');
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h2 className="text-2xl md:text-3xl font-light dark:text-white tracking-tight">Setări Cont</h2>
                <p className="text-gray-400 font-light mt-1 text-sm md:text-base">Gestionează preferințele și profilul tău.</p>
            </div>

            {/* Dummy Settings Section */}
            <div className="bg-[#13141a] rounded-2xl border border-white/5 p-6 shadow-xl">
                <h3 className="text-lg text-white font-light mb-4">Profilul Meu</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Nume Complet</label>
                        <input 
                            type="text" 
                            defaultValue={profile?.full_name || ''}
                            className="w-full bg-[#0a0b14] border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            disabled
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Adresă Email</label>
                        <input 
                            type="email" 
                            defaultValue={session?.user?.email || ''}
                            className="w-full bg-[#0a0b14] border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            disabled
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Notificări Browser</label>
                        <select className="w-full bg-[#0a0b14] border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all cursor-not-allowed" disabled>
                            <option>Active</option>
                            <option>Inactive</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Sunet Notificări</label>
                        <select className="w-full bg-[#0a0b14] border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all cursor-not-allowed" disabled>
                            <option>Clopoțel (Default)</option>
                            <option>Scurt</option>
                            <option>Fără sunet</option>
                        </select>
                    </div>
                </div>
                <div className="mt-6">
                    <button className="btn-3d-secondary px-4 py-2 rounded-xl text-sm font-medium opacity-50 cursor-not-allowed">Salvează Modificările</button>
                </div>
            </div>

            {/* Team Section (Only for Owners) */}
            {isOwner && (
                <div>
                    <div className="flex justify-between items-center mb-6 mt-12">
                        <div>
                            <h3 className="text-xl text-white font-light">Echipa Mea</h3>
                            <p className="text-gray-400 font-light mt-1 text-sm">Gestionează membrii care au acces la acest Workspace.</p>
                        </div>
                        <button 
                            onClick={() => setShowModal(true)}
                            className="btn-3d-primary px-4 py-2.5 rounded-xl text-white text-sm font-medium flex items-center gap-2"
                        >
                            <span className="material-icons-round text-lg">person_add</span>
                            Adaugă Membru
                        </button>
                    </div>
            {loading ? (
                <div className="flex justify-center p-12">
                    <span className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></span>
                </div>
            ) : (
                <div className="bg-[#13141a] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/5">
                                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Nume</th>
                                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Rol</th>
                                    <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Acțiuni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-500 font-light">
                                            Nu ai niciun membru în echipă momentan.
                                        </td>
                                    </tr>
                                ) : (
                                    members.map((member) => (
                                        <tr key={member.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-medium text-sm">
                                                        {member.full_name ? member.full_name.substring(0, 1).toUpperCase() : member.email.substring(0, 1).toUpperCase()}
                                                    </div>
                                                    <span className="text-white text-sm">{member.full_name || 'Fără Nume'}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-gray-400">{member.email}</td>
                                            <td className="p-4">
                                                <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                    Membru Echipa
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button 
                                                    onClick={() => handleDeleteMember(member.id)}
                                                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Șterge Membru"
                                                >
                                                    <span className="material-icons-round text-[20px]">delete_outline</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <div className="relative bg-[#161822] border border-white/10 p-6 md:p-8 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl text-white font-light">Adaugă Membru</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white transition-colors">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleAddMember} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Nume Complet</label>
                                <input 
                                    type="text" 
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-[#0a0b14] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    placeholder="Ex: Ion Popescu"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Adresă Email</label>
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[#0a0b14] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    placeholder="email@exemplu.ro"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Parolă Inițială</label>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#0a0b14] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    placeholder="Minim 6 caractere"
                                    required
                                    minLength={6}
                                />
                                <p className="text-xs text-gray-500 mt-1">Transmite-i această parolă noului membru pentru a se putea autentifica.</p>
                            </div>

                            <div className="mt-4 flex justify-end gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm font-medium"
                                >
                                    Anulează
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="btn-3d-primary px-6 py-2 rounded-xl text-white text-sm font-medium flex items-center justify-center min-w-[120px]"
                                >
                                    {isSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Adaugă'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
                </div>
            )}
        </div>
    );
}
