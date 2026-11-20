import type { AnalyzeInput } from './types';

type PromptInput = Pick<AnalyzeInput, 'hints' | 'locale' | 'currentYear'> & { hasImage: boolean };

/** Stable across calls: only the user message carries the current year. */
export function buildLabelPrompt(input: PromptInput): { system: string; user: string } {
  const lang = input.locale === 'fr' ? 'en français' : 'in English';
  const system = [
    'Tu es un sommelier. Tu lis une étiquette de vin et tu estimes une fenêtre de dégustation réaliste pour une cave de particulier.',
    "Extrais l'identité du vin (producteur, cuvée, appellation, région, pays, couleur, millésime, cépages, format en cl) uniquement si elle est lisible ou raisonnablement déductible.",
    'Donne la fenêtre de dégustation en années absolues (par exemple 2028), jamais en durées relatives ("dans 5 ans").',
    "Sois honnête sur l'incertitude : mets confidence à low plutôt que d'inventer, et laisse null les champs que tu ne peux pas déterminer.",
    "Si l'image n'est pas une étiquette de vin, mets is_wine_label à false.",
    `Rédige rationale (court : une ou deux phrases) ${lang}.`,
    'Réponds uniquement avec un objet JSON conforme au schéma demandé.'
  ].join('\n');

  const h = input.hints ?? {};
  const known: string[] = [];
  if (h.producer) known.push(`producteur : ${h.producer}`);
  if (h.cuvee) known.push(`cuvée : ${h.cuvee}`);
  if (h.appellation) known.push(`appellation : ${h.appellation}`);
  if (h.color) known.push(`couleur : ${h.color}`);
  if (h.vintage != null) known.push(`millésime : ${h.vintage}`);
  if (h.formatCl != null) known.push(`format : ${h.formatCl} cl`);

  const lines = [`Année courante : ${input.currentYear}.`];
  if (known.length) lines.push(`Indices connus — ${known.join(' ; ')}.`);
  if (h.vintage == null && h.acquiredYear != null)
    lines.push(
      `Vin non millésimé, année d'entrée en cave : ${h.acquiredYear}, raisonne à partir de cette année.`
    );
  lines.push(
    input.hasImage
      ? "Analyse l'étiquette ci-jointe."
      : "Aucune image n'est fournie : estime à partir de ces informations."
  );
  return { system, user: lines.join('\n') };
}
