/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quarantine_Still_FailingInputs */



/**
* | output |
* | --- |
* | "Still unable to send" |
*
* @param {Quarantine_Still_FailingInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const quarantine_still_failing = /** @type {((inputs?: Quarantine_Still_FailingInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quarantine_Still_FailingInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Still unable to send")
	return /** @type {LocalizedString} */ ("Toujours impossible à envoyer")
});