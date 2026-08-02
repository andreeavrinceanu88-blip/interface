import React, { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  { id: '1', position: { x: 250, y: 100 }, data: { label: 'Nod de start' }, type: 'input' },
  { id: '2', position: { x: 250, y: 250 }, data: { label: 'Pasul 2' } },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2' },
];

export default function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div className="w-full h-[calc(100vh-2rem)] bg-[#1a1b23] rounded-2xl overflow-hidden border border-white/5 relative">
      <div className="absolute top-4 left-4 z-10">
          <h1 className="text-2xl font-bold text-white bg-[#13141a]/80 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/5 shadow-lg">
            Flow Whiteboard
          </h1>
          <p className="mt-2 text-sm text-gray-400 bg-[#13141a]/80 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/5 shadow-lg max-w-sm">
            Trage nodurile, conectează-le între ele și dă scroll pentru zoom. E un spațiu de lucru simplu.
          </p>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        colorMode="dark"
        fitView
      >
        <Controls className="bg-[#13141a] border-white/10 fill-white" />
        <MiniMap 
          nodeColor={(n) => '#4f46e5'} 
          maskColor="#1a1b2388" 
          className="bg-[#13141a] border-white/10" 
        />
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#ffffff22" />
      </ReactFlow>
    </div>
  );
}
