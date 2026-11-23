/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quarantine_Kind_UnconsumeInputs */



/**
* | output |
* | --- |
* | "Bottle put back" |
*
* @param {Quarantine_Kind_UnconsumeInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const quarantine_kind_unconsume = /** @type {((inputs?: Quarantine_Kind_UnconsumeInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quarantine_Kind_UnconsumeInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Bottle put back")
	return /** @type {LocalizedString} */ ("Bouteille remise en cave")
});