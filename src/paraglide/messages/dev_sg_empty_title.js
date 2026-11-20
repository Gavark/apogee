/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_Empty_TitleInputs */



/**
* | output |
* | --- |
* | "Nothing to open yet" |
*
* @param {Dev_Sg_Empty_TitleInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_empty_title = /** @type {((inputs?: Dev_Sg_Empty_TitleInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Empty_TitleInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Nothing to open yet")
	return /** @type {LocalizedString} */ ("Rien à ouvrir pour l'instant")
});