export async function getResultadosExamen(examenId: string): Promise<any> {
  const res = { rows: [] };
  return {
    examenId,
    resultados: res.rows.map((r: any) => ({
      estudianteId: toId(r.estudiante_id),
      nombreCompleto: \ \ \.trim(),
      totalPuntaje: Number(r.total_puntaje),
      totalPreguntas: Number(r.total_preguntas),
      correctas: Number(r.correctas),
      porcentaje: r.total_preguntas > 0 ? Math.round((Number(r.correctas) / Number(r.total_preguntas)) * 10000) / 100 : 0,
      fechaRespuesta: r.fecha_respuesta,
    })),
  };
}