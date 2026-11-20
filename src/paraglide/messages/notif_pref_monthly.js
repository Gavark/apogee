/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notif_Pref_MonthlyInputs */



/**
* | output |
* | --- |
* | "Monthly reminder" |
*
* @param {Notif_Pref_MonthlyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_pref_monthly = /** @type {((inputs?: Notif_Pref_MonthlyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Pref_MonthlyInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Monthly reminder")
	return /** @type {LocalizedString} */ ("Rappel mensuel")
});