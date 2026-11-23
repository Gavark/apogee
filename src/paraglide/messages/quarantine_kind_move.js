/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quarantine_Kind_MoveInputs */



/**
* | output |
* | --- |
* | "Bottle moved" |
*
* @param {Quarantine_Kind_MoveInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const quarantine_kind_move = /** @type {((inputs?: Quarantine_Kind_MoveInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quarantine_Kind_MoveInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Bottle moved")
	return /** @type {LocalizedString} */ ("Bouteille déplacée")
});