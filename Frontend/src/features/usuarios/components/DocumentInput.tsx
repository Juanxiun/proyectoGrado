import { useState } from 'react';
import { Alert, Linking, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import type { UsuarioDoc } from '../../../types';

export const BOLIVIA_CI_EXTENSIONS = [
  { code: 'LP', name: 'La Paz' },
  { code: 'SC', name: 'Santa Cruz' },
  { code: 'CB', name: 'Cochabamba' },
  { code: 'OR', name: 'Oruro' },
  { code: 'PT', name: 'Potosí' },
  { code: 'TJ', name: 'Tarija' },
  { code: 'CH', name: 'Chuquisaca' },
  { code: 'BE', name: 'Beni' },
  { code: 'PD', name: 'Pando' },
  { code: '', name: 'Sin extensión' },
] as const;

export type BoliviaExtension = typeof BOLIVIA_CI_EXTENSIONS[number]['code'];

/**
 * Parsea un documento CI en número puro y extensión de departamento.
 * Ejemplo: "8492019-LP" -> { digits: "8492019", ext: "LP" }
 *          "8492019 LP" -> { digits: "8492019", ext: "LP" }
 */
export function parseCiDocument(val: string): { digits: string; ext: string } {
  const raw = (val || '').trim();
  if (!raw) return { digits: '', ext: '' };

  const match = raw.match(/^([0-9]+)(?:[-_\s]+([a-zA-Z]{2}))?$/i);
  if (match) {
    const digits = match[1] || '';
    const extFound = (match[2] || '').toUpperCase();
    const isKnown = BOLIVIA_CI_EXTENSIONS.some((e) => e.code === extFound);
    return { digits, ext: isKnown ? extFound : '' };
  }

  // Si tiene caracteres no numéricos al final
  const digits = raw.replace(/[^0-9]/g, '');
  const letters = raw.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2);
  const isKnown = BOLIVIA_CI_EXTENSIONS.some((e) => e.code === letters);
  return { digits, ext: isKnown ? letters : '' };
}

interface DocumentInputProps {
  documents: UsuarioDoc[];
  onChange: (docs: UsuarioDoc[]) => void;
  requiredTypes?: string[];
  title?: string;
  showRequiredBadge?: boolean;
  /** Errores de validación por tipo de documento; se muestran bajo su campo. */
  fieldErrors?: Record<string, string | undefined>;
}

export function DocumentInput({
  documents,
  onChange,
  requiredTypes = [],
  title = 'Documentos',
  showRequiredBadge = false,
  fieldErrors = {},
}: DocumentInputProps) {
  const [activeExtModalIndex, setActiveExtModalIndex] = useState<number | null>(null);

  const isCriticalDoc = (tipoDoc: string) => {
    const t = (tipoDoc || '').trim().toUpperCase();
    return t === 'CI' || requiredTypes.some((rt) => rt.trim().toUpperCase() === t);
  };

  const pickDocument = async (index: number) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const newDocs = [...documents];
        newDocs[index] = {
          ...newDocs[index],
          fileUri: file.uri,
          fileName: file.name,
        };
        onChange(newDocs);
      }
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar el documento PDF');
    }
  };

  const addDocument = () => {
    onChange([...documents, { tipoDoc: '', numeroDoc: '' }]);
  };

  const removeDocument = (index: number) => {
    const doc = documents[index];
    if (doc && isCriticalDoc(doc.tipoDoc)) {
      Alert.alert('Documento obligatorio', `El documento ${doc.tipoDoc} es crítico y no se puede eliminar.`);
      return;
    }
    onChange(documents.filter((_, i) => i !== index));
  };

  const updateTipoDoc = (index: number, tipoDoc: string) => {
    const newDocs = [...documents];
    newDocs[index] = { ...newDocs[index], tipoDoc };
    onChange(newDocs);
  };

  const updateNumeroDoc = (index: number, numeroDoc: string) => {
    const newDocs = [...documents];
    newDocs[index] = { ...newDocs[index], numeroDoc };
    onChange(newDocs);
  };

  const updateCiDigits = (index: number, newDigitsRaw: string) => {
    // Restricción estricta: sólo números en el CI
    const digitsOnly = newDigitsRaw.replace(/[^0-9]/g, '');
    const currentDoc = documents[index];
    const { ext } = parseCiDocument(currentDoc?.numeroDoc || '');
    const combined = ext ? `${digitsOnly}-${ext}` : digitsOnly;
    updateNumeroDoc(index, combined);
  };

  const updateCiExtension = (index: number, newExt: string) => {
    const currentDoc = documents[index];
    const { digits } = parseCiDocument(currentDoc?.numeroDoc || '');
    const combined = newExt ? `${digits}-${newExt}` : digits;
    updateNumeroDoc(index, combined);
    setActiveExtModalIndex(null);
  };

  const fileLabel = (doc: UsuarioDoc) => {
    if (doc.fileName) return doc.fileName;
    if (doc.docUrl) {
      try {
        const path = doc.docUrl.split('?')[0];
        return decodeURIComponent(path.split('/').pop() || 'Archivo_PDF.pdf');
      } catch {
        return 'Archivo_PDF.pdf';
      }
    }
    return null;
  };

  // Identificar si falta algún archivo crítico
  const missingCriticalFiles = documents.filter(
    (d) => isCriticalDoc(d.tipoDoc) && !d.fileUri && !d.docUrl,
  );

  return (
    <View className="gap-2">
      <View className="flex-row justify-between items-center mb-1">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="documents-outline" size={16} color="#7A1F3D" />
          <Text className="text-xs font-bold text-gray-800 uppercase tracking-wide">{title}</Text>
        </View>
        <TouchableOpacity
          onPress={addDocument}
          className="flex-row items-center gap-1 bg-maroon/10 px-2.5 py-1.5 rounded-lg border border-maroon/20"
        >
          <Ionicons name="add-circle" size={14} color="#7A1F3D" />
          <Text className="text-maroon text-xs font-bold">+ Agregar Documento</Text>
        </TouchableOpacity>
      </View>

      {/* Alerta general si faltan archivos críticos como CI */}
      {missingCriticalFiles.length > 0 && (
        <View className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 flex-row items-center gap-2 mb-2 shadow-xs">
          <Ionicons name="warning" size={18} color="#D97706" />
          <View className="flex-1">
            <Text className="text-xs font-bold text-amber-800">
              Archivo crítico no subido: {missingCriticalFiles.map((d) => d.tipoDoc || 'CI').join(', ')}
            </Text>
            <Text className="text-[11px] text-amber-700">
              Debe adjuntar el archivo PDF correspondiente para cumplir con los requisitos oficiales.
            </Text>
          </View>
        </View>
      )}

      {showRequiredBadge && requiredTypes.length > 0 && (
        <Text className="text-[11px] text-gray-500 mb-1">
          Campos obligatorios: <Text className="font-semibold text-gray-700">{requiredTypes.join(', ')}</Text>.
          Si ya existe un archivo subido, se conservará a menos que elija reemplazarlo.
        </Text>
      )}

      {documents.map((doc, idx) => {
        const label = fileLabel(doc);
        const hasFile = Boolean(doc.fileUri || doc.docUrl);
        const critical = isCriticalDoc(doc.tipoDoc);
        const isCi = (doc.tipoDoc || '').trim().toUpperCase() === 'CI';
        const isRude = (doc.tipoDoc || '').trim().toUpperCase() === 'RUDE';
        const { digits, ext } = isCi ? parseCiDocument(doc.numeroDoc) : { digits: doc.numeroDoc, ext: '' };

        return (
          <View
            key={doc.id ?? `${doc.tipoDoc}-${idx}`}
            className={`p-2.5 rounded-xl border mb-2 bg-white ${
              critical && !hasFile
                ? 'border-amber-400 bg-amber-50/30'
                : hasFile
                ? 'border-green-300 bg-green-50/10'
                : 'border-gray-200'
            }`}
          >
            {/* Fila con inputs y botones */}
            <View className="flex-row items-center gap-2">
              <View className="w-[100px] md:w-[120px]">
                <TextInput
                  value={doc.tipoDoc}
                  onChangeText={(v) => updateTipoDoc(idx, v)}
                  placeholder="Tipo (CI, RUDE)"
                  className="bg-gray-100 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-800 border border-gray-200"
                />
              </View>

              {isCi ? (
                /* CI con input de solo números + selector de extensión por departamento de Bolivia */
                <View className="flex-1 flex-row items-center gap-1.5">
                  <TextInput
                    value={digits}
                    onChangeText={(v) => updateCiDigits(idx, v)}
                    placeholder="Número de CI (sólo dígitos) *"
                    keyboardType="numeric"
                    className="flex-1 bg-gray-100 rounded-lg px-2.5 py-2 text-xs text-gray-800 border border-gray-200 font-mono"
                  />
                  <TouchableOpacity
                    onPress={() => setActiveExtModalIndex(idx)}
                    className="bg-maroon/10 border border-maroon/30 rounded-lg px-2 py-2 flex-row items-center gap-1"
                  >
                    <Text className="text-xs font-bold text-maroon">
                      {ext ? `Ext: ${ext}` : 'Ext: Sel.'}
                    </Text>
                    <Ionicons name="chevron-down" size={13} color="#801529" />
                  </TouchableOpacity>
                </View>
              ) : isRude ? (
                /* RUDE con input sólo números */
                <View className="flex-1">
                  <TextInput
                    value={doc.numeroDoc}
                    onChangeText={(v) => updateNumeroDoc(idx, v.replace(/[^0-9]/g, ''))}
                    placeholder="Código RUDE (sólo números) *"
                    keyboardType="numeric"
                    className="bg-gray-100 rounded-lg px-2.5 py-2 text-xs text-gray-800 border border-gray-200 font-mono"
                  />
                </View>
              ) : (
                /* Input estándar para otros documentos */
                <View className="flex-1">
                  <TextInput
                    value={doc.numeroDoc}
                    onChangeText={(v) => updateNumeroDoc(idx, v)}
                    placeholder="Número / Código *"
                    className="bg-gray-100 rounded-lg px-2.5 py-2 text-xs text-gray-800 border border-gray-200"
                  />
                </View>
              )}

              {/* Botón selector de archivo */}
              <TouchableOpacity
                onPress={() => pickDocument(idx)}
                className={`rounded-lg px-2.5 py-2 flex-row items-center gap-1.5 ${
                  hasFile
                    ? 'bg-green-600 text-white'
                    : critical
                    ? 'bg-amber-600 text-white'
                    : 'bg-maroon text-white'
                }`}
              >
                <Ionicons
                  name={hasFile ? 'checkmark-circle' : 'cloud-upload-outline'}
                  size={15}
                  color="#FFF"
                />
                <Text className="text-white text-[11px] font-bold">
                  {hasFile ? 'Cambiar PDF' : 'Subir PDF'}
                </Text>
              </TouchableOpacity>

              {/* Botón eliminar (deshabilitado si es obligatorio) */}
              <TouchableOpacity
                onPress={() => removeDocument(idx)}
                disabled={critical}
                className="p-1.5 rounded-lg"
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={critical ? '#D1D5DB' : '#DC2626'}
                />
              </TouchableOpacity>
            </View>

            {fieldErrors[`documento:${doc.tipoDoc?.trim().toUpperCase()}`] && (
              <Text className="text-xs text-red-600 mt-1">
                {fieldErrors[`documento:${doc.tipoDoc?.trim().toUpperCase()}`]}
              </Text>
            )}

            {/* Estado del archivo adjunto */}
            <View className="mt-2 pt-2 border-t border-gray-100 flex-row items-center justify-between flex-wrap gap-2">
              {hasFile ? (
                <View className="flex-row items-center gap-1.5 flex-1 min-w-[180px]">
                  <Ionicons name="document-text" size={14} color="#16A34A" />
                  <Text className="text-[11px] text-green-700 font-medium" numberOfLines={1}>
                    {doc.fileUri ? `Nuevo seleccionado: ${label}` : `En servidor MinIO: ${label}`}
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center gap-1.5 flex-1 min-w-[180px]">
                  <Ionicons
                    name={critical ? 'alert-circle' : 'information-circle-outline'}
                    size={14}
                    color={critical ? '#D97706' : '#9CA3AF'}
                  />
                  <Text
                    className={`text-[11px] font-medium ${
                      critical ? 'text-amber-700' : 'text-gray-500'
                    }`}
                  >
                    {critical
                      ? '⚠️ Sin archivo digital (PDF de CI es crítico)'
                      : 'Sin archivo adjunto (Opcional)'}
                  </Text>
                </View>
              )}

              {/* Acciones de visualización y reemplazo */}
              <View className="flex-row items-center gap-3">
                {doc.docUrl && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(doc.docUrl!)}
                    className="flex-row items-center gap-1"
                  >
                    <Ionicons name="eye-outline" size={13} color="#7A1F3D" />
                    <Text className="text-xs font-bold text-maroon">Ver PDF</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => pickDocument(idx)}
                  className="flex-row items-center gap-1"
                >
                  <Ionicons name="sync-outline" size={13} color="#7A1F3D" />
                  <Text className="text-xs font-bold text-maroon">
                    {hasFile ? 'Reemplazar' : 'Adjuntar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}

      {/* Modal Selector de Extensiones Departamentales de Bolivia para CI */}
      <Modal
        visible={activeExtModalIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveExtModalIndex(null)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-4">
          <View className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <View className="p-4 bg-maroon flex-row items-center justify-between">
              <View>
                <Text className="text-base font-bold text-white">Extensión de CI (Bolivia)</Text>
                <Text className="text-xs text-white/80">Seleccione el departamento emisor</Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveExtModalIndex(null)}
                className="w-7 h-7 rounded-full bg-white/20 items-center justify-center"
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-3 max-h-80">
              <View className="gap-1.5">
                {BOLIVIA_CI_EXTENSIONS.map((item) => {
                  const currentExt = activeExtModalIndex !== null
                    ? parseCiDocument(documents[activeExtModalIndex]?.numeroDoc || '').ext
                    : '';
                  const isSelected = currentExt === item.code;

                  return (
                    <TouchableOpacity
                      key={item.code || 'none'}
                      onPress={() => {
                        if (activeExtModalIndex !== null) {
                          updateCiExtension(activeExtModalIndex, item.code);
                        }
                      }}
                      className={`p-3 rounded-xl flex-row items-center justify-between border ${
                        isSelected
                          ? 'bg-maroon/10 border-maroon'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <View className="flex-row items-center gap-2.5">
                        <View className={`w-8 h-8 rounded-lg items-center justify-center ${isSelected ? 'bg-maroon' : 'bg-gray-200'}`}>
                          <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                            {item.code || '—'}
                          </Text>
                        </View>
                        <Text className={`text-sm font-semibold ${isSelected ? 'text-maroon' : 'text-gray-800'}`}>
                          {item.name}
                        </Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={18} color="#801529" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
