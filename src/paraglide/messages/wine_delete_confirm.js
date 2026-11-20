/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_Delete_ConfirmInputs */



/**
* | output |
* | --- |
* | "Delete permanently" |
*
* @param {Wine_Delete_ConfirmInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_delete_confirm = /** @type {((inputs?: Wine_Delete_ConfirmInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Delete_ConfirmInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Delete permanently")
	return /** @type {LocalizedString} */ ("Supprimer définitivement")
});