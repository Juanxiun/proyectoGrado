import { assert, assertEquals } from "@std/assert";
import { buildShiftSlots, generateSchedule } from "./horarioAlgoritmo.ts";

Deno.test("construye bloques dentro de los turnos y evita el receso", () => {
  const morning = buildShiftSlots("manana", 45);
  const afternoon = buildShiftSlots("tarde", 45);
  assert(morning.every((slot) => !(slot.horaInicio < "10:00" && slot.horaFin > "09:30")));
  assert(afternoon.every((slot) => !(slot.horaInicio < "16:30" && slot.horaFin > "16:00")));
  assertEquals(new Set(morning.map((slot) => slot.horaInicio)).size, morning.length / 5);
});

Deno.test("genera una grilla sin traslapes de docente, paralelo ni aula", () => {
  const entries = generateSchedule([
    {
      cursoPeriodoId: "1",
      turno: "manana",
      sesiones: [
        { materiaId: "m1", materiaNombre: "Matemática", maestroId: "t1", cargaHorariaSemanal: 3, materiaPesada: true, pesoSintactico: 5 },
        { materiaId: "m2", materiaNombre: "Arte", maestroId: "t2", cargaHorariaSemanal: 2, materiaPesada: false, pesoSintactico: 1 },
      ],
    },
    {
      cursoPeriodoId: "2",
      turno: "manana",
      sesiones: [
        { materiaId: "m1", materiaNombre: "Matemática", maestroId: "t1", cargaHorariaSemanal: 2, materiaPesada: true, pesoSintactico: 5 },
      ],
    },
  ], [{ id: "a1" }, { id: "a2" }], 45);

  for (const entry of entries) {
    const sameTeacher = entries.filter((other) => other.maestroId === entry.maestroId && other.diaSemana === entry.diaSemana && other.horaInicio === entry.horaInicio);
    const sameCourse = entries.filter((other) => other.cursoPeriodoId === entry.cursoPeriodoId && other.diaSemana === entry.diaSemana && other.horaInicio === entry.horaInicio);
    const sameRoom = entries.filter((other) => other.aulaId === entry.aulaId && other.diaSemana === entry.diaSemana && other.horaInicio === entry.horaInicio);
    assert(sameTeacher.length <= 1);
    assert(sameCourse.length <= 1);
    assert(sameRoom.length <= 1);
  }
});
