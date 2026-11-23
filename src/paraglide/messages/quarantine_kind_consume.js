/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quarantine_Kind_ConsumeInputs */



/**
* | output |
* | --- |
* | "Bottle drunk" |
*
* @param {Quarantine_Kind_ConsumeInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const quarantine_kind_consume = /** @type {((inputs?: Quarantine_Kind_ConsumeInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quarantine_Kind_ConsumeInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Bottle drunk")
	return /** @type {LocalizedString} */ ("Bouteille bue")
});