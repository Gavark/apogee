/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_Est_Error_AuthInputs */



/**
* | output |
* | --- |
* | "Access to the AI service was refused — tell the administrator." |
*
* @param {Ai_Est_Error_AuthInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const ai_est_error_auth = /** @type {((inputs?: Ai_Est_Error_AuthInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_Est_Error_AuthInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Access to the AI service was refused — tell the administrator.")
	return /** @type {LocalizedString} */ ("Accès au service d'IA refusé — prévenez l'administrateur.")
});