/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Loc_Toast_DeletedInputs */



/**
* | output |
* | --- |
* | "Location deleted." |
*
* @param {Loc_Toast_DeletedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const loc_toast_deleted = /** @type {((inputs?: Loc_Toast_DeletedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Loc_Toast_DeletedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Location deleted.")
	return /** @type {LocalizedString} */ ("Lieu supprimé.")
});