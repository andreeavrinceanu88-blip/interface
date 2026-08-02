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
      <div className="text-sm font-bold text-white mb-2 flex items-center gap-2">
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
      <div className="text-sm font-bold text-white mb-2 flex items-center gap-2">
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

const nodeTypes = {
  trigger: TriggerNode,
  wait: WaitNode,
};

const initialNodes = [
  { id: '1', position: { x: 250, y: 100 }, data: { eventType: 'draft_creat' }, type: 'trigger' },
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

  const addNode = (type: 'trigger' | 'wait') => {
    const newNode = {
      id: getId(),
      type,
      position: {
        x: Math.random() * 200 + 200, // random offset so they don't pile exactly on top
        y: Math.random() * 200 + 200,
      },
      data: type === 'trigger' ? { eventType: 'draft_creat' } : { duration: 15, unit: 'minutes' },
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
          
          <div className="flex gap-2 bg-[#13141a]/80 px-2 py-2 rounded-xl backdrop-blur-sm border border-white/5 shadow-lg w-fit">
            <button 
                onClick={() => addNode('trigger')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors rounded-lg text-sm font-semibold border border-indigo-500/30"
            >
                <span className="material-icons-round text-[18px]">bolt</span>
                Adaugă Trigger
            </button>
            <button 
                onClick={() => addNode('wait')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors rounded-lg text-sm font-semibold border border-amber-500/30"
            >
                <span className="material-icons-round text-[18px]">timer</span>
                Adaugă Wait
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
              if (n.type === 'trigger') return '#6366f1';
              if (n.type === 'wait') return '#f59e0b';
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
