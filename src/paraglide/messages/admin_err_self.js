/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Err_SelfInputs */



/**
* | output |
* | --- |
* | "You can't delete your own account." |
*
* @param {Admin_Err_SelfInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_err_self = /** @type {((inputs?: Admin_Err_SelfInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Err_SelfInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("You can't delete your own account.")
	return /** @type {LocalizedString} */ ("Vous ne pouvez pas supprimer votre propre compte.")
});