/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_Delete_BodyInputs */



/**
* | output |
* | --- |
* | "The entry, its stock and its history will be permanently deleted." |
*
* @param {Wine_Delete_BodyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_delete_body = /** @type {((inputs?: Wine_Delete_BodyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Delete_BodyInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The entry, its stock and its history will be permanently deleted.")
	return /** @type {LocalizedString} */ ("La fiche, son stock et son historique seront supprimés définitivement.")
});