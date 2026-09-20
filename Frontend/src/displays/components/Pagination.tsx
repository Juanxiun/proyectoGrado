import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  loading?: boolean;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalRecords,
  pageSize = 20,
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
  loading = false,
  className = '',
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const isFirst = currentPage <= 1;
  const isLast = currentPage >= safeTotalPages;

  const startRecord = totalRecords !== undefined && totalRecords > 0
    ? (currentPage - 1) * pageSize + 1
    : 0;
  const endRecord = totalRecords !== undefined
    ? Math.min(currentPage * pageSize, totalRecords)
    : 0;

  return (
    <View
      className={`flex-row flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100 ${className}`}
    >
      {/* Información de Registros */}
      <View className="flex-row items-center gap-2">
        {totalRecords !== undefined ? (
          <Text className="text-xs text-gray-500">
            Mostrando{' '}
            <Text className="font-bold text-gray-800">
              {totalRecords > 0 ? `${startRecord}–${endRecord}` : '0'}
            </Text>{' '}
            de <Text className="font-bold text-gray-800">{totalRecords}</Text> registros
          </Text>
        ) : (
          <Text className="text-xs text-gray-500">
            Página <Text className="font-bold text-gray-800">{currentPage}</Text> de{' '}
            <Text className="font-bold text-gray-800">{safeTotalPages}</Text>
          </Text>
        )}

        {/* Selector opcional de tamaño por página */}
        {onPageSizeChange && (
          <View className="flex-row items-center gap-1 ml-2 bg-gray-100 p-0.5 rounded-lg">
            {pageSizeOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => onPageSizeChange(opt)}
                disabled={loading}
                className={`px-2 py-0.5 rounded-md ${
                  pageSize === opt ? 'bg-maroon' : 'hover:bg-gray-200'
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    pageSize === opt ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {opt}/pág
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Controles de Navegación: < Anterior | Página X de Y | Siguiente > */}
      <View className="flex-row items-center gap-1.5">
        {/* Botón Primera Página */}
        {safeTotalPages > 3 && (
          <TouchableOpacity
            onPress={() => onPageChange(1)}
            disabled={isFirst || loading}
            className={`w-8 h-8 rounded-xl items-center justify-center border ${
              isFirst || loading
                ? 'bg-gray-50 border-gray-100 opacity-40'
                : 'bg-white border-gray-200 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            <Ionicons name="play-back" size={12} color="#4B5563" />
          </TouchableOpacity>
        )}

        {/* Botón < Anterior */}
        <TouchableOpacity
          onPress={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={isFirst || loading}
          className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1 ${
            isFirst || loading
              ? 'bg-gray-50 border-gray-100 opacity-40'
              : 'bg-white border-gray-200 hover:bg-gray-50 active:bg-gray-100'
          }`}
        >
          <Ionicons name="chevron-back" size={14} color="#374151" />
          <Text
            className={`text-xs font-bold ${
              isFirst || loading ? 'text-gray-400' : 'text-gray-700'
            }`}
          >
            Anterior
          </Text>
        </TouchableOpacity>

        {/* Badge Página X de Y */}
        <View className="px-3 py-1.5 bg-maroon/10 border border-maroon/20 rounded-xl">
          <Text className="text-xs font-bold text-maroon">
            {currentPage} / {safeTotalPages}
          </Text>
        </View>

        {/* Botón Siguiente > */}
        <TouchableOpacity
          onPress={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
          disabled={isLast || loading}
          className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1 ${
            isLast || loading
              ? 'bg-gray-50 border-gray-100 opacity-40'
              : 'bg-white border-gray-200 hover:bg-gray-50 active:bg-gray-100'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              isLast || loading ? 'text-gray-400' : 'text-gray-700'
            }`}
          >
            Siguiente
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#374151" />
        </TouchableOpacity>

        {/* Botón Última Página */}
        {safeTotalPages > 3 && (
          <TouchableOpacity
            onPress={() => onPageChange(safeTotalPages)}
            disabled={isLast || loading}
            className={`w-8 h-8 rounded-xl items-center justify-center border ${
              isLast || loading
                ? 'bg-gray-50 border-gray-100 opacity-40'
                : 'bg-white border-gray-200 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            <Ionicons name="play-forward" size={12} color="#4B5563" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
