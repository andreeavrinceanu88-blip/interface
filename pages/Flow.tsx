import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// --- Custom Nodes ---

const TriggerNode = ({ data }: any) => {
  return (
    <div className="bg-[#1a1b23] border-2 border-indigo-500 rounded-xl p-4 shadow-lg min-w-[200px]">
      <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <span className="material-icons-round text-indigo-400 text-lg">bolt</span>
        Trigger
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-400">Alege un eveniment</label>
        <select 
          className="bg-[#13141a] border border-white/10 rounded-lg text-sm text-white px-2 py-2 outline-none focus:border-indigo-500"
          defaultValue={data.eventType || 'draft_creat'}
          onChange={(e) => {
              if(data.onChange) data.onChange(e.target.value);
          }}
        >
          <option value="draft_creat">Draft creat</option>
          <option value="comanda_creata">Comanda creată</option>
        </select>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500" />
    </div>
  );
};

const WaitNode = ({ data }: any) => {
  return (
    <div className="bg-[#1a1b23] border-2 border-amber-500 rounded-xl p-4 shadow-lg min-w-[200px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500" />
      <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <span className="material-icons-round text-amber-400 text-lg">timer</span>
        Wait (Așteaptă)
      </div>
      <div className="flex items-center gap-2">
        <input 
          type="number" 
          defaultValue={data.duration || 15}
          className="bg-[#13141a] border border-white/10 rounded-lg text-sm text-white px-2 py-2 w-16 outline-none focus:border-amber-500 text-center"
        />
        <select 
          className="bg-[#13141a] border border-white/10 rounded-lg text-sm text-white px-2 py-2 outline-none focus:border-amber-500 flex-1"
          defaultValue={data.unit || 'minutes'}
        >
          <option value="minutes">Minute</option>
          <option value="hours">Ore</option>
          <option value="days">Zile</option>
        </select>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-amber-500" />
    </div>
  );
};

const CallNode = ({ data }: any) => {
  return (
    <div className="bg-[#1a1b23] border-2 border-cyan-500 rounded-xl p-4 shadow-lg min-w-[260px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-cyan-500" />
      <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <span className="material-icons-round text-cyan-400 text-lg">phone_in_talk</span>
        Sună Clientul
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Număr maxim de apeluri (dacă nu răspunde)</label>
          <input 
            type="number" 
            defaultValue={data.maxCalls || 3}
            className="bg-[#13141a] border border-white/10 rounded-lg text-sm text-white px-2 py-1.5 outline-none focus:border-cyan-500 w-full"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Interval orar (ex: 09:00 - 18:00)</label>
          <div className="flex items-center gap-2">
            <input type="time" defaultValue={data.timeStart || '09:00'} className="bg-[#13141a] border border-white/10 rounded-lg text-sm text-white px-2 py-1.5 outline-none focus:border-cyan-500 flex-1" />
            <span className="text-gray-400">-</span>
            <input type="time" defaultValue={data.timeEnd || '18:00'} className="bg-[#13141a] border border-white/10 rounded-lg text-sm text-white px-2 py-1.5 outline-none focus:border-cyan-500 flex-1" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Timp între reîncercări</label>
          <div className="flex items-center gap-2">
            <input type="number" defaultValue={data.retryDuration || 30} className="bg-[#13141a] border border-white/10 rounded-lg text-sm text-white px-2 py-1.5 outline-none focus:border-cyan-500 w-16 text-center" />
            <select defaultValue={data.retryUnit || 'minutes'} className="bg-[#13141a] border border-white/10 rounded-lg text-sm text-white px-2 py-1.5 outline-none focus:border-cyan-500 flex-1">
              <option value="minutes">Minute</option>
              <option value="hours">Ore</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Model AI</label>
          <select defaultValue={data.aiModel || 'light'} className="bg-[#13141a] border border-white/10 rounded-lg text-sm text-white px-2 py-1.5 outline-none focus:border-cyan-500">
            <option value="light">Light (Rapid)</option>
            <option value="performance">Performance (Inteligent)</option>
          </select>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-cyan-500" />
    </div>
  );
};

const WhatsAppNode = ({ data }: any) => {
  return (
    <div className="bg-[#1a1b23] border-2 border-emerald-500 rounded-xl p-4 shadow-lg min-w-[240px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-500" />
      <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-emerald-400 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
        WhatsApp
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">Mesaj (Folosește [NUME] pt variabile)</label>
        <textarea 
          rows={3}
          defaultValue={data.message || 'Buna ziua [NUME]!'}
          className="bg-[#13141a] border border-white/10 rounded-lg text-sm text-white px-2 py-2 outline-none focus:border-emerald-500 resize-none w-full"
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500" />
    </div>
  );
};

const SmsNode = ({ data }: any) => {
  return (
    <div className="bg-[#1a1b23] border-2 border-rose-500 rounded-xl p-4 shadow-lg min-w-[240px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-rose-500" />
      <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <span className="material-icons-round text-rose-400 text-lg">sms</span>
        SMS
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">Conținut SMS</label>
        <textarea 
          rows={3}
          defaultValue={data.message || ''}
          className="bg-[#13141a] border border-white/10 rounded-lg text-sm text-white px-2 py-2 outline-none focus:border-rose-500 resize-none w-full"
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-rose-500" />
    </div>
  );
};


const nodeTypes = {
  trigger: TriggerNode,
  wait: WaitNode,
  call: CallNode,
  whatsapp: WhatsAppNode,
  sms: SmsNode,
};

const initialNodes = [
  { id: '1', position: { x: 400, y: 100 }, data: { eventType: 'draft_creat' }, type: 'trigger' },
];

const initialEdges: any[] = [];

let idCounter = 2;
const getId = () => `${idCounter++}`;

export default function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const addNode = (type: 'trigger' | 'wait' | 'call' | 'whatsapp' | 'sms') => {
    let data = {};
    if (type === 'trigger') data = { eventType: 'draft_creat' };
    else if (type === 'wait') data = { duration: 15, unit: 'minutes' };
    else if (type === 'call') data = { maxCalls: 3, timeStart: '09:00', timeEnd: '18:00', retryDuration: 30, retryUnit: 'minutes', aiModel: 'light' };
    else if (type === 'whatsapp') data = { message: 'Buna ziua [NUME]!' };
    else if (type === 'sms') data = { message: '' };

    const newNode = {
      id: getId(),
      type,
      position: {
        x: Math.random() * 200 + 300,
        y: Math.random() * 200 + 200,
      },
      data,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  return (
    <div className="w-full h-[calc(100vh-2rem)] bg-[#1a1b23] rounded-2xl overflow-hidden border border-white/5 relative flex flex-col">
      
      {/* Top Bar / Actions */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-3">
          <div className="flex flex-col gap-1 bg-[#13141a]/80 px-4 py-3 rounded-xl backdrop-blur-sm border border-white/5 shadow-lg max-w-sm">
            <h1 className="text-xl font-bold text-white">Flow Builder</h1>
            <p className="text-xs text-gray-400">
              Adaugă noduri și conectează-le pentru a crea fluxuri automate.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 bg-[#13141a]/80 px-2 py-2 rounded-xl backdrop-blur-sm border border-white/5 shadow-lg max-w-[600px]">
            <button 
                onClick={() => addNode('trigger')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors rounded-lg text-sm font-semibold border border-indigo-500/30"
            >
                <span className="material-icons-round text-[18px]">bolt</span>
                Trigger
            </button>
            <button 
                onClick={() => addNode('wait')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors rounded-lg text-sm font-semibold border border-amber-500/30"
            >
                <span className="material-icons-round text-[18px]">timer</span>
                Wait
            </button>
            <button 
                onClick={() => addNode('call')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors rounded-lg text-sm font-semibold border border-cyan-500/30"
            >
                <span className="material-icons-round text-[18px]">phone_in_talk</span>
                Apel Robot
            </button>
            <button 
                onClick={() => addNode('whatsapp')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors rounded-lg text-sm font-semibold border border-emerald-500/30"
            >
                <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                WhatsApp
            </button>
            <button 
                onClick={() => addNode('sms')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors rounded-lg text-sm font-semibold border border-rose-500/30"
            >
                <span className="material-icons-round text-[18px]">sms</span>
                SMS
            </button>
          </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
      >
        <Controls className="bg-[#13141a] border-white/10 fill-white" />
        <MiniMap 
          nodeColor={(n) => {
              if (n.type === 'trigger') return '#6366f1'; // indigo
              if (n.type === 'wait') return '#f59e0b'; // amber
              if (n.type === 'call') return '#06b6d4'; // cyan
              if (n.type === 'whatsapp') return '#10b981'; // emerald
              if (n.type === 'sms') return '#f43f5e'; // rose
              return '#4f46e5';
          }} 
          maskColor="#1a1b2388" 
          className="bg-[#13141a] border-white/10" 
        />
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#ffffff22" />
      </ReactFlow>
    </div>
  );
}
