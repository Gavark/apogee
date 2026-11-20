/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_Est_KeepInputs */



/**
* | output |
* | --- |
* | "Keep the current one" |
*
* @param {Ai_Est_KeepInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const ai_est_keep = /** @type {((inputs?: Ai_Est_KeepInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_Est_KeepInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Keep the current one")
	return /** @type {LocalizedString} */ ("Garder l'actuelle")
});