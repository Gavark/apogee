/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Test_HintInputs */



/**
* | output |
* | --- |
* | "A real call is billed by the provider, a few cents with the default model." |
*
* @param {Admin_Ai_Test_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_test_hint = /** @type {((inputs?: Admin_Ai_Test_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Test_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("A real call is billed by the provider, a few cents with the default model.")
	return /** @type {LocalizedString} */ ("Un appel réel est facturé par le fournisseur, quelques centimes avec le modèle par défaut.")
});