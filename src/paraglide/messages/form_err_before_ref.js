/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Form_Err_Before_RefInputs */



/**
* | output |
* | --- |
* | "The window cannot start before the vintage (or entry year)." |
*
* @param {Form_Err_Before_RefInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const form_err_before_ref = /** @type {((inputs?: Form_Err_Before_RefInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Form_Err_Before_RefInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The window cannot start before the vintage (or entry year).")
	return /** @type {LocalizedString} */ ("La fenêtre ne peut pas commencer avant le millésime (ou l'année d'entrée).")
});