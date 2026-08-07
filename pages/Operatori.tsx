import React from 'react';

export default function Operatori() {
    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl md:text-3xl font-light dark:text-white tracking-tight">Operatori</h2>
                <p className="text-gray-400 font-light mt-1 text-sm md:text-base">Gestionează performanța operatorilor și regulile de alocare (în curând).</p>
            </div>

            <div className="bg-[#13141a] rounded-2xl border border-white/5 p-8 shadow-xl flex flex-col items-center justify-center text-center">
                <span className="material-icons-round text-6xl text-cyan-500/20 mb-4">support_agent</span>
                <h3 className="text-xl text-white font-light mb-2">Modul în Dezvoltare</h3>
                <p className="text-gray-400 font-light max-w-md">
                    Aici vei putea adăuga operatori noi, vizualiza metricile de performanță (apeluri, mesaje trimise, minute vorbite) și vei putea ajusta regulile de alocare (ex. fară alocare către operator, fiecare sună ce apucă).
                </p>
                
                <button className="mt-8 px-6 py-2.5 rounded-xl bg-white/5 text-gray-400 font-medium text-sm hover:bg-white/10 hover:text-white transition-all cursor-not-allowed">
                    Setează Reguli (Comming Soon)
                </button>
            </div>
        </div>
    );
}
