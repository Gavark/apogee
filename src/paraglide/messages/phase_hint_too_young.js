/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Phase_Hint_Too_YoungInputs */



/**
* | output |
* | --- |
* | "Too young: it opens from the year shown." |
*
* @param {Phase_Hint_Too_YoungInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const phase_hint_too_young = /** @type {((inputs?: Phase_Hint_Too_YoungInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Phase_Hint_Too_YoungInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Too young: it opens from the year shown.")
	return /** @type {LocalizedString} */ ("Trop jeune : il s'ouvre à partir de l'année indiquée.")
});