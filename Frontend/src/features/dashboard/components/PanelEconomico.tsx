import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { MESES, type ResumenEconomico } from '../../../api/dashboard.api';

const MONEDA = 'Bs';

function monto(valor: number): string {
  return `${MONEDA} ${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(valor)}`;
}

function Fila({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: string;
  color?: string;
}) {
  return (
    <View className="flex-row items-center justify-between py-2 border-b border-gray-50">
      <Text className="text-sm text-gray-600">{etiqueta}</Text>
      <Text className="text-sm font-bold" style={color ? { color } : { color: '#111827' }}>
        {valor}
      </Text>
    </View>
  );
}

/**
 * Estimación económica: cobranza real y proyección. Sólo llega a dirección y
 * control; para el resto el backend lo oculta.
 */
export function PanelEconomico({ economico }: { economico: ResumenEconomico }) {
  const maxMes = Math.max(1, ...economico.porMes.map((m) => m.facturado));

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-3">
        <View className="flex-1 min-w-[120px]">
          <Text className="text-[10px] font-bold text-gray-500 uppercase">Cobranza</Text>
          <Text
            className="text-xl font-bold"
            style={{
              color: (economico.porcentajeCobranza ?? 0) < 70 ? '#DC2626' : '#16A34A',
            }}
          >
            {economico.porcentajeCobranza !== null ? `${economico.porcentajeCobranza}%` : '—'}
          </Text>
          <Text className="text-[11px] text-gray-400">
            {monto(economico.cobrado)} de {monto(economico.facturado)}
          </Text>
        </View>
        <View className="flex-1 min-w-[120px]">
          <Text className="text-[10px] font-bold text-gray-500 uppercase">Cartera vencida</Text>
          <Text
            className="text-xl font-bold"
            style={{ color: economico.morosidad.carteraVencida > 0 ? '#DC2626' : '#16A34A' }}
          >
            {monto(economico.morosidad.carteraVencida)}
          </Text>
          <Text className="text-[11px] text-gray-400">
            {economico.morosidad.estudiantesConDeuda} estudiantes
          </Text>
        </View>
        <View className="flex-1 min-w-[120px]">
          <Text className="text-[10px] font-bold text-gray-500 uppercase">Ingreso del mes</Text>
          <Text className="text-xl font-bold text-gray-900">{monto(economico.ingresoMesActual)}</Text>
          <Text className="text-[11px] text-gray-400">pagos confirmados</Text>
        </View>
      </View>

      <View>
        <Fila etiqueta="Facturado" valor={monto(economico.facturado)} />
        <Fila etiqueta="Cobrado" valor={monto(economico.cobrado)} color="#16A34A" />
        <Fila
          etiqueta="Pendiente"
          valor={monto(economico.pendiente)}
          color={economico.pendiente > 0 ? '#B45309' : undefined}
        />
        <Fila
          etiqueta="Vencido"
          valor={monto(economico.vencido)}
          color={economico.vencido > 0 ? '#DC2626' : undefined}
        />
        {economico.anulado > 0 ? (
          <Fila etiqueta="Anulado" valor={monto(economico.anulado)} color="#9CA3AF" />
        ) : null}
      </View>

      <View className="bg-gray-50 border border-gray-100 rounded-xl p-3">
        <View className="flex-row items-center gap-2 mb-2">
          <Ionicons name="trending-up-outline" size={15} color="#801529" />
          <Text className="text-[10px] font-bold text-gray-600 uppercase">Proyección de cobranza</Text>
        </View>
        <Text className="text-sm text-gray-700">
          Se proyectan{' '}
          <Text className="font-bold">{monto(economico.proyectado.proximos30Dias)}</Text> para los
          próximos {economico.proyectado.diasProyeccion} días.
        </Text>
        <Text className="text-xs text-gray-500 mt-1">
          Restan {monto(economico.proyectado.restoDelPeriodo)} por vencer hasta el cierre de la
          gestión.
        </Text>
      </View>

      {economico.porMes.length > 0 ? (
        <View>
          <Text className="text-[10px] font-bold text-gray-500 uppercase mb-2">Cobranza por mes</Text>
          <View className="flex-row items-end gap-1 h-20">
            {economico.porMes.map((mes) => {
              const cobrado = mes.facturado > 0 ? mes.cobrado / mes.facturado : 0;
              return (
                <View key={`${mes.anio}-${mes.mes}`} className="flex-1 items-center gap-1">
                  <View className="w-full h-14 bg-gray-100 rounded-t overflow-hidden justify-end">
                    <View
                      className="w-full bg-maroon"
                      style={{ height: `${(mes.facturado / maxMes) * 100}%` }}
                    >
                      <View
                        className="w-full h-full"
                        style={{ backgroundColor: 'rgba(255,255,255,0.35)', height: `${cobrado * 100}%` }}
                      />
                    </View>
                  </View>
                  <Text className="text-[8px] text-gray-400">{MESES[mes.mes - 1]}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {economico.topDeudores.length > 0 ? (
        <View>
          <Text className="text-[10px] font-bold text-gray-500 uppercase mb-2">
            Mayor deuda pendiente
          </Text>
          {economico.topDeudores.map((deudor) => (
            <View
              key={deudor.estudianteId}
              className="flex-row items-center justify-between py-2 border-b border-gray-50"
            >
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-800" numberOfLines={1}>
                  {deudor.nombre} {deudor.apellidoPaterno}
                </Text>
                <Text className="text-[11px] text-gray-400">
                  {deudor.cuotasPendientes} {deudor.cuotasPendientes === 1 ? 'cuota' : 'cuotas'}
                  {deudor.diasAtraso !== null ? ` · ${deudor.diasAtraso} días de atraso` : ''}
                </Text>
              </View>
              <Text className="text-sm font-bold text-red-600">{monto(deudor.deuda)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
