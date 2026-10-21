import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder } from 'react-native';
import { Canvas, Circle, Path, Text as SkiaText, Group, Skia } from '@shopify/react-native-skia';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 48;
const CANVAS_HEIGHT = 420;
const NODE_RADIUS = 36;

const KIND_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  concepto: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  procedimiento: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' },
  relacion: { bg: '#EDE9FE', border: '#8B5CF6', text: '#5B21B6' },
};

function buildPathString(sourceX: number, sourceY: number, targetX: number, targetY: number, radius: number): string {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) return '';
  const angle = Math.atan2(dy, dx);
  const startX = sourceX + Math.cos(angle) * radius;
  const startY = sourceY + Math.sin(angle) * radius;
  const endX = targetX - Math.cos(angle) * radius;
  const endY = targetY - Math.sin(angle) * radius;

  return `M${startX},${startY} L${endX},${endY}`;
}

function buildArrowPathString(targetX: number, targetY: number, sourceX: number, sourceY: number, radius: number): string {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) return '';
  const angle = Math.atan2(dy, dx);
  const baseX = targetX - Math.cos(angle) * radius;
  const baseY = targetY - Math.sin(angle) * radius;
  const arrowSize = 12;
  const arrowX1 = baseX - Math.cos(angle - Math.PI / 6) * arrowSize;
  const arrowY1 = baseY - Math.sin(angle - Math.PI / 6) * arrowSize;
  const arrowX2 = baseX - Math.cos(angle + Math.PI / 6) * arrowSize;
  const arrowY2 = baseY - Math.sin(angle + Math.PI / 6) * arrowSize;
  return `M${baseX},${baseY} L${arrowX1},${arrowY1} M${baseX},${baseY} L${arrowX2},${arrowY2}`;
}

export function EsquemaSkia({ nodes, edges, relatedTopics, title, onNodePress }: EsquemaSkiaProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [layout, setLayout] = useState<Map<string, { x: number; y: number }>>(new Map());

  const fontMgr = useMemo(() => Skia.FontMgr.System(), []);
  const typeface = useMemo(() => fontMgr.matchFamilyStyle('Inter', { weight: 400 }), [fontMgr]);
  const fontRegular = useMemo(() => Skia.Font(typeface, 11), [typeface]);
  const fontBold = useMemo(() => { const f = Skia.Font(typeface, 11); f.setEmbolden(true); return f; }, [typeface]);
  const fontSmall = useMemo(() => Skia.Font(typeface, 9), [typeface]);
  const fontTitle = useMemo(() => { const f = Skia.Font(typeface, 14); f.setEmbolden(true); return f; }, [typeface]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        checkNodeHit(gestureState.moveX, gestureState.moveY);
      },
      onPanResponderMove: (_, gestureState) => {
        checkNodeHit(gestureState.moveX, gestureState.moveY);
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    })
  ).current;

  const checkNodeHit = (x: number, y: number) => {
    for (const [nodeId, pos] of layout.entries()) {
      const dx = x - pos.x;
      const dy = y - pos.y;
      if (dx * dx + dy * dy <= NODE_RADIUS * NODE_RADIUS) {
        setSelectedNodeId(nodeId);
        const node = nodes.find(n => n.id === nodeId);
        if (node && onNodePress) onNodePress(node);
        return;
      }
    }
    setSelectedNodeId(null);
  };

  const buildLayout = useMemo(() => {
    if (!nodes.length) return new Map();
    const adjacency = new Map<string, string[]>();
    edges.forEach(e => {
      if (!adjacency.has(e.source)) adjacency.set(e.source, []);
      if (!adjacency.has(e.target)) adjacency.set(e.target, []);
      adjacency.get(e.source)!.push(e.target);
      adjacency.get(e.target)!.push(e.source);
    });

    const positions = new Map<string, { x: number; y: number }>();
    const visited = new Set<string>();
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    function dfs(nodeId: string, depth: number, angle: number, radius: number) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      positions.set(nodeId, { x, y });

      const neighbors = adjacency.get(nodeId) || [];
      const childAngleStep = (Math.PI * 2) / Math.max(neighbors.length, 1);
      neighbors.forEach((neighbor, i) => {
        if (!visited.has(neighbor)) {
          dfs(neighbor, depth + 1, angle + i * childAngleStep, radius + 100);
        }
      });
    }

    const rootId = nodes[0]?.id;
    if (rootId) {
      dfs(rootId, 0, -Math.PI / 2, 0);
    }

    nodes.forEach(n => {
      if (!positions.has(n.id)) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 140 + Math.random() * 60;
        positions.set(n.id, {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        });
      }
    });

    return positions;
  }, [nodes, edges]);

  useEffect(() => {
    setLayout(buildLayout);
  }, [buildLayout]);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);

  const connectedEdges = useMemo(() => {
    if (!selectedNodeId) return edges;
    return edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId);
  }, [edges, selectedNodeId]);

  const connectedNodes = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const connected = new Set<string>();
    edges.forEach(e => {
      if (e.source === selectedNodeId) connected.add(e.target);
      if (e.target === selectedNodeId) connected.add(e.source);
    });
    return connected;
  }, [edges, selectedNodeId]);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.legend}>
          {Object.entries(KIND_COLORS).map(([kind, colors]) => (
            <View key={kind} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
              <Text style={[styles.legendText, { color: colors.text }]}>{kind}</Text>
            </View>
          ))}
        </View>
      </View>

      <Canvas style={styles.canvas}>
        <Group>
          {connectedEdges.map((edge, index) => {
            const sourcePos = layout.get(edge.source);
            const targetPos = layout.get(edge.target);
            if (!sourcePos || !targetPos) return null;

            const isSelected = edge.source === selectedNodeId || edge.target === selectedNodeId;
            const isConnected = connectedNodes.has(edge.source) && connectedNodes.has(edge.target);

            const linePath = Skia.Path.MakeFromSVGString(buildPathString(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, NODE_RADIUS));
            const arrowPath = Skia.Path.MakeFromSVGString(buildArrowPathString(targetPos.x, targetPos.y, sourcePos.x, sourcePos.y, NODE_RADIUS));
            if (!linePath || !arrowPath) return null;

            const midX = (sourcePos.x + targetPos.x) / 2;
            const midY = (sourcePos.y + targetPos.y) / 2;

            return (
              <Group key={`edge-${index}`}>
                <Path
                  path={linePath}
                  color={isSelected ? '#8B5CF6' : isConnected ? '#3B82F6' : '#9CA3AF'}
                  style="stroke"
                  strokeWidth={isSelected ? 3 : 2}
                />
                <Path
                  path={arrowPath}
                  color={isSelected ? '#8B5CF6' : isConnected ? '#3B82F6' : '#9CA3AF'}
                  style="stroke"
                  strokeWidth={isSelected ? 3 : 2}
                />
                {edge.label && (
                  <SkiaText
                    text={edge.label}
                    x={midX}
                    y={midY - 8}
                    font={fontSmall}
                    color="#6B7280"
                  />
                )}
              </Group>
            );
          })}
        </Group>

        <Group>
          {Array.from(layout.entries()).map(([nodeId, pos]) => {
            const node = nodes.find(n => n.id === nodeId);
            if (!node) return null;

            const isSelected = nodeId === selectedNodeId;
            const isConnected = connectedNodes.has(nodeId);
            const colors = KIND_COLORS[node.kind] || KIND_COLORS.concepto;

            const displayLabel = node.label.length > 14 ? node.label.slice(0, 14) + '…' : node.label;

            return (
              <Group key={nodeId} transform={[{ translateX: pos.x }, { translateY: pos.y }]}>
                <Circle
                  cx={0}
                  cy={0}
                  r={isSelected ? NODE_RADIUS + 4 : NODE_RADIUS}
                  color={isSelected ? '#8B5CF6' : isConnected ? '#3B82F6' : colors.border}
                  style="stroke"
                  strokeWidth={isSelected ? 4 : isConnected ? 3 : 2}
                />
                <Circle
                  cx={0}
                  cy={0}
                  r={NODE_RADIUS - 4}
                  color={colors.bg}
                  style="fill"
                />
                <SkiaText
                  text={displayLabel}
                  x={0}
                  y={4}
                  font={fontBold}
                  color={colors.text}
                />
                {isSelected && (
                  <SkiaText
                    text="▼"
                    x={0}
                    y={NODE_RADIUS + 14}
                    font={fontSmall}
                    color="#8B5CF6"
                  />
                )}
              </Group>
            );
          })}
        </Group>
      </Canvas>

      {selectedNode && (
        <BentoCard className="mt-4 p-4 bg-white shadow-sm">
          <View style={styles.nodeDetailHeader}>
            <View style={[styles.kindBadge, { backgroundColor: KIND_COLORS[selectedNode.kind]?.bg, borderColor: KIND_COLORS[selectedNode.kind]?.border }]}>
              <Text style={[styles.kindBadgeText, { color: KIND_COLORS[selectedNode.kind]?.text }]}>{selectedNode.kind.toUpperCase()}</Text>
            </View>
            <Text style={styles.nodeDetailTitle}>{selectedNode.label}</Text>
          </View>
          {selectedNode.detail && <Text style={styles.nodeDetailText}>{selectedNode.detail}</Text>}
          {connectedEdges.length > 0 && (
            <View style={styles.connectionsList}>
              <Text style={styles.connectionsTitle}>Conexiones:</Text>
              {connectedEdges.map((edge, index) => {
                const otherId = edge.source === selectedNodeId ? edge.target : edge.source;
                const otherNode = nodes.find(n => n.id === otherId);
                return (
                  <View key={index} style={styles.connectionRow}>
                    <Text style={styles.arrowLabel}>{edge.label || '→'}</Text>
                    <Text style={styles.connectedNodeName}>{otherNode?.label || otherId}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </BentoCard>
      )}

      {relatedTopics.length > 0 && (
        <BentoCard className="mt-4 p-4 bg-amber-50 border border-amber-200">
          <Text style={styles.relatedTitle}>Este tema tiene relación con:</Text>
          <View style={styles.relatedTags}>
            {relatedTopics.map((topic, index) => (
              <View key={index} style={styles.relatedTag}>
                <Text style={styles.relatedTagText}>{topic}</Text>
              </View>
            ))}
          </View>
        </BentoCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  canvas: {
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },
  nodeDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  kindBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  nodeDetailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  nodeDetailText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 8,
  },
  connectionsList: {
    gap: 4,
  },
  connectionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 4,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  arrowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  connectedNodeName: {
    fontSize: 12,
    color: '#374151',
  },
  relatedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  relatedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  relatedTag: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  relatedTagText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
});
