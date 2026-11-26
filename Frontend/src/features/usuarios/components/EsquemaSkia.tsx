import React, { useRef, useState } from 'react';
import { Animated, Modal, PanResponder, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { BentoCard } from '../../../displays/components/BentoCard';
import { MarkdownContent, formatearTextoMatematico } from '../../../shared/ui/MarkdownContent';

export interface SchemaNode {
  id: string;
  label: string;
  kind?: 'concepto' | 'procedimiento' | 'relacion';
  detail?: string;
  mini_example?: string;
}

export interface SchemaEdge {
  source: string;
  target: string;
  label?: string;
}

interface EsquemaSkiaProps {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  relatedTopics?: string[];
  title: string;
  svgXml?: string;
  onNodePress?: (node: SchemaNode) => void;
}

// resumen -> texto seguro para renderizar dentro de <Text>
export function aTexto(valor: unknown, respaldo = ''): string {
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
      mini_example: aTexto(nodo.mini_example, ''),
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

// visor interactivo fullscreen con zoom y arrastre (pan) para SVG o mapa de nodos
export function MapaMentalExpandible({
  visible,
  onClose,
  titulo,
  svgXml,
  nodes: nodosEntrada = [],
  edges: edgesEntrada = [],
}: {
  visible: boolean;
  onClose: () => void;
  titulo: string;
  svgXml?: string;
  nodes?: SchemaNode[];
  edges?: SchemaEdge[];
}) {
  const { width, height } = useWindowDimensions();
  const [escala, setEscala] = useState(1);
  const [nodoActivo, setNodoActivo] = useState<SchemaNode | null>(null);
  const [svgFallo, setSvgFallo] = useState(false);

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const offsetRef = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
      onPanResponderGrant: () => {
        pan.setOffset(offsetRef.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        offsetRef.current = {
          x: offsetRef.current.x + gesture.dx,
          y: offsetRef.current.y + gesture.dy,
        };
        pan.flattenOffset();
      },
    })
  ).current;

  const reiniciarVista = () => {
    setEscala(1);
    offsetRef.current = { x: 0, y: 0 };
    pan.setOffset({ x: 0, y: 0 });
    pan.setValue({ x: 0, y: 0 });
  };

  const cambiarZoom = (delta: number) => {
    setEscala((prev) => Math.min(3, Math.max(0.6, Number((prev + delta).toFixed(2)))));
  };

  const nodes = normalizarNodos(nodosEntrada);
  const edges = normalizarEdges(edgesEntrada);
  const root = nodes[0];
  const svgLimpio = (svgXml || '').trim();
  const tieneSvg = (svgLimpio.startsWith('<svg') || svgLimpio.startsWith('<?xml')) && !svgFallo;

  const canvasW = Math.max(width - 24, 340);
  const canvasH = Math.max(height * 0.56, 360);

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-950">
        {/* Barra superior */}
        <View className="flex-row items-center justify-between border-b border-white/10 bg-[#801F3F] px-4 pt-12 pb-3.5">
          <View className="flex-1 pr-3">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-white/75">Mapa mental interactivo</Text>
            <Text className="text-base font-black text-white" numberOfLines={1}>
              {formatearTextoMatematico(titulo)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              reiniciarVista();
              onClose();
            }}
            className="h-9 w-9 items-center justify-center rounded-full bg-white/20"
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Controles de zoom y ayuda */}
        <View className="flex-row items-center justify-between bg-slate-900 px-4 py-2.5">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="hand-left-outline" size={14} color="#CBD5E1" />
            <Text className="text-[11px] text-slate-300">Arrastra para moverte y usa zoom para acercar</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <TouchableOpacity
              onPress={() => cambiarZoom(-0.25)}
              className="h-8 w-8 items-center justify-center rounded-lg bg-slate-800 border border-slate-700"
            >
              <Ionicons name="remove" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={reiniciarVista}
              className="h-8 px-2.5 items-center justify-center rounded-lg bg-slate-800 border border-slate-700"
            >
              <Text className="text-xs font-bold text-white">{Math.round(escala * 100)}%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => cambiarZoom(0.25)}
              className="h-8 w-8 items-center justify-center rounded-lg bg-slate-800 border border-slate-700"
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Lienzo interactivo */}
        <View className="flex-1 overflow-hidden bg-slate-50" {...panResponder.panHandlers}>
          <Animated.View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: escala }],
            }}
          >
            {tieneSvg ? (
              <View className="rounded-2xl bg-white p-4 shadow-md border border-slate-200">
                <SvgXml
                  xml={svgLimpio}
                  width={canvasW}
                  height={canvasH}
                  onError={() => setSvgFallo(true)}
                />
              </View>
            ) : nodes.length > 0 ? (
              <View className="items-center px-6 py-8">
                <TouchableOpacity
                  onPress={() => setNodoActivo(root ?? null)}
                  activeOpacity={0.85}
                  className="rounded-2xl border-2 border-[#801F3F] bg-white px-6 py-3.5 shadow-sm"
                >
                  <Text className="text-center text-[10px] font-bold uppercase text-[#801F3F]">Tema principal</Text>
                  <Text className="mt-1 text-center text-base font-black text-gray-900">
                    {formatearTextoMatematico(root?.label || titulo)}
                  </Text>
                </TouchableOpacity>

                <View className="h-6 w-0.5 bg-violet-400" />

                <View className="flex-row flex-wrap justify-center gap-3 max-w-[680px]">
                  {nodes.slice(1).map((node) => {
                    const edge = edges.find((e) => e.source === node.id || e.target === node.id);
                    const activo = nodoActivo?.id === node.id;
                    return (
                      <TouchableOpacity
                        key={node.id}
                        activeOpacity={0.85}
                        onPress={() => setNodoActivo(activo ? null : node)}
                        className={`w-44 rounded-2xl border-2 p-3 shadow-sm ${
                          activo ? 'border-[#801F3F] bg-rose-50' : 'border-violet-200 bg-white'
                        }`}
                      >
                        {edge?.label ? (
                          <Text className="text-[10px] font-bold uppercase text-violet-700 mb-1" numberOfLines={1}>
                            {formatearTextoMatematico(edge.label)}
                          </Text>
                        ) : null}
                        <Text className="text-xs font-extrabold text-gray-900">
                          {formatearTextoMatematico(node.label)}
                        </Text>
                        {node.detail ? (
                          <Text className="mt-1 text-[11px] text-gray-600" numberOfLines={3}>
                            {formatearTextoMatematico(node.detail)}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <Text className="text-sm text-gray-500">No hay elementos gráficos para mostrar.</Text>
            )}
          </Animated.View>
        </View>

        {/* Detalle del nodo seleccionado en pantalla completa */}
        {nodoActivo ? (
          <View className="max-h-56 border-t border-slate-200 bg-white px-5 py-4">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-sm font-black text-[#801F3F] flex-1">
                {formatearTextoMatematico(nodoActivo.label)}
              </Text>
              <TouchableOpacity onPress={() => setNodoActivo(null)}>
                <Ionicons name="close-circle" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {nodoActivo.detail ? <MarkdownContent texto={nodoActivo.detail} baseFontSize={13} /> : null}
              {nodoActivo.mini_example ? (
                <View className="mt-2 rounded-xl bg-amber-50 p-2.5 border border-amber-200">
                  <Text className="text-[10px] font-bold uppercase text-amber-800 mb-0.5">Ejemplo</Text>
                  <MarkdownContent texto={nodoActivo.mini_example} baseFontSize={12} />
                </View>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

export function EsquemaSkia({ nodes: nodosEntrada, edges: edgesEntrada, title, svgXml, onNodePress }: EsquemaSkiaProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(false);
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

  const ordenados = [...nodes].sort(
    (izquierda, derecha) =>
      (depthById.get(izquierda.id) ?? Number.MAX_SAFE_INTEGER) - (depthById.get(derecha.id) ?? Number.MAX_SAFE_INTEGER),
  );

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-extrabold text-gray-800">Mapa mental</Text>
        {(nodes.length > 0 || Boolean(svgXml)) ? (
          <TouchableOpacity
            onPress={() => setExpandido(true)}
            className="flex-row items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5"
          >
            <Ionicons name="expand-outline" size={14} color="#6D28D9" />
            <Text className="text-xs font-bold text-violet-900">Expandir</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {nodes.length ? (
        <View className="items-center rounded-2xl border border-violet-100 bg-violet-50 px-4 py-5">
          <TouchableOpacity
            onPress={() => {
              setSelectedNodeId(root?.id ?? null);
              if (root) onNodePress?.(root);
            }}
            activeOpacity={0.8}
            className="max-w-full rounded-2xl border-2 border-[#801F3F] bg-white px-5 py-3"
          >
            <Text className="text-center text-[10px] font-bold uppercase text-[#801F3F]">Tema principal</Text>
            <Text className="mt-1 text-center text-base font-black text-gray-900">
              {formatearTextoMatematico(aTexto(root?.label, aTexto(title, 'Tema principal')))}
            </Text>
          </TouchableOpacity>
          {ordenados.slice(1).map((node) => {
            const parentId = parentById.get(node.id) ?? root?.id;
            const relacion = edges.find(
              (edge) => (edge.source === parentId && edge.target === node.id) || (edge.target === parentId && edge.source === node.id),
            );
            const isSelected = node.id === selectedNodeId;
            return (
              <React.Fragment key={node.id}>
                <View className="h-5 w-0.5 bg-violet-300" />
                <Text className="-mt-1 rounded-full bg-violet-100 px-3 py-1 text-[10px] font-bold text-violet-800">
                  {formatearTextoMatematico(aTexto(relacion?.label, 'se relaciona con'))}
                </Text>
                <View className="h-3 w-0.5 bg-violet-300" />
                <TouchableOpacity
                  onPress={() => {
                    setSelectedNodeId(isSelected ? null : node.id);
                    if (!isSelected) onNodePress?.(node);
                  }}
                  activeOpacity={0.8}
                  className={`max-w-full rounded-full border px-5 py-2.5 ${
                    isSelected ? 'border-[#801F3F] bg-rose-100' : 'border-amber-300 bg-amber-50'
                  }`}
                >
                  <Text className="text-center text-sm font-bold text-gray-900">
                    {formatearTextoMatematico(node.label)}
                  </Text>
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
          <Text className="font-bold text-gray-900">Conexiones de {formatearTextoMatematico(selectedNode.label)}</Text>
          {connectedEdges.map((edge, index) => {
            const otherId = edge.source === selectedNodeId ? edge.target : edge.source;
            const otherNode = nodes.find((node) => node.id === otherId);
            return (
              <View key={`${edge.source}-${edge.target}-${index}`} className="flex-row items-center gap-2">
                <Text className="text-sm text-violet-700">{formatearTextoMatematico(aTexto(edge.label, '→'))}</Text>
                <Text className="flex-1 text-sm text-gray-800">
                  {formatearTextoMatematico(otherNode?.label || otherId)}
                </Text>
              </View>
            );
          })}
        </BentoCard>
      ) : null}

      <MapaMentalExpandible
        visible={expandido}
        onClose={() => setExpandido(false)}
        titulo={title}
        svgXml={svgXml}
        nodes={nodes}
        edges={edges}
      />
    </View>
  );
}
