import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { useAuth } from './contexts/AuthContext';
import Index from "./pages/Index";
import CallRecordings from "./pages/CallRecordings";
import WhatsappPage from "./pages/WhatsappPage";
import ChatPage from "./pages/ChatPage";
import ControlRobotPage from "./pages/ControlRobotPage";
import StatisticiProduse from "./pages/StatisticiProduse";
import ScriptVanzare from "./pages/ScriptVanzare";
import StatisticiAdrese from "./pages/StatisticiAdrese";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import OnboardingPage from "./pages/OnboardingPage";
import VerificareApeluri from "./pages/VerificareApeluri";
import Drafturi from "./pages/Drafturi";

export default function App() {
    const { session, loading: authLoading } = useAuth();

    // While loading initial auth, show nothing or a loader
    if (authLoading) {
        return (
            <div className="h-screen w-full bg-[#0a0b14] flex items-center justify-center">
                <span className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></span>
            </div>
        );
    }

    if (!session) {
        return <AuthPage />;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <HashRouter>
                <div className="flex flex-col h-screen overflow-hidden bg-background-light dark:bg-background-dark text-gray-800 dark:text-gray-200 font-sans transition-colors duration-300 w-full">
                    <div className="flex flex-1 overflow-hidden">
                        {/* Fixed-width spacer so main never shifts when sidebar expands */}
                        <div className="flex-shrink-0 w-[72px]" />
                        <Sidebar />
                        <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-cyan-900/10 via-cyan-900/5 to-transparent pointer-events-none z-0"></div>

                            <Header userEmail={session.user.email} />

                            <div className="flex-1 overflow-y-auto p-8 z-10 scroll-smooth">
                                <Routes>
                                    <Route path="/" element={<Index />} />
                                    <Route path="/call-recordings" element={<CallRecordings />} />
                                    <Route path="/whatsapp" element={<WhatsappPage />} />
                                    <Route path="/chat" element={<ChatPage />} />
                                    <Route path="/control-robot" element={<ControlRobotPage />} />
                                    <Route path="/statistici-produse" element={<StatisticiProduse />} />
                                    <Route path="/script-vanzare" element={<ScriptVanzare />} />
                                    <Route path="/statistici-adrese" element={<StatisticiAdrese />} />
                                    <Route path="/setup" element={<OnboardingPage />} />
                                    <Route path="/drafturi" element={<Drafturi />} />
                                    <Route path="/verificare-apeluri" element={<VerificareApeluri />} />
                                    <Route path="*" element={<PlaceholderPage />} />
                                </Routes>
                            </div>
                        </main>
                    </div>
                </div>
            </HashRouter>
        </QueryClientProvider>
    );
}

function AuthPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
        } catch (error: any) {
            if (error.message && (error.message.includes('fetch') || error.message.includes('URL'))) {
                setError("Eroare conexiune: Verificați configurația Supabase.");
            } else if (error.message === "Invalid login credentials") {
                setError("Email sau parolă incorectă.");
            } else {
                setError(error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-full bg-[#0a0b14] flex items-center justify-center relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full"></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
            </div>

            <div className="w-full max-w-md p-8 relative z-10">
                <div className="glass-panel-3d rounded-2xl p-8 border border-white/5 shadow-2xl">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#00d2ff] via-[#00b0ff] to-[#008cff] drop-shadow-[0_0_15px_rgba(0,176,255,0.3)] font-mono mb-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                            NANOASSIST
                        </h1>
                        <p className="text-gray-400 text-sm font-light">
                            Autentificare
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-xs text-gray-500 font-medium ml-1">Email</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-icons-round text-lg">mail</span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-[#00d2ff] text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-[#00d2ff] transition-all shadow-none"
                                    placeholder="nume@companie.ro"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-gray-500 font-medium ml-1">Parolă</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-icons-round text-lg">lock</span>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-12 py-3 rounded-xl bg-white border border-[#a855f7] text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-[#a855f7] transition-all shadow-none"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                                >
                                    <span className="material-icons-round text-xl">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-pulse">
                                <span className="material-icons-round text-sm">error_outline</span>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-3d-primary py-3 rounded-xl text-white font-medium text-sm tracking-wide mt-4 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <>
                                    AUTENTIFICARE
                                    <span className="material-icons-round text-lg">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

function PlaceholderPage() {
    const location = useLocation();
    return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <span className="material-icons-round text-6xl mb-4 opacity-20">construction</span>
            <h2 className="text-xl font-light">Pagina {location.pathname} este în lucru</h2>
        </div>
    );
}

function Header({ userEmail }: { userEmail?: string }) {
    return (
        <header className="h-20 flex items-center justify-between px-8 z-10 border-b border-gray-200 dark:border-gray-800 bg-surface-light/90 dark:bg-background-dark/90 backdrop-blur-md shadow-lg shrink-0">
            <div className="flex items-center gap-4 w-1/3">
                <h1 className="text-2xl font-light tracking-tight dark:text-white drop-shadow-sm bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Statistici</h1>
            </div>
            <div className="flex items-center gap-4 w-1/3 justify-end">
                <button className="w-12 h-12 btn-3d-secondary rounded-xl flex items-center justify-center relative hover:text-white transition-colors">
                    <span className="material-icons-round text-xl">notifications</span>
                    <span className="absolute top-3 right-3.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface-dark shadow-[0_0_10px_rgba(239,68,68,0.6)]"></span>
                </button>
                <button className="w-12 h-12 btn-3d-secondary rounded-xl flex items-center justify-center hover:text-white transition-colors">
                    <span className="material-icons-round text-xl">settings</span>
                </button>
            </div>
        </header>
    );
}

function Sidebar() {
    const { session, signOut } = useAuth();
    const userEmail = session?.user?.email;
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const handleLogout = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('🔘 [Sidebar] Logout interaction started.');
        setIsLoggingOut(true);

        try {
            await signOut();
            console.log('✅ [Sidebar] Logout sequence triggered successfully.');
        } catch (error) {
            console.error('❌ [Sidebar] Logout error:', error);
            setIsLoggingOut(false);
        }
    };

    // WhatsApp SVG Icon
    const whatsappIcon = (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-[1.25rem] h-[1.25rem]" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );

    const collapsed = !isHovered;

    return (
        <aside
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`fixed left-0 top-0 h-screen border-r border-gray-200 dark:border-gray-800 bg-surface-light dark:bg-[#0d0e19] flex flex-col overflow-hidden z-20 shadow-xl transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${collapsed ? 'w-[72px]' : 'w-64'}`}
        >
            {/* Logo — always rendered, text slides in */}
            <div className="flex items-center h-20 px-4 shrink-0 overflow-hidden">
                <span
                    className="text-3xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#00d2ff] via-[#00b0ff] to-[#008cff] drop-shadow-[0_0_15px_rgba(0,176,255,0.3)] font-mono shrink-0"
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >N</span>
                <span
                    className={`text-3xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#00d2ff] via-[#00b0ff] to-[#008cff] font-mono whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[200px] opacity-100'}`}
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >ANOASSIST</span>
            </div>

            <nav className="flex-1 space-y-4 mt-2 overflow-y-auto overflow-x-hidden px-2">
                <div>
                    <ul className="space-y-1">
                        <li><SidebarLink to="/" icon="dashboard" label="Dashboard" collapsed={collapsed} /></li>
                        <li><SidebarLink to="/statistici-produse" icon="bar_chart" label="Statistici produse" collapsed={collapsed} /></li>
                        <li><SidebarLink to="/statistici-adrese" icon="map" label="Statistici adrese" collapsed={collapsed} /></li>
                        <li><SidebarLink to="/processed-orders" icon="shopping_cart" label="Comenzi procesate" collapsed={collapsed} /></li>
                        <li><SidebarLink to="/customers" icon="people" label="Clienți" collapsed={collapsed} /></li>
                        <li><SidebarLink to="/script-vanzare" icon="description" label="Script vanzare" collapsed={collapsed} /></li>
                        <li><SidebarLink to="/drafturi" icon="shopping_basket" label="Drafturi" collapsed={collapsed} /></li>
                        <li><SidebarLink to="/setup" icon="add_circle" label="Adaugă magazin" collapsed={collapsed} /></li>
                    </ul>
                </div>
                <div>
                    <ul className="space-y-1">
                        <li><SidebarLink to="/chat" icon="smart_toy" label="Chat AI" collapsed={collapsed} /></li>
                        <li><SidebarLink to="/whatsapp" icon={whatsappIcon} label="Whatsapp" collapsed={collapsed} /></li>
                        <li><SidebarLink to="/call-recordings" icon="keyboard_voice" label="Înregistrări Apeluri" collapsed={collapsed} /></li>
                        <li><SidebarLink to="/control-robot" icon="settings_remote" label="Control Robot" collapsed={collapsed} /></li>
                        <li><SidebarLink to="/verificare-apeluri" icon="fact_check" label="Verificare apeluri" collapsed={collapsed} /></li>
                    </ul>
                </div>
            </nav>

            {/* Footer — always full structure, text slides in */}
            <div className="border-t border-gray-200 dark:border-gray-800 p-2 shrink-0">
                <div className="flex items-center gap-3 p-2 rounded-xl glass-panel-3d overflow-hidden">
                    <div className="relative flex-shrink-0">
                        <img
                            alt="User Profile"
                            className="w-9 h-9 rounded-full ring-2 ring-cyan-500/50 shadow-lg"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBU74HU2GRRRCYR-y4C1o61_xlf-GzgQpiMNTsr3T3-zTKJvGn7N3WilTiZKPnPS_5A_Br7ktYW-DlTNeX9zU5rGJSDSh8g5Z-Qp2Fk_CPVxEYAq4wiZbjIIgViNUU8XHUi67qBn09PAjmrocgGdbNKg9e8rR1vQ6ht3YUPh5sP9DOyuxBRmzpgiJN28BA9jOm-jgx7ldZI1RocbOo5bhIkHaQIEQcSRJ2XovxY079dty-_nwbSz-VMbWbo4Uo3vOJ7V8BnBEo-cT_z"
                        />
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#161822] rounded-full"></div>
                    </div>
                    <div className={`flex-1 min-w-0 overflow-hidden transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[120px] opacity-100'}`}>
                        <p className="text-sm font-normal text-gray-900 dark:text-white truncate">{userEmail || 'Admin'}</p>
                        <p className="text-xs text-gray-500 truncate font-light">Online</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-gray-400 transition-all focus:outline-none active:scale-95 overflow-hidden ${collapsed ? 'max-w-0 opacity-0 border-0 p-0' : 'max-w-[40px] opacity-100'} ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400'}`}
                        title="Deconectare"
                        type="button"
                    >
                        {isLoggingOut
                            ? <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin"></span>
                            : <span className="material-icons-round text-lg">logout</span>
                        }
                    </button>
                </div>
            </div>
        </aside>
    );
}

function SidebarLink({ to, icon, label, badge, collapsed }: { to: string; icon: React.ReactNode | string; label: string; badge?: string; collapsed?: boolean }) {
    return (
        <NavLink
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
                `flex items-center px-2 py-2 rounded-xl transition-all duration-150 overflow-hidden ${
                    isActive
                        ? 'bg-gradient-to-r from-cyan-900/40 to-cyan-800/10 border border-cyan-500/20 text-primary shadow-[0_4px_12px_rgba(0,176,255,0.15)]'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-surface-dark-lighter hover:text-white border border-transparent'
                } group`
            }
        >
            {({ isActive }) => (
                <>
                    {typeof icon === 'string' ? (
                        <span className="material-icons-round text-xl flex-shrink-0 group-hover:text-primary transition-colors">{icon}</span>
                    ) : (
                        <span className="flex items-center justify-center w-[24px] h-[24px] flex-shrink-0 group-hover:text-primary transition-colors">{icon}</span>
                    )}
                    {/* Label always rendered, slides in with width+opacity */}
                    <span
                        className={`ml-3 whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] text-sm ${
                            isActive ? '' : 'font-light'
                        } ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100'}`}
                    >
                        {label}
                    </span>
                    {badge && (
                        <span className={`ml-auto bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-[10px] font-normal px-2 py-0.5 rounded-full shrink-0 overflow-hidden transition-[max-width,opacity] duration-300 ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[60px] opacity-100'}`}>
                            {badge}
                        </span>
                    )}
                </>
            )}
        </NavLink>
    );
}