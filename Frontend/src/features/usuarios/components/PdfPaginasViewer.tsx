import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, PanResponder, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { aprendizajeApi, type PaginaPdf, type VistaPreviaPdf } from '../../../api/aprendizaje.api';
import { ApiClientError } from '../../../api/client';
import { BentoCard } from '../../../displays/components/BentoCard';

interface PdfPaginasViewerProps {
  materialId: string;
  titulo: string;
}

// lector -> navegar el PDF como libro con gesto horizontal
export function PdfPaginasViewer({ materialId, titulo }: PdfPaginasViewerProps) {
  const [info, setInfo] = useState<VistaPreviaPdf | null>(null);
  const [paginas, setPaginas] = useState<Record<number, PaginaPdf>>({});
  const [paginaActual, setPaginaActual] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cargadasRef = useRef<Set<number>>(new Set());
  const total = Math.max(1, Number(info?.paginas) || 1);

  const cargarPagina = useCallback(async (numero: number) => {
    const pagina = await aprendizajeApi.paginaPdf(materialId, numero);
    cargadasRef.current.add(Number(pagina.pagina));
    setPaginas((previas) => ({ ...previas, [pagina.pagina]: pagina }));
    return pagina;
  }, [materialId]);

  const cargar = useCallback(async (numero: number) => {
    setCargando(true);
    setError(null);
    try {
      let datos = info;
      if (!datos) {
        datos = await aprendizajeApi.vistaPreviaPdf(materialId);
        setInfo(datos);
      }
      const total = Math.max(1, Number(datos.paginas) || 1);
      const pagina = Math.min(total, Math.max(1, numero));
      if (!cargadasRef.current.has(pagina)) await cargarPagina(pagina);
    } catch (err) {
      const detalle = err instanceof ApiClientError ? err.message : 'No se pudo preparar la vista previa del material.';
      setError(detalle);
    } finally {
      setCargando(false);
    }
  }, [cargarPagina, info, materialId]);

  const cambiarPagina = useCallback((numero: number) => {
    const destino = Math.min(total, Math.max(1, numero));
    setPaginaActual(destino);
    if (!cargadasRef.current.has(destino)) void cargar(destino);
  }, [cargar, total]);

  const gestoPagina = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx < -35) cambiarPagina(paginaActual + 1);
      else if (gesture.dx > 35) cambiarPagina(paginaActual - 1);
    },
  }), [cambiarPagina, paginaActual]);

  useEffect(() => {
    setInfo(null);
    setPaginas({});
    cargadasRef.current = new Set();
    setPaginaActual(1);
    void cargar(1);
    // lector -> reiniciar solo cuando cambia el material
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId]);

  const proporcion = info && info.ancho > 0 && info.alto > 0 ? info.ancho / info.alto : 0.72;
  const pagina = paginas[paginaActual];

  if (error && !Object.keys(paginas).length) {
    return (
      <BentoCard className="items-center gap-2 p-6 bg-amber-50">
        <Ionicons name="document-text-outline" size={30} color="#B45309" />
        <Text className="text-sm font-bold text-amber-900">No se pudo abrir la vista previa</Text>
        <Text className="text-xs text-center text-amber-800">{error}</Text>
        <TouchableOpacity onPress={() => void cargar(paginaActual)} className="mt-2 rounded-xl bg-white px-4 py-2 border border-amber-200">
          <Text className="text-xs font-bold text-amber-900">Reintentar</Text>
        </TouchableOpacity>
      </BentoCard>
    );
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold text-gray-600">LECTURA EN LA APP · PDF</Text>
        <Text className="text-[11px] text-gray-500">{paginaActual} / {total}</Text>
      </View>
      <View {...gestoPagina.panHandlers} className="rounded-xl border border-gray-200 bg-white p-1">
        <Text className="px-2 py-1 text-[10px] font-bold text-gray-500">Página {paginaActual} · desliza para pasar</Text>
        {pagina?.imagen ? <Image source={{ uri: pagina.imagen }} resizeMode="contain" accessibilityLabel={`${titulo} página ${paginaActual}`} style={{ width: '100%', aspectRatio: proporcion }} /> : (
          <View className="items-center justify-center rounded-lg bg-gray-50" style={{ width: '100%', aspectRatio: proporcion }}>
            <ActivityIndicator color="#801529" />
            <Text className="mt-2 text-xs text-gray-500">Abriendo página...</Text>
          </View>
        )}
      </View>
      <View className="flex-row gap-2">
        <TouchableOpacity disabled={paginaActual <= 1} onPress={() => cambiarPagina(paginaActual - 1)} className="flex-1 rounded-xl border border-gray-200 bg-white p-3 opacity-100">
          <Text className="text-center text-xs font-bold text-[#801F3F]">‹ Anterior</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={paginaActual >= total} onPress={() => cambiarPagina(paginaActual + 1)} className="flex-1 rounded-xl bg-[#801F3F] p-3">
          <Text className="text-center text-xs font-bold text-white">Siguiente ›</Text>
        </TouchableOpacity>
      </View>
      {cargando ? <View className="items-center py-1"><ActivityIndicator color="#801529" /></View> : null}
    </View>
  );
}
