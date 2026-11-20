/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_Est_Apply_ErrorInputs */



/**
* | output |
* | --- |
* | "This proposal could not be applied." |
*
* @param {Ai_Est_Apply_ErrorInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const ai_est_apply_error = /** @type {((inputs?: Ai_Est_Apply_ErrorInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_Est_Apply_ErrorInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("This proposal could not be applied.")
	return /** @type {LocalizedString} */ ("Impossible d'appliquer cette proposition.")
});