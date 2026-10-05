// hook_usuarios -> obtener y listar datos de usuarios
import { useCallback, useState } from 'react';
import { usuariosApi } from '../api/usuarios.api';
import type {
  UpdateUsuarioPayload,
  Usuario,
  UsuariosListResponse,
  UsuariosQueryParams,
} from '../types';

export function useUsuariosList() {
  const [data, setData] = useState<UsuariosListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async (params: UsuariosQueryParams = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await usuariosApi.list(params);
      setData(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar usuarios';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Igual que `fetchList` pero recorre todas las páginas.
   *
   * El backend topa `limit` en 100 por pedido sin avisar, así que un solo
   * pedido con `limit: 300` devuelve 100. Las pantallas que filtran o cuentan
   * sobre el listado completo (por ejemplo el control estudiantil por nivel)
   * necesitan sí o sí todas las filas.
   */
  const fetchAll = useCallback(async (params: UsuariosQueryParams = {}) => {
    setLoading(true);
    setError(null);
    try {
      const todos = await usuariosApi.listAll(params);
      const resultado: UsuariosListResponse = {
        data: todos,
        total: todos.length,
        page: 1,
        limit: todos.length,
        totalPages: 1,
      };
      setData(resultado);
      return resultado;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar usuarios';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchList, fetchAll };
}

export function useUsuarioDetail() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchById = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await usuariosApi.getById(id);
      setUsuario(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar perfil';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { usuario, loading, error, fetchById, setUsuario };
}

export function useUsuarioUpdate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const update = useCallback(async (id: string, payload: UpdateUsuarioPayload) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await usuariosApi.update(id, payload);
      setSuccess(true);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateWithPhoto = useCallback(
    async (id: string, payload: UpdateUsuarioPayload, fotoUri: string) => {
      setLoading(true);
      setError(null);
      setSuccess(false);
      try {
        const result = await usuariosApi.updateWithPhoto(id, payload, fotoUri);
        setSuccess(true);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al actualizar foto';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const updateWithFiles = useCallback(
    async (id: string, payload: UpdateUsuarioPayload, fotoUri?: string) => {
      setLoading(true);
      setError(null);
      setSuccess(false);
      try {
        const result = await usuariosApi.updateWithFiles(id, payload, fotoUri);
        setSuccess(true);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al actualizar';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, error, success, update, updateWithPhoto, updateWithFiles };
}

export function useUsuarioDelete() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await usuariosApi.delete(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, remove };
}
