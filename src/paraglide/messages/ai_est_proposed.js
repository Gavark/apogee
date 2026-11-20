/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ confidence: NonNullable<unknown> }} Ai_Est_ProposedInputs */



/**
* | output |
* | --- |
* | "Proposed by AI ({confidence})" |
*
* @param {Ai_Est_ProposedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const ai_est_proposed = /** @type {((inputs: Ai_Est_ProposedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_Est_ProposedInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Proposed by AI (${i?.confidence})`)
	return /** @type {LocalizedString} */ (`Proposée par l'IA (${i?.confidence})`)
});