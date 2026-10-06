import { describe, expect, it } from 'vitest';
import {
  DESCRIPTION_MAX_LENGTH,
  draftToNewProject,
  EMPTY_DRAFT,
  MAX_CAPACITY,
  MAX_LIST_ITEMS,
  parseCapacity,
  splitLines,
  splitParagraphs,
  TITLE_MAX_LENGTH,
  validateProjectDraft,
} from './projectDraft';

const TODAY = new Date(2026, 8, 23, 9, 20);
const VALID = {
  title: 'Piloto de mentorías',
  area: 'Cultura',
  cohort: 'Semilla 2026-2',
  summary: 'Mentorías cruzadas entre áreas.',
  description: 'Mentorías cruzadas entre áreas de la empresa.',
  requirements: '',
  skills: '',
  capacity: '5',
  closesAt: '2026-10-15',
};

describe('validación del borrador de proyecto', () => {
  it('acepta un borrador completo, con requisitos y habilidades opcionales', () => {
    expect(validateProjectDraft(VALID, TODAY)).toEqual({});
    expect(
      validateProjectDraft({ ...VALID, requirements: 'SQL\nPython', skills: 'Análisis' }, TODAY),
    ).toEqual({});
  });

  it('exige los campos obligatorios y deja libres los opcionales', () => {
    const errors = validateProjectDraft(EMPTY_DRAFT, TODAY);
    expect(Object.keys(errors)).toEqual([
      'title',
      'area',
      'cohort',
      'summary',
      'description',
      'capacity',
      'closesAt',
    ]);
  });

  it.each([
    ['vacía', '', 'Indica cuántos cupos ofrece el proyecto'],
    ['con decimales', '2.5', 'Los cupos deben ser un número entero'],
    ['con letras', 'cinco', 'Los cupos deben ser un número entero'],
    ['en notación científica', '1e3', 'Los cupos deben ser un número entero'],
    ['cero', '0', 'El proyecto necesita al menos 1 cupo'],
    ['negativa', '-3', 'El proyecto necesita al menos 1 cupo'],
    [
      'sobre el máximo',
      String(MAX_CAPACITY + 1),
      `El máximo es ${String(MAX_CAPACITY)} cupos por proyecto`,
    ],
  ])('rechaza una capacidad %s', (_case, capacity, message) => {
    expect(validateProjectDraft({ ...VALID, capacity }, TODAY).capacity).toBe(message);
  });

  it.each(['1', ' 7 ', String(MAX_CAPACITY)])('acepta la capacidad %j', (capacity) => {
    expect(validateProjectDraft({ ...VALID, capacity }, TODAY).capacity).toBeUndefined();
  });

  it('valida los largos sin contar espacios sobrantes', () => {
    expect(validateProjectDraft({ ...VALID, title: ' abc ' }, TODAY).title).toBeDefined();
    expect(
      validateProjectDraft({ ...VALID, title: 'a'.repeat(TITLE_MAX_LENGTH + 1) }, TODAY).title,
    ).toBeDefined();
    expect(validateProjectDraft({ ...VALID, summary: 'corto' }, TODAY).summary).toBeDefined();
    expect(
      validateProjectDraft({ ...VALID, description: 'corta' }, TODAY).description,
    ).toBeDefined();
    expect(
      validateProjectDraft({ ...VALID, description: 'a'.repeat(DESCRIPTION_MAX_LENGTH + 1) }, TODAY)
        .description,
    ).toBeDefined();
  });

  it('limita los requisitos y habilidades a pocas líneas cortas', () => {
    const tooMany = Array.from({ length: MAX_LIST_ITEMS + 1 }, (_v, i) => `Ítem ${String(i)}`).join(
      '\n',
    );
    expect(
      validateProjectDraft({ ...VALID, requirements: tooMany }, TODAY).requirements,
    ).toBeDefined();
    expect(validateProjectDraft({ ...VALID, skills: 'x'.repeat(101) }, TODAY).skills).toBeDefined();
  });

  it('la fecha límite puede ser hoy pero no un día pasado', () => {
    expect(
      validateProjectDraft({ ...VALID, closesAt: '2026-09-23' }, TODAY).closesAt,
    ).toBeUndefined();
    expect(validateProjectDraft({ ...VALID, closesAt: '2026-09-22' }, TODAY).closesAt).toBe(
      'La fecha límite no puede ser anterior a hoy',
    );
    expect(validateProjectDraft({ ...VALID, closesAt: '2026-02-30' }, TODAY).closesAt).toBe(
      'Elige la fecha límite para postularse',
    );
  });
});

describe('borrador → contrato del API', () => {
  it('separa párrafos y líneas, recorta espacios y cierra al final del día elegido', () => {
    const body = draftToNewProject({
      ...VALID,
      title: '  Piloto  ',
      capacity: ' 5 ',
      description: 'Primer párrafo.\n\n  Segundo párrafo.  \n\n\n',
      requirements: ' SQL \n\n Python ',
      skills: '',
    });
    expect(body).toMatchObject({
      title: 'Piloto',
      capacity: 5,
      description: ['Primer párrafo.', 'Segundo párrafo.'],
      requirements: ['SQL', 'Python'],
      skills: [],
    });
    expect(new Date(body.closesAt)).toEqual(new Date(2026, 9, 15, 23, 59, 59));
  });

  it('interpreta texto libre', () => {
    expect(parseCapacity('abc')).toBeNull();
    expect(splitParagraphs('a\nb\n\nc')).toEqual(['a\nb', 'c']);
    expect(splitLines('a\n\n b ')).toEqual(['a', 'b']);
  });
});
