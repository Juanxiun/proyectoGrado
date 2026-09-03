import { useEffect, useMemo, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BirthDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minYear?: number;
  maxYear?: number;
}

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

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

const parseInitialDate = (val: unknown): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val === 'object') return new Date();

  const str = String(val).trim();
  if (!str || str.includes('[object') || str === 'undefined' || str === 'null') {
    return new Date();
  }

  try {
    const clean = str.includes('T') ? str.split('T')[0] : str.split(' ')[0];
    const parts = clean.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
};

export function BirthDatePicker({
  value,
  onChange,
  placeholder = 'Fecha de nacimiento *',
  className = '',
  minYear = 1940,
  maxYear = new Date().getFullYear(),
}: BirthDatePickerProps) {
  const [open, setOpen] = useState(false);
  const initial = parseInitialDate(value);

  const [selectedYear, setSelectedYear] = useState(initial.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initial.getMonth());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Selector de década para evitar el listado extenso de 100+ años
  const [decadeStart, setDecadeStart] = useState(() => Math.floor(initial.getFullYear() / 10) * 10);

  useEffect(() => {
    const d = parseInitialDate(value);
    setSelectedYear(d.getFullYear());
    setSelectedMonth(d.getMonth());
    setDecadeStart(Math.floor(d.getFullYear() / 10) * 10);
  }, [value]);

  const displayValue = useMemo(() => {
    if (!value) return '';
    if (typeof value === 'string') {
      if (value.includes('[object') || value === 'undefined' || value === 'null') return '';
      return value.slice(0, 10);
    }
    if ((value as any) instanceof Date && !isNaN((value as any).getTime())) {
      return (value as any).toISOString().slice(0, 10);
    }
    return '';
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

  const handleDayPress = (day: number) => {
    onChange(iso(new Date(selectedYear, selectedMonth, day)));
    setOpen(false);
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
    setDecadeStart(Math.floor(today.getFullYear() / 10) * 10);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && selectedMonth === today.getMonth() && selectedYear === today.getFullYear();
  };

  const isSelected = (day: number) => displayValue === iso(new Date(selectedYear, selectedMonth, day));

  // Años a mostrar en la década actual (máximo 10 o 12 botones compactos)
  const decadeYears = useMemo(() => {
    const years: number[] = [];
    const end = Math.min(maxYear, decadeStart + 9);
    for (let y = decadeStart; y <= end; y++) {
      if (y >= minYear) years.push(y);
    }
    return years;
  }, [decadeStart, minYear, maxYear]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className={`bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[170px] ${className}`}
      >
        <Text className={displayValue ? 'text-gray-800 font-medium' : 'text-gray-400'}>
          {displayValue || placeholder}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 bg-black/40 justify-center items-center p-4">
          <View className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl border border-gray-100">
            {/* Cabecera del selector (Año / Mes) */}
            <View className="flex-row items-center justify-between mb-4 gap-2">
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
                <Text className="font-bold text-gray-900 text-lg">{selectedYear}</Text>
                <Ionicons name={showYearPicker ? 'chevron-up' : 'chevron-down'} size={14} color="#7A1F3D" />
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
                <Text className="font-bold text-gray-900 text-lg">{MONTHS[selectedMonth]?.short ?? 'Ene'}</Text>
                <Ionicons name={showMonthPicker ? 'chevron-up' : 'chevron-down'} size={14} color="#7A1F3D" />
              </TouchableOpacity>
            </View>

            {/* Selector de Años con navegación por décadas (Limpio y compacto, no listado extenso) */}
            {showYearPicker && (
              <View className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <View className="flex-row justify-between items-center mb-3">
                  <TouchableOpacity
                    onPress={() => setDecadeStart((d) => Math.max(minYear, d - 10))}
                    disabled={decadeStart <= minYear}
                    className="p-1 rounded-lg bg-white border border-gray-200"
                  >
                    <Ionicons name="chevron-back" size={18} color={decadeStart <= minYear ? '#D1D5DB' : '#7A1F3D'} />
                  </TouchableOpacity>

                  <Text className="font-bold text-maroon text-sm">
                    {decadeStart} - {Math.min(maxYear, decadeStart + 9)}
                  </Text>

                  <TouchableOpacity
                    onPress={() => setDecadeStart((d) => Math.min(maxYear - 5, d + 10))}
                    disabled={decadeStart + 10 > maxYear}
                    className="p-1 rounded-lg bg-white border border-gray-200"
                  >
                    <Ionicons name="chevron-forward" size={18} color={decadeStart + 10 > maxYear ? '#D1D5DB' : '#7A1F3D'} />
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
                      className={`w-[48%] py-2.5 items-center justify-center rounded-lg ${
                        y === selectedYear
                          ? 'bg-maroon'
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      <Text
                        className={`font-bold text-sm ${
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

            {/* Selector de Meses (Cuadrícula 3x4 limpia) */}
            {showMonthPicker && (
              <View className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <Text className="text-xs font-bold text-gray-600 mb-2.5 text-center uppercase">Selecciona el Mes</Text>
                <View className="flex-row flex-wrap justify-between gap-1.5">
                  {MONTHS.map((m, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => {
                        setSelectedMonth(idx);
                        setShowMonthPicker(false);
                      }}
                      className={`w-[31%] py-2 items-center rounded-lg ${
                        idx === selectedMonth
                          ? 'bg-maroon'
                          : 'bg-white border border-gray-200'
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

            {/* Vista principal del Calendario mensual */}
            {!showYearPicker && !showMonthPicker && (
              <>
                <View className="flex-row justify-between items-center mb-3">
                  <TouchableOpacity onPress={() => setSelectedMonth((m) => (m === 0 ? 11 : m - 1))}>
                    <Ionicons name="chevron-back" size={20} color="#7A1F3D" />
                  </TouchableOpacity>

                  <Text className="font-bold text-maroon text-base">
                    {MONTHS[selectedMonth]?.long ?? 'Enero'} {selectedYear}
                  </Text>

                  <TouchableOpacity onPress={() => setSelectedMonth((m) => (m === 11 ? 0 : m + 1))}>
                    <Ionicons name="chevron-forward" size={20} color="#7A1F3D" />
                  </TouchableOpacity>
                </View>

                <View className="flex-row flex-wrap mb-3">
                  {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((d) => (
                    <Text key={d} className="w-[14.28%] text-center text-gray-400 font-bold text-xs mb-2">
                      {d}
                    </Text>
                  ))}
                  {days.map((day, i) =>
                    day === null ? (
                      <View key={`empty-${i}`} className="w-[14.28%] h-9" />
                    ) : (
                      <TouchableOpacity
                        key={day}
                        onPress={() => handleDayPress(day)}
                        className="w-[14.28%] h-9 items-center justify-center"
                      >
                        <View
                          className={`w-8 h-8 rounded-full items-center justify-center ${
                            isSelected(day)
                              ? 'bg-maroon'
                              : isToday(day)
                              ? 'bg-gold/30 border border-gold/60'
                              : ''
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              isSelected(day)
                                ? 'text-white font-bold'
                                : isToday(day)
                                ? 'text-maroon font-bold'
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

                <View className="flex-row justify-between items-center pt-2 border-t border-gray-100">
                  <TouchableOpacity onPress={goToToday}>
                    <Text className="text-maroon font-bold text-xs">Ir a Hoy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setOpen(false)}>
                    <Text className="text-gray-500 font-semibold text-xs">Cerrar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}