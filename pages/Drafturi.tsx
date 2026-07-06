import React, { useState } from 'react';

const Drafturi = () => {
    const [phoneNumber, setPhoneNumber] = useState('');

    const dummyDrafts = [
        { id: '1001', name: 'Ion Popescu', total: '149.99 RON', date: '2026-07-06 10:30', status: 'Abandonat' },
        { id: '1002', name: 'Maria Ionescu', total: '299.00 RON', date: '2026-07-06 11:15', status: 'În așteptare' },
        { id: '1003', name: 'Andrei Radu', total: '89.50 RON', date: '2026-07-06 12:45', status: 'Abandonat' },
        { id: '1004', name: 'Elena Vlad', total: '450.00 RON', date: '2026-07-06 14:20', status: 'Abandonat' },
        { id: '1005', name: 'George Matei', total: '120.00 RON', date: '2026-07-06 15:05', status: 'În așteptare' },
    ];

    const handleKeypadPress = (key: string) => {
        setPhoneNumber(prev => prev + key);
    };

    const handleDelete = () => {
        setPhoneNumber(prev => prev.slice(0, -1));
    };

    const handleCall = () => {
        if (!phoneNumber) return;
        alert(`Se apelează numărul ${phoneNumber}...`);
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div>
                <h1 className="text-3xl font-light text-white mb-2 tracking-tight">Drafturi</h1>
                <p className="text-gray-400 font-light text-sm">Gestionați coșurile abandonate și inițiați apeluri.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                {/* Left Column: Dummy Draft Orders */}
                <div className="lg:w-2/3 card-depth p-6 rounded-2xl flex flex-col h-full overflow-hidden">
                    <h3 className="text-xl font-light text-white mb-4 tracking-tight">Comenzi Draft</h3>
                    <div className="overflow-y-auto pr-2 scrollbar-hide flex-1">
                        <div className="space-y-3">
                            {dummyDrafts.map(draft => (
                                <div key={draft.id} className="glass-panel-3d p-4 rounded-xl border border-white/5 flex items-center justify-between group hover:border-cyan-500/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
                                            <span className="material-icons-round">shopping_cart</span>
                                        </div>
                                        <div>
                                            <h4 className="text-white font-medium text-sm">Comanda #{draft.id} - {draft.name}</h4>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                                <span className="flex items-center gap-1"><span className="material-icons-round" style={{ fontSize: '14px' }}>payments</span>{draft.total}</span>
                                                <span className="flex items-center gap-1"><span className="material-icons-round" style={{ fontSize: '14px' }}>schedule</span>{draft.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-1 rounded text-[10px] uppercase font-medium ${draft.status === 'Abandonat' ? 'text-red-400 bg-red-500/10' : 'text-yellow-400 bg-yellow-500/10'}`}>
                                            {draft.status}
                                        </span>
                                        <button className="p-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-400 transition-colors">
                                            <span className="material-icons-round text-lg">call</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Cell Phone Keypad */}
                <div className="lg:w-1/3 card-depth p-6 rounded-2xl flex flex-col items-center justify-center h-full">
                    <div className="w-full max-w-[280px] flex flex-col items-center">
                        {/* Display */}
                        <div className="w-full bg-[#13151d] border border-white/10 rounded-2xl p-4 mb-8 min-h-[72px] flex items-center justify-center relative">
                            <span className="text-3xl font-light text-white tracking-widest font-num">{phoneNumber || ' '}</span>
                            {phoneNumber && (
                                <button onClick={handleDelete} className="absolute right-4 text-gray-500 hover:text-white transition-colors">
                                    <span className="material-icons-round">backspace</span>
                                </button>
                            )}
                        </div>

                        {/* Keypad Grid */}
                        <div className="grid grid-cols-3 gap-4 w-full mb-8">
                            {[
                                { key: '1', sub: '' }, { key: '2', sub: 'ABC' }, { key: '3', sub: 'DEF' },
                                { key: '4', sub: 'GHI' }, { key: '5', sub: 'JKL' }, { key: '6', sub: 'MNO' },
                                { key: '7', sub: 'PQRS' }, { key: '8', sub: 'TUV' }, { key: '9', sub: 'WXYZ' },
                                { key: '*', sub: '' }, { key: '0', sub: '+' }, { key: '#', sub: '' }
                            ].map((item) => (
                                <button
                                    key={item.key}
                                    onClick={() => handleKeypadPress(item.key)}
                                    className="flex flex-col items-center justify-center h-16 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-all active:scale-95"
                                >
                                    <span className="text-2xl font-light text-white">{item.key}</span>
                                    {item.sub && <span className="text-[9px] text-gray-500 font-medium tracking-widest">{item.sub}</span>}
                                </button>
                            ))}
                        </div>

                        {/* Call Action */}
                        <div className="flex justify-center w-full">
                            <button
                                onClick={handleCall}
                                disabled={!phoneNumber}
                                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-icons-round text-white text-3xl">call</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Drafturi;
