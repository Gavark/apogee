/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_StaleInputs */



/**
* | output |
* | --- |
* | "This analysis is no longer valid: take the photo again." |
*
* @param {Add_Ai_StaleInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_stale = /** @type {((inputs?: Add_Ai_StaleInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_StaleInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("This analysis is no longer valid: take the photo again.")
	return /** @type {LocalizedString} */ ("Cette analyse n'est plus valable : reprenez la photo.")
});