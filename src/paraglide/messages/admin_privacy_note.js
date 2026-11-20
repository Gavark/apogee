/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Privacy_NoteInputs */



/**
* | output |
* | --- |
* | "You can see households and their members, never the contents of their cellars." |
*
* @param {Admin_Privacy_NoteInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_privacy_note = /** @type {((inputs?: Admin_Privacy_NoteInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Privacy_NoteInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("You can see households and their members, never the contents of their cellars.")
	return /** @type {LocalizedString} */ ("Vous voyez les foyers et leurs membres, jamais le contenu des caves.")
});