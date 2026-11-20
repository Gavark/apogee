/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Logout_Unsynced_TitleInputs */



/**
* | output |
* | --- |
* | "Unsynced changes" |
*
* @param {Logout_Unsynced_TitleInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const logout_unsynced_title = /** @type {((inputs?: Logout_Unsynced_TitleInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Logout_Unsynced_TitleInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Unsynced changes")
	return /** @type {LocalizedString} */ ("Gestes non synchronisés")
});