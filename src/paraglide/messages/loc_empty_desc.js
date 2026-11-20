/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Loc_Empty_DescInputs */



/**
* | output |
* | --- |
* | "Add your first storage location to start placing bottles." |
*
* @param {Loc_Empty_DescInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const loc_empty_desc = /** @type {((inputs?: Loc_Empty_DescInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Loc_Empty_DescInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Add your first storage location to start placing bottles.")
	return /** @type {LocalizedString} */ ("Ajoutez votre premier lieu de stockage pour y ranger vos bouteilles.")
});