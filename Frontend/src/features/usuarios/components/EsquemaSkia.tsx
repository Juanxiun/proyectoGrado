import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { BentoCard } from '../../../displays/components/BentoCard';

interface SchemaNode {
  id: string;
  label: string;
  kind: 'concepto' | 'procedimiento' | 'relacion';
  detail?: string;
}

interface SchemaEdge {
  source: string;
  target: string;
  label?: string;
}

interface EsquemaSkiaProps {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  relatedTopics: string[];
  title: string;
  onNodePress?: (node: SchemaNode) => void;
}

// resumen -> texto seguro para renderizar dentro de <Text>
function aTexto(valor: unknown, respaldo = ''): string {
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return respaldo;
}

// resumen -> normalizar nodos del esquema
function normalizarNodos(valor: unknown): SchemaNode[] {
  if (!Array.isArray(valor)) return [];
  return valor.reduce<SchemaNode[]>((acc, item, index) => {
    if (!item || typeof item !== 'object') return acc;
    const nodo = item as Record<string, unknown>;
    const label = aTexto(nodo.label ?? nodo.title ?? nodo.concept, '').trim();
    if (!label) return acc;
    acc.push({
      id: aTexto(nodo.id, `nodo-${index}`),
      label,
      kind: (nodo.kind === 'procedimiento' || nodo.kind === 'relacion' ? nodo.kind : 'concepto') as SchemaNode['kind'],
      detail: aTexto(nodo.detail ?? nodo.definition, ''),
    });
    return acc;
  }, []);
}

// resumen -> normalizar conexiones del esquema
function normalizarEdges(valor: unknown): SchemaEdge[] {
  if (!Array.isArray(valor)) return [];
  return valor.reduce<SchemaEdge[]>((acc, item) => {
    if (!item || typeof item !== 'object') return acc;
    const edge = item as Record<string, unknown>;
    const source = aTexto(edge.source, '');
    const target = aTexto(edge.target, '');
    if (!source || !target) return acc;
    acc.push({ source, target, label: aTexto(edge.label, '') });
    return acc;
  }, []);
}

export function EsquemaSkia({ nodes: nodosEntrada, edges: edgesEntrada, title, onNodePress }: EsquemaSkiaProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const nodes = normalizarNodos(nodosEntrada);
  const edges = normalizarEdges(edgesEntrada);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const connectedEdges = selectedNodeId
    ? edges.filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId)
    : [];

  const root = nodes[0];
  const parentById = new Map<string, string>();
  const depthById = new Map<string, number>();
  const queue: string[] = root ? [root.id] : [];
  if (root) depthById.set(root.id, 0);
  while (queue.length) {
    const currentId = queue.shift() as string;
    const depth = depthById.get(currentId) ?? 0;
    edges.forEach((edge) => {
      const neighbor = edge.source === currentId ? edge.target : edge.target === currentId ? edge.source : null;
      if (neighbor && !depthById.has(neighbor) && nodes.some((node) => node.id === neighbor)) {
        depthById.set(neighbor, depth + 1);
        parentById.set(neighbor, currentId);
        queue.push(neighbor);
      }
    });
  }

  // resumen -> ordenar nodos por proximidad al tema central
  const ordenados = [...nodes].sort(
    (izquierda, derecha) =>
      (depthById.get(izquierda.id) ?? Number.MAX_SAFE_INTEGER) - (depthById.get(derecha.id) ?? Number.MAX_SAFE_INTEGER),
  );

  return (
    <View className="gap-3">
      <Text className="text-lg font-extrabold text-gray-800">Mapa mental</Text>

      {nodes.length ? (
        <View className="items-center rounded-2xl border border-violet-100 bg-violet-50 px-4 py-5">
          <TouchableOpacity onPress={() => { setSelectedNodeId(root?.id ?? null); if (root) onNodePress?.(root); }} activeOpacity={0.8} className="max-w-full rounded-2xl border-2 border-[#801F3F] bg-white px-5 py-3">
            <Text className="text-center text-[10px] font-bold uppercase text-[#801F3F]">Tema principal</Text>
            <Text className="mt-1 text-center text-base font-black text-gray-900">{aTexto(root?.label, aTexto(title, 'Tema principal'))}</Text>
          </TouchableOpacity>
          {ordenados.slice(1).map((node) => {
            const parentId = parentById.get(node.id) ?? root?.id;
            const relacion = edges.find((edge) => (edge.source === parentId && edge.target === node.id) || (edge.target === parentId && edge.source === node.id));
            const isSelected = node.id === selectedNodeId;
            return (
              <React.Fragment key={node.id}>
                <View className="h-5 w-0.5 bg-violet-300" />
                <Text className="-mt-1 rounded-full bg-violet-100 px-3 py-1 text-[10px] font-bold text-violet-800">{aTexto(relacion?.label, 'se relaciona con')}</Text>
                <View className="h-3 w-0.5 bg-violet-300" />
                <TouchableOpacity onPress={() => { setSelectedNodeId(isSelected ? null : node.id); if (!isSelected) onNodePress?.(node); }} activeOpacity={0.8} className={`max-w-full rounded-full border px-5 py-2.5 ${isSelected ? 'border-[#801F3F] bg-rose-100' : 'border-amber-300 bg-amber-50'}`}>
                  <Text className="text-center text-sm font-bold text-gray-900">{node.label}</Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      ) : (
        <BentoCard className="p-4 bg-gray-50">
          <Text className="text-sm text-gray-700">Este esquema todavía no tiene conceptos para mostrar.</Text>
        </BentoCard>
      )}

      {selectedNode && connectedEdges.length ? (
        <BentoCard className="gap-2 p-4 bg-white">
          <Text className="font-bold text-gray-900">Conexiones de {selectedNode.label}</Text>
          {connectedEdges.map((edge, index) => {
            const otherId = edge.source === selectedNodeId ? edge.target : edge.source;
            const otherNode = nodes.find((node) => node.id === otherId);
            return (
              <View key={`${edge.source}-${edge.target}-${index}`} className="flex-row items-center gap-2">
                <Text className="text-sm text-violet-700">{aTexto(edge.label, '→')}</Text>
                <Text className="flex-1 text-sm text-gray-800">{otherNode?.label || otherId}</Text>
              </View>
            );
          })}
        </BentoCard>
      ) : null}

    </View>
  );
}
