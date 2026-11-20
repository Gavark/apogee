/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Wine_Move_Same_HintInputs */



/**
* | output |
* | --- |
* | "Choose another location or spot: the bottle is already there." |
*
* @param {Wine_Move_Same_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const wine_move_same_hint = /** @type {((inputs?: Wine_Move_Same_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Wine_Move_Same_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Choose another location or spot: the bottle is already there.")
	return /** @type {LocalizedString} */ ("Choisissez un autre lieu ou une autre précision : la bouteille est déjà là.")
});