/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notif_Pref_Monthly_HintInputs */



/**
* | output |
* | --- |
* | "Each month, the bottles not to forget." |
*
* @param {Notif_Pref_Monthly_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_pref_monthly_hint = /** @type {((inputs?: Notif_Pref_Monthly_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Pref_Monthly_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Each month, the bottles not to forget.")
	return /** @type {LocalizedString} */ ("Chaque mois, les bouteilles à ne pas oublier.")
});