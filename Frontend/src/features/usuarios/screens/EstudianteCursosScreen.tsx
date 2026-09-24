import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { academicManagementApi, academicServicesApi } from '../../../api/academicServices.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { getFullName } from '../../../utils/validation';

export function EstudianteCursosScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [compañeros, setCompañeros] = useState<any[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [enrolledCourseId, setEnrolledCourseId] = useState(String(user?.cursoPeriodoId ?? ''));
  const [requests, setRequests] = useState<any[]>([]);
  const [requestType, setRequestType] = useState<'promocion' | 'reserva'>('promocion');
  const [requesting, setRequesting] = useState(false);
  const [enabling, setEnabling] = useState(false);

  const fullName = user ? getFullName(user.nombre, user.apellidoPaterno, user.apellidoMaterno) : 'Estudiante';
  const grado = user?.grado || '3';
  const paralelo = user?.paralelo || 'A';
  const nivel = user?.nivel || 'Secundaria';

  useEffect(() => {
    setEnrolledCourseId(String(user?.cursoPeriodoId ?? ''));
  }, [user?.cursoPeriodoId]);

  useEffect(() => {
    async function loadCompañeros() {
      try {
        setLoading(true);
        if (enrolledCourseId) {
          const res = await academicServicesApi.list('inscripciones', {
            cursoPeriodoId: enrolledCourseId,
            limit: 100,
          });
          setCompañeros(res.data as any[]);
        } else {
          setCompañeros([]);
        }
      } catch (err) {
        console.error('Error cargando compañeros de curso:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCompañeros();
  }, [enrolledCourseId]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      academicServicesApi.list('cursos-periodo', { estado: 'activo', limit: 100 }),
      academicManagementApi.listEnrollmentRequests(),
    ]).then(([courses, pendingRequests]) => {
      if (!mounted) return;
      setAvailableCourses((courses.data ?? []).filter((course: any) => course.periodo?.activo !== false));
      setRequests(pendingRequests as any[]);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const requestEnrollment = async () => {
    if (!selectedCourseId) {
      Alert.alert('Selecciona un curso', 'Elige el paralelo de destino para enviar la solicitud.');
      return;
    }
    setRequesting(true);
    try {
      await academicManagementApi.createEnrollmentRequest({ cursoPeriodoDestinoId: selectedCourseId, tipo: requestType });
      const pendingRequests = await academicManagementApi.listEnrollmentRequests();
      setRequests(pendingRequests as any[]);
      Alert.alert('Solicitud enviada', 'La administración revisará tu promoción.');
    } catch (error) {
      Alert.alert('No se pudo solicitar', error instanceof Error ? error.message : 'Intente nuevamente');
    } finally {
      setRequesting(false);
    }
  };

  const enableEnrollment = async () => {
    if (!selectedCourseId) {
      Alert.alert('Selecciona un curso', 'Elige el grado y paralelo que deseas cursar.');
      return;
    }
    setEnabling(true);
    try {
      await academicManagementApi.enableEnrollment(selectedCourseId);
      setEnrolledCourseId(selectedCourseId);
      Alert.alert('Inscripción habilitada', 'Ya puedes consultar las materias y horarios de tu curso.');
    } catch (error) {
      Alert.alert('No se pudo habilitar', error instanceof Error ? error.message : 'Intente nuevamente');
    } finally {
      setEnabling(false);
    }
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-8 min-w-0" showsVerticalScrollIndicator={false}>
      <BentoCard className="p-5 overflow-hidden">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 min-w-0">
            <Text className="text-2xl font-bold text-gray-900">Mi Curso y Paralelo</Text>
            <Text className="text-sm text-gray-500 mt-1">
              Ficha académica del estudiante y nómina de compañeros de sección.
            </Text>
          </View>
          <StatusBadge label="Matrícula Activa" variant="success" />
        </View>
      </BentoCard>

      {/* Tarjeta resumen del curso */}
      <BentoCard className="p-6 bg-cream border border-gold/20 overflow-hidden">
        <View className="flex-row items-center gap-4">
          <View className="w-16 h-16 rounded-2xl bg-maroon items-center justify-center shadow-md">
            <Ionicons name="school" size={32} color="#FFFFFF" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-xl font-bold text-gray-900" numberOfLines={2} ellipsizeMode="tail">
              {grado}° &quot;{paralelo}&quot; de {nivel}
            </Text>
            <Text className="text-sm text-gray-600 mt-0.5">
              Estudiante: <Text className="font-semibold">{fullName}</Text>
            </Text>
            <Text className="text-xs text-gray-400 mt-1">
              Gestión Escolar Activa • Turno Mañana
            </Text>
          </View>
        </View>
      </BentoCard>

      <BentoCard className="p-5 border border-gold/30">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 min-w-0"><Text className="text-lg font-bold text-gray-900">Promoción / reserva</Text><Text className="text-xs text-gray-500 mt-1">Solicita el paso al grado superior de la gestión activa.</Text></View>
          <Ionicons name="swap-horizontal-outline" size={26} color="#801529" />
        </View>
        {requests.length > 0 && <Text className="text-xs text-amber-700 mt-3">Solicitud pendiente: {requests[0].estado}</Text>}
        <View className="flex-row gap-2 mt-3"><TouchableOpacity onPress={() => setRequestType('promocion')} className={`px-3 py-2 rounded-lg ${requestType === 'promocion' ? 'bg-maroon' : 'bg-gray-100'}`}><Text className={`text-xs font-bold ${requestType === 'promocion' ? 'text-white' : 'text-gray-600'}`}>Promoción</Text></TouchableOpacity><TouchableOpacity onPress={() => setRequestType('reserva')} className={`px-3 py-2 rounded-lg ${requestType === 'reserva' ? 'bg-maroon' : 'bg-gray-100'}`}><Text className={`text-xs font-bold ${requestType === 'reserva' ? 'text-white' : 'text-gray-600'}`}>Reserva</Text></TouchableOpacity></View>
        {availableCourses.length > 0 && (
          <View className="mt-3 w-full flex-row flex-wrap gap-2">
            {availableCourses.map((course) => (
              <TouchableOpacity
                key={String(course.id)}
                onPress={() => setSelectedCourseId(String(course.id))}
                className={`flex-1 min-w-[150px] max-w-[240px] px-3 py-2 rounded-xl ${selectedCourseId === String(course.id) ? 'bg-maroon' : 'bg-gray-100'}`}
              >
                <Text className={`text-xs font-bold ${selectedCourseId === String(course.id) ? 'text-white' : 'text-gray-600'}`} numberOfLines={2} ellipsizeMode="tail">
                  {course.curso?.grado ?? ''} {course.curso?.paralelo ?? ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {availableCourses.length > 0 && (
          <TouchableOpacity
            onPress={enableEnrollment}
            disabled={enabling || Boolean(enrolledCourseId)}
            className={`mt-3 rounded-xl py-3 items-center flex-row justify-center gap-2 ${enabling || enrolledCourseId ? 'bg-gray-200' : 'bg-emerald-700'}`}
          >
            <Ionicons name={enrolledCourseId ? 'checkmark-circle' : 'checkbox-outline'} size={17} color={enrolledCourseId ? '#6B7280' : '#FFFFFF'} />
            <Text className={`font-bold text-sm ${enabling || enrolledCourseId ? 'text-gray-500' : 'text-white'}`}>
              {enrolledCourseId ? 'Inscripción habilitada' : enabling ? 'Habilitando inscripción...' : 'Habilitar inscripción'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={requestEnrollment} disabled={requesting || requests.some((item) => item.estado === 'pendiente')} className={`mt-3 rounded-xl py-3 items-center ${requesting || requests.some((item) => item.estado === 'pendiente') ? 'bg-gray-200' : 'bg-maroon'}`}>
          {requesting ? <ActivityIndicator color="#801529" /> : <Text className="text-white font-bold text-sm">Solicitar {requestType === 'promocion' ? 'promoción' : 'reserva'}</Text>}
        </TouchableOpacity>
      </BentoCard>

      {/* Compañeros de curso */}
      <BentoCard className="p-5 overflow-hidden">
        <Text className="text-lg font-bold text-gray-900 mb-3">
          Compañeros de Paralelo ({compañeros.length > 0 ? compañeros.length : 'En aula'})
        </Text>

        {loading ? (
          <View className="py-8 items-center justify-center">
            <ActivityIndicator size="small" color="#801529" />
            <Text className="text-xs text-gray-500 mt-2">Cargando lista de compañeros...</Text>
          </View>
        ) : compañeros.length === 0 ? (
          <View className="py-6 items-center">
            <Ionicons name="people-outline" size={36} color="#D1D5DB" />
            <Text className="text-sm text-gray-500 mt-2">
              Sección registrada correctamente en el sistema.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {compañeros.map((item: any, i: number) => {
              const st = item.estudiante || item;
              const isMe = String(st.usuarioId) === String(user?.id);
              return (
                <View
                  key={item.id || i}
                  className={`p-3 rounded-xl flex-row items-center justify-between ${
                    isMe ? 'bg-maroon/10 border border-maroon/30' : 'bg-gray-50'
                  }`}
                >
                  <View className="flex-row items-center gap-3 flex-1 min-w-0">
                    <View className={`w-8 h-8 rounded-full items-center justify-center ${
                      isMe ? 'bg-maroon' : 'bg-gray-200'
                    }`}>
                      <Text className={`text-xs font-bold ${isMe ? 'text-white' : 'text-gray-700'}`}>
                        {st.apellidoPaterno?.charAt(0) || st.nombre?.charAt(0) || 'A'}
                      </Text>
                    </View>
                    <Text className={`text-sm flex-1 min-w-0 ${isMe ? 'font-bold text-maroon' : 'font-medium text-gray-800'}`} numberOfLines={1} ellipsizeMode="tail">
                      {st.apellidoPaterno} {st.apellidoMaterno} {st.nombre} {isMe ? '(Tú)' : ''}
                    </Text>
                  </View>
                  <StatusBadge label="Inscrito" variant="success" />
                </View>
              );
            })}
          </View>
        )}
      </BentoCard>
    </ScrollView>
  );
}
