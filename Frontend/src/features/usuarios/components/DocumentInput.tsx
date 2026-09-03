import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import type { UsuarioDoc } from '../../../types';

interface DocumentInputProps {
  documents: UsuarioDoc[];
  onChange: (docs: UsuarioDoc[]) => void;
  requiredTypes?: string[];
  title?: string;
  showRequiredBadge?: boolean;
}

const DOCUMENT_TYPES = [
  'CI',
  'RUDE',
  'Libreta Escolar',
  'Certificado de Nacimiento',
  'Diploma de Bachiller',
  'Certificado de Egreso',
  'Certificado de Gestora Pública',
  'AcerNet',
  'Seguro Médico',
  'Otro',
];

export function DocumentInput({
  documents,
  onChange,
  requiredTypes = [],
  title = 'Documentos',
  showRequiredBadge = false,
}: DocumentInputProps) {
  const pickDocument = async (index: number) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const newDocs = [...documents];
        newDocs[index] = {
          ...newDocs[index],
          fileUri: result.assets[0].uri,
          fileName: result.assets[0].name,
        };
        onChange(newDocs);
      }
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar el documento');
    }
  };

  const addDocument = () => {
    onChange([...documents, { tipoDoc: '', numeroDoc: '' }]);
  };

  const removeDocument = (index: number) => {
    if (requiredTypes.some((rt) => documents[index]?.tipoDoc === rt)) {
      Alert.alert('Documento obligatorio', 'Este documento es requerido y no se puede eliminar');
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

  return (
    <View className="gap-2">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-xs font-bold text-gray-700">{title}</Text>
        <TouchableOpacity onPress={addDocument} className="flex-row items-center gap-1 bg-maroon/10 px-2.5 py-1.5 rounded-lg">
          <Ionicons name="add-circle" size={14} color="#7A1F3D" />
          <Text className="text-maroon text-xs font-bold">+ Agregar Documento</Text>
        </TouchableOpacity>
      </View>

      {documents.map((doc, idx) => (
        <View key={idx} className="flex-row items-center gap-2 mb-2">
          <TextInput
            value={doc.tipoDoc}
            onChangeText={(v) => updateTipoDoc(idx, v)}
            placeholder="Tipo documento"
            className="bg-gray-100 rounded-xl px-3 py-2.5 flex-1 text-xs"
          />
          <TextInput
            value={doc.numeroDoc}
            onChangeText={(v) => updateNumeroDoc(idx, v)}
            placeholder="Número / Código"
            className="bg-gray-100 rounded-xl px-3 py-2.5 flex-1 text-xs"
          />
          <TouchableOpacity
            onPress={() => pickDocument(idx)}
            className={`bg-gray-100 rounded-xl p-2.5 ${doc.fileUri ? 'border border-green-400' : 'border border-gray-200'}`}
          >
            <Ionicons name={doc.fileUri ? 'checkmark-circle' : 'document-text-outline'} size={20} color={doc.fileUri ? '#16A34A' : '#7A1F3D'} />
          </TouchableOpacity>
          {doc.fileName && <Text className="text-xs text-gray-500 max-w-[80px] truncate">{doc.fileName}</Text>}
          {requiredTypes.includes(doc.tipoDoc) && (
            <Ionicons name="shield-checkmark-outline" size={16} color="#F59E0B" />
          )}
          <TouchableOpacity
            onPress={() => removeDocument(idx)}
            disabled={requiredTypes.includes(doc.tipoDoc)}
            className="p-2"
          >
            <Ionicons name="trash" size={16} color={requiredTypes.includes(doc.tipoDoc) ? '#9CA3AF' : '#DC2626'} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}