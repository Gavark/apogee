/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Offline_Op_FailedInputs */



/**
* | output |
* | --- |
* | "An operation could not be applied" |
*
* @param {Offline_Op_FailedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const offline_op_failed = /** @type {((inputs?: Offline_Op_FailedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Offline_Op_FailedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("An operation could not be applied")
	return /** @type {LocalizedString} */ ("Une opération n'a pas pu être appliquée")
});