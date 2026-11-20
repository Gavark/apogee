/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_Not_LabelInputs */



/**
* | output |
* | --- |
* | "That is not a wine label. Enter the wine yourself, the photo is kept." |
*
* @param {Add_Ai_Not_LabelInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_not_label = /** @type {((inputs?: Add_Ai_Not_LabelInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Not_LabelInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("That is not a wine label. Enter the wine yourself, the photo is kept.")
	return /** @type {LocalizedString} */ ("Ce n'est pas une étiquette de vin. Saisissez le vin, la photo est gardée.")
});