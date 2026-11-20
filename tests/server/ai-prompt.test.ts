import { describe, it, expect } from 'vitest';
import { buildLabelPrompt } from '$lib/server/ai/prompt';

const base = { hints: null, locale: 'fr' as const, currentYear: 2026, hasImage: true };

describe('buildLabelPrompt', () => {
  it('rationale demandée en français / en anglais selon la locale', () => {
    expect(buildLabelPrompt({ ...base, locale: 'fr' }).system).toMatch(/en français/i);
    const en = buildLabelPrompt({ ...base, locale: 'en' }).system;
    expect(en).toMatch(/in English/i);
    expect(en).not.toMatch(/en français/i);
  });

  it("NV : l'année d'entrée en cave est donnée comme référence", () => {
    const { user } = buildLabelPrompt({ ...base, hints: { vintage: null, acquiredYear: 2024 } });
    expect(user).toContain("année d'entrée en cave : 2024");
    const v = buildLabelPrompt({ ...base, hints: { vintage: 2018, acquiredYear: 2024 } }).user;
    expect(v).not.toContain('entrée en cave');
  });

  it('sans image : demande une estimation à partir des indices', () => {
    const { user } = buildLabelPrompt({
      ...base, hasImage: false, hints: { producer: 'Chave', appellation: 'Hermitage' }
    });
    expect(user).toMatch(/estime à partir de ces informations/i);
    expect(user).toContain('Chave');
    expect(user).toContain('Hermitage');
    expect(buildLabelPrompt(base).user).not.toMatch(/estime à partir de ces informations/i);
  });

  it("le prompt utilisateur rappelle l'année courante", () => {
    expect(buildLabelPrompt(base).user).toContain('2026');
  });

  it("le prompt système exige des années absolues et de l'honnêteté, sans date variable", () => {
    const { system } = buildLabelPrompt({ ...base, currentYear: 2026 });
    expect(system).not.toMatch(/2026/);
    expect(system).toMatch(/absolu/i);
    expect(system).toContain('low');
    expect(buildLabelPrompt({ ...base, currentYear: 2031 }).system).toBe(system);
  });
});
