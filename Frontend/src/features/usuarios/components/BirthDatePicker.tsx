import { useMemo, useState } from 'react';
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

export function BirthDatePicker({
  value,
  onChange,
  placeholder = 'Fecha de nacimiento *',
  className = '',
  minYear = 1920,
  maxYear = new Date().getFullYear(),
}: BirthDatePickerProps) {
  const [open, setOpen] = useState(false);
  const initial = value ? new Date(`${value}T12:00:00`) : new Date();
  const [selectedYear, setSelectedYear] = useState(initial.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initial.getMonth());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const days = useMemo(() => {
    const first = new Date(selectedYear, selectedMonth, 1).getDay();
    const count = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [selectedYear, selectedMonth]);

  const handleDayPress = (day: number) => {
    onChange(iso(new Date(selectedYear, selectedMonth, day)));
    setOpen(false);
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && selectedMonth === today.getMonth() && selectedYear === today.getFullYear();
  };

  const isSelected = (day: number) => value === iso(new Date(selectedYear, selectedMonth, day));

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} className={`bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[170px] ${className}`}>
        <Text className={value ? 'text-gray-800' : 'text-gray-500'}>{value || placeholder}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 bg-black/40 justify-center p-5">
          <View className="bg-white rounded-2xl p-5 max-w-md w-full">
            <View className="flex-row items-center justify-between mb-4 gap-2">
              <TouchableOpacity onPress={() => setShowYearPicker(true)} className="flex-1 items-center py-2 bg-gray-100 rounded-xl">
                <Text className="text-xs text-gray-500">AÑO</Text>
                <Text className="font-bold text-gray-900 text-lg">{selectedYear}</Text>
                <Ionicons name="chevron-down" size={16} color="#7A1F3D" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowMonthPicker(true)} className="flex-1 items-center py-2 bg-gray-100 rounded-xl">
                <Text className="text-xs text-gray-500">MES</Text>
                <Text className="font-bold text-gray-900 text-lg">{MONTHS[selectedMonth].short}</Text>
                <Ionicons name="chevron-down" size={16} color="#7A1F3D" />
              </TouchableOpacity>
            </View>

            {showYearPicker && (
              <View className="mb-4 p-3 bg-gray-50 rounded-xl max-h-60">
                <Text className="text-xs font-bold text-gray-700 mb-2 text-center">Seleccionar Año</Text>
                <View className="flex-row flex-wrap justify-center gap-1">
                  {Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i).map((y) => (
                    <TouchableOpacity
                      key={y}
                      onPress={() => { setSelectedYear(y); setShowYearPicker(false); }}
                      className={`w-20 h-10 items-center justify-center rounded-lg ${
                        y === selectedYear ? 'bg-maroon text-white' : 'bg-white text-gray-800 border border-gray-200'
                      }`}
                    >
                      <Text className="font-bold text-sm">{y}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {showMonthPicker && (
              <View className="mb-4 p-3 bg-gray-50 rounded-xl">
                <Text className="text-xs font-bold text-gray-700 mb-2 text-center">Seleccionar Mes</Text>
                <View className="flex-row flex-wrap justify-center gap-1">
                  {MONTHS.map((m, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => { setSelectedMonth(idx); setShowMonthPicker(false); }}
                      className={`px-3 py-2 rounded-lg ${
                        idx === selectedMonth ? 'bg-maroon text-white' : 'bg-white text-gray-800 border border-gray-200'
                      }`}
                    >
                      <Text className="font-bold text-xs">{m.short}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {!showYearPicker && !showMonthPicker && (
              <>
                <View className="flex-row justify-between items-center mb-3">
                  <TouchableOpacity onPress={() => setSelectedYear(y => Math.max(minYear, y - 1))}>
                    <Ionicons name="chevron-back" size={22} color="#7A1F3D" />
                  </TouchableOpacity>
                  <Text className="font-bold text-maroon text-lg">
                    {MONTHS[selectedMonth].long} {selectedYear}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedYear(y => Math.min(maxYear, y + 1))}>
                    <Ionicons name="chevron-forward" size={22} color="#7A1F3D" />
                  </TouchableOpacity>
                </View>
                <View className="flex-row flex-wrap mb-3">
                  {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((d) => (
                    <Text key={d} className="w-[14.28%] text-center text-gray-500 font-semibold mb-2">{d}</Text>
                  ))}
                  {days.map((day, i) =>
                    day === null ? (
                      <View key={`empty-${i}`} className="w-[14.28%] h-10" />
                    ) : (
                      <TouchableOpacity
                        key={day}
                        onPress={() => handleDayPress(day)}
                        className="w-[14.28%] h-10 items-center justify-center"
                      >
                        <Text
                          className={`text-sm font-medium rounded-full w-8 h-8 items-center justify-center ${
                            isSelected(day)
                              ? 'bg-maroon text-white'
                              : isToday(day)
                              ? 'bg-gold/30 text-maroon border border-gold/50'
                              : 'text-gray-800'
                          }`}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
                <View className="flex-row justify-between items-center">
                  <TouchableOpacity onPress={goToToday}>
                    <Text className="text-maroon font-semibold text-sm">Hoy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setOpen(false)}>
                    <Text className="text-gray-500 font-semibold text-sm">Cancelar</Text>
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