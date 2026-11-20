/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ max: NonNullable<unknown> }} Dev_Sg_Field_Vintage_ErrorInputs */



/**
* | output |
* | --- |
* | "The vintage must be between 1900 and {max}." |
*
* @param {Dev_Sg_Field_Vintage_ErrorInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_field_vintage_error = /** @type {((inputs: Dev_Sg_Field_Vintage_ErrorInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Field_Vintage_ErrorInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`The vintage must be between 1900 and ${i?.max}.`)
	return /** @type {LocalizedString} */ (`Le millésime doit être compris entre 1900 et ${i?.max}.`)
});