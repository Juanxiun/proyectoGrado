import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  minYear?: number;
  maxYear?: number;
}

const MONTHS = [
  { short: 'Ene', long: 'Enero' },
  { short: 'Feb', long: 'Febrero' },
  { short: 'Mar', long: 'Marzo' },
  { short: 'Abr', long: 'Abril' },
  { short: 'May', long: 'Mayo' },
  { short: 'Jun', long: 'Junio' },
  { short: 'Jul', long: 'Julio' },
  { short: 'Ago', long: 'Agosto' },
  { short: 'Sep', long: 'Septiembre' },
  { short: 'Oct', long: 'Octubre' },
  { short: 'Nov', long: 'Noviembre' },
  { short: 'Dic', long: 'Diciembre' },
];

const TIME_PRESETS = [
  { label: '07:30', hour: 7, minute: 30 },
  { label: '08:00', hour: 8, minute: 0 },
  { label: '12:00', hour: 12, minute: 0 },
  { label: '14:30', hour: 14, minute: 30 },
  { label: '18:00', hour: 18, minute: 0 },
  { label: '23:59', hour: 23, minute: 59 },
];

const parseDateValue = (val: string): Date => {
  if (!val) return new Date();
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  } catch {}
  return new Date();
};

export function DateTimePicker({
  value,
  onChange,
  label,
  placeholder = 'Seleccionar fecha y hora',
  className = '',
  minYear = 2024,
  maxYear = 2035,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  const initial = useMemo(() => parseDateValue(value), [value]);

  const [selectedYear, setSelectedYear] = useState(initial.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initial.getMonth());
  const [selectedDay, setSelectedDay] = useState(initial.getDate());
  const [selectedHour, setSelectedHour] = useState(initial.getHours());
  const [selectedMinute, setSelectedMinute] = useState(initial.getMinutes());

  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [decadeStart, setDecadeStart] = useState(() => Math.floor(initial.getFullYear() / 10) * 10);

  useEffect(() => {
    const d = parseDateValue(value);
    setSelectedYear(d.getFullYear());
    setSelectedMonth(d.getMonth());
    setSelectedDay(d.getDate());
    setSelectedHour(d.getHours());
    setSelectedMinute(d.getMinutes());
    setDecadeStart(Math.floor(d.getFullYear() / 10) * 10);
  }, [value, open]);

  // Formato visual en el botón trigger
  const displayFormatted = useMemo(() => {
    if (!value) return '';
    try {
      const d = parseDateValue(value);
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = MONTHS[d.getMonth()]?.short || 'Ene';
      const anio = d.getFullYear();
      const horas = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${dia} ${mes} ${anio}, ${horas}:${mins}`;
    } catch {
      return value;
    }
  }, [value]);

  const days = useMemo(() => {
    const y = isNaN(selectedYear) ? new Date().getFullYear() : selectedYear;
    const m = isNaN(selectedMonth) ? new Date().getMonth() : selectedMonth;
    const first = new Date(y, m, 1).getDay();
    const count = new Date(y, m + 1, 0).getDate();
    const safeFirst = isNaN(first) || first < 0 || first > 6 ? 0 : first;
    const safeCount = isNaN(count) || count < 1 || count > 31 ? 30 : count;
    return [...Array(safeFirst).fill(null), ...Array.from({ length: safeCount }, (_, i) => i + 1)];
  }, [selectedYear, selectedMonth]);

  const decadeYears = useMemo(() => {
    const years: number[] = [];
    const end = Math.min(maxYear, decadeStart + 9);
    for (let y = decadeStart; y <= end; y++) {
      if (y >= minYear) years.push(y);
    }
    return years;
  }, [decadeStart, minYear, maxYear]);

  const handleConfirm = () => {
    const d = new Date(selectedYear, selectedMonth, selectedDay, selectedHour, selectedMinute);
    const isoString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    onChange(isoString);
    setOpen(false);
  };

  const handleSetNow = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
    setSelectedDay(now.getDate());
    setSelectedHour(now.getHours());
    setSelectedMinute(now.getMinutes());
  };

  return (
    <View className={`w-full ${className}`}>
      {label ? (
        <Text className="text-xs font-semibold text-gray-700 mb-1">{label}</Text>
      ) : null}

      {/* Botón Trigger de Apertura */}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="bg-gray-100 hover:bg-gray-200/80 border border-gray-200 rounded-xl px-3.5 py-2.5 flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-2 flex-1 mr-2">
          <View className="w-8 h-8 rounded-lg bg-maroon/10 items-center justify-center">
            <Ionicons name="calendar" size={16} color="#801529" />
          </View>
          <Text
            className={`text-sm ${
              displayFormatted ? 'font-semibold text-gray-900' : 'text-gray-400'
            }`}
          >
            {displayFormatted || placeholder}
          </Text>
        </View>
        <View className="flex-row items-center gap-1 bg-gray-200/70 px-2 py-1 rounded-md">
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <Text className="text-xs text-gray-600 font-medium">Cambiar</Text>
        </View>
      </TouchableOpacity>

      {/* Modal de Selección Fecha y Hora */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-3">
          <View className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-gray-100 max-h-[90vh]">
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Título de la ventana */}
              <View className="flex-row items-center justify-between mb-3 pb-2 border-b border-gray-100">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="calendar-outline" size={20} color="#801529" />
                  <Text className="text-base font-bold text-gray-900">
                    {label || 'Seleccionar Fecha y Hora'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setOpen(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Cabecera Año y Mes */}
              <View className="flex-row items-center justify-between mb-3 gap-2">
                <TouchableOpacity
                  onPress={() => {
                    setShowYearPicker(!showYearPicker);
                    setShowMonthPicker(false);
                  }}
                  className={`flex-1 items-center py-2 rounded-xl border ${
                    showYearPicker ? 'bg-maroon/10 border-maroon' : 'bg-gray-100 border-gray-200'
                  }`}
                >
                  <Text className="text-[10px] uppercase font-bold text-gray-400">Año</Text>
                  <Text className="font-bold text-gray-900 text-base">{selectedYear}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowMonthPicker(!showMonthPicker);
                    setShowYearPicker(false);
                  }}
                  className={`flex-1 items-center py-2 rounded-xl border ${
                    showMonthPicker ? 'bg-maroon/10 border-maroon' : 'bg-gray-100 border-gray-200'
                  }`}
                >
                  <Text className="text-[10px] uppercase font-bold text-gray-400">Mes</Text>
                  <Text className="font-bold text-gray-900 text-base">
                    {MONTHS[selectedMonth]?.long ?? 'Enero'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Selector de Años */}
              {showYearPicker && (
                <View className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <View className="flex-row justify-between items-center mb-2">
                    <TouchableOpacity
                      onPress={() => setDecadeStart((d) => Math.max(minYear, d - 10))}
                      disabled={decadeStart <= minYear}
                      className="p-1 rounded-lg bg-white border border-gray-200"
                    >
                      <Ionicons name="chevron-back" size={16} color="#801529" />
                    </TouchableOpacity>
                    <Text className="font-bold text-maroon text-xs">
                      {decadeStart} - {Math.min(maxYear, decadeStart + 9)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setDecadeStart((d) => Math.min(maxYear - 5, d + 10))}
                      disabled={decadeStart + 10 > maxYear}
                      className="p-1 rounded-lg bg-white border border-gray-200"
                    >
                      <Ionicons name="chevron-forward" size={16} color="#801529" />
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row flex-wrap justify-between gap-1.5">
                    {decadeYears.map((y) => (
                      <TouchableOpacity
                        key={y}
                        onPress={() => {
                          setSelectedYear(y);
                          setShowYearPicker(false);
                        }}
                        className={`w-[48%] py-2 items-center justify-center rounded-lg ${
                          y === selectedYear ? 'bg-maroon' : 'bg-white border border-gray-200'
                        }`}
                      >
                        <Text
                          className={`font-bold text-xs ${
                            y === selectedYear ? 'text-white' : 'text-gray-800'
                          }`}
                        >
                          {y}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Selector de Meses */}
              {showMonthPicker && (
                <View className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <View className="flex-row flex-wrap justify-between gap-1.5">
                    {MONTHS.map((m, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => {
                          setSelectedMonth(idx);
                          setShowMonthPicker(false);
                        }}
                        className={`w-[31%] py-2 items-center rounded-lg ${
                          idx === selectedMonth ? 'bg-maroon' : 'bg-white border border-gray-200'
                        }`}
                      >
                        <Text
                          className={`font-bold text-xs ${
                            idx === selectedMonth ? 'text-white' : 'text-gray-800'
                          }`}
                        >
                          {m.short}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Cuadrícula de Días */}
              {!showYearPicker && !showMonthPicker && (
                <>
                  <View className="flex-row justify-between items-center mb-2 px-1">
                    <TouchableOpacity
                      onPress={() =>
                        setSelectedMonth((m) => {
                          if (m === 0) {
                            setSelectedYear((y) => y - 1);
                            return 11;
                          }
                          return m - 1;
                        })
                      }
                      className="p-1 rounded-lg bg-gray-100"
                    >
                      <Ionicons name="chevron-back" size={16} color="#801529" />
                    </TouchableOpacity>

                    <Text className="font-bold text-maroon text-sm">
                      {MONTHS[selectedMonth]?.long} {selectedYear}
                    </Text>

                    <TouchableOpacity
                      onPress={() =>
                        setSelectedMonth((m) => {
                          if (m === 11) {
                            setSelectedYear((y) => y + 1);
                            return 0;
                          }
                          return m + 1;
                        })
                      }
                      className="p-1 rounded-lg bg-gray-100"
                    >
                      <Ionicons name="chevron-forward" size={16} color="#801529" />
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row flex-wrap mb-2">
                    {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((d) => (
                      <Text
                        key={d}
                        className="w-[14.28%] text-center text-gray-400 font-bold text-[11px] mb-1"
                      >
                        {d}
                      </Text>
                    ))}
                    {days.map((day, i) =>
                      day === null ? (
                        <View key={`empty-${i}`} className="w-[14.28%] h-8" />
                      ) : (
                        <TouchableOpacity
                          key={day}
                          onPress={() => setSelectedDay(day)}
                          className="w-[14.28%] h-8 items-center justify-center"
                        >
                          <View
                            className={`w-7 h-7 rounded-full items-center justify-center ${
                              day === selectedDay
                                ? 'bg-maroon'
                                : ''
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                day === selectedDay
                                  ? 'text-white font-bold'
                                  : 'text-gray-800'
                              }`}
                            >
                              {day}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ),
                    )}
                  </View>
                </>
              )}

              {/* SECCIÓN DE HORA Y MINUTOS */}
              <View className="mt-2 pt-3 border-t border-gray-100">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    ⏰ Hora y Minutos
                  </Text>
                  <TouchableOpacity onPress={handleSetNow}>
                    <Text className="text-xs font-bold text-maroon">Fijar Hora Actual</Text>
                  </TouchableOpacity>
                </View>

                {/* Controles interactivos de Hora y Minuto */}
                <View className="flex-row items-center justify-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  {/* Horas */}
                  <View className="items-center">
                    <Text className="text-[10px] text-gray-400 font-bold uppercase mb-1">Hora</Text>
                    <View className="flex-row items-center gap-1.5">
                      <TouchableOpacity
                        onPress={() => setSelectedHour((h) => (h === 0 ? 23 : h - 1))}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-300 items-center justify-center"
                      >
                        <Ionicons name="remove" size={16} color="#374151" />
                      </TouchableOpacity>

                      <View className="w-12 h-10 bg-white rounded-lg border border-gray-300 items-center justify-center">
                        <Text className="text-lg font-bold text-gray-900 font-mono">
                          {String(selectedHour).padStart(2, '0')}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => setSelectedHour((h) => (h === 23 ? 0 : h + 1))}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-300 items-center justify-center"
                      >
                        <Ionicons name="add" size={16} color="#374151" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text className="text-2xl font-bold text-gray-400 mt-3">:</Text>

                  {/* Minutos */}
                  <View className="items-center">
                    <Text className="text-[10px] text-gray-400 font-bold uppercase mb-1">Minuto</Text>
                    <View className="flex-row items-center gap-1.5">
                      <TouchableOpacity
                        onPress={() =>
                          setSelectedMinute((m) => {
                            const prev = m - 5;
                            return prev < 0 ? 55 : prev;
                          })
                        }
                        className="w-8 h-8 rounded-lg bg-white border border-gray-300 items-center justify-center"
                      >
                        <Ionicons name="remove" size={16} color="#374151" />
                      </TouchableOpacity>

                      <View className="w-12 h-10 bg-white rounded-lg border border-gray-300 items-center justify-center">
                        <Text className="text-lg font-bold text-gray-900 font-mono">
                          {String(selectedMinute).padStart(2, '0')}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() =>
                          setSelectedMinute((m) => {
                            const next = m + 5;
                            return next > 59 ? 0 : next;
                          })
                        }
                        className="w-8 h-8 rounded-lg bg-white border border-gray-300 items-center justify-center"
                      >
                        <Ionicons name="add" size={16} color="#374151" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Presets Rápidos */}
                <View className="flex-row flex-wrap gap-1.5 mt-2.5">
                  {TIME_PRESETS.map((p) => (
                    <TouchableOpacity
                      key={p.label}
                      onPress={() => {
                        setSelectedHour(p.hour);
                        setSelectedMinute(p.minute);
                      }}
                      className={`px-2.5 py-1 rounded-lg border ${
                        selectedHour === p.hour && selectedMinute === p.minute
                          ? 'bg-maroon border-maroon'
                          : 'bg-gray-100 border-gray-200'
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-bold ${
                          selectedHour === p.hour && selectedMinute === p.minute
                            ? 'text-white'
                            : 'text-gray-700'
                        }`}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Resumen de Selección */}
              <View className="mt-3 p-2.5 bg-gold/15 rounded-xl border border-gold/30 flex-row items-center justify-between">
                <Text className="text-xs text-amber-950 font-medium">Seleccionado:</Text>
                <Text className="text-xs font-bold text-maroon font-mono">
                  {selectedDay} {MONTHS[selectedMonth]?.short} {selectedYear} a las{' '}
                  {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}
                </Text>
              </View>

              {/* Botones de Acción */}
              <View className="flex-row gap-2 mt-4 pt-2 border-t border-gray-100">
                <TouchableOpacity
                  onPress={() => setOpen(false)}
                  className="flex-1 py-2.5 bg-gray-200 rounded-xl items-center justify-center"
                >
                  <Text className="text-sm font-semibold text-gray-700">Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirm}
                  className="flex-[2] py-2.5 bg-maroon rounded-xl items-center justify-center shadow-sm"
                >
                  <Text className="text-sm font-bold text-white">Confirmar Fecha y Hora</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
