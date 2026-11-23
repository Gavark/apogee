/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quarantine_AbandonedInputs */



/**
* | output |
* | --- |
* | "Change discarded" |
*
* @param {Quarantine_AbandonedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const quarantine_abandoned = /** @type {((inputs?: Quarantine_AbandonedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quarantine_AbandonedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Change discarded")
	return /** @type {LocalizedString} */ ("Geste abandonné")
});