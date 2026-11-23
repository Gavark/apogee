/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Offline_Op_QuarantinedInputs */



/**
* | output |
* | --- |
* | "A change could not be sent" |
*
* @param {Offline_Op_QuarantinedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const offline_op_quarantined = /** @type {((inputs?: Offline_Op_QuarantinedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Offline_Op_QuarantinedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("A change could not be sent")
	return /** @type {LocalizedString} */ ("Un geste n'a pas pu être envoyé")
});