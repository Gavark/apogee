/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quarantine_Kind_AdjustInputs */



/**
* | output |
* | --- |
* | "Stock adjusted" |
*
* @param {Quarantine_Kind_AdjustInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const quarantine_kind_adjust = /** @type {((inputs?: Quarantine_Kind_AdjustInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quarantine_Kind_AdjustInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Stock adjusted")
	return /** @type {LocalizedString} */ ("Stock ajusté")
});